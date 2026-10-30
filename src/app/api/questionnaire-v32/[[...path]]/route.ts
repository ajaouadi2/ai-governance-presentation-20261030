import { v32ReportStore } from '@/lib/questionnaire-v32-report';
import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { v32Store, V32StoreError } from '@/lib/questionnaire-v32-store';
import { projectV32 } from '@/lib/questionnaire-v32-roles';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const json = (body: unknown, status = 200) =>
  Response.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
  });
async function handle(req: NextRequest, ctx: { params: Promise<{ path?: string[] }> }) {
  try {
    const host = req.headers.get('host') ?? '';
    // TLS terminates at the hosting proxy; retain an exact origin allowlist.
    const allowed = [
      `http://127.0.0.1:3000`,
      `http://localhost:3000`,
      process.env.CLAIR_PREVIEW_ORIGIN,
      process.env.RENDER_EXTERNAL_URL,
    ].filter(Boolean);
    const requestOrigin = req.headers.get('origin');
    if (!allowed.some((a) => new URL(a!).host === host))
      return json({ error: 'Adresse de démonstration non autorisée.' }, 403);
    if (req.method !== 'GET' && requestOrigin && !allowed.includes(requestOrigin))
      return json({ error: 'Origine non autorisée.' }, 403);
    if (req.method !== 'GET' && requestOrigin && new URL(requestOrigin).host !== host)
      return json({ error: 'Origine différente de l’hôte.' }, 403);
    const jar = await cookies();
    const role = jar.get('clair-v32-actor')?.value ?? jar.get('clair-pdf-actor')?.value;
    const actor = 'unil' as const;
    const parts = (await ctx.params).path ?? [];
    const reportPath = parts.length >= 2 && parts[1] === 'reports' && parts.length <= 3;
    const archivePath = parts.length === 2 && parts[1] === 'archive';
    if (parts.length > 1 && !reportPath && !archivePath)
      return json({ error: 'Page introuvable.' }, 404);
    if (req.method === 'GET') {
      jar.set('clair-v32-actor', 'unil', { httpOnly: true, sameSite: 'strict', path: '/' });
      jar.delete('clair-v32-bound');
      if (parts[0] === 'session') return json({ actor });
    } else if (role === 'supplier' || role === 'reviewer') {
      return json(
        {
          error:
            'Le parcours utilise désormais un espace UNIL unique. Actualisez la page avant d’enregistrer.',
        },
        409,
      );
    }
    if (req.method === 'GET' && reportPath) {
      if (parts.length === 2) return json({ reports: await v32ReportStore.list(parts[0]) });
      const report = await v32ReportStore.load(parts[0], parts[2]);
      return new Response(report.html, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff',
          'Referrer-Policy': 'no-referrer',
          'Content-Security-Policy':
            "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'self'; base-uri 'none'; form-action 'none'",
        },
      });
    }
    if (req.method === 'GET' && archivePath) return json({ error: 'Méthode non autorisée.' }, 405);
    if (req.method === 'GET')
      return parts.length
        ? json(projectV32(await v32Store.load(parts[0]), actor))
        : json({
            drafts: await v32Store.list(req.nextUrl.searchParams.get('archived') === 'true'),
            actor,
          });
    if (req.method !== 'POST') return json({ error: 'Méthode non autorisée.' }, 405);
    // Old filtered clients must never replace the now-complete UNIL draft, even after cookie refresh.
    if (parts[0] !== 'session' && req.headers.get('x-clair-workspace') !== 'unil-3')
      return json(
        { error: 'Actualisez la page pour utiliser l’espace UNIL unique avant d’enregistrer.' },
        409,
      );
    if (Number(req.headers.get('content-length') ?? 0) > 768 * 1024)
      return json({ error: 'Requête trop volumineuse.' }, 413);
    const reader = req.body?.getReader();
    if (!reader) return json({ error: 'Corps manquant.' }, 400);
    let size = 0;
    const chunks: Uint8Array[] = [];
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 768 * 1024) {
        await reader.cancel();
        return json({ error: 'Requête trop volumineuse.' }, 413);
      }
      chunks.push(value);
    }
    let body: unknown;
    try {
      body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } catch {
      return json({ error: 'JSON invalide.' }, 400);
    }
    if (archivePath) {
      const input = z.strictObject({ archived: z.boolean() }).parse(body);
      return json(await v32Store.setArchived(parts[0], input.archived));
    }
    if (reportPath) {
      if (parts.length !== 2) return json({ error: 'Méthode non autorisée.' }, 405);
      const input = z
        .strictObject({ revision: z.number().int().nonnegative(), locale: z.enum(['fr', 'en']) })
        .parse(body);
      return json(
        { report: await v32ReportStore.create(parts[0], input.revision, input.locale) },
        201,
      );
    }
    if (parts[0] === 'session')
      return json({ error: 'Le changement de rôle est supprimé. Actualisez la page.' }, 410);
    return parts.length
      ? json(projectV32(await v32Store.save(parts[0], body, actor), actor))
      : json(projectV32(await v32Store.create(body, actor), actor), 201);
  } catch (e) {
    if (e instanceof V32StoreError) return json({ error: e.message }, e.status);
    if (e instanceof z.ZodError) return json({ error: 'Données du dossier invalides.' }, 400);
    return json({ error: 'Opération impossible. Les saisies existantes sont conservées.' }, 500);
  }
}
export { handle as GET, handle as POST };
