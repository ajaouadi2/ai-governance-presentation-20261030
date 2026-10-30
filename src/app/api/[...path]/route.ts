import { protectionReviewIssues } from '@/lib/data-protection';
import { scopeReviewIssues } from '@/lib/legal-scope';
import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { mkdir, readFile, writeFile, unlink } from 'node:fs/promises';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import {
  authorizedCase,
  casePayload,
  event,
  fail,
  HttpError,
  json,
  loadCase,
  requireRole,
  session,
  touch,
  transaction,
} from '@/lib/server';
import {
  answered,
  assess,
  controlFingerprint,
  effectiveAnswers,
  missingQuestions,
  visibleQuestions,
} from '@/lib/engine';
import {
  CONFIG_VERSION,
  DISCLAIMER,
  questions,
  RULE_SUMMARY,
  scoringCriteria,
  sources,
} from '@/config/assessment';
import { reviewStatuses, type ReportSnapshot } from '@/lib/domain';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const evidenceDir = () => path.join(process.cwd(), 'data', 'evidence');
const caseSchema = z.object({
  title: z.string().trim().min(3).max(160),
  department: z.string().trim().min(2).max(200),
  owner: z.string().trim().min(2).max(200),
  purpose: z.enum(['Enseignement', 'Recherche', 'Administration', 'RH', 'Autre', 'Mixte']),
  description: z.string().trim().min(10).max(8000),
  assessmentDate: z.iso.date(),
  deploymentDate: z.iso.date(),
  vendorName: z.string().trim().max(200),
  product: z.string().trim().max(200),
});
async function body<T>(req: NextRequest, schema: z.ZodType<T>): Promise<T> {
  let data: unknown;
  try {
    data = await req.json();
  } catch {
    throw new HttpError(400, 'Données JSON invalides.');
  }
  const result = schema.safeParse(data);
  if (!result.success)
    throw new HttpError(
      400,
      result.error.issues.map((i) => `${i.path.join('.')} : ${i.message}`).join(' ; '),
    );
  return result.data;
}
async function present(id: string) {
  return json(await casePayload(id));
}
function validateAnswer(id: string, value: unknown) {
  const q = questions.find((q) => q.id === id);
  if (!q) throw new HttpError(400, 'Question inconnue.');
  if (value === '') return;
  if (
    id === 'U20a' &&
    (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 1200)
  )
    throw new HttpError(400, 'U20a : durée entière entre 1 et 1200 mois attendue.');
  if (q.type === 'number') {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1e12)
      throw new HttpError(400, `${id} : nombre positif attendu.`);
  } else if (q.type === 'multi') {
    if (
      !Array.isArray(value) ||
      value.some((v) => typeof v !== 'string' || !q.options?.includes(v)) ||
      new Set(value).size !== value.length
    )
      throw new HttpError(400, `${id} : choix invalides.`);
  } else if (
    typeof value !== 'string' ||
    value.length > 12000 ||
    (q.type === 'select' && value !== '' && !q.options?.includes(value))
  )
    throw new HttpError(400, `${id} : réponse invalide.`);
}
async function handle(req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  try {
    const segments = (await context.params).path;
    const [root, id, action] = segments;
    const method = req.method;
    const origin = req.headers.get('origin');
    const requestOrigin = `${req.nextUrl.protocol}//${req.headers.get('host')}`;
    const requestHost = new URL(requestOrigin).hostname;
    const previewOrigin = process.env.CLAIR_PREVIEW_ORIGIN;
    const previewRequest =
      !!previewOrigin && req.headers.get('host') === new URL(previewOrigin).host;
    if (!['localhost', '127.0.0.1', '[::1]'].includes(requestHost) && !previewRequest)
      throw new HttpError(403, 'Application réservée à la démonstration locale.');
    if (
      !['GET', 'HEAD'].includes(method) &&
      origin &&
      origin !== requestOrigin &&
      !(previewRequest && origin === previewOrigin)
    )
      throw new HttpError(403, 'Origine de la requête non autorisée.');
    const s = await session();
    if (root === 'session' && method === 'GET') return json(s);
    if (root === 'role' && method === 'POST') {
      const data = await body(
        req,
        z.object({
          role: z.enum(['requester', 'supplier', 'evaluator']),
          caseId: z.string().optional(),
        }),
      );
      if (data.caseId) await loadCase(data.caseId);
      const jar = await cookies();
      jar.set('clair-role', data.role, { httpOnly: true, sameSite: 'strict', path: '/' });
      if (data.role === 'supplier' && data.caseId)
        jar.set('clair-supplier-case', data.caseId, {
          httpOnly: true,
          sameSite: 'strict',
          path: '/',
        });
      else jar.delete('clair-supplier-case');
      return json({ ok: true });
    }
    if (root === 'cases' && !id && method === 'GET') {
      const rows = await db.case.findMany({
        where: s.role === 'supplier' ? { id: s.caseId ?? '__none__' } : {},
        select: {
          id: true,
          title: true,
          purpose: true,
          department: true,
          updatedAt: true,
          internalSubmitted: true,
          vendorSubmitted: true,
          _count: { select: { reports: true } },
        },
        orderBy: { updatedAt: 'desc' },
      });
      return json(rows);
    }
    if (root === 'cases' && !id && method === 'POST') {
      requireRole(s.role, ['requester', 'evaluator']);
      const d = await body(req, caseSchema);
      const result = await transaction(async (tx) => {
        const c = await tx.case.create({
          data: {
            title: d.title,
            department: d.department,
            owner: d.owner,
            purpose: d.purpose,
            description: d.description,
            assessmentDate: d.assessmentDate,
            deploymentDate: d.deploymentDate,
            configVersion: CONFIG_VERSION,
            vendor: { create: { name: d.vendorName, product: d.product } },
          },
        });
        const initial = { U01: `${d.department} — ${d.owner}`, U03: d.purpose, U02: d.description };
        await tx.answer.createMany({
          data: Object.entries(initial).map(([questionId, value]) => ({
            caseId: c.id,
            questionId,
            value,
          })),
        });
        await event(tx, c.id, s.role, 'Dossier créé', { title: d.title });
        return c;
      });
      return json({ id: result.id }, 201);
    }
    if (root === 'reports' && id && method === 'GET') {
      requireRole(s.role, ['requester', 'evaluator']);
      const report = await db.report.findUnique({ where: { id } });
      if (!report) throw new HttpError(404, 'Rapport introuvable.');
      return json(report);
    }
    if (root === 'evidence' && id) {
      const e = await db.evidence.findUnique({ where: { id } });
      if (!e) throw new HttpError(404, 'Document introuvable.');
      await authorizedCase(e.caseId);
      if (method === 'GET') {
        const bytes = await readFile(path.join(evidenceDir(), e.storageName));
        return new Response(bytes, {
          headers: {
            'Content-Type': e.mime,
            'Content-Disposition': `${req.nextUrl.searchParams.has('download') ? 'attachment' : 'inline'}; filename*=UTF-8''${encodeURIComponent(e.originalName)}`,
            'X-Content-Type-Options': 'nosniff',
            'Content-Security-Policy': "default-src 'none'; sandbox",
            'Cache-Control': 'no-store',
          },
        });
      }
      if (method === 'DELETE') {
        requireRole(s.role, ['supplier', 'evaluator']);
        const c = await loadCase(e.caseId);
        await transaction(async (tx) => {
          await touch(tx, c.id, c.revision);
          await tx.evidence.delete({ where: { id } });
          await tx.case.update({ where: { id: c.id }, data: { vendorSubmitted: false } });
          await tx.score.deleteMany({ where: { caseId: c.id } });
          await event(tx, c.id, s.role, 'Justificatif retiré', {
            document: e.originalName,
            controlId: e.controlId,
          });
        });
        await unlink(path.join(evidenceDir(), e.storageName)).catch(() => {});
        return json({ ok: true });
      }
    }
    if (root === 'cases' && id) {
      const { c } = await authorizedCase(id);
      if (!action && method === 'GET') return present(id);
      if (!action && method === 'PATCH') {
        requireRole(s.role, ['requester', 'evaluator']);
        const d = await body(req, caseSchema.extend({ revision: z.number().int() }));
        await transaction(async (tx) => {
          await touch(tx, id, d.revision);
          await tx.case.update({
            where: { id },
            data: {
              title: d.title,
              department: d.department,
              owner: d.owner,
              purpose: d.purpose,
              description: d.description,
              assessmentDate: d.assessmentDate,
              deploymentDate: d.deploymentDate,
              internalSubmitted: false,
              vendorSubmitted: false,
              vendor: {
                upsert: {
                  create: { name: d.vendorName, product: d.product },
                  update: { name: d.vendorName, product: d.product },
                },
              },
            },
          });
          await tx.score.deleteMany({ where: { caseId: id } });
          await event(tx, id, s.role, 'Identification modifiée', d);
          const identityAnswers = {
            U01: `${d.department} — ${d.owner}`,
            U02: d.description,
            U03: d.purpose,
          };
          for (const [questionId, value] of Object.entries(identityAnswers))
            await tx.answer.upsert({
              where: { caseId_questionId: { caseId: id, questionId } },
              create: { caseId: id, questionId, value },
              update: { value },
            });
        });
        return present(id);
      }
      if (action === 'answers' && method === 'PUT') {
        const d = await body(
          req,
          z.object({
            audience: z.enum(['internal', 'vendor']),
            answers: z.record(
              z.string(),
              z.union([z.string().max(12000), z.number(), z.array(z.string())]),
            ),
            submit: z.boolean().default(false),
            revision: z.number().int(),
          }),
        );
        requireRole(
          s.role,
          d.audience === 'internal' ? ['requester', 'evaluator'] : ['supplier', 'evaluator'],
        );
        for (const [key, value] of Object.entries(d.answers)) {
          if (!questions.some((q) => q.id === key && q.audience === d.audience))
            throw new HttpError(400, 'Réponse hors questionnaire.');
          validateAnswer(key, value);
        }
        const merged = effectiveAnswers({ ...c.answers, ...d.answers });
        if (d.submit) {
          const missing = missingQuestions(d.audience, merged);
          if (missing.length)
            throw new HttpError(
              422,
              `Complétez les questions : ${missing.map((q) => q.id).join(', ')}.`,
            );
          if (d.audience === 'vendor' && !c.internalSubmitted)
            throw new HttpError(422, 'Le questionnaire interne doit être soumis en premier.');
        }
        const changed = JSON.stringify(merged) !== JSON.stringify(c.answers);
        await transaction(async (tx) => {
          await touch(tx, id, d.revision);
          await tx.answer.deleteMany({
            where: { caseId: id, questionId: { notIn: Object.keys(merged) } },
          });
          for (const [questionId, value] of Object.entries(merged))
            await tx.answer.upsert({
              where: { caseId_questionId: { caseId: id, questionId } },
              create: { caseId: id, questionId, value },
              update: { value },
            });
          await tx.case.update({
            where: { id },
            data: {
              ...(d.audience === 'internal'
                ? {
                    internalSubmitted: d.submit,
                    vendorSubmitted: changed ? false : c.vendorSubmitted,
                    purpose: String(merged.U03 ?? c.purpose),
                    description: String(merged.U02 ?? c.description),
                  }
                : { vendorSubmitted: d.submit }),
            },
          });
          if (changed) await tx.score.deleteMany({ where: { caseId: id } });
          await event(tx, id, s.role, d.submit ? 'Questionnaire soumis' : 'Réponses enregistrées', {
            audience: d.audience,
            changed,
            answers: d.answers,
          });
        });
        return present(id);
      }
      if (action === 'config' && method === 'POST') {
        requireRole(s.role, ['evaluator']);
        await transaction(async (tx) => {
          await touch(tx, id, c.revision);
          await tx.case.update({
            where: { id },
            data: {
              configVersion: CONFIG_VERSION,
              internalSubmitted: false,
              vendorSubmitted: false,
            },
          });
          await tx.review.deleteMany({ where: { caseId: id } });
          await tx.score.deleteMany({ where: { caseId: id } });
          await event(tx, id, s.role, 'Configuration actualisée', {
            from: c.configVersion,
            to: CONFIG_VERSION,
          });
        });
        return present(id);
      }
      if (action === 'evidence' && method === 'POST') {
        requireRole(s.role, ['supplier', 'evaluator']);
        const length = Number(req.headers.get('content-length') || 0);
        if (length > 11 * 1024 * 1024)
          throw new HttpError(413, 'Fichier trop volumineux (10 Mo maximum).');
        const data = await req.formData();
        const file = data.get('file');
        const controlId = String(data.get('controlId') || '');
        if (!(file instanceof File) || file.size === 0 || file.size > 10 * 1024 * 1024)
          throw new HttpError(400, 'Choisissez un fichier non vide de 10 Mo maximum.');
        if (!assess(c).controls.some((x) => x.id === controlId))
          throw new HttpError(400, 'Contrôle non actif.');
        const ext = path.extname(file.name).toLowerCase();
        const mimes: Record<string, string> = {
          '.pdf': 'application/pdf',
          '.txt': 'text/plain; charset=utf-8',
          '.png': 'image/png',
          '.jpg': 'image/jpeg',
          '.jpeg': 'image/jpeg',
        };
        if (!mimes[ext]) throw new HttpError(400, 'Formats acceptés : PDF, TXT, PNG, JPG.');
        const bytes = Buffer.from(await file.arrayBuffer());
        if (
          (ext === '.pdf' && !bytes.subarray(0, 5).equals(Buffer.from('%PDF-'))) ||
          (ext === '.png' &&
            !bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) ||
          (['.jpg', '.jpeg'].includes(ext) &&
            !(bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255)) ||
          (ext === '.txt' && bytes.includes(0))
        )
          throw new HttpError(400, 'Le contenu ne correspond pas au format du fichier.');
        const storageName = randomUUID() + ext;
        await mkdir(evidenceDir(), { recursive: true });
        await writeFile(path.join(evidenceDir(), storageName), bytes);
        try {
          await transaction(async (tx) => {
            await touch(tx, id, c.revision);
            await tx.evidence.create({
              data: {
                caseId: id,
                controlId,
                originalName: path.basename(file.name).slice(0, 200),
                storageName,
                mime: mimes[ext],
                size: file.size,
                uploadedBy: s.role,
              },
            });
            await tx.case.update({ where: { id }, data: { vendorSubmitted: false } });
            await tx.score.deleteMany({ where: { caseId: id } });
            await event(tx, id, s.role, 'Justificatif ajouté', { controlId, name: file.name });
          });
        } catch (error) {
          await unlink(path.join(evidenceDir(), storageName)).catch(() => {});
          throw error;
        }
        return present(id);
      }
      if (action === 'reviews' && method === 'PUT') {
        requireRole(s.role, ['evaluator']);
        const d = await body(
          req,
          z.object({
            controlId: z.string(),
            status: z.enum(reviewStatuses),
            justification: z.string().trim().min(20).max(8000),
            condition: z.string().trim().max(4000).default(''),
            prerequisite: z.boolean().default(false),
            legalConclusions: z.record(z.string(), z.string().max(50)).default({}),
            scopeOverrideReason: z.string().trim().max(4000).default(''),
            blockingType: z.enum(['LEGAL_OBLIGATION', 'PROCUREMENT_REQUIREMENT']).optional(),
            reviewer: z.string().trim().min(2).max(100),
            revision: z.number().int(),
          }),
        );
        const protectionIssues = protectionReviewIssues(d.controlId, c.answers, d.status);
        if (protectionIssues.length) throw new HttpError(422, protectionIssues.join(' '));
        const control = assess(c).controls.find((x) => x.id === d.controlId);
        if (!control) throw new HttpError(400, 'Contrôle non actif.');
        if (d.controlId === 'T02' && d.status === 'not_applicable')
          throw new HttpError(
            422,
            'La qualification doit préciser quels régimes sont applicables ou hors champ ; elle ne peut pas être écartée globalement.',
          );
        if (
          ['satisfied', 'conditional'].includes(d.status) &&
          (!control.evidenceCount ||
            control.questionIds.some(
              (q) =>
                visibleQuestions('vendor', c.answers).some((x) => x.id === q) &&
                (!answered(c.answers[q]) || ['Inconnu', 'Inconnue'].includes(String(c.answers[q]))),
            ))
        )
          throw new HttpError(
            422,
            'Complétez les réponses et joignez une preuve avant de valider ce contrôle.',
          );
        if (['conditional', 'correction'].includes(d.status) && d.condition.length < 10)
          throw new HttpError(422, 'Précisez la mesure ou condition attendue.');
        if (d.status === 'noncompliant' && !d.blockingType)
          throw new HttpError(422, 'Qualifiez le motif légal ou le critère de marché bloquant.');
        const condition = ['conditional', 'correction'].includes(d.status)
          ? `${d.prerequisite ? '[PRÉALABLE] ' : ''}${d.condition}`
          : '';
        const lawKeys = ['lprd', 'lpdVendor', 'gdprUnil', 'gdprVendor', 'aiProvider', 'aiDeployer'];
        if (
          d.controlId === 'T02' &&
          ['satisfied', 'conditional'].includes(d.status) &&
          (lawKeys.some(
            (key) => !['APPLICABLE', 'NOT_APPLICABLE'].includes(d.legalConclusions[key]),
          ) ||
            !['OUT_OF_SCOPE', 'OTHER', 'HIGH_RISK', 'PROHIBITED'].includes(
              d.legalConclusions.category,
            ))
        )
          throw new HttpError(
            422,
            'Complétez la qualification de chaque acteur et de l’usage avant de valider.',
          );
        if (d.controlId === 'T02' && ['satisfied', 'conditional'].includes(d.status)) {
          const issues = scopeReviewIssues(c.answers, d.legalConclusions, d.scopeOverrideReason);
          if (issues.length) throw new HttpError(422, issues.join(' '));
        }
        const review = {
          status: d.status,
          justification: d.justification,
          condition,
          legalConclusions:
            d.controlId === 'T02'
              ? { ...d.legalConclusions, scopeOverrideReason: d.scopeOverrideReason }
              : {},
          blockingType: d.status === 'noncompliant' ? (d.blockingType ?? '') : '',
          reviewer: d.reviewer,
          fingerprint: controlFingerprint(control, c),
          reviewedAt: new Date(),
        };
        await transaction(async (tx) => {
          await touch(tx, id, d.revision);
          await tx.review.upsert({
            where: { caseId_controlId: { caseId: id, controlId: d.controlId } },
            create: { caseId: id, controlId: d.controlId, ...review },
            update: review,
          });
          await tx.score.deleteMany({ where: { caseId: id } });
          await event(tx, id, s.role, 'Contrôle examiné', { ...d, condition });
        });
        return present(id);
      }
      if (action === 'scores' && method === 'PUT') {
        requireRole(s.role, ['evaluator']);
        const d = await body(
          req,
          z.object({
            revision: z.number().int(),
            scores: z
              .array(
                z.object({
                  criterionId: z.string(),
                  value: z.number().min(0).max(5),
                  weight: z.number().min(0).max(100),
                  justification: z.string().trim().min(10).max(3000),
                }),
              )
              .length(scoringCriteria.length),
          }),
        );
        if (!assess(c).scoringEligible)
          throw new HttpError(422, 'Les exigences préalables ne sont pas toutes validées.');
        if (
          new Set(d.scores.map((x) => x.criterionId)).size !== scoringCriteria.length ||
          d.scores.some((x) => !scoringCriteria.some((y) => y.id === x.criterionId)) ||
          Math.abs(d.scores.reduce((n, x) => n + x.weight, 0) - 100) > 0.001
        )
          throw new HttpError(400, 'Critères invalides ou pondérations différentes de 100 %.');
        await transaction(async (tx) => {
          await touch(tx, id, d.revision);
          await tx.score.deleteMany({ where: { caseId: id } });
          await tx.score.createMany({ data: d.scores.map((x) => ({ caseId: id, ...x })) });
          await event(tx, id, s.role, 'Notation enregistrée', d.scores);
        });
        return present(id);
      }
      if (action === 'reports' && method === 'POST') {
        requireRole(s.role, ['requester', 'evaluator']);
        const d = await body(req, z.object({ revision: z.number().int() }));
        const snapshot: ReportSnapshot = {
          case: c,
          assessment: assess(c),
          sources,
          questions,
          scoringDefinitions: scoringCriteria,
          disclaimer: DISCLAIMER,
          configVersion: CONFIG_VERSION,
          ruleSummary: RULE_SUMMARY,
          generatedBy: s.role,
          generatedAt: new Date().toISOString(),
        };
        const report = await transaction(async (tx) => {
          await touch(tx, id, d.revision);
          const latest = await tx.report.aggregate({
            where: { caseId: id },
            _max: { version: true },
          });
          const result = await tx.report.create({
            data: {
              caseId: id,
              version: (latest._max.version ?? 0) + 1,
              snapshot: JSON.parse(
                JSON.stringify({ ...snapshot, disclaimer: DISCLAIMER }),
              ) as Prisma.InputJsonValue,
            },
          });
          await event(tx, id, s.role, 'Rapport généré', {
            version: result.version,
            reportId: result.id,
          });
          return result;
        });
        return json({ id: report.id, version: report.version }, 201);
      }
    }
    throw new HttpError(404, 'Route introuvable.');
  } catch (error) {
    return fail(error);
  }
}
export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
