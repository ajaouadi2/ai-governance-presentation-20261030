export const v32DecisionNames = {
  go: 'Avis favorable',
  'conditional-go': 'Avis favorable sous conditions',
  'no-go': 'Avis défavorable',
  suspended: 'Évaluation à compléter / validation attendue',
};
export const v32VerdictNames: Record<string, string> = {
  POURSUIVRE: 'Contrôle satisfait sur la réponse déclarée',
  'SOUS CONDITION': 'Action ou vérification requise',
  'NE PAS POURSUIVRE': 'Point bloquant',
  ORIENTATION: 'Information de parcours',
};
// Presentation only: source text and engine values remain unchanged.
export function v32Readable(text: string) {
  return text
    .replace(/réponse rouge effective/gi, 'réponse constituant un point bloquant')
    .replace(/réponse rouge/gi, 'réponse bloquante')
    .replace(/rouges effectifs/gi, 'points bloquants')
    .replace(/rouge effectif/gi, 'point bloquant')
    .replace(/arrêt rouge/gi, 'arrêt du parcours')
    .replace(/No-go/g, 'avis défavorable')
    .replace(/Go sous conditions/g, 'avis favorable sous conditions')
    .replace(/\bGo\b/g, 'avis favorable')
    .replace(/le avis/g, 'l’avis');
}
