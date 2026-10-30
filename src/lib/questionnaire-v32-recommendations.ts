import presentation from '../config/questionnaire-v32/presentation.json';

// Exact excerpts from source consequences that ask the person to act, rather than route the app.
const inline: Record<string, string[]> = {
  'V32-S00-Q01/c': ["demander l'avis du service juridique"],
  'V32-S01-Q06/b': ['Audit à mettre en place'],
  'V32-S01-Q07/a': ["Réaliser l'AIPD et la faire valider par le DPO avant la décision finale"],
  'V32-S01-Q07/b': ['vérifier les conditions précises et rédiger une justification détaillée'],
  'V32-S01-Q09/b': ['avis du DPO'],
  'V32-S02-Q08/c': ['informer avant la mise en service'],
  'V32-S02-Q09/b': ['prévoir cette information avant la mise en service'],
  'V32-S02-Q10/c': [
    "demander l'avis du service juridique et, si requis, enregistrer avant la mise en service",
  ],
  'V32-S02-Q11/b': ['il faut la nommer'],
  'V32-S02-Q12/c': ['prévoir une mention avant la mise en service'],
  'V32-S02-Q13/b': ['prévoir une formation avant la mise en service'],
  'V32-S02-Q14/c': ['définir ces règles avant la mise en service'],
  'V32-S02-Q15/a': ["l'accessibilité devient obligatoire"],
  'V32-S03-Q03/b': ['Clause obligatoire pour poursuivre'],
  'V32-S05-Q09/b': ['À exiger avant la signature'],
  'V32-S06-Q02/c': ['exiger le marquage avant la signature'],
  'V32-S07-Q01/b': ['Négocier'],
  'V32-S07-Q03/b': ['Négocier'],
  'V32-S08-Q04/b': ['chaque condition a un responsable et une échéance'],
  'V32-S09-Q01/b': ['À effectuer'],
  'V32-S09-Q02/b': ['Fixer une date de revue'],
  'V32-S09-Q03/b': ['Fixer la fréquence du suivi et son responsable'],
  'V32-S09-Q04/b': ['À mettre en place avant la mise en service'],
  'V32-S09-Q05/b': ["À mettre en place ; fixer l'échéance dans la décision finale"],
};
const clean = (text: string) =>
  text
    .replace(/^Recommandations?[^:]*:\s*/u, '')
    .replace(/\s*\(étape \d+, question \d+\)/gu, '')
    .replace(/\s*Voir aussi l'étape \d+, questions [\d à]+\s*\(journalisation\)\.?/gu, '')
    .trim();
export function v32VisibleRecommendations(id: string, letter: string | undefined): string[] {
  const question = presentation.questions.find((q) => q.id === id);
  const choice = question?.answers.find((a) => a.letter === letter);
  if (!choice) return [];
  return [
    ...choice.recommendations,
    ...(inline[id + '/' + letter] ?? []),
    ...question!.generalNotes.filter((t) => /^(?:À remplir|Preuve exigée)/u.test(t)),
  ]
    .map(clean)
    .filter(Boolean);
}
export const v32InlineRecommendations = inline;
