import catalog from '@/config/questionnaire-v2/catalog.json';
import { answerFieldById, questionSchemas } from '@/config/questionnaire-v2/answer-schema';
import {
  evaluateV2Workflow,
  questionReviewFingerprint,
  scopeReviewFingerprint,
} from './questionnaire-v2-workflow';
import type { V2Actor } from './questionnaire-v2-domain';
import type { V2Scope } from '@/config/questionnaire-v2/workflow';
import type { V2Draft } from './questionnaire-v2-store';

export function projectV2Draft(draft: V2Draft, actor: V2Actor) {
  const workflow = evaluateV2Workflow(draft);
  const supplier = actor === 'supplier';
  const fields = workflow.fields.filter((item) => !supplier || item.field.actor === 'supplier');
  const ids = new Set(fields.filter((item) => item.visible).map((item) => item.field.questionId));
  return {
    actor,
    draft: {
      id: draft.id,
      title: draft.title,
      sharedContext: draft.sharedContext,
      mode: draft.mode,
      revision: draft.revision,
      schemaVersion: draft.schemaVersion,
      updatedAt: draft.updatedAt,
      answers: supplier
        ? Object.fromEntries(
            Object.entries(draft.answers).filter(
              ([key]) => answerFieldById.get(key)?.actor === 'supplier',
            ),
          )
        : draft.answers,
      evidence: draft.evidence.filter((file) => !supplier || file.visibility === 'shared'),
    },
    questions: questionSchemas
      .filter((q) => ids.has(q.questionId))
      .map((q) => ({
        ...q,
        fields: q.fields.filter((field) => !supplier || field.actor === 'supplier'),
        stage: catalog.questions.find((source) => source.id === q.questionId)!.stage,
        author: catalog.questions.find((source) => source.id === q.questionId)!.author,
        sourceUrls: catalog.questions
          .find((source) => source.id === q.questionId)!
          .sourceUrls.filter((url) => url.startsWith('https://')),
      })),
    fields,
    actions: supplier
      ? workflow.actions.filter((action) => action.owner === 'supplier' && !!action.fieldId)
      : workflow.actions,
    checkpoints: supplier ? null : workflow.checkpoints,
    scopes: supplier ? null : workflow.scopes,
    scopeReviews: supplier
      ? null
      : Object.fromEntries(
          Object.entries(draft.scopeReviews).map(([id, record]) => {
            const { fingerprint, ...review } = record;
            return [
              id,
              {
                ...review,
                current:
                  Object.hasOwn(workflow.scopes, id) &&
                  fingerprint ===
                    scopeReviewFingerprint(id as V2Scope, draft.answers, draft.evidence),
              },
            ];
          }),
        ),
    questionReviews: supplier
      ? null
      : Object.fromEntries(
          Object.entries(draft.questionReviews).map(([id, record]) => {
            const { fingerprint, ...review } = record;
            return [
              id,
              {
                ...review,
                current:
                  questionSchemas.some((q) => q.questionId === id) &&
                  fingerprint === questionReviewFingerprint(id, draft),
              },
            ];
          }),
        ),
  };
}
export type V2DraftView = ReturnType<typeof projectV2Draft>;
export type V2DraftSummary = {
  id: string;
  title: string;
  mode: 'unil' | 'both';
  revision: number;
  updatedAt: string;
  status?: 'ready' | 'blocked' | 'needs_information';
};
