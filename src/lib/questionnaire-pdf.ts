import { createHash } from 'node:crypto';
import { z } from 'zod';
import {
  PDF_VERSION,
  canonicalPdfId,
  pdfById,
  pdfQuestions,
  phases,
  type Phase,
  type PdfActor,
} from '@/config/questionnaire-pdf/catalog';
export const pdfAnswerSchema = z.strictObject({
  choice: z.string().max(60),
  details: z.string().max(12000),
  reference: z.string().max(2000),
});
export type PdfAnswer = z.infer<typeof pdfAnswerSchema>;
export const pdfConditionSchema = z.strictObject({
  description: z.string().trim().min(5).max(2000),
  owner: z.enum(['unil', 'supplier', 'reviewer']),
  before: z.enum(phases),
  done: z.boolean(),
  completionReference: z.string().max(2000),
});
export const pdfReviewInput = z.strictObject({
  status: z.enum(['accepted', 'needs_work', 'blocked', 'exempt']),
  justification: z.string().trim().min(10).max(6000),
  reference: z.string().trim().min(3).max(2000),
  resolution: z.enum(['none', 'corrected', 'not_applicable', 'lawful_exception']),
  conditions: z.array(pdfConditionSchema).max(12),
});
export type PdfCondition = z.infer<typeof pdfConditionSchema>;
export type PdfReview = z.infer<typeof pdfReviewInput> & { fingerprint: string; at: string };
export type PdfEvidence = {
  id: string;
  questionId: string;
  name: string;
  mime: string;
  size: number;
  sha256: string;
  visibility: 'internal' | 'shared';
  uploadedBy: PdfActor;
  at: string;
};
export type PdfDecision = {
  phase: Phase;
  decision: 'approved' | 'deferred';
  justification: string;
  reference: string;
  fingerprint: string;
  at: string;
};
export type PdfDraft = {
  id: string;
  version: typeof PDF_VERSION;
  revision: number;
  title: string;
  createdAt: string;
  updatedAt: string;
  archived: boolean;
  answers: Record<string, PdfAnswer>;
  reviews: Record<string, PdfReview>;
  evidence: PdfEvidence[];
  decisions: Partial<Record<Phase, PdfDecision>>;
  events: { at: string; actor: PdfActor; action: string; questionId?: string }[];
};
export const digest = (value: unknown) =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex');
export function pdfFingerprint(d: PdfDraft, id: string) {
  id = canonicalPdfId(id);
  const ids = [
    ...new Set([
      id,
      'E01',
      'E02',
      'E03',
      'U-D03',
      'U-A03',
      'U-A10',
      ...(id === 'P-A10' || id === 'P-D14' ? ['P-A10', 'P-D14'] : []),
      ...(id === 'P-A18' || id === 'P-C15' ? ['P-A18', 'P-C15'] : []),
      ...(id === 'P-D12' || id === 'P-C14' ? ['P-D12', 'P-C14'] : []),
    ]),
  ].sort();
  return digest({
    version: d.version,
    rules: PDF_VERSION,
    question: pdfById.get(id),
    answers: ids.map((k) => [k, d.answers[k] ?? null]),
    evidence: d.evidence
      .filter((e) => ids.includes(e.questionId))
      .map((e) => ({ ...e }))
      .sort((a, b) => a.id.localeCompare(b.id)),
  });
}
export type PdfAction = {
  questionId: string;
  kind: 'information' | 'review' | 'block' | 'signature' | 'deployment';
  before: Phase;
  owner: PdfActor;
  reason: 'answer' | 'details' | 'reference' | 'review' | 'exemption' | 'signal' | 'condition';
  description?: string;
};
export function evaluatePdf(d: PdfDraft) {
  const actions: PdfAction[] = [];
  const states = pdfQuestions.map((q) => {
    const key = canonicalPdfId(q.id);
    const a = d.answers[key];
    const r = d.reviews[key];
    const current = !!r && r.fingerprint === pdfFingerprint(d, q.id);
    const choice = q.choices.find((c) => c.value === a?.choice);
    const add = (
      kind: PdfAction['kind'],
      reason: PdfAction['reason'],
      owner: PdfActor = q.owner,
      before: Phase = q.deadline,
      description?: string,
    ) => {
      if (key === q.id)
        actions.push({ questionId: q.id, kind, reason, owner, before, description });
    };
    const exempt = current && r.status === 'exempt' && a?.choice === 'not_applicable';
    if (!a || !choice || a.choice === 'unknown') add('information', 'answer');
    else {
      if (!a.details.trim()) add('information', 'details');
      if (
        !a.reference.trim() &&
        !d.evidence.some(
          (e) => e.questionId === key && (q.owner !== 'supplier' || e.visibility === 'shared'),
        )
      )
        add('information', 'reference');
    }
    if (!current || r.status === 'needs_work') add('review', 'review', 'reviewer');
    if (current && r.status === 'blocked') add('block', 'review', 'reviewer');
    if (a?.choice === 'not_applicable' && !exempt) add('review', 'exemption', 'reviewer');
    if (
      choice?.signal === 'stop' &&
      !(
        current &&
        r.status === 'accepted' &&
        ['not_applicable', 'lawful_exception'].includes(r.resolution)
      )
    )
      add('block', 'signal', 'reviewer');
    if (
      choice?.signal === 'correction' &&
      !(current && r.status === 'accepted' && (r.resolution !== 'none' || r.conditions.length))
    )
      add(q.deadline === 'deployment' ? 'deployment' : 'signature', 'signal', 'reviewer');
    if (current && r.status === 'accepted')
      for (const condition of r.conditions)
        if (!condition.done || !condition.completionReference.trim())
          add(
            condition.before === 'deployment' ? 'deployment' : 'signature',
            'condition',
            condition.owner,
            condition.before,
            condition.description,
          );
    return {
      id: q.id,
      applicability: exempt ? 'exempt' : 'open',
      reviewCurrent: current,
      reviewStatus: current ? r.status : 'pending',
      complete: !!a && a.choice !== 'unknown' && !!a.details.trim(),
    };
  });
  const checkpoints = phases
    .filter((p) => p !== 'followup')
    .map((phase) => ({
      phase,
      remaining: actions.filter((a) => phases.indexOf(a.before) <= phases.indexOf(phase)).length,
      legalApproval: false as const,
    }));
  return { actions, questions: states, checkpoints, legalApproval: false as const };
}
export function pdfDecisionFingerprint(d: PdfDraft) {
  return digest({
    version: PDF_VERSION,
    answers: d.answers,
    evidence: d.evidence,
    reviews: d.reviews,
    title: d.title,
  });
}
export function pdfDecisionCurrent(d: PdfDraft, phase: Phase) {
  const r = d.decisions[phase];
  return !!r && r.fingerprint === pdfDecisionFingerprint(d);
}
export function projectPdf(d: PdfDraft, actor: PdfActor) {
  const all = actor !== 'supplier';
  return {
    id: d.id,
    title: d.title,
    version: d.version,
    revision: d.revision,
    archived: d.archived,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
    actor,
    answers: Object.fromEntries(
      pdfQuestions
        .filter((q) => all || q.owner === 'supplier')
        .filter((q) => !!d.answers[canonicalPdfId(q.id)])
        .map((q) => [q.id, d.answers[canonicalPdfId(q.id)]]),
    ),
    evidence: d.evidence.filter((e) => all || e.visibility === 'shared'),
    ...(all
      ? {
          reviews: Object.fromEntries(
            pdfQuestions
              .filter((q) => !!d.reviews[canonicalPdfId(q.id)])
              .map((q) => [q.id, d.reviews[canonicalPdfId(q.id)]]),
          ),
          decisions: d.decisions,
          evaluation: evaluatePdf(d),
          decisionCurrent: Object.fromEntries(phases.map((p) => [p, pdfDecisionCurrent(d, p)])),
        }
      : {}),
    legalApproval: false,
  };
}
export type PdfView = ReturnType<typeof projectPdf>;
