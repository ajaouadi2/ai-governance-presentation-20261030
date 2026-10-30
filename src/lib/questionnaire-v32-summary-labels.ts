// Short display titles only. Full requirements and evidence remain in the detail views.
const titles: Record<string, [string, string]> = {
  'V32-S02-Q15': ['Accessibilité', 'Accessibility safeguards'],
  'V32-S01-Q07': [
    'Analyse d’impact sur la protection des données',
    'Data protection impact assessment',
  ],
  'V32-S06-Q02': ['Marquage des contenus générés par IA', 'AI-generated content marking'],
  'V32-S07-Q05': [
    'Droit d’auteur et données d’entraînement',
    'Copyright and training-data documentation',
  ],
  'V32-S07-Q06': ['Notification des incidents graves', 'Serious-incident notification clause'],
};
export function v32SummaryCheckTitle(id: string, fallback: string, locale: 'fr' | 'en') {
  return titles[id]?.[locale === 'en' ? 1 : 0] ?? fallback;
}
