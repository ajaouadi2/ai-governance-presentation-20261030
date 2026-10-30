import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { draftIdSchema, V2StoreError, v2DraftStore } from '@/lib/questionnaire-v2-store';
import { projectV2Draft } from '@/lib/questionnaire-v2-view';
import type { V2Actor } from '@/lib/questionnaire-v2-domain';
import { V2_MAX_FILE_BYTES } from '@/lib/questionnaire-v2-evidence';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const revision = z.number().int().nonnegative();
const sessionSchema = z.strictObject({
  actor: z.enum(['unil', 'supplier', 'reviewer']),
  draftId: draftIdSchema.optional(),
});
const answerSchema = z.strictObject({
  revision,
  answers: z.record(z.string(), z.unknown()),
  clear: z.array(z.string()).max(400).default([]),
});
const reviewSchema = z.strictObject({
  revision,
  kind: z.enum(['scope', 'question']),
  key: z.string().max(80),
  review: z.unknown(),
});
const json = (data: unknown, status = 200) =>
  Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
async function session() {
  const jar = await cookies();
  const raw = jar.get('clair-v2-actor')?.value;
  return {
    actor: (raw === 'supplier' || raw === 'reviewer' ? raw : 'unil') as V2Actor,
    draftId: jar.get('clair-v2-draft')?.value,
  };
}
function checkOrigin(req: NextRequest) {
  const host = req.headers.get('host') ?? '';
  const origin = `${req.nextUrl.protocol}//${host}`;
  let hostname: string;
  try {
    hostname = new URL(origin).hostname;
  } catch {
    throw new V2StoreError(403, 'Hôte non autorisé.');
  }
  const preview = process.env.CLAIR_PREVIEW_ORIGIN;
  if (!['localhost', '127.0.0.1', '[::1]'].includes(hostname) && origin !== preview)
    throw new V2StoreError(403, 'Démonstration locale uniquement.');
  if (req.method !== 'GET' && req.headers.get('origin') && req.headers.get('origin') !== origin)
    throw new V2StoreError(403, 'Origine non autorisée.');
}
async function body(req: NextRequest) {
  const text = await req.text();
  if (new TextEncoder().encode(text).length > 5 * 1024 * 1024)
    throw new V2StoreError(413, 'Brouillon trop volumineux.');
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new V2StoreError(400, 'JSON invalide.');
  }
}
async function uploadBody(req: NextRequest) {
  if (!req.headers.get('content-type')?.startsWith('multipart/form-data;'))
    throw new V2StoreError(400, 'Formulaire de fichier attendu.');
  const max = V2_MAX_FILE_BYTES + 64 * 1024;
  const reader = req.body?.getReader();
  if (!reader) throw new V2StoreError(400, 'Fichier manquant.');
  let size = 0;
  const chunks: Uint8Array[] = [];
  for (;;) {
    const next = await reader.read();
    if (next.done) break;
    size += next.value.length;
    if (size > max) {
      await reader.cancel();
      throw new V2StoreError(413, 'Le fichier dépasse la limite de 10 Mo.');
    }
    chunks.push(next.value);
  }
  try {
    const form = await new Response(new Uint8Array(Buffer.concat(chunks)), {
      headers: { 'Content-Type': req.headers.get('content-type')! },
    }).formData();
    if (
      [...form.keys()].some(
        (key) => !['file', 'revision', 'questionId', 'visibility'].includes(key),
      ) ||
      ['file', 'revision', 'questionId', 'visibility'].some((key) => form.getAll(key).length !== 1)
    )
      throw new Error('Champs invalides');
    const file = form.get('file');
    if (!(file instanceof File) || !file.size || file.size > V2_MAX_FILE_BYTES)
      throw new V2StoreError(400, 'Choisissez un fichier entre 1 octet et 10 Mo.');
    const rawRevision = form.get('revision');
    if (
      typeof rawRevision !== 'string' ||
      !/^\d+$/.test(rawRevision) ||
      !Number.isSafeInteger(Number(rawRevision))
    )
      throw new Error('Révision invalide');
    const metadata = z
      .strictObject({
        questionId: z.string().regex(/^[A-Z]\d+[ab]?$/),
        visibility: z.enum(['internal', 'shared']),
      })
      .parse({ questionId: form.get('questionId'), visibility: form.get('visibility') });
    return { ...metadata, revision: Number(rawRevision), file };
  } catch (error) {
    if (error instanceof V2StoreError) throw error;
    throw new V2StoreError(400, 'Fichier ou formulaire invalide.');
  }
}
async function handle(req: NextRequest, context: { params: Promise<{ path?: string[] }> }) {
  try {
    checkOrigin(req);
    const parts = (await context.params).path ?? [];
    const s = await session();
    if (parts.length === 1 && parts[0] === 'archives' && req.method === 'GET') {
      if (s.actor === 'supplier')
        throw new V2StoreError(403, 'Archives réservées aux rôles internes.');
      return json({ drafts: await v2DraftStore.list(true) });
    }
    if (!parts.length && req.method === 'GET') {
      const drafts =
        s.actor === 'supplier'
          ? s.draftId
            ? [await v2DraftStore.load(s.draftId)].map(
                ({ id, title, mode, revision, updatedAt }) => ({
                  id,
                  title,
                  mode,
                  revision,
                  updatedAt,
                }),
              )
            : []
          : await v2DraftStore.list();
      return json({ actor: s.actor, boundDraftId: s.draftId ?? null, drafts });
    }
    if (parts.length === 1 && parts[0] === 'session' && req.method === 'POST') {
      const data = sessionSchema.parse(await body(req));
      if (data.draftId) {
        if (s.actor === 'supplier' && s.draftId !== data.draftId)
          throw new V2StoreError(403, 'Ce dossier n’est pas lié au fournisseur.');
        await v2DraftStore.load(data.draftId);
      }
      const boundId = data.draftId ?? s.draftId;
      if (data.actor === 'supplier' && !boundId)
        throw new V2StoreError(403, 'Ouvrez un dossier UNIL avant de passer au fournisseur.');
      const jar = await cookies();
      jar.set('clair-v2-actor', data.actor, { httpOnly: true, sameSite: 'strict', path: '/' });
      if (boundId)
        jar.set('clair-v2-draft', boundId, { httpOnly: true, sameSite: 'strict', path: '/' });
      return json({ actor: data.actor, boundDraftId: boundId ?? null });
    }
    if (!parts.length && req.method === 'POST') {
      const draft = await v2DraftStore.create(await body(req), s.actor);
      const jar = await cookies();
      jar.set('clair-v2-draft', draft.id, { httpOnly: true, sameSite: 'strict', path: '/' });
      return json(projectV2Draft(draft, s.actor), 201);
    }
    const [id, action] = parts;
    if (!draftIdSchema.safeParse(id).success || parts.length > 3)
      throw new V2StoreError(404, 'Page introuvable.');
    if (s.actor === 'supplier' && s.draftId !== id)
      throw new V2StoreError(403, 'Ce dossier n’est pas lié au fournisseur simulé.');
    if (parts.length === 3 && action === 'reports' && req.method === 'GET') {
      const report = await v2DraftStore.readReport(id, parts[2], s.actor);
      const format = req.nextUrl.searchParams.get('format') ?? 'html';
      if (!['html', 'json'].includes(format))
        throw new V2StoreError(400, 'Format de rapport inconnu.');
      const payload = JSON.parse(report.payload) as { html: string; snapshot: unknown };
      return new Response(
        format === 'html' ? payload.html : JSON.stringify({ ...report, payload }, null, 2),
        {
          headers: {
            'Content-Type':
              format === 'html' ? 'text/html; charset=utf-8' : 'application/json; charset=utf-8',
            'Content-Disposition': `${req.nextUrl.searchParams.get('download') === '1' || format === 'json' ? 'attachment' : 'inline'}; filename="evaluation-ia-v2-${report.id}.${format}"`,
            'Cache-Control': 'no-store',
            'X-Content-Type-Options': 'nosniff',
            'Content-Security-Policy':
              "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'self'; sandbox allow-modals",
          },
        },
      );
    }
    if (parts.length === 3 && action === 'evidence' && req.method === 'GET') {
      const { file, bytes } = await v2DraftStore.downloadEvidence(id, parts[2], s.actor);
      const fallback = file.originalName.replace(/[^a-zA-Z0-9._-]/g, '_');
      const encoded = encodeURIComponent(file.originalName).replace(
        /[!'()*]/g,
        (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
      );
      return new Response(new Uint8Array(bytes), {
        headers: {
          'Content-Type': file.mime,
          'Content-Disposition': `attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`,
          'Content-Length': String(bytes.length),
          'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff',
          'Content-Security-Policy': "default-src 'none'; sandbox",
        },
      });
    }
    if (parts.length > 2) throw new V2StoreError(404, 'Action introuvable.');
    if (action === 'archive' && req.method === 'POST') {
      const data = z.strictObject({ revision, archived: z.boolean() }).parse(await body(req));
      await v2DraftStore.setArchived(id, data.revision, s.actor, data.archived);
      return json({ ok: true });
    }
    if (action === 'reports' && req.method === 'GET')
      return json({ reports: await v2DraftStore.listReports(id, s.actor) });
    if (action === 'reports' && req.method === 'POST') {
      const data = z.strictObject({ revision }).parse(await body(req));
      const locale = (await cookies()).get('clair-language')?.value === 'en' ? 'en' : 'fr';
      return json(await v2DraftStore.createReport(id, data.revision, s.actor, locale), 201);
    }
    if (action === 'comparison' && req.method === 'GET')
      return json(await v2DraftStore.comparison(id, s.actor));
    if (action === 'comparison' && req.method === 'POST') {
      const data = z
        .strictObject({
          revision,
          plan: z.unknown(),
          expectedRevisions: z.record(z.uuid(), revision),
        })
        .parse(await body(req));
      await v2DraftStore.saveComparison(
        id,
        data.revision,
        s.actor,
        data.plan,
        data.expectedRevisions,
      );
      return json(await v2DraftStore.comparison(id, s.actor));
    }
    if (parts.length === 1 && req.method === 'GET')
      return json(projectV2Draft(await v2DraftStore.load(id), s.actor));
    if (req.method === 'POST' && action === 'evidence') {
      const data = await uploadBody(req);
      return json(
        projectV2Draft(
          await v2DraftStore.addEvidence(
            id,
            data.revision,
            s.actor,
            data.questionId,
            data.file.name,
            new Uint8Array(await data.file.arrayBuffer()),
            data.visibility,
          ),
          s.actor,
        ),
        201,
      );
    }
    if (req.method === 'POST' && action === 'answers') {
      const data = answerSchema.parse(await body(req));
      return json(
        projectV2Draft(
          await v2DraftStore.updateAnswers(id, data.revision, s.actor, data.answers, data.clear),
          s.actor,
        ),
      );
    }
    if (req.method === 'POST' && action === 'metadata') {
      const data = z.strictObject({ revision, metadata: z.unknown() }).parse(await body(req));
      return json(
        projectV2Draft(
          await v2DraftStore.updateMetadata(id, data.revision, s.actor, data.metadata),
          s.actor,
        ),
      );
    }
    if (req.method === 'POST' && action === 'reviews') {
      const data = reviewSchema.parse(await body(req));
      return json(
        projectV2Draft(
          await v2DraftStore.saveReview(
            id,
            data.revision,
            s.actor,
            data.kind,
            data.key,
            data.review,
          ),
          s.actor,
        ),
      );
    }
    throw new V2StoreError(404, 'Action introuvable.');
  } catch (error) {
    if (error instanceof V2StoreError) return json({ error: error.message }, error.status);
    if (error instanceof z.ZodError)
      return json(
        { error: error.issues.map((i) => `${i.path.join('.')} : ${i.message}`).join('; ') },
        400,
      );
    console.error('Questionnaire v2:', error);
    return json(
      { error: 'Enregistrement impossible. Votre saisie reste affichée ; réessayez.' },
      500,
    );
  }
}
export { handle as GET, handle as POST };
