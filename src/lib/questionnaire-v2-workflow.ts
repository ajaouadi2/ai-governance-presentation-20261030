import catalog from '@/config/questionnaire-v2/catalog.json';
import { z } from 'zod';
import {
  ANSWER_SCHEMA_VERSION,
  answerFieldById,
  answerFields,
  questionSchemas,
} from '@/config/questionnaire-v2/answer-schema';
import {
  WORKFLOW_VERSION,
  activationScopes,
  checkpoints,
  dependencyClosure,
  evidenceClaims,
  fieldConditions,
  questionActivation,
  questionCheckpoint,
  questionConditions,
  scopeDefinitions,
  sourceSignals,
} from '@/config/questionnaire-v2/workflow';
import type {
  Activation,
  V2Checkpoint,
  V2Scope,
  V2Truth,
} from '@/config/questionnaire-v2/workflow';
import { fieldAnswerSchema } from './questionnaire-v2-answers';
import type { V2Actor, V2Answers, V2Field } from './questionnaire-v2-domain';
import type { V2Evidence } from './questionnaire-v2-evidence';

export type V2WorkflowReview = {
  status: 'accepted' | 'needs_work' | 'blocked';
  reviewer: string;
  justification: string;
  evidenceReferences: string[];
  fingerprint: string;
  sourceResolution?: {
    kind: 'not_applicable' | 'exception_approved' | 'conditioned';
    explanation: string;
    evidenceReferences: string[];
  };
  conditions?: {
    id: string;
    description: string;
    owner: V2Actor;
    before: V2Checkpoint;
    status: 'open' | 'done';
    completionReference?: string;
  }[];
};
export type V2ScopeReview = Omit<V2WorkflowReview, 'status' | 'conditions' | 'sourceResolution'> & {
  decision: 'applies' | 'does_not_apply' | 'unresolved';
};
const reviewBase = {
  reviewer: z.string().trim().min(1),
  justification: z.string().trim().min(1),
  evidenceReferences: z.array(z.string().trim().min(1)).min(1),
  fingerprint: z.string().min(1),
};
export const v2ScopeReviewSchema = z.strictObject({
  ...reviewBase,
  decision: z.enum(['applies', 'does_not_apply', 'unresolved']),
});
export const v2QuestionReviewSchema = z.strictObject({
  ...reviewBase,
  status: z.enum(['accepted', 'needs_work', 'blocked']),
  sourceResolution: z
    .strictObject({
      kind: z.enum(['not_applicable', 'exception_approved', 'conditioned']),
      explanation: z.string().trim().min(1),
      evidenceReferences: z.array(z.string().trim().min(1)).min(1),
    })
    .optional(),
  conditions: z
    .array(
      z.strictObject({
        id: z.string().trim().min(1),
        description: z.string().trim().min(1),
        owner: z.enum(['unil', 'supplier', 'reviewer']),
        before: z.enum(checkpoints),
        status: z.enum(['open', 'done']),
        completionReference: z.string().trim().min(1).optional(),
      }),
    )
    .optional(),
});
export type V2WorkflowInput = {
  answers: V2Answers;
  evidence?: V2Evidence[];
  scopeReviews?: Partial<Record<V2Scope, V2ScopeReview>>;
  questionReviews?: Record<string, V2WorkflowReview>;
};
export type V2Action = {
  id: string;
  questionId?: string;
  fieldId?: string;
  kind:
    | 'missing'
    | 'unknown'
    | 'invalid'
    | 'review'
    | 'source-followup'
    | 'contradiction'
    | 'scope-review'
    | 'condition';
  owner: V2Actor;
  before: V2Checkpoint;
  message: string;
  sourceText?: string;
};

const schemaById = new Map(questionSchemas.map((q) => [q.questionId, q]));
const unknown = 'unknown' as const;
export function andTruth(values: V2Truth[]): V2Truth {
  return values.includes('false') ? 'false' : values.includes(unknown) ? unknown : 'true';
}
function value(answers: V2Answers, id: string) {
  const field = answerFieldById.get(id);
  const answer = answers[id];
  if (
    !field ||
    !answer ||
    !fieldAnswerSchema(field).safeParse(answer).success ||
    answer.state !== 'known'
  )
    return undefined;
  return answer.value;
}
function is(answers: V2Answers, id: string, values: string[]): V2Truth {
  const v = value(answers, id);
  if (v === undefined) return unknown;
  return (
    Array.isArray(v)
      ? v.some((item) => values.includes(item))
      : typeof v === 'string' && values.includes(v)
  )
    ? 'true'
    : 'false';
}

function canonical(input: unknown): string {
  if (input === undefined) return 'null';
  if (Array.isArray(input)) return `[${input.map(canonical).join(',')}]`;
  if (input !== null && typeof input === 'object')
    return `{${Object.entries(input)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, v]) => `${JSON.stringify(key)}:${canonical(v)}`)
      .join(',')}}`;
  return JSON.stringify(input);
}
function dependencyAnswers(answers: V2Answers, roots: string[]) {
  // Full blocks: changing an example, supporting reference or reviewer answer can matter.
  return Object.fromEntries(
    answerFields
      .filter((f) => roots.includes(f.questionId))
      .map((f) => [f.id, answers[f.id] ?? null]),
  );
}

/** Deterministic comparison token, not a signature. Persist reviews only through a trusted API. */
export function scopeReviewFingerprint(
  scope: V2Scope,
  answers: V2Answers,
  evidence: V2Evidence[] = [],
): string {
  return canonical({
    version: WORKFLOW_VERSION,
    schema: ANSWER_SCHEMA_VERSION,
    sources: catalog.sources,
    scope,
    answers: dependencyAnswers(answers, scopeDefinitions[scope].dependencies),
    evidence: dependencyEvidence(evidence, scopeDefinitions[scope].dependencies),
  });
}
function currentScopeReview(input: V2WorkflowInput, name: V2Scope): V2ScopeReview | undefined {
  const parsed = v2ScopeReviewSchema.safeParse(input.scopeReviews?.[name]);
  return parsed.success &&
    parsed.data.fingerprint === scopeReviewFingerprint(name, input.answers, input.evidence)
    ? parsed.data
    : undefined;
}

function sourceTrigger(scope: V2Scope, answers: V2Answers): V2Truth {
  // Only positive source signals activate routes. A raw negative never establishes a legal exemption.
  if (scope === 'ai')
    return is(answers, 'A2.ai_screening', ['yes_documented']) === 'true' ? 'true' : unknown;
  if (scope === 'personal_data')
    return is(answers, 'I3.response', ['ordinary_personal_data', 'sensitive_biometric_profile']) ===
      'true'
      ? 'true'
      : unknown;
  if (scope === 'ordinary_data')
    return is(answers, 'I3.response', ['ordinary_personal_data']) === 'true' ? 'true' : unknown;
  if (scope === 'sensitive_data')
    return is(answers, 'I3.response', ['sensitive_biometric_profile']) === 'true'
      ? 'true'
      : unknown;
  if (scope === 'high_risk')
    return is(answers, 'N3.response', ['decision_use', 'simple_task_exception_claimed']) === 'true'
      ? 'true'
      : unknown;
  if (scope === 'procurement')
    return is(answers, 'M1.response', ['paid', 'free_with_data_use']) === 'true' ? 'true' : unknown;
  if (scope === 'new_procurement')
    return andTruth([is(answers, 'M1.response', ['paid']), is(answers, 'M2.response', ['no'])]) ===
      'true'
      ? 'true'
      : unknown;
  return is(answers, 'M4.response', [
    '150k_to_below_250k',
    '250k_to_below_350k',
    '350k_or_more',
  ]) === 'true'
    ? 'true'
    : unknown;
}

export function scopeStates(input: V2WorkflowInput): Record<V2Scope, V2Truth> {
  const states = Object.fromEntries(
    (Object.keys(scopeDefinitions) as V2Scope[]).map((name) => {
      const review = currentScopeReview(input, name);
      return [
        name,
        review?.decision === 'applies'
          ? 'true'
          : review?.decision === 'does_not_apply'
            ? 'false'
            : review?.decision === 'unresolved'
              ? unknown
              : sourceTrigger(name, input.answers),
      ];
    }),
  ) as Record<V2Scope, V2Truth>;
  // Contradictory facts cannot be used to hide whole branches, even with a stored review.
  if (states.ai === 'false' && value(input.answers, 'A2.ai_screening') === 'yes_documented')
    states.ai = unknown;
  if (
    states.personal_data === 'false' &&
    is(input.answers, 'I3.response', ['ordinary_personal_data', 'sensitive_biometric_profile']) ===
      'true'
  )
    states.personal_data = unknown;
  if (
    states.high_risk === 'false' &&
    (value(input.answers, 'T1.review_status') === 'discrepancy' ||
      (is(input.answers, 'N3.response', ['decision_use', 'simple_task_exception_claimed']) ===
        'true' &&
        value(input.answers, 'T1.review_status') !== 'consistent'))
  )
    states.high_risk = unknown;
  const amount = value(input.answers, 'M4.estimated_value');
  const bucket = value(input.answers, 'M4.response');
  if (typeof amount === 'number' && typeof bucket === 'string' && bucket !== amountBucket(amount))
    states.competition = unknown;
  return states;
}
function amountBucket(amount: number) {
  return amount < 150000
    ? 'below_150k'
    : amount < 250000
      ? '150k_to_below_250k'
      : amount < 350000
        ? '250k_to_below_350k'
        : '350k_or_more';
}
function activation(rule: Activation | undefined, scopes: Record<V2Scope, V2Truth>): V2Truth {
  if (!rule) return 'true';
  return 'scope' in rule
    ? scopes[rule.scope]
    : andTruth(rule.all.map((item) => activation(item, scopes)));
}
function questionState(id: string, scopes: Record<V2Scope, V2Truth>, answers: V2Answers): V2Truth {
  const condition = questionConditions[id];
  return andTruth([
    activation(questionActivation[id], scopes),
    condition ? is(answers, condition.fieldId, condition.values) : 'true',
  ]);
}

export function questionReviewFingerprint(questionId: string, input: V2WorkflowInput): string {
  if (!schemaById.has(questionId)) throw new Error(`Question inconnue : ${questionId}`);
  const scopes = activationScopes(questionActivation[questionId]);
  const dependencies = dependencyClosure([
    questionId,
    ...scopes.flatMap((scope) => scopeDefinitions[scope].dependencies),
  ]);
  return canonical({
    version: WORKFLOW_VERSION,
    schema: ANSWER_SCHEMA_VERSION,
    sources: catalog.sources,
    questionId,
    answers: dependencyAnswers(input.answers, dependencies),
    evidence: dependencyEvidence(input.evidence ?? [], dependencies),
    scopeReviews: Object.fromEntries(
      scopes.map((scope) => [scope, input.scopeReviews?.[scope] ?? null]),
    ),
  });
}
function acceptedReview(id: string, input: V2WorkflowInput): boolean {
  const parsed = v2QuestionReviewSchema.safeParse(input.questionReviews?.[id]);
  return (
    parsed.success &&
    parsed.data.status === 'accepted' &&
    parsed.data.fingerprint === questionReviewFingerprint(id, input)
  );
}

function dependencyEvidence(evidence: V2Evidence[], roots: string[]) {
  return evidence
    .filter((file) => roots.includes(file.questionId))
    .map((file) => ({ ...file }))
    .sort((a, b) => a.id.localeCompare(b.id));
}
function requiresEvidence(field: V2Field, input: V2WorkflowInput) {
  if (!field.id.endsWith('.evidence_reference')) return false;
  return (
    is(input.answers, `${field.questionId}.response`, evidenceClaims[field.questionId] ?? []) ===
      'true' &&
    !input.evidence?.some(
      (file) =>
        file.questionId === field.questionId &&
        (field.actor !== 'supplier' || file.visibility === 'shared'),
    )
  );
}
export function activeV2Fields(input: V2WorkflowInput) {
  const scopes = scopeStates(input);
  return answerFields.map((field) => {
    const parentState = questionState(field.questionId, scopes, input.answers);
    const condition = fieldConditions[field.id];
    const conditionState = condition
      ? is(input.answers, condition.fieldId, condition.values)
      : 'true';
    const state = andTruth([parentState, conditionState]);
    // Unknown conditions stay visible, but only confirmed conditions add new requirements.
    const scoreNeedsAnalysis =
      field.id.endsWith('.evaluation') &&
      typeof value(input.answers, `${field.questionId}.score`) === 'number';
    const required =
      field.required ||
      (!!condition && conditionState === 'true') ||
      requiresEvidence(field, input) ||
      scoreNeedsAnalysis;
    return { field, state, visible: state !== 'false', required: state !== 'false' && required };
  });
}

function scopeRelevant(name: V2Scope, states: Record<V2Scope, V2Truth>) {
  if (['ordinary_data', 'sensitive_data'].includes(name) && states.personal_data === 'false')
    return false;
  if (name === 'high_risk' && states.ai === 'false') return false;
  if (name === 'new_procurement' && states.procurement === 'false') return false;
  if (
    name === 'competition' &&
    (states.procurement === 'false' || states.new_procurement === 'false')
  )
    return false;
  return true;
}

export function evaluateV2Workflow(input: V2WorkflowInput) {
  const scopes = scopeStates(input);
  const fields = activeV2Fields(input);
  const actions: V2Action[] = [];
  for (const name of Object.keys(scopeDefinitions) as V2Scope[]) {
    if (!scopeRelevant(name, scopes)) continue;
    const review = currentScopeReview(input, name);
    if (!review || review.decision === 'unresolved' || scopes[name] === unknown)
      actions.push({
        id: `scope:${name}`,
        kind: 'scope-review',
        owner: 'reviewer',
        before: scopeDefinitions[name].before,
        message: `Confirmer et justifier : ${scopeDefinitions[name].label}. Une réponse source ne vaut pas exemption.`,
      });
  }
  for (const { field, visible, required } of fields) {
    if (!visible) continue;
    const answer = input.answers[field.id];
    const base = {
      questionId: field.questionId,
      fieldId: field.id,
      owner: field.actor,
      before: questionCheckpoint(field.questionId),
    };
    if (answer === undefined) {
      if (required)
        actions.push({
          ...base,
          id: `field:${field.id}`,
          kind: 'missing',
          message: `Renseigner : ${field.label}`,
        });
    } else if (!fieldAnswerSchema(field).safeParse(answer).success) {
      actions.push({
        ...base,
        id: `field:${field.id}`,
        kind: 'invalid',
        message: `Corriger le format : ${field.label}`,
      });
    } else if (answer.state === 'unknown') {
      actions.push({
        ...base,
        id: `field:${field.id}`,
        kind: 'unknown',
        message: `Clarifier la réponse inconnue : ${field.label}`,
      });
    }
  }
  for (const question of questionSchemas) {
    if (questionState(question.questionId, scopes, input.answers) === 'false') continue;
    const id = question.questionId;
    const current = acceptedReview(id, input);
    const response = value(input.answers, `${id}.response`);
    const signal = sourceSignals[id]?.find((item) => item.value === response);
    const parsedReview = v2QuestionReviewSchema.safeParse(input.questionReviews?.[id]);
    const storedReview = parsedReview.success ? parsedReview.data : undefined;
    const resolution = storedReview?.sourceResolution;
    const resolutionExplained =
      !!resolution?.explanation?.trim() && resolution.evidenceReferences?.some((ref) => ref.trim());
    const sourceResolved =
      !signal ||
      (current &&
        resolutionExplained &&
        (resolution?.kind === 'not_applicable' ||
          resolution?.kind === 'exception_approved' ||
          (resolution?.kind === 'conditioned' &&
            signal.kind !== 'stop' &&
            !!storedReview?.conditions?.length)));
    if (!current || !sourceResolved)
      actions.push({
        id: `review:${id}`,
        questionId: id,
        kind: signal ? 'source-followup' : 'review',
        owner: 'reviewer',
        before: questionCheckpoint(id),
        message: signal
          ? `Examiner la recommandation source (${signal.kind}) ; préciser correction, condition ou décision motivée.`
          : `Examiner les réponses et justificatifs de ${id}${question.pendingTeamReview ? ' ; formulation de l’auteur en attente d’accord' : ''}.`,
        ...(signal ? { sourceText: signal.sourceText } : {}),
      });
    const reviewStatus = value(input.answers, `${id}.review_status`);
    if (
      typeof reviewStatus === 'string' &&
      [
        'needs_information',
        'insufficient_information',
        'discrepancy',
        'changes_or_advice',
      ].includes(reviewStatus)
    )
      actions.push({
        id: `unresolved-review:${id}`,
        questionId: id,
        kind: 'review',
        owner: 'reviewer',
        before: questionCheckpoint(id),
        message:
          'L’examen saisi mentionne encore des informations, une divergence ou une modification à résoudre.',
      });
    if (id === 'A6' && is(input.answers, 'A6.challenge_procedure', ['planned', 'none']) === 'true')
      actions.push({
        id: 'prerequisite:A6',
        questionId: id,
        kind: 'condition',
        owner: 'unil',
        before: 'deployment',
        message:
          'Mettre en place la procédure de réexamen et actualiser sa réponse avant les décisions concernées.',
      });
    if (
      id === 'T1' &&
      is(input.answers, 'T1.classification_status', ['in_progress', 'none']) === 'true'
    )
      actions.push({
        id: 'prerequisite:T1',
        questionId: id,
        kind: 'condition',
        owner: 'supplier',
        before: 'signature',
        message:
          'Fournir la qualification justifiée ou faire examiner explicitement le champ d’application avant signature.',
      });
    if (current) {
      const review = storedReview!;
      const seen = new Set<string>();
      if (review.conditions !== undefined && !Array.isArray(review.conditions))
        actions.push({
          id: `condition:${id}:invalid`,
          questionId: id,
          kind: 'invalid',
          owner: 'reviewer',
          before: questionCheckpoint(id),
          message: 'Format des conditions de revue invalide.',
        });
      else
        for (const [conditionIndex, condition] of (review.conditions ?? []).entries()) {
          const valid =
            typeof condition.id === 'string' &&
            condition.id.trim() &&
            !seen.has(condition.id) &&
            typeof condition.description === 'string' &&
            condition.description.trim() &&
            ['unil', 'supplier', 'reviewer'].includes(condition.owner) &&
            checkpoints.includes(condition.before) &&
            ['open', 'done'].includes(condition.status);
          seen.add(condition.id);
          if (!valid || condition.status !== 'done' || !condition.completionReference?.trim())
            actions.push({
              id: valid
                ? `condition:${id}:${condition.id}`
                : `condition-invalid:${id}:${conditionIndex}`,
              questionId: id,
              kind: valid ? 'condition' : 'invalid',
              owner: valid ? condition.owner : 'reviewer',
              before: valid ? condition.before : questionCheckpoint(id),
              message: valid
                ? `Condition à réaliser et justifier : ${condition.description}`
                : 'Condition de revue invalide ou dupliquée.',
            });
        }
    }
    // A reviewer must not mark missing/unknown values as resolved: independent actions remain.
    if (
      andTruth([scopes.ai, scopes.high_risk]) === 'true' &&
      is(input.answers, `${id}.response`, [
        'not_high_risk',
        'none_not_high_risk',
        'no_not_high_risk',
      ]) === 'true'
    )
      actions.push({
        id: `conflict:${id}:risk`,
        questionId: id,
        kind: 'contradiction',
        owner: 'reviewer',
        before: questionCheckpoint(id),
        message:
          'Cette réponse revendique une absence de haut risque alors que le parcours haut risque est actif. Corriger la réponse ou réexaminer le classement.',
      });
  }
  // Original M4 buckets and optional entered value must agree; zero is a valid value.
  const amount = value(input.answers, 'M4.estimated_value');
  const bucket = value(input.answers, 'M4.response');
  if (typeof amount === 'number' && typeof bucket === 'string') {
    const expected = amountBucket(amount);
    if (
      expected !== bucket &&
      fields.some((item) => item.field.id === 'M4.response' && item.visible)
    )
      actions.push({
        id: 'conflict:M4:value',
        questionId: 'M4',
        kind: 'contradiction',
        owner: 'unil',
        before: 'supplier-selection',
        message: 'La tranche de montant et la valeur totale saisie ne correspondent pas.',
      });
  }
  // Unknown/foreign keys are never silently consumed by a future draft reader.
  for (const id of Object.keys(input.answers))
    if (!answerFieldById.has(id))
      actions.push({
        id: `unknown-field:${id}`,
        kind: 'invalid',
        owner: 'reviewer',
        before: 'assessment',
        message: `Champ inconnu de la version : ${id}`,
      });
  const checkpointStates = Object.fromEntries(
    checkpoints.map((checkpoint, index) => {
      const blockers = actions.filter((action) => checkpoints.indexOf(action.before) <= index);
      return [
        checkpoint,
        {
          status: blockers.length ? 'actions_required' : 'ready_for_human_decision',
          actionIds: blockers.map((action) => action.id),
        },
      ];
    }),
  );
  return {
    version: WORKFLOW_VERSION,
    scopes,
    questions: questionSchemas.map((q) => ({
      id: q.questionId,
      activation: questionState(q.questionId, scopes, input.answers),
    })),
    fields,
    actions,
    checkpoints: checkpointStates,
    legalApproval: false as const,
  };
}
