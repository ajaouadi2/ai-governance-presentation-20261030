import { protectionDefinitions } from '@/config/data-protection';
import { CONFIG_VERSION, controls, questions, scoringCriteria, sources } from '@/config/assessment';
import { objectiveRuleDefinitions } from './objective-rules';
import { activationDependencies, dependencyClosure } from './rule-facts';

export function buildChecklistModel() {
  const conditions = new Map(questions.map((q) => [q.id, q.when]));
  return {
    version: CONFIG_VERSION,
    questions,
    sources,
    scoringCriteria,
    rules: objectiveRuleDefinitions,
    protectionRules: protectionDefinitions,
    activations: activationDependencies,
    controls: controls.map((c) => ({
      ...c,
      dependencies: dependencyClosure(
        [...c.questionIds, ...(c.when ? [c.when.id] : [])],
        conditions,
      ),
    })),
  };
}
export type ChecklistModel = ReturnType<typeof buildChecklistModel>;
