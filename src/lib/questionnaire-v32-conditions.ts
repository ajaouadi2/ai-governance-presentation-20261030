import catalogue from '../config/questionnaire-v32/catalogue.json';
import presentation from '../config/questionnaire-v32/presentation.json';
import { v32QuestionActive, type V32Result } from './questionnaire-v32-engine';
import { v32VisibleRecommendations } from './questionnaire-v32-recommendations';

export type V32ConditionMapping = {
  key: string;
  questionId: string;
  letter: string;
  question: string;
  pages: number[];
  sourceVerdict: string;
  sourceAnswer: string;
  answerLabel: string;
  actions: string[];
  kind: 'documented-action' | 'classification' | 'clarification-required';
  relatedQuestions: string[];
  convertedRedOnly: boolean;
};
// Documentary mapping only. An action in the PDF is not proof it has been performed.
export const v32ConditionMap: V32ConditionMapping[] = catalogue.questions
  .filter((q) => q.stage < 8 && v32QuestionActive(q.id))
  .flatMap((q) =>
    q.answers
      .filter(
        (a) =>
          a.sourceVerdict === 'SOUS CONDITION' ||
          (a.sourceVerdict === 'NE PAS POURSUIVRE' &&
            (q.badge === 'AI ACT' ||
              q.badge === 'HAUT RISQUE' ||
              (q.id === 'V32-S04-Q06' && a.letter === 'c') ||
              (q.id === 'V32-S05-Q17' && a.letter === 'b'))),
      )
      .map((a) => {
        const display = presentation.questions
          .find((p) => p.id === q.id)!
          .answers.find((p) => p.letter === a.letter)!;
        const actions = v32VisibleRecommendations(q.id, a.letter);
        const classification = q.id === 'V32-S02-Q02' && ['a', 'b'].includes(a.letter);
        const unclear = !actions.length || actions.every((t) => t === 'Négocier');
        const text = a.sourceText + '\n' + display.recommendations.join('\n');
        const relatedQuestions = [
          ...new Set(
            [...text.matchAll(/étape (\d+), question (\d+)/gu)].map(
              (m) => 'V32-S' + m[1].padStart(2, '0') + '-Q' + m[2].padStart(2, '0'),
            ),
          ),
        ].filter((id) => id !== q.id && catalogue.questions.some((q) => q.id === id));
        return {
          key: q.id + '/' + a.letter,
          questionId: q.id,
          letter: a.letter,
          question: q.stemText,
          pages: q.pages,
          sourceVerdict: a.sourceVerdict,
          sourceAnswer: a.sourceText,
          answerLabel: display.label,
          actions,
          kind: classification
            ? ('classification' as const)
            : unclear
              ? ('clarification-required' as const)
              : ('documented-action' as const),
          relatedQuestions,
          convertedRedOnly: a.sourceVerdict === 'NE PAS POURSUIVRE',
        };
      }),
  );

export function v32ReachedConditions(result: V32Result) {
  return result.summary
    .filter((s) => !s.questionId.startsWith('V32-S08') && s.effectiveVerdict === 'SOUS CONDITION')
    .map((s) => {
      const mapping = v32ConditionMap.find((m) => m.key === s.questionId + '/' + s.letter);
      if (!mapping) throw new Error('Condition sans correspondance source : ' + s.questionId);
      return {
        ...mapping,
        converted: s.sourceVerdict !== s.effectiveVerdict,
        checks: result.verificationChecks.filter((c) => c.questionId === s.questionId),
      };
    });
}
