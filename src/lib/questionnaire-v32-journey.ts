import journey from '../config/questionnaire-v32/journey.json';
import catalogue from '../config/questionnaire-v32/catalogue.json';
export const v32Journey = journey;
export const v32JourneyQuestions = journey.stages.flatMap((stage) => {
  let position = 0;
  return stage.sections.flatMap((section) =>
    section.questionIds.map((id) => ({
      id,
      stage: stage.number,
      phase: stage.phase,
      title: stage.title,
      section: section.name,
      position: ++position,
    })),
  );
});
export const v32Location = (id: string) => v32JourneyQuestions.find((q) => q.id === id);
export const v32LocationLabel = (id: string) => {
  const q = v32Location(id);
  return q ? 'Étape ' + q.stage + ' · question ' + q.position : 'Repère PDF ' + id;
};
export const v32ExecutionQuestions = [
  ...v32JourneyQuestions
    .filter((q) => !q.id.startsWith('V32-S09'))
    .map((q) => catalogue.questions.find((c) => c.id === q.id)!),
  ...catalogue.questions.filter((q) => q.id === 'V32-S04-Q04' || q.stage === 9),
];
