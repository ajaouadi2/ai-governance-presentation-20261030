import questions from '@/config/i18n/questions.en.json';
import messages from '@/config/i18n/interface.en.json';
export type Locale = 'fr' | 'en';
export const english: Record<string, string> = Object.assign(
  Object.create(null),
  questions,
  messages,
);
export function translate(text: string, locale: Locale): string {
  if (locale === 'fr' || !text.trim()) return text;
  if (
    text.includes('\n') &&
    text
      .trim()
      .split('\n')
      .every((line) => /^[^:]+ :/.test(line))
  )
    return text
      .trim()
      .split('\n')
      .map((line) => translate(line, locale))
      .join('\n');
  const trimmed = text.replace(/\s+/g, ' ').trim();
  const exact = english[trimmed];
  if (exact !== undefined) return text.replace(text.trim(), exact);
  if (trimmed.includes(' · '))
    return trimmed
      .split(' · ')
      .map((part) => translate(part, locale))
      .join(' · ');
  if (trimmed.includes('\n'))
    return trimmed
      .split('\n')
      .map((part) => translate(part, locale))
      .join('\n');
  // These templates contain presentation text, never answer keys or stored values.
  const patterns: [RegExp, (match: RegExpMatchArray) => string][] = [
    [/^Error: (.+)$/, (m) => `Error: ${translate(m[1], locale)}`],
    [/^(\d+) octets$/, (m) => `${m[1]} bytes`],
    [/^(.+) · Rapport Clair$/, (m) => `${m[1]} · Assessment report`],
    [/^Étape (\d+)$/, (m) => `Stage ${m[1]}`],
    [/^([A-Z]\d+[ab]?) · (.+)$/, (m) => `${m[1]} · ${translate(m[2], locale)}`],
    [/^Rapport (.+)$/, (m) => `Report ${m[1]}`],
    [/^Dossier (.+)$/, (m) => `Dossier ${m[1]}`],
    [/^Révision (.+)$/, (m) => `Revision ${m[1]}`],
    [/^Généré le (.+)$/, (m) => `Generated on ${m[1]}`],
    [/^Créé le (.+)$/, (m) => `Created on ${m[1]}`],
    [/^Fin du rapport$/, () => `End of report`],
    [/^Historique \((\d+) rapports précédents\)$/, (m) => `History (${m[1]} previous reports)`],
    [/^Voir toutes les actions \((\d+)\)$/, (m) => `Show all actions (${m[1]})`],
    [/^(\d+) actions à traiter$/, (m) => `${m[1]} actions to address`],
    [/^Renseigner : (.+)$/, (m) => `Complete: ${translate(m[1], locale)}`],
    [/^Corriger le format : (.+)$/, (m) => `Correct the format: ${translate(m[1], locale)}`],
    [
      /^Clarifier la réponse inconnue : (.+)$/,
      (m) => `Clarify the unknown answer: ${translate(m[1], locale)}`,
    ],
    [
      /^Examiner les réponses et justificatifs de (.+?)( ; formulation de l’auteur en attente d’accord)?\.$/,
      (m) =>
        `Review answers and evidence for ${m[1]}${m[2] ? '; author wording awaiting agreement' : ''}.`,
    ],
    [
      /^Examiner la recommandation source \((.+)\) ; préciser correction, condition ou décision motivée\.$/,
      (m) =>
        `Review the source recommendation (${m[1]}); specify a correction, condition or reasoned decision.`,
    ],
    [
      /^Condition à réaliser et justifier : (.+)$/,
      (m) => `Condition to complete and justify: ${m[1]}`,
    ],
    [/^Champ inconnu de la version : (.+)$/, (m) => `Unknown field in this version: ${m[1]}`],
    [
      /^Confirmer et justifier : (.+)\. Une réponse source ne vaut pas exemption\.$/,
      (m) =>
        `Confirm and justify: ${translate(m[1], locale)}. A source answer does not establish an exemption.`,
    ],
    [/^([A-Z]\d+[ab]?) : (.+)$/, (m) => `${m[1]}: ${translate(m[2], locale)}`],
    [/^Pièces jointes de (.+)$/, (m) => `Attachments for ${m[1]}`],
    [/^Examen de (.+)$/, (m) => `Review of ${m[1]}`],
  ];
  for (const [pattern, render] of patterns) {
    const match = trimmed.match(pattern);
    if (match) return render(match);
  }
  const colon = trimmed.match(/^(.*?) : (.+)$/);
  if (colon && english[colon[1]]) return `${english[colon[1]]}: ${translate(colon[2], locale)}`;
  const labelOnly = trimmed.match(/^(.*?)\s*:\s*$/);
  if (labelOnly && english[labelOnly[1]]) return `${english[labelOnly[1]]}: `;
  return text;
}
