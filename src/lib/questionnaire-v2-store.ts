import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { ANSWER_SCHEMA_VERSION, answerFieldById } from '@/config/questionnaire-v2/answer-schema';
import { WORKFLOW_VERSION, scopeDefinitions } from '@/config/questionnaire-v2/workflow';
import { validateV2AnswerPatch } from './questionnaire-v2-answers';
import {
  activeV2Fields,
  evaluateV2Workflow,
  questionReviewFingerprint,
  scopeReviewFingerprint,
  v2QuestionReviewSchema,
  v2ScopeReviewSchema,
} from './questionnaire-v2-workflow';
import { inspectV2File, v2EvidenceSchema } from './questionnaire-v2-evidence';
import {
  comparisonPlanSchema,
  storedComparisonSchema,
  comparisonFingerprint,
  evaluateV2Comparison,
  SCORING_VERSION,
} from './questionnaire-v2-scoring';
import type { V2Actor, V2Answers } from './questionnaire-v2-domain';
import type { V2Scope } from '@/config/questionnaire-v2/workflow';
import {
  buildV2Report,
  reportEnvelopeSchema,
  reportDigest,
  reportSummary,
} from './questionnaire-v2-report';

export class V2StoreError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export const draftIdSchema = z.uuid();
export const draftMetadataSchema = z.strictObject({
  title: z.string().trim().min(3).max(160),
  sharedContext: z.string().trim().max(4000),
  mode: z.enum(['unil', 'both']),
});
const storedSchema = z.strictObject({
  formatVersion: z.literal(1),
  id: draftIdSchema,
  schemaVersion: z.string(),
  workflowVersion: z.string(),
  title: z.string(),
  sharedContext: z.string(),
  mode: z.enum(['unil', 'both']),
  revision: z.number().int().nonnegative(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  answers: z.record(z.string(), z.unknown()),
  scopeReviews: z.record(z.string(), v2ScopeReviewSchema),
  questionReviews: z.record(z.string(), v2QuestionReviewSchema),
  evidence: z.array(v2EvidenceSchema).default([]),
  comparison: storedComparisonSchema.optional(),
  archived: z.boolean().optional(),
  events: z.array(
    z.strictObject({
      actor: z.enum(['unil', 'supplier', 'reviewer']),
      action: z.string(),
      ids: z.array(z.string()),
      at: z.iso.datetime(),
    }),
  ),
});
export type V2Draft = Omit<z.infer<typeof storedSchema>, 'answers'> & { answers: V2Answers };
export const scopeReviewSubmission = v2ScopeReviewSchema.omit({ fingerprint: true });
export const questionReviewSubmission = v2QuestionReviewSchema.omit({ fingerprint: true });

// One local app instance. Share the queue across Next route bundles in the same process.
const globalStore = globalThis as unknown as { clairV2Locks?: Map<string, Promise<void>> };
const locks = (globalStore.clairV2Locks ??= new Map());
async function exclusive<T>(key: string, operation: () => Promise<T>): Promise<T> {
  const previous = locks.get(key) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  locks.set(key, current);
  await previous;
  try {
    return await operation();
  } finally {
    release();
    if (locks.get(key) === current) locks.delete(key);
  }
}
function requireActor(actor: V2Actor, allowed: V2Actor[]) {
  if (!allowed.includes(actor))
    throw new V2StoreError(403, 'Cette action appartient à un autre rôle.');
}
export class V2DraftStore {
  constructor(private directory = path.join(process.cwd(), 'data', 'questionnaire-v2')) {}
  private reportFile(id: string, reportId: string) {
    this.file(id);
    if (!draftIdSchema.safeParse(reportId).success)
      throw new V2StoreError(400, 'Identifiant de rapport invalide.');
    return path.join(this.directory, 'reports', id, `${reportId}.json`);
  }
  async readReport(id: string, reportId: string, actor: V2Actor) {
    requireActor(actor, ['unil', 'reviewer']);
    const file = this.reportFile(id, reportId);
    let raw: string;
    try {
      raw = await readFile(file, 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT')
        throw new V2StoreError(404, 'Rapport introuvable dans ce dossier.');
      throw error;
    }
    let decoded: unknown;
    try {
      decoded = JSON.parse(raw);
    } catch {
      throw new V2StoreError(503, 'Rapport illisible ; fichier conservé.');
    }
    const parsed = reportEnvelopeSchema.safeParse(decoded);
    if (
      !parsed.success ||
      parsed.data.id !== reportId ||
      parsed.data.draftId !== id ||
      reportDigest(parsed.data.payload) !== parsed.data.sha256
    )
      throw new V2StoreError(503, 'Rapport invalide ou altéré ; fichier conservé.');
    return parsed.data;
  }
  async listReports(id: string, actor: V2Actor) {
    requireActor(actor, ['unil', 'reviewer']);
    this.file(id);
    let names: string[];
    try {
      names = await readdir(path.join(this.directory, 'reports', id));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw error;
    }
    const reports = await Promise.all(
      names
        .filter(
          (name) => name.endsWith('.json') && draftIdSchema.safeParse(name.slice(0, -5)).success,
        )
        .map((name) => this.readReport(id, name.slice(0, -5), actor)),
    );
    return reports.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(reportSummary);
  }
  async createReport(id: string, revision: number, actor: V2Actor, locale: 'fr' | 'en' = 'fr') {
    requireActor(actor, ['unil', 'reviewer']);
    return exclusive(this.file(id), async () => {
      const draft = await this.load(id);
      if (revision !== draft.revision)
        throw new V2StoreError(409, 'Le dossier a changé. Rechargez avant de générer le rapport.');
      const offers = draft.comparison
        ? await Promise.all(
            draft.comparison.plan.offerIds.map((key) =>
              key === id ? Promise.resolve(draft) : this.load(key),
            ),
          )
        : [];
      const report = buildV2Report(draft, offers, randomUUID(), new Date().toISOString(), locale);
      const file = this.reportFile(id, report.id);
      await mkdir(path.dirname(file), { recursive: true });
      // Append-only snapshots: no update or delete route, no overwrite of an earlier report.
      const temporary = `${file}.${randomUUID()}.tmp`;
      await writeFile(temporary, JSON.stringify(report), { flag: 'wx' });
      await rename(temporary, file);
      return reportSummary(report);
    });
  }
  private file(id: string) {
    if (!draftIdSchema.safeParse(id).success)
      throw new V2StoreError(400, 'Identifiant de brouillon invalide.');
    return path.join(this.directory, `${id}.json`);
  }
  async load(id: string): Promise<V2Draft> {
    let raw: string;
    try {
      raw = await readFile(this.file(id), 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT')
        throw new V2StoreError(404, 'Brouillon introuvable.');
      throw error;
    }
    let data: z.infer<typeof storedSchema>;
    try {
      data = storedSchema.parse(JSON.parse(raw));
    } catch {
      throw new V2StoreError(503, 'Le brouillon ne peut pas être lu. Son fichier a été conservé.');
    }
    if (data.id !== id || data.schemaVersion !== ANSWER_SCHEMA_VERSION)
      throw new V2StoreError(
        409,
        'Version de brouillon incompatible. Aucune conversion automatique.',
      );
    const answers: V2Answers = {};
    for (const actor of ['unil', 'supplier', 'reviewer'] as const) {
      const own = Object.fromEntries(
        Object.entries(data.answers).filter(([key]) => answerFieldById.get(key)?.actor === actor),
      );
      const result = validateV2AnswerPatch(
        { schemaVersion: data.schemaVersion, answers: own },
        actor,
      );
      if (!result.ok)
        throw new V2StoreError(503, 'Réponses enregistrées invalides ; fichier conservé.');
      Object.assign(answers, result.answers);
    }
    if (Object.keys(answers).length !== Object.keys(data.answers).length)
      throw new V2StoreError(409, 'Ce brouillon contient des champs d’une autre version.');
    return { ...data, answers };
  }
  private async write(draft: V2Draft) {
    await mkdir(this.directory, { recursive: true });
    const destination = this.file(draft.id);
    const temporary = `${destination}.${randomUUID()}.tmp`;
    await writeFile(temporary, `${JSON.stringify(draft)}\n`, { flag: 'wx' });
    await rename(temporary, destination);
  }
  async create(raw: unknown, actor: V2Actor) {
    requireActor(actor, ['unil', 'reviewer']);
    const parsed = draftMetadataSchema.safeParse(raw);
    if (!parsed.success) throw new V2StoreError(400, 'Titre, contexte ou parcours invalide.');
    const now = new Date().toISOString();
    const draft: V2Draft = {
      formatVersion: 1,
      id: randomUUID(),
      schemaVersion: ANSWER_SCHEMA_VERSION,
      workflowVersion: WORKFLOW_VERSION,
      ...parsed.data,
      revision: 0,
      createdAt: now,
      updatedAt: now,
      answers: {},
      scopeReviews: {},
      questionReviews: {},
      evidence: [],
      events: [{ actor, action: 'created', ids: [], at: now }],
    };
    await this.write(draft);
    return draft;
  }
  async setArchived(id: string, revision: number, actor: V2Actor, archived: boolean) {
    requireActor(actor, ['unil', 'reviewer']);
    return this.mutate(id, revision, actor, archived ? 'archived' : 'restored', [], (draft) => {
      draft.archived = archived;
    });
  }
  async list(archived = false) {
    let names: string[];
    try {
      names = await readdir(this.directory);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw error;
    }
    const rows = await Promise.all(
      names
        .filter(
          (name) => name.endsWith('.json') && draftIdSchema.safeParse(name.slice(0, -5)).success,
        )
        .map((name) => this.load(name.slice(0, -5))),
    );
    return rows
      .filter((row) => Boolean(row.archived) === archived)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map((draft) => {
        const workflow = evaluateV2Workflow(draft);
        const blocked = Object.entries(draft.questionReviews).some(
          ([id, review]) =>
            review.status === 'blocked' &&
            review.fingerprint === questionReviewFingerprint(id, draft),
        );
        return {
          id: draft.id,
          title: draft.title,
          mode: draft.mode,
          revision: draft.revision,
          updatedAt: draft.updatedAt,
          status: blocked
            ? ('blocked' as const)
            : workflow.checkpoints.deployment.status === 'ready_for_human_decision'
              ? ('ready' as const)
              : ('needs_information' as const),
        };
      });
  }
  private async mutate(
    id: string,
    revision: number,
    actor: V2Actor,
    action: string,
    ids: string[],
    operation: (draft: V2Draft) => void | Promise<void>,
  ) {
    return exclusive(this.file(id), async () => {
      const draft = await this.load(id);
      if (draft.revision !== revision)
        throw new V2StoreError(
          409,
          'Ce brouillon a changé dans une autre fenêtre. Votre saisie est conservée ; rechargez avant de reprendre.',
        );
      await operation(draft);
      draft.revision++;
      draft.updatedAt = new Date().toISOString();
      draft.workflowVersion = WORKFLOW_VERSION;
      draft.events.push({ actor, action, ids, at: draft.updatedAt });
      draft.events = draft.events.slice(-500);
      await this.write(draft);
      return draft;
    });
  }
  async updateAnswers(
    id: string,
    revision: number,
    actor: V2Actor,
    answers: unknown,
    clear: string[] = [],
  ) {
    const result = validateV2AnswerPatch({ schemaVersion: ANSWER_SCHEMA_VERSION, answers }, actor);
    if (!result.ok)
      throw new V2StoreError(
        result.issues.some((i) => i.code === 'forbidden_field') ? 403 : 400,
        result.issues.map((i) => `${i.fieldId ?? ''} : ${i.message}`).join('; '),
      );
    for (const field of clear) {
      if (answerFieldById.get(field)?.actor !== actor)
        throw new V2StoreError(403, 'Impossible d’effacer un champ appartenant à un autre rôle.');
      if (Object.hasOwn(result.answers, field))
        throw new V2StoreError(400, 'Un champ ne peut pas être renseigné et effacé ensemble.');
    }
    return this.mutate(
      id,
      revision,
      actor,
      'answers',
      [...Object.keys(result.answers), ...clear],
      (draft) => {
        Object.assign(draft.answers, result.answers);
        for (const field of clear) delete draft.answers[field];
      },
    );
  }
  async updateMetadata(id: string, revision: number, actor: V2Actor, raw: unknown) {
    requireActor(actor, ['unil', 'reviewer']);
    const parsed = draftMetadataSchema.safeParse(raw);
    if (!parsed.success) throw new V2StoreError(400, 'Métadonnées invalides.');
    return this.mutate(id, revision, actor, 'metadata', [], (draft) => {
      Object.assign(draft, parsed.data);
    });
  }
  async comparison(id: string, actor: V2Actor) {
    requireActor(actor, ['unil', 'reviewer']);
    const anchor = await this.load(id);
    const saved = anchor.comparison;
    return {
      revision: anchor.revision,
      plan: saved?.plan ?? null,
      result: saved
        ? evaluateV2Comparison(
            saved.plan,
            await Promise.all(saved.plan.offerIds.map((key) => this.load(key))),
            saved.version === SCORING_VERSION ? saved.fingerprint : undefined,
          )
        : null,
      available: await this.list(),
    };
  }
  async saveComparison(
    id: string,
    revision: number,
    actor: V2Actor,
    raw: unknown,
    expectedRevisions: Record<string, number>,
  ) {
    requireActor(actor, ['reviewer']);
    const plan = comparisonPlanSchema.parse(raw);
    if (!plan.offerIds.includes(id))
      throw new V2StoreError(400, 'Inclure le dossier courant dans la comparaison.');
    return this.mutate(
      id,
      revision,
      actor,
      'comparison-confirmed',
      plan.offerIds,
      async (draft) => {
        const offers = await Promise.all(
          plan.offerIds.map((key) => (key === id ? Promise.resolve(draft) : this.load(key))),
        );
        if (offers.some((offer) => expectedRevisions[offer.id] !== offer.revision))
          throw new V2StoreError(
            409,
            'Une offre a changé. Actualisez les résultats et réexaminez les coûts avant de confirmer.',
          );
        draft.comparison = {
          plan,
          fingerprint: comparisonFingerprint(plan, offers),
          version: SCORING_VERSION,
        };
      },
    );
  }
  async saveReview(
    id: string,
    revision: number,
    actor: V2Actor,
    kind: 'scope' | 'question',
    key: string,
    raw: unknown,
  ) {
    requireActor(actor, ['reviewer']);
    const schema = kind === 'scope' ? scopeReviewSubmission : questionReviewSubmission;
    const parsed = schema.safeParse(raw);
    if (!parsed.success)
      throw new V2StoreError(
        400,
        'Renseignez l’auteur, la justification et au moins une référence. Vérifiez les conditions.',
      );
    if (kind === 'scope' && !Object.hasOwn(scopeDefinitions, key))
      throw new V2StoreError(400, 'Parcours inconnu.');
    if (kind === 'question' && !answerFieldsForRoot(key))
      throw new V2StoreError(400, 'Question inconnue.');
    return this.mutate(id, revision, actor, 'review', [`${kind}:${key}`], (draft) => {
      const references = [
        ...parsed.data.evidenceReferences,
        ...('sourceResolution' in parsed.data
          ? (parsed.data.sourceResolution?.evidenceReferences ?? [])
          : []),
      ];
      for (const ref of references.filter((item) => item.startsWith('piece:'))) {
        if (!draft.evidence.some((file) => ref === `piece:${file.id}`))
          throw new V2StoreError(400, 'La pièce référencée n’existe pas dans ce dossier.');
      }
      if (kind === 'scope')
        draft.scopeReviews[key] = {
          ...scopeReviewSubmission.parse(raw),
          fingerprint: scopeReviewFingerprint(key as V2Scope, draft.answers, draft.evidence),
        };
      else
        draft.questionReviews[key] = {
          ...questionReviewSubmission.parse(raw),
          fingerprint: questionReviewFingerprint(key, draft),
        };
    });
  }
  async addEvidence(
    id: string,
    revision: number,
    actor: V2Actor,
    questionId: string,
    originalName: string,
    bytes: Uint8Array,
    visibility: 'internal' | 'shared',
  ) {
    requireActor(actor, ['unil', 'supplier', 'reviewer']);
    const fields = [...answerFieldById.values()].filter((field) => field.questionId === questionId);
    if (!fields.length) throw new V2StoreError(400, 'Question inconnue.');
    const supplierQuestion = fields.some((field) => field.actor === 'supplier');
    if (actor === 'supplier' && (!supplierQuestion || visibility !== 'shared'))
      throw new V2StoreError(
        403,
        'Le fournisseur peut joindre des pièces uniquement à ses questions, partagées avec l’UNIL.',
      );
    if (
      !['internal', 'shared'].includes(visibility) ||
      (visibility === 'shared' && !supplierQuestion)
    )
      throw new V2StoreError(
        400,
        'Une pièce UNIL ne peut pas être partagée depuis une question interne.',
      );
    let inspected: ReturnType<typeof inspectV2File>;
    try {
      inspected = inspectV2File(originalName, bytes);
    } catch (error) {
      throw new V2StoreError(400, (error as Error).message);
    }
    const evidence = v2EvidenceSchema.parse({
      id: randomUUID(),
      questionId,
      originalName: inspected.name,
      mime: inspected.mime,
      size: bytes.length,
      sha256: createHash('sha256').update(bytes).digest('hex'),
      uploadedBy: actor,
      visibility,
      createdAt: new Date().toISOString(),
    });
    return this.mutate(
      id,
      revision,
      actor,
      'evidence-added',
      [questionId, evidence.id],
      async (draft) => {
        if (
          !activeV2Fields(draft).some(
            (item) => item.field.questionId === questionId && item.visible,
          )
        )
          throw new V2StoreError(400, 'Cette question n’est pas active dans le parcours.');
        const folder = path.join(this.directory, 'attachments', id);
        await mkdir(folder, { recursive: true });
        // Never overwrite files or use user-supplied names as paths. Failed metadata saves
        // may leave an unreferenced file, but cannot replace an existing attachment.
        await writeFile(path.join(folder, `${evidence.id}.bin`), bytes, { flag: 'wx' });
        draft.evidence.push(evidence);
      },
    );
  }
  async downloadEvidence(id: string, evidenceId: string, actor: V2Actor) {
    requireActor(actor, ['unil', 'supplier', 'reviewer']);
    if (!draftIdSchema.safeParse(evidenceId).success)
      throw new V2StoreError(400, 'Identifiant de pièce invalide.');
    const draft = await this.load(id);
    const file = draft.evidence.find((item) => item.id === evidenceId);
    if (!file) throw new V2StoreError(404, 'Pièce introuvable dans ce dossier.');
    if (actor === 'supplier' && file.visibility !== 'shared')
      throw new V2StoreError(403, 'Cette pièce est réservée à l’UNIL et à l’évaluateur.');
    let bytes: Buffer;
    try {
      bytes = await readFile(path.join(this.directory, 'attachments', id, `${file.id}.bin`));
    } catch {
      throw new V2StoreError(
        503,
        'Le fichier est indisponible. Les réponses et références sont conservées.',
      );
    }
    if (
      bytes.length !== file.size ||
      createHash('sha256').update(bytes).digest('hex') !== file.sha256
    )
      throw new V2StoreError(409, 'Le fichier ne correspond plus à la pièce enregistrée.');
    return { file, bytes };
  }
}
function answerFieldsForRoot(id: string) {
  return [...answerFieldById.values()].some((f) => f.questionId === id);
}
export const v2DraftStore = new V2DraftStore();
