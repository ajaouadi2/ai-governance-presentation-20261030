import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import {
  PDF_VERSION,
  canonicalPdfId,
  pdfById,
  pdfQuestions,
  phases,
  type PdfActor,
  type Phase,
} from '@/config/questionnaire-pdf/catalog';
import { inspectV2File } from './questionnaire-v2-evidence';
import {
  pdfAnswerSchema,
  pdfReviewInput,
  pdfFingerprint,
  pdfDecisionFingerprint,
  evaluatePdf,
  type PdfDraft,
  type PdfEvidence,
} from './questionnaire-pdf';
export class PdfError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
const uuid = z.uuid();
const rev = z.number().int().nonnegative();
const globalLocks = globalThis as unknown as { clairPdfLocks?: Map<string, Promise<void>> };
const locks = (globalLocks.clairPdfLocks ??= new Map());
async function locked<T>(key: string, fn: () => Promise<T>) {
  const prev = locks.get(key) ?? Promise.resolve();
  let release!: () => void;
  const next = new Promise<void>((r) => (release = r));
  locks.set(key, next);
  await prev;
  try {
    return await fn();
  } finally {
    release();
    if (locks.get(key) === next) locks.delete(key);
  }
}
const allowed = (actor: PdfActor, roles: PdfActor[]) => {
  if (!roles.includes(actor)) throw new PdfError(403, 'Action réservée à un autre rôle.');
};
const cleanId = (id: string) => {
  if (!uuid.safeParse(id).success) throw new PdfError(404, 'Dossier introuvable.');
  return id;
};
export class PdfStore {
  constructor(public directory = path.join(process.cwd(), 'data', 'questionnaire-pdf')) {}
  private file(id: string) {
    return path.join(this.directory, cleanId(id) + '.json');
  }
  async exists(id: string) {
    try {
      await readFile(this.file(id));
      return true;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') return false;
      throw e;
    }
  }
  async load(id: string): Promise<PdfDraft> {
    try {
      const d = JSON.parse(await readFile(this.file(id), 'utf8')) as PdfDraft;
      if (
        d.id !== id ||
        ![PDF_VERSION, '2026-10-26.pdf-questionnaire.1'].includes(d.version) ||
        !Number.isInteger(d.revision) ||
        !d.answers ||
        !d.reviews ||
        !Array.isArray(d.evidence)
      )
        throw new PdfError(409, 'Version ou format du dossier non pris en charge.');
      return d;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT')
        throw new PdfError(404, 'Dossier introuvable.');
      throw e;
    }
  }
  private async save(d: PdfDraft) {
    await mkdir(this.directory, { recursive: true });
    const tmp = this.file(d.id) + '.' + randomUUID() + '.tmp';
    await writeFile(tmp, JSON.stringify(d) + '\n', { flag: 'wx' });
    await rename(tmp, this.file(d.id));
  }
  async create(raw: unknown, actor: PdfActor) {
    allowed(actor, ['unil', 'reviewer']);
    const { title } = z.strictObject({ title: z.string().trim().min(3).max(160) }).parse(raw);
    const now = new Date().toISOString();
    const d: PdfDraft = {
      id: randomUUID(),
      version: PDF_VERSION,
      title,
      revision: 0,
      createdAt: now,
      updatedAt: now,
      archived: false,
      answers: {},
      reviews: {},
      evidence: [],
      decisions: {},
      events: [{ at: now, actor, action: 'created' }],
    };
    await this.save(d);
    return d;
  }
  async list(archived = false) {
    await mkdir(this.directory, { recursive: true });
    const names = (await readdir(this.directory)).filter(
      (n) => n.endsWith('.json') && uuid.safeParse(n.slice(0, -5)).success,
    );
    const ds = await Promise.all(names.map((n) => this.load(n.slice(0, -5))));
    return ds
      .filter((d) => d.archived === archived)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map((d) => {
        const e = evaluatePdf(d);
        return {
          id: d.id,
          title: d.title,
          version: d.version,
          revision: d.revision,
          updatedAt: d.updatedAt,
          status: e.actions.some((a) => a.kind === 'block')
            ? 'blocked'
            : e.checkpoints.find((c) => c.phase === 'deployment')!.remaining
              ? 'information'
              : 'ready',
          remaining: e.actions.length,
        };
      });
  }
  async mutate(
    id: string,
    revision: number,
    actor: PdfActor,
    action: string,
    fn: (d: PdfDraft) => Promise<void> | void,
    questionId?: string,
  ) {
    rev.parse(revision);
    return locked(this.file(id), async () => {
      const d = await this.load(id);
      if (d.revision !== revision)
        throw new PdfError(
          409,
          'Dossier modifié ailleurs. Rechargez avant de réappliquer vos changements.',
        );
      await fn(d);
      d.revision++;
      d.updatedAt = new Date().toISOString();
      d.events.push({ at: d.updatedAt, actor, action, ...(questionId ? { questionId } : {}) });
      d.events = d.events.slice(-500);
      await this.save(d);
      return d;
    });
  }
  async answer(id: string, revision: number, actor: PdfActor, raw: unknown) {
    const data = z.strictObject({ questionId: z.string(), answer: pdfAnswerSchema }).parse(raw);
    const q = pdfById.get(canonicalPdfId(data.questionId));
    if (!q) throw new PdfError(400, 'Question inconnue.');
    allowed(actor, [q.owner]);
    if (!q.choices.some((c) => c.value === data.answer.choice))
      throw new PdfError(400, 'Réponse inconnue.');
    return this.mutate(
      id,
      revision,
      actor,
      'answered',
      (d) => {
        d.answers[q.id] = data.answer;
      },
      q.id,
    );
  }
  async review(id: string, revision: number, actor: PdfActor, raw: unknown) {
    allowed(actor, ['reviewer']);
    const data = z.strictObject({ questionId: z.string(), review: pdfReviewInput }).parse(raw);
    const q = pdfById.get(canonicalPdfId(data.questionId));
    if (!q) throw new PdfError(400, 'Question inconnue.');
    return this.mutate(
      id,
      revision,
      actor,
      'reviewed',
      (d) => {
        if (data.review.status === 'exempt' && d.answers[q.id]?.choice !== 'not_applicable')
          throw new PdfError(
            400,
            'Une exemption exige la réponse non applicable et sa justification.',
          );
        if (
          data.review.resolution === 'corrected' &&
          q.choices.find((c) => c.value === d.answers[q.id]?.choice)?.signal
        )
          throw new PdfError(
            400,
            'Corrigez la réponse source avant de déclarer les faits corrigés.',
          );
        if (data.review.conditions.some((c) => c.done && !c.completionReference.trim()))
          throw new PdfError(400, 'Une condition réalisée demande une preuve de réalisation.');
        if (
          ['procedure', 'selection'].includes(q.deadline) &&
          q.choices.find((c) => c.value === d.answers[q.id]?.choice)?.signal === 'correction' &&
          data.review.conditions.some((c) => phases.indexOf(c.before) > phases.indexOf(q.deadline))
        )
          throw new PdfError(
            400,
            'Cette correction doit être résolue avant la procédure ou la sélection ; elle ne peut pas être reportée.',
          );
        d.reviews[q.id] = {
          ...data.review,
          fingerprint: pdfFingerprint(d, q.id),
          at: new Date().toISOString(),
        };
      },
      q.id,
    );
  }
  async decision(id: string, revision: number, actor: PdfActor, raw: unknown) {
    allowed(actor, ['reviewer']);
    const data = z
      .strictObject({
        phase: z.enum(phases).refine((p) => p !== 'followup'),
        decision: z.enum(['approved', 'deferred']),
        justification: z.string().trim().min(10).max(6000),
        reference: z.string().trim().min(3).max(2000),
      })
      .parse(raw);
    return this.mutate(id, revision, actor, 'decision', (d) => {
      const e = evaluatePdf(d);
      const index = phases.indexOf(data.phase);
      if (data.decision === 'approved' && index > 0) {
        const prior = d.decisions[phases[index - 1]];
        if (
          !prior ||
          prior.decision !== 'approved' ||
          prior.fingerprint !== pdfDecisionFingerprint(d)
        )
          throw new PdfError(
            409,
            'La décision du point de contrôle précédent doit être confirmée.',
          );
      }
      if (
        data.decision === 'approved' &&
        e.checkpoints.find((c) => c.phase === data.phase)!.remaining
      )
        throw new PdfError(409, 'Des actions restent à résoudre pour cette décision.');
      if (data.decision === 'approved' && data.phase === 'deployment') {
        const sign = d.decisions.signature;
        if (!sign || sign.decision !== 'approved' || sign.fingerprint !== pdfDecisionFingerprint(d))
          throw new PdfError(409, 'Une décision de signature actuelle est requise.');
      }
      d.decisions[data.phase] = {
        ...data,
        phase: data.phase as Phase,
        fingerprint: pdfDecisionFingerprint(d),
        at: new Date().toISOString(),
      };
    });
  }
  async archive(id: string, revision: number, actor: PdfActor, archived: boolean) {
    allowed(actor, ['unil', 'reviewer']);
    return this.mutate(id, revision, actor, archived ? 'archived' : 'restored', (d) => {
      d.archived = archived;
    });
  }
  async upload(
    id: string,
    revision: number,
    actor: PdfActor,
    questionId: string,
    visibility: 'internal' | 'shared',
    name: string,
    bytes: Uint8Array,
  ) {
    questionId = canonicalPdfId(questionId);
    const q = pdfById.get(questionId);
    if (!q) throw new PdfError(400, 'Question inconnue.');
    if (actor !== 'reviewer') allowed(actor, [q.owner]);
    if (actor === 'supplier' && visibility !== 'shared')
      throw new PdfError(403, 'Une pièce fournisseur doit être partagée.');
    let checked;
    try {
      checked = inspectV2File(name, bytes);
    } catch (e) {
      throw new PdfError(400, (e as Error).message);
    }
    const evidence: PdfEvidence = {
      id: randomUUID(),
      questionId,
      name: checked.name,
      mime: checked.mime,
      size: bytes.length,
      sha256: createHash('sha256').update(bytes).digest('hex'),
      visibility,
      uploadedBy: actor,
      at: new Date().toISOString(),
    };
    return this.mutate(
      id,
      revision,
      actor,
      'evidence',
      async (d) => {
        const dir = path.join(this.directory, 'attachments', cleanId(id));
        await mkdir(dir, { recursive: true });
        await writeFile(path.join(dir, evidence.id + '.bin'), bytes, { flag: 'wx' });
        d.evidence.push(evidence);
      },
      questionId,
    );
  }
  async download(id: string, evidenceId: string, actor: PdfActor) {
    cleanId(evidenceId);
    const d = await this.load(id);
    const e = d.evidence.find((e) => e.id === evidenceId);
    if (!e) throw new PdfError(404, 'Pièce introuvable.');
    if (actor === 'supplier' && e.visibility !== 'shared')
      throw new PdfError(403, 'Pièce interne.');
    const bytes = await readFile(
      path.join(this.directory, 'attachments', cleanId(id), evidenceId + '.bin'),
    );
    if (bytes.length !== e.size || createHash('sha256').update(bytes).digest('hex') !== e.sha256)
      throw new PdfError(409, 'Intégrité de la pièce non vérifiée.');
    return { evidence: e, bytes };
  }
  async reports(id: string, actor: PdfActor) {
    allowed(actor, ['unil', 'reviewer']);
    await this.load(id);
    const dir = path.join(this.directory, 'reports', cleanId(id));
    try {
      const ids = (await readdir(dir))
        .filter((n) => n.endsWith('.json') && uuid.safeParse(n.slice(0, -5)).success)
        .map((n) => n.slice(0, -5));
      const items = await Promise.all(ids.map((r) => this.report(id, r, actor)));
      return items.sort((a, b) => a.at.localeCompare(b.at)).map((r) => r.id);
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw e;
    }
  }
  async saveReport(
    id: string,
    revision: number,
    actor: PdfActor,
    locale: 'fr' | 'en',
    build: (d: PdfDraft, locale: 'fr' | 'en') => string,
  ) {
    allowed(actor, ['unil', 'reviewer']);
    return locked(this.file(id), async () => {
      const d = await this.load(id);
      if (d.revision !== revision) throw new PdfError(409, 'Le dossier a changé.');
      const reportId = randomUUID();
      const payload = JSON.stringify({
        draft: d,
        catalog: pdfQuestions,
        evaluation: evaluatePdf(d),
        html: build(d, locale),
        locale,
        version: PDF_VERSION,
        legalApproval: false,
      });
      const envelope = {
        id: reportId,
        draftId: id,
        at: new Date().toISOString(),
        payload,
        sha256: createHash('sha256').update(payload).digest('hex'),
      };
      const dir = path.join(this.directory, 'reports', cleanId(id));
      await mkdir(dir, { recursive: true });
      await writeFile(path.join(dir, reportId + '.json'), JSON.stringify(envelope), { flag: 'wx' });
      return { id: reportId, at: envelope.at };
    });
  }
  async report(id: string, reportId: string, actor: PdfActor) {
    allowed(actor, ['unil', 'reviewer']);
    cleanId(reportId);
    try {
      const e = JSON.parse(
        await readFile(
          path.join(this.directory, 'reports', cleanId(id), reportId + '.json'),
          'utf8',
        ),
      );
      if (
        e.id !== reportId ||
        e.draftId !== id ||
        typeof e.payload !== 'string' ||
        createHash('sha256').update(e.payload).digest('hex') !== e.sha256
      )
        throw new PdfError(409, 'Intégrité du rapport non vérifiée.');
      return e as { id: string; draftId: string; at: string; payload: string; sha256: string };
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT')
        throw new PdfError(404, 'Rapport introuvable.');
      throw e;
    }
  }
}
export const pdfStore = new PdfStore();
