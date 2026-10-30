import { v32Automation } from './questionnaire-v32-automation';
import { randomUUID, createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { emptyV32Draft, v32DraftSchema } from './questionnaire-v32-draft';
import { evaluateV32 } from './questionnaire-v32-engine';
import { mergeV32Contribution, v32Handover, type V32Actor } from './questionnaire-v32-roles';
const titleSchema = z.string().trim().min(3).max(160);
const documentSchema = z.strictObject({
  id: z.uuid(),
  format: z.literal('clair-v32-server.1'),
  title: titleSchema,
  revision: z.number().int().nonnegative(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  draft: v32DraftSchema,
});
export type V32Document = z.infer<typeof documentSchema>;
export class V32StoreError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
const globalLocks = globalThis as unknown as { v32Locks?: Map<string, Promise<void>> };
const locks = (globalLocks.v32Locks ??= new Map());
async function lock<T>(key: string, fn: () => Promise<T>) {
  const prior = locks.get(key) ?? Promise.resolve();
  let release!: () => void;
  const next = new Promise<void>((r) => (release = r));
  locks.set(key, next);
  await prior;
  try {
    return await fn();
  } finally {
    release();
    if (locks.get(key) === next) locks.delete(key);
  }
}
export class V32Store {
  constructor(
    public directory = process.env.CLAIR_V32_DATA_DIR ||
      path.join(process.cwd(), 'data', 'questionnaire-v32'),
  ) {}
  private file(id: string) {
    if (!z.uuid().safeParse(id).success) throw new V32StoreError(404, 'Dossier v3.2 introuvable.');
    return path.join(this.directory, id + '.json');
  }
  async load(id: string): Promise<V32Document> {
    try {
      const d = documentSchema.parse(JSON.parse(await readFile(this.file(id), 'utf8')));
      if (d.id !== id) throw new V32StoreError(409, 'Identifiant incohérent.');
      return d;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT')
        throw new V32StoreError(404, 'Dossier v3.2 introuvable.');
      throw e;
    }
  }
  private async archivedIds(): Promise<string[]> {
    try {
      return z
        .array(z.uuid())
        .parse(JSON.parse(await readFile(path.join(this.directory, 'archived.json'), 'utf8')));
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw e;
    }
  }
  async setArchived(id: string, archived: boolean) {
    await this.load(id);
    const file = path.join(this.directory, 'archived.json');
    return lock(file, async () => {
      const ids = new Set(await this.archivedIds());
      if (archived) ids.add(id);
      else ids.delete(id);
      const temp = file + '.' + randomUUID() + '.tmp';
      await writeFile(temp, JSON.stringify([...ids].sort()) + '\n', { flag: 'wx' });
      await rename(temp, file);
      return { id, archived };
    });
  }
  async list(archived = false) {
    await mkdir(this.directory, { recursive: true });
    const archiveIds = new Set(await this.archivedIds());
    const names = (await readdir(this.directory)).filter(
      (n) => /^[0-9a-f-]{36}\.json$/.test(n) && archiveIds.has(n.slice(0, -5)) === archived,
    );
    const result = await Promise.all(
      names.map(async (n) => {
        const d = await this.load(n.slice(0, -5));
        const evaluation = evaluateV32(d.draft.answers, d.draft);
        const automation = v32Automation(evaluation, d.draft);
        return {
          id: d.id,
          title: d.title,
          revision: d.revision,
          updatedAt: d.updatedAt,
          answered: evaluation.questions.filter((q) => q.state === 'answered').length,
          decisionChoice:
            automation.decisionStatus === 'confirmed' ? d.draft.decisionRecord!.choice : null,
          ...v32Handover(d.draft),
          status:
            automation.decisionStatus === 'confirmed'
              ? 'decision-recorded'
              : automation.decisionStatus === 'stale'
                ? 'decision-stale'
                : automation.proposal === 'no-go'
                  ? 'no-go-proposed'
                  : evaluation.status,
        };
      }),
    );
    return result.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
  private async write(d: V32Document) {
    await mkdir(this.directory, { recursive: true });
    const temp = this.file(d.id) + '.' + randomUUID() + '.tmp';
    await writeFile(temp, JSON.stringify(d) + '\n', { flag: 'wx' });
    await rename(temp, this.file(d.id));
  }
  async create(raw: unknown, actor: V32Actor = 'unil') {
    if (actor !== 'unil') throw new V32StoreError(403, 'Espace UNIL unique : actualisez la page.');
    const input = z
      .strictObject({ title: titleSchema, draft: v32DraftSchema.optional() })
      .parse(raw);
    const now = new Date().toISOString();
    const d: V32Document = {
      id: randomUUID(),
      format: 'clair-v32-server.1',
      title: input.title,
      revision: 0,
      createdAt: now,
      updatedAt: now,
      draft: input.draft ?? emptyV32Draft(),
    };
    if (
      d.draft.decisionRecord &&
      v32Automation(evaluateV32(d.draft.answers, d.draft), d.draft).decisionStatus !== 'confirmed'
    )
      throw new V32StoreError(
        400,
        'Décision non confirmable : vérifiez les conditions, avis et informations de signature.',
      );
    await this.write(d);
    return d;
  }
  async save(id: string, raw: unknown, actor: V32Actor = 'unil') {
    const input = z
      .strictObject({
        revision: z.number().int().nonnegative(),
        title: titleSchema,
        draft: v32DraftSchema,
      })
      .parse(raw);
    return lock(this.file(id), async () => {
      const before = await this.load(id);
      if (input.revision !== before.revision)
        throw new V32StoreError(
          409,
          'Une autre personne a modifié ce dossier. Exportez vos saisies puis rechargez la version serveur ; aucun écrasement effectué.',
        );
      let merged;
      try {
        merged = mergeV32Contribution(before, input, actor);
      } catch (e) {
        throw new V32StoreError(403, (e as Error).message);
      }
      const history = path.join(this.directory, 'revisions', id);
      await mkdir(history, { recursive: true });
      if (
        merged.decisionRecord &&
        JSON.stringify(merged.decisionRecord) !== JSON.stringify(before.draft.decisionRecord) &&
        v32Automation(evaluateV32(merged.answers, merged), merged).decisionStatus !== 'confirmed'
      )
        throw new V32StoreError(
          400,
          'Décision non confirmable : vérifiez les conditions, avis et informations de signature.',
        );
      const snapshot = JSON.stringify(before) + '\n';
      const digest = createHash('sha256').update(snapshot).digest('hex');
      const revisionFile = path.join(history, String(before.revision) + '.json');
      try {
        await writeFile(revisionFile, JSON.stringify({ sha256: digest, payload: before }) + '\n', {
          flag: 'wx',
        });
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== 'EEXIST') throw e;
        const existing = JSON.parse(await readFile(revisionFile, 'utf8'));
        if (existing.sha256 !== digest)
          throw new V32StoreError(409, 'Historique de révision incohérent.');
      }
      const d: V32Document = {
        ...before,
        title: input.title,
        draft: merged,
        revision: before.revision + 1,
        updatedAt: new Date().toISOString(),
      };
      await this.write(d);
      return d;
    });
  }
}
export const v32Store = new V32Store();
