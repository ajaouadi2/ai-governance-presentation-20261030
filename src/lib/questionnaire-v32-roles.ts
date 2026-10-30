import { v32Automation } from './questionnaire-v32-automation';
import catalogue from '../config/questionnaire-v32/catalogue.json';
import { evaluateV32 } from './questionnaire-v32-engine';
import type { V32BrowserDraft } from './questionnaire-v32-draft';
import type { V32Document } from './questionnaire-v32-store';
// Legacy values are retained in the type only to reject stale callers explicitly.
export type V32Actor = 'unil' | 'supplier' | 'reviewer';
export const v32Owner = (id: string): 'unil' => {
  if (!catalogue.questions.some((q) => q.id === id)) throw new Error('Question inconnue');
  return 'unil';
};
export function v32Handover(draft: V32BrowserDraft) {
  const r = evaluateV32(draft.answers, draft);
  return {
    status: r.status,
    nextOwner: r.nextQuestion ? 'unil' : null,
    nextQuestion: r.nextQuestion,
  };
}
export function projectV32(d: V32Document, actor: V32Actor = 'unil') {
  if (actor !== 'unil') throw new Error('Actualisez la page : espace UNIL unique.');
  return {
    ...d,
    actor: 'unil' as const,
    navigation: evaluateV32(d.draft.answers, d.draft),
    synthesis: v32Automation(evaluateV32(d.draft.answers, d.draft), d.draft),
    handover: v32Handover(d.draft),
  };
}
export type V32View = ReturnType<typeof projectV32>;
export function mergeV32Contribution(
  _before: V32Document,
  incoming: { title: string; draft: V32BrowserDraft },
  actor: V32Actor,
) {
  if (actor !== 'unil') throw new Error('Actualisez la page : espace UNIL unique.');
  return structuredClone(incoming.draft);
}
