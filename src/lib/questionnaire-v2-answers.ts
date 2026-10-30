import { z } from 'zod';
import {
  ANSWER_SCHEMA_VERSION,
  answerFieldById,
  answerFields,
} from '@/config/questionnaire-v2/answer-schema';
import type { V2Actor, V2Answers, V2Field } from './questionnaire-v2-domain';

function valueSchema(field: V2Field): z.ZodType {
  switch (field.type) {
    case 'single':
      return z
        .string()
        .refine(
          (value) => field.options.some((option) => option.value === value),
          'Réponse non proposée',
        );
    case 'multi':
      return z
        .array(z.string())
        .min(1)
        .max(field.options.length)
        .refine((values) => new Set(values).size === values.length, 'Sélections dupliquées')
        .refine(
          (values) =>
            values.every((value) => field.options.some((option) => option.value === value)),
          'Réponse non proposée',
        );
    case 'text':
    case 'textarea':
      return z.string().trim().min(1).max(field.maxLength);
    case 'number': {
      const schema = z.number().min(field.min);
      return field.max === undefined ? schema : schema.max(field.max);
    }
    case 'date':
      return z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .refine((value) => {
          const date = new Date(`${value}T00:00:00.000Z`);
          return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
        }, 'Date civile invalide');
  }
}

export function fieldAnswerSchema(field: V2Field) {
  return z.discriminatedUnion('state', [
    z.strictObject({ state: z.literal('unknown') }),
    z.strictObject({ state: z.literal('known'), value: valueSchema(field) }),
  ]);
}

type AnswerIssue = {
  fieldId?: string;
  code:
    'invalid_payload' | 'invalid_version' | 'unknown_field' | 'forbidden_field' | 'invalid_answer';
  message: string;
};
type PatchResult =
  { ok: true; schemaVersion: string; answers: V2Answers } | { ok: false; issues: AnswerIssue[] };

const envelope = z.strictObject({
  schemaVersion: z.string(),
  answers: z.record(z.string(), z.unknown()),
});

/**
 * Validates an isolated v2 patch. No database writes, legal conclusions or v1 conversion.
 * The eventual API must derive actor from its trusted session and authorize the dossier;
 * accepting an actor argument here is not authentication or authorization of a case.
 * Omitted keys leave a draft unanswered; clearing will need an explicit API operation.
 */
export function validateV2AnswerPatch(input: unknown, actor: V2Actor): PatchResult {
  const parsed = envelope.safeParse(input);
  if (!parsed.success || !['unil', 'supplier', 'reviewer'].includes(actor)) {
    return {
      ok: false,
      issues: [{ code: 'invalid_payload', message: 'Format ou auteur du brouillon invalide' }],
    };
  }
  if (parsed.data.schemaVersion !== ANSWER_SCHEMA_VERSION) {
    return {
      ok: false,
      issues: [{ code: 'invalid_version', message: 'Version du schéma de réponse incompatible' }],
    };
  }
  const issues: AnswerIssue[] = [];
  const answers: V2Answers = {};
  for (const [fieldId, raw] of Object.entries(parsed.data.answers)) {
    const field = answerFieldById.get(fieldId);
    if (!field) {
      issues.push({ fieldId, code: 'unknown_field', message: 'Champ inconnu de cette version' });
      continue;
    }
    if (field.actor !== actor) {
      issues.push({
        fieldId,
        code: 'forbidden_field',
        message: 'Ce champ appartient à un autre répondant',
      });
      continue;
    }
    const answer = fieldAnswerSchema(field).safeParse(raw);
    if (!answer.success) {
      issues.push({
        fieldId,
        code: 'invalid_answer',
        message: answer.error.issues.map((issue) => issue.message).join('; '),
      });
      continue;
    }
    answers[fieldId] = answer.data as V2Answers[string];
  }
  return issues.length
    ? { ok: false, issues }
    : { ok: true, schemaVersion: ANSWER_SCHEMA_VERSION, answers };
}

/** Mechanical field inventory only. Activation, prerequisites and readiness are step 3. */
export function inspectV2AnswerCoverage(answers: V2Answers, actor: V2Actor) {
  const result = {
    missing: [] as string[],
    unknown: [] as string[],
    invalid: [] as string[],
    known: [] as string[],
  };
  for (const field of answerFields.filter((item) => item.actor === actor)) {
    const answer = answers[field.id];
    if (answer === undefined) {
      if (field.required) result.missing.push(field.id);
    } else if (!fieldAnswerSchema(field).safeParse(answer).success) {
      result.invalid.push(field.id);
    } else if (answer.state === 'unknown') {
      result.unknown.push(field.id);
    } else {
      result.known.push(field.id);
    }
  }
  return result;
}
