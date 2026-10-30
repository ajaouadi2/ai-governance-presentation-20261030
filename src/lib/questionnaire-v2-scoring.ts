import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { V2Draft } from './questionnaire-v2-store';
import { evaluateV2Workflow, questionReviewFingerprint } from './questionnaire-v2-workflow';

export const SCORING_VERSION = '2026-10-25.questionnaire-v2-scoring.1';
export const comparisonPlanSchema = z.strictObject({
  offerIds: z
    .array(z.uuid())
    .min(1)
    .max(8)
    .refine((ids) => new Set(ids).size === ids.length),
  scope: z.string().trim().min(10).max(2000),
  currency: z
    .string()
    .trim()
    .regex(/^[A-Z]{3}$/),
  reviewer: z.string().trim().min(2).max(160),
  justification: z.string().trim().min(10).max(4000),
  confirmed: z.literal(true),
});
export type ComparisonPlan = z.infer<typeof comparisonPlanSchema>;
export const storedComparisonSchema = z.strictObject({
  plan: comparisonPlanSchema,
  fingerprint: z.string(),
  version: z.string(),
});
const known = (draft: V2Draft, key: string) => {
  const answer = draft.answers[key];
  return answer?.state === 'known' ? answer.value : undefined;
};
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object')
    return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, v]) => `${JSON.stringify(key)}:${canonical(v)}`)
      .join(',')}}`;
  return JSON.stringify(value) ?? 'null';
}
export function comparisonFingerprint(plan: ComparisonPlan, drafts: V2Draft[]) {
  return createHash('sha256')
    .update(
      canonical({
        version: SCORING_VERSION,
        plan,
        offers: drafts.map((d) => ({
          id: d.id,
          title: d.title,
          sharedContext: d.sharedContext,
          answers: d.answers,
          evidence: d.evidence,
          questionReviews: d.questionReviews,
          scopeReviews: d.scopeReviews,
          schemaVersion: d.schemaVersion,
          workflowVersion: d.workflowVersion,
        })),
      }),
    )
    .digest('hex');
}
export function evaluateV2Comparison(
  plan: ComparisonPlan,
  drafts: V2Draft[],
  approvedFingerprint?: string,
) {
  const fingerprint = comparisonFingerprint(plan, drafts);
  const current = approvedFingerprint === fingerprint;
  const rows = drafts.map((draft) => {
    const workflow = evaluateV2Workflow(draft);
    const reasons: string[] = [];
    if (workflow.checkpoints['supplier-selection'].status !== 'ready_for_human_decision')
      reasons.push('Prérequis de sélection non résolus.');
    for (const id of ['M16', 'M17', 'M18', 'M19']) {
      if (workflow.questions.find((q) => q.id === id)?.activation !== 'true')
        reasons.push(`${id} : question non applicable ou périmètre à clarifier.`);
      const review = draft.questionReviews[id];
      if (
        !review ||
        review.status !== 'accepted' ||
        review.fingerprint !== questionReviewFingerprint(id, draft)
      )
        reasons.push(`${id} : examen accepté et actuel requis.`);
      if (
        typeof known(draft, `${id}.evaluation`) !== 'string' ||
        !String(known(draft, `${id}.evaluation`)).trim()
      )
        reasons.push(`${id} : motivation de la note requise.`);
    }
    const test = known(draft, 'M16.response');
    const manual = known(draft, 'M16.score');
    const quality =
      test === 'no'
        ? 0
        : test === 'yes' && typeof manual === 'number' && manual >= 0 && manual <= 5
          ? manual
          : null;
    const integration =
      ({ complete: 5, partial: 3, none: 0 } as Record<string, number>)[
        String(known(draft, 'M17.response'))
      ] ?? null;
    const environment =
      ({ quantified: 5, general_statement: 2, no: 0 } as Record<string, number>)[
        String(known(draft, 'M19.response'))
      ] ?? null;
    const rawCost = known(draft, 'M18.total_cost');
    const cost =
      typeof rawCost === 'number' && Number.isFinite(rawCost) && rawCost >= 0 ? rawCost : null;
    if ([quality, integration, environment, cost].some((v) => v === null))
      reasons.push('Déclarations ou note de qualité manquantes.');
    if (String(known(draft, 'M18.currency')).trim().toUpperCase() !== plan.currency)
      reasons.push('Devise différente ou manquante ; aucune conversion automatique.');
    if (
      typeof known(draft, 'M18.cost_scope') !== 'string' ||
      !String(known(draft, 'M18.cost_scope')).trim()
    )
      reasons.push('Périmètre du coût manquant.');
    return {
      id: draft.id,
      title: draft.title,
      cost,
      costScope: known(draft, 'M18.cost_scope') ?? null,
      quality,
      integration,
      environment,
      reasons,
      price: null as number | null,
      total: null as number | null,
      rank: null as number | null,
    };
  });
  const eligible = rows.filter((row) => !row.reasons.length);
  // Incomplete offers never set the reference price. No partial roster is ranked.
  if (eligible.length) {
    const minimum = Math.min(...eligible.map((row) => row.cost!));
    for (const row of eligible) {
      row.price = minimum === 0 ? (row.cost === 0 ? 5 : 0) : (5 * minimum) / row.cost!;
      row.total =
        Math.round(
          ((row.quality! / 5) * 40 +
            (row.integration! / 5) * 15 +
            (row.price / 5) * 30 +
            (row.environment! / 5) * 15) *
            100,
        ) / 100;
    }
  }
  const ranked = current && rows.length >= 2 && eligible.length === rows.length;
  if (ranked)
    for (const row of eligible)
      row.rank = 1 + eligible.filter((other) => other.total! > row.total!).length;
  return {
    version: SCORING_VERSION,
    current,
    ranked,
    rows,
    weights: { quality: 40, integration: 15, price: 30, environment: 15 },
    legalApproval: false as const,
  };
}
