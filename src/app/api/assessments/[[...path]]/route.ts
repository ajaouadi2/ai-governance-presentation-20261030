import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { pdfStore, PdfError } from '@/lib/questionnaire-pdf-store';
import { projectPdf } from '@/lib/questionnaire-pdf';
import { buildPdfReport } from '@/lib/questionnaire-pdf-report';
import type { PdfActor } from '@/config/questionnaire-pdf/catalog';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const json = (data: unknown, status = 200) =>
  Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
function originCheck(req: NextRequest) {
  const host = req.headers.get('host') ?? '';
  let hostname: string;
  const origin = `${req.nextUrl.protocol}//${host}`;
  try {
    hostname = new URL(origin).hostname;
  } catch {
    throw new PdfError(403, 'Hôte non autorisé.');
  }
  if (
    !['localhost', '127.0.0.1', '[::1]'].includes(hostname) &&
    origin !== process.env.CLAIR_PREVIEW_ORIGIN
  )
    throw new PdfError(403, 'Adresse de démonstration non autorisée.');
  if (req.method !== 'GET' && req.headers.get('origin') && req.headers.get('origin') !== origin)
    throw new PdfError(403, 'Origine non autorisée.');
}
async function body(req: NextRequest) {
  const text = await req.text();
  if (Buffer.byteLength(text) > 512 * 1024) throw new PdfError(413, 'Requête trop volumineuse.');
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new PdfError(400, 'JSON invalide.');
  }
}
async function handle(req: NextRequest, context: { params: Promise<{ path?: string[] }> }) {
  try {
    originCheck(req);
    const parts = (await context.params).path ?? [];
    const jar = await cookies();
    const role = jar.get('clair-pdf-actor')?.value;
    const actor: PdfActor = role === 'supplier' || role === 'reviewer' ? role : 'unil';
    const bound = jar.get('clair-pdf-draft')?.value;
    if (parts[0] === 'session' && parts.length === 1 && req.method === 'POST') {
      const s = z
        .strictObject({
          actor: z.enum(['unil', 'supplier', 'reviewer']),
          draftId: z.uuid().optional(),
        })
        .parse(await body(req));
      if (actor === 'supplier' && s.draftId && s.draftId !== bound)
        throw new PdfError(403, 'Dossier fournisseur non lié.');
      const id = s.draftId ?? bound;
      if (id) await pdfStore.load(id);
      if (s.actor === 'supplier' && !id)
        throw new PdfError(403, 'Ouvrez un dossier avant de choisir Fournisseur.');
      jar.set('clair-pdf-actor', s.actor, { httpOnly: true, sameSite: 'strict', path: '/' });
      if (id) jar.set('clair-pdf-draft', id, { httpOnly: true, sameSite: 'strict', path: '/' });
      return json({ actor: s.actor });
    }
    if (!parts.length) {
      if (req.method === 'GET') {
        if (actor === 'supplier') {
          const d = bound ? await pdfStore.load(bound) : null;
          return json({
            actor,
            drafts: d
              ? [
                  {
                    id: d.id,
                    title: d.title,
                    version: d.version,
                    revision: d.revision,
                    updatedAt: d.updatedAt,
                    status: 'supplier',
                    remaining: 0,
                  },
                ]
              : [],
          });
        }
        return json({
          actor,
          drafts: await pdfStore.list(req.nextUrl.searchParams.get('archived') === '1'),
        });
      }
      if (req.method === 'POST') {
        const d = await pdfStore.create(await body(req), actor);
        jar.set('clair-pdf-draft', d.id, { httpOnly: true, sameSite: 'strict', path: '/' });
        return json(projectPdf(d, actor), 201);
      }
    }
    const [id, action, item] = parts;
    if (!z.uuid().safeParse(id).success || parts.length > 3)
      throw new PdfError(404, 'Page introuvable.');
    if (actor === 'supplier' && id !== bound)
      throw new PdfError(403, 'Ce dossier n’est pas lié au fournisseur.');
    if (action === 'evidence' && item && req.method === 'GET') {
      const { evidence: e, bytes } = await pdfStore.download(id, item, actor);
      return new Response(bytes, {
        headers: {
          'Content-Type': e.mime,
          'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(e.name).replace(/'/g, '%27')}`,
          'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff',
        },
      });
    }
    if (action === 'reports' && item && req.method === 'GET') {
      const e = await pdfStore.report(id, item, actor);
      const payload = JSON.parse(e.payload);
      const asJson = req.nextUrl.searchParams.get('format') === 'json';
      return new Response(asJson ? JSON.stringify({ ...e, payload }, null, 2) : payload.html, {
        headers: {
          'Content-Type': asJson ? 'application/json' : 'text/html; charset=utf-8',
          'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff',
          'Content-Security-Policy':
            "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'self'; sandbox allow-modals",
        },
      });
    }
    if (!action && req.method === 'GET') return json(projectPdf(await pdfStore.load(id), actor));
    if (action === 'reports' && req.method === 'GET')
      return json({ reports: await pdfStore.reports(id, actor) });
    if (action === 'evidence' && req.method === 'POST') {
      if (!req.headers.get('content-type')?.startsWith('multipart/form-data;'))
        throw new PdfError(400, 'Formulaire attendu.');
      const reader = req.body?.getReader();
      if (!reader) throw new PdfError(400, 'Fichier absent.');
      const chunks: Uint8Array[] = [];
      let size = 0;
      for (;;) {
        const next = await reader.read();
        if (next.done) break;
        size += next.value.byteLength;
        if (size > 10 * 1024 * 1024 + 65536) {
          await reader.cancel();
          throw new PdfError(413, 'Maximum 10 Mo.');
        }
        chunks.push(next.value);
      }
      const form = await new Response(new Uint8Array(Buffer.concat(chunks)), {
        headers: { 'Content-Type': req.headers.get('content-type')! },
      }).formData();
      const allowed = ['file', 'revision', 'questionId', 'visibility'];
      if (
        [...form.keys()].some((k) => !allowed.includes(k)) ||
        allowed.some((k) => form.getAll(k).length !== 1)
      )
        throw new PdfError(400, 'Formulaire invalide.');
      const file = form.get('file');
      if (!(file instanceof File) || file.size > 10 * 1024 * 1024)
        throw new PdfError(400, 'Fichier invalide.');
      const metadata = z
        .strictObject({
          revision: z.coerce.number().int().nonnegative(),
          questionId: z.string().min(1).max(40),
          visibility: z.enum(['internal', 'shared']),
        })
        .parse({
          revision: form.get('revision'),
          questionId: form.get('questionId'),
          visibility: form.get('visibility'),
        });
      return json(
        projectPdf(
          await pdfStore.upload(
            id,
            metadata.revision,
            actor,
            metadata.questionId,
            metadata.visibility,
            file.name,
            new Uint8Array(await file.arrayBuffer()),
          ),
          actor,
        ),
      );
    }
    if (req.method === 'POST') {
      const raw = z.record(z.string(), z.unknown()).parse(await body(req));
      const revision = z.number().int().nonnegative().parse(raw.revision);
      let d;
      if (action === 'answer')
        d = await pdfStore.answer(id, revision, actor, {
          questionId: raw.questionId,
          answer: raw.answer,
        });
      else if (action === 'review')
        d = await pdfStore.review(id, revision, actor, {
          questionId: raw.questionId,
          review: raw.review,
        });
      else if (action === 'decision')
        d = await pdfStore.decision(id, revision, actor, {
          phase: raw.phase,
          decision: raw.decision,
          justification: raw.justification,
          reference: raw.reference,
        });
      else if (action === 'archive')
        d = await pdfStore.archive(id, revision, actor, z.boolean().parse(raw.archived));
      else if (action === 'reports') {
        const locale = jar.get('clair-language')?.value === 'en' ? 'en' : 'fr';
        return json(await pdfStore.saveReport(id, revision, actor, locale, buildPdfReport), 201);
      } else throw new PdfError(404, 'Action introuvable.');
      return json(projectPdf(d, actor));
    }
    throw new PdfError(404, 'Page introuvable.');
  } catch (e) {
    if (e instanceof PdfError) return json({ error: e.message }, e.status);
    if (e instanceof z.ZodError) return json({ error: 'Champs invalides.' }, 400);
    console.error('PDF questionnaire API', e instanceof Error ? e.message : 'unknown');
    return json({ error: 'Opération impossible. Réessayez ou rechargez le dossier.' }, 500);
  }
}
export { handle as GET, handle as POST };
