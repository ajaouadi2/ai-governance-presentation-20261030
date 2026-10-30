import 'server-only';
import { cookies } from 'next/headers';
import { Prisma } from '@prisma/client';
import { db } from './db';
import type { CaseView, Role } from './domain';
import { assess, visibleQuestions } from './engine';
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function session() {
  const jar = await cookies();
  const role = jar.get('clair-role')?.value;
  return {
    role: (role === 'supplier' || role === 'evaluator' ? role : 'requester') as Role,
    caseId: jar.get('clair-supplier-case')?.value,
  };
}
export function requireRole(role: Role, allowed: Role[]) {
  if (!allowed.includes(role))
    throw new HttpError(403, 'Cette action est réservée au rôle approprié.');
}
export async function loadCase(id: string): Promise<CaseView> {
  const row = await db.case.findUnique({
    where: { id },
    include: {
      vendor: true,
      answers: true,
      evidence: { orderBy: { createdAt: 'asc' } },
      reviews: true,
      scores: true,
      reports: {
        select: { id: true, version: true, createdAt: true },
        orderBy: { version: 'desc' },
      },
      events: { orderBy: { createdAt: 'desc' }, take: 100 },
    },
  });
  if (!row) throw new HttpError(404, 'Dossier introuvable.');
  const serialized = JSON.parse(JSON.stringify(row));
  return {
    ...serialized,
    answers: Object.fromEntries(row.answers.map((a) => [a.questionId, a.value])),
  } as CaseView;
}
export async function authorizedCase(id: string) {
  const s = await session();
  if (s.role === 'supplier' && s.caseId !== id)
    throw new HttpError(403, 'Ce dossier n’est pas lié au fournisseur simulé.');
  return { s, c: await loadCase(id) };
}
export async function casePayload(id: string) {
  const { s, c } = await authorizedCase(id);
  const vendorQuestionIds = visibleQuestions('vendor', c.answers).map((q) => q.id);
  const vendorControlIds = assess(c).controls.map((x) => x.id);
  if (s.role === 'supplier')
    return {
      case: {
        ...c,
        owner: '',
        department: '',
        description: '',
        answers: Object.fromEntries(
          Object.entries(c.answers).filter(([id]) => vendorQuestionIds.includes(id)),
        ),
        reviews: [],
        scores: [],
        reports: [],
        events: [],
      },
      assessment: null,
      vendorQuestionIds,
      vendorControlIds,
    };
  return { case: c, assessment: assess(c), vendorQuestionIds, vendorControlIds };
}
export function json(value: unknown, status = 200) {
  return Response.json(value, { status, headers: { 'Cache-Control': 'no-store' } });
}
export function fail(error: unknown) {
  if (error instanceof HttpError) return json({ error: error.message }, error.status);
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    ['P2034', 'P2002'].includes(error.code)
  )
    return json({ error: 'Le dossier a changé. Rechargez la page puis réessayez.' }, 409);
  console.error(error);
  return json(
    { error: 'Opération impossible. Vérifiez que PostgreSQL est démarré, puis réessayez.' },
    500,
  );
}
export async function transaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>) {
  return db.$transaction(fn, {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    timeout: 15000,
  });
}
export async function touch(tx: Prisma.TransactionClient, id: string, revision?: number) {
  const result = await tx.case.updateMany({
    where: { id, ...(revision !== undefined ? { revision } : {}) },
    data: { revision: { increment: 1 } },
  });
  if (!result.count) throw new HttpError(409, 'Le dossier a changé. Rechargez avant de continuer.');
}
export async function event(
  tx: Prisma.TransactionClient,
  caseId: string,
  actor: Role,
  action: string,
  detail: unknown,
) {
  await tx.auditEvent.create({
    data: { caseId, actor, action, detail: detail as Prisma.InputJsonValue },
  });
}
