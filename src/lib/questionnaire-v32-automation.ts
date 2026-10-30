import { verificationBasis, type V32Result } from './questionnaire-v32-engine';
import { v32ReachedConditions } from './questionnaire-v32-conditions';
import type { V32BrowserDraft } from './questionnaire-v32-draft';
export const V32_AUTOMATION_VERSION = '2026-10-27.synthesis.1';
const validDate = (v: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(v) &&
  Number.isFinite(Date.parse(v + 'T00:00:00Z')) &&
  new Date(v + 'T00:00:00Z').toISOString().slice(0, 10) === v;
export { validDate as v32ValidDate };
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, canonical(v)]),
    );
  return value;
}
function token(value: unknown) {
  const s = JSON.stringify(canonical(value));
  let hash = 2166136261;
  for (let i = 0; i < s.length; i++) hash = Math.imul(hash ^ s.charCodeAt(i), 16777619);
  return V32_AUTOMATION_VERSION + ':' + (hash >>> 0) + ':' + s.length;
}
export function v32Automation(result: V32Result, draft: V32BrowserDraft) {
  const reached = Object.fromEntries(
    result.questions
      .filter(
        (q) => q.state === 'answered' && !q.id.startsWith('V32-S08') && !q.id.startsWith('V32-S09'),
      )
      .map((q) => [q.id, q.letter!]),
  );
  const basis =
    V32_AUTOMATION_VERSION + ':' + verificationBasis(reached, draft.notes, draft.supplierEvidence);
  const assessmentLinks: Record<string, string> = {
    'V32-S01-Q07/a': 'aipd',
    'V32-S01-Q07/b': 'aipd-exemption',
    'V32-S02-Q05/b': 'fria',
  };
  const conditions = v32ReachedConditions(result).map((c) => {
    const record = draft.conditionReviews?.[c.key];
    const linked = assessmentLinks[c.key];
    const specialist =
      linked && result.verificationChecks.some((v) => v.id === linked && v.status === 'confirmed');
    const complete =
      record?.resolved &&
      record.actionTaken.trim() &&
      record.reference.trim() &&
      record.checkedBy.trim() &&
      validDate(record.date);
    const state =
      c.kind === 'classification'
        ? 'classification'
        : c.kind === 'clarification-required'
          ? 'clarification'
          : specialist
            ? 'resolved'
            : complete
              ? record.basis === basis
                ? 'resolved'
                : 'stale'
              : 'open';
    return { ...c, basis, state, specialist: !!specialist, record };
  });
  const red = result.summary.some(
    (s) => !s.questionId.startsWith('V32-S08') && s.effectiveVerdict === 'NE PAS POURSUIVRE',
  );
  const incomplete = result.questions.some(
    (q) =>
      !q.id.startsWith('V32-S08') &&
      !q.id.startsWith('V32-S09') &&
      ['unanswered', 'not-reached'].includes(q.state),
  );
  const issues = result.pendingIssues.filter((c) => !['A11', 'A18'].includes(c));
  const missingChecks = result.verificationChecks.some((c) => c.status !== 'confirmed');
  const unclear = conditions.filter((c) => c.state === 'clarification');
  const open = conditions.filter((c) => ['open', 'stale'].includes(c.state));
  const proposal: 'go' | 'conditional-go' | 'no-go' | 'suspended' = red
    ? 'no-go'
    : incomplete ||
        issues.length ||
        missingChecks ||
        result.status === 'suspended' ||
        unclear.length
      ? 'suspended'
      : open.length
        ? 'conditional-go'
        : 'go';
  const reason = red
    ? 'Une réponse rouge effective impose une proposition de refus.'
    : incomplete
      ? 'Le parcours comporte encore des réponses manquantes ou non atteintes.'
      : issues.length
        ? 'Une clarification du parcours reste nécessaire.'
        : missingChecks || result.status === 'suspended'
          ? 'Une analyse ou un avis requis reste à confirmer.'
          : unclear.length
            ? 'Le critère de clôture de certaines conditions doit être précisé.'
            : open.length
              ? 'Des actions documentées restent à réaliser ou à revérifier.'
              : 'Aucun blocage ni condition ouverte détecté sur le parcours évalué.';
  const assignmentMissing = open.some(
    (c) => !c.record?.owner.trim() || !validDate(c.record?.deadline ?? ''),
  );
  const decisionBasis = token([
    basis,
    draft.notes['V32-S08-Q04'] ?? '',
    proposal,
    Object.entries(draft.conditionReviews ?? {}).sort(),
    Object.entries(draft.verifications ?? {}).sort(),
  ]);
  const d = draft.decisionRecord;
  const choiceMap = { go: 'a', 'conditional-go': 'b', 'no-go': 'c' } as const;
  const canRecordRejection = result.questions.some(
    (q) => q.id === 'V32-S08-Q04' && ['answered', 'unanswered'].includes(q.state),
  );
  const compatible =
    d &&
    (d.choice === proposal || (d.choice === 'no-go' && canRecordRejection)) &&
    (proposal !== 'suspended' || (d.choice === 'no-go' && canRecordRejection));
  const confirmed = !!(
    d &&
    compatible &&
    d.basis === decisionBasis &&
    d.name.trim() &&
    d.function.trim() &&
    validDate(d.date) &&
    d.reasons.trim() &&
    draft.answers['V32-S08-Q04'] === choiceMap[d.choice] &&
    !(d.choice === 'conditional-go' && assignmentMissing)
  );
  return {
    version: V32_AUTOMATION_VERSION,
    conditions,
    proposal,
    reason,
    basis: decisionBasis,
    assignmentMissing,
    canRecordRejection,
    decisionStatus: confirmed ? 'confirmed' : d ? 'stale' : 'unconfirmed',
    deploymentAuthorised: false as const,
  };
}
