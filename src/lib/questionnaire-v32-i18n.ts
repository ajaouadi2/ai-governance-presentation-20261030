import messages from '../config/questionnaire-v32/english.json';
import stems from '../config/questionnaire-v32/english-stems.json';
import catalogue from '../config/questionnaire-v32/catalogue.json';
import { translate, english as legacyEnglish, type Locale } from './i18n';
import { v32Readable } from './questionnaire-v32-labels';
const normal = (s: string) => s.replace(/\s+/g, ' ').trim();
export const v32English: Record<string, string> = { ...legacyEnglish, ...messages };
const strip = (s: string) =>
  s.replace(
    /^\s*(?:(?:AI ACT|HAUT RISQUE|DONNÉES PERSONNELLES|HIGH RISK|PERSONAL DATA)\s*)?\d+\.\s*/u,
    '',
  );
for (const q of catalogue.questions) {
  const en = (stems as Record<string, string>)[q.id];
  v32English[normal(q.stemText)] = en;
  v32English[normal(q.stemText.split('\n')[0])] = en.split('\n')[0];
  const parts = (s: string) =>
    s.includes('\n•')
      ? [strip(s.slice(0, s.indexOf('\n•'))), s.slice(s.indexOf('\n•') + 1)]
      : [strip(s)];
  parts(q.stemText).forEach((part, index) => {
    v32English[normal(part)] = parts(en)[index];
  });
}
// Recommendation panels show exact excerpts, with the navigation instructions removed.
const clean = (s: string) =>
  s
    .replace(/^Recommandations?[^:]*:\s*/u, '')
    .replace(/\s*\(étape \d+, question \d+\)/gu, '')
    .replace(/\s*Voir aussi l'étape \d+, questions [\d à]+\s*\(journalisation\)\.?/gu, '')
    .trim();
const cleanEn = (s: string) =>
  s
    .replace(/^Recommendations?[^:]*:\s*/u, '')
    .replace(/\s*\(stage \d+, question \d+\)/gu, '')
    .replace(/\s*See also stage \d+, questions [\d– -]+\s*\(logging\)\.?/gu, '')
    .trim();
for (const [fr, en] of Object.entries({ ...v32English })) {
  v32English[normal(v32Readable(fr))] ??= en;
  if (/^Recommandations?[^:]*:/u.test(fr)) v32English[normal(clean(fr))] = cleanEn(en);
}
// Preserve the original order when several translated notes share one source block.
for (const q of catalogue.questions) {
  if (!q.notesText.trim()) continue;
  const parts = normal(q.notesText)
    .split(/(?=Recommandations?[^:]*:|Note :|Règle :|Preuve exigée :|À remplir[^:]*:)/u)
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.every((s) => v32English[s] !== undefined))
    v32English[normal(q.notesText)] = parts.map((s) => v32English[s]).join('\n\n');
}
export function translateV32(text: string, locale: Locale): string {
  if (locale === 'fr' || !text.trim()) return text;
  const exact = v32English[normal(text)];
  if (exact !== undefined) return text.replace(text.trim(), exact);
  const location = text.match(/^Étape (\d+) · question (\d+)$/);
  if (location) return `Stage ${location[1]} · question ${location[2]}`;
  const revision = text.match(/^Dossier partagé enregistré — révision (\d+)\.$/);
  if (revision) return `Shared assessment saved — revision ${revision[1]}.`;
  if (text.includes(' — '))
    return text
      .split(' — ')
      .map((part) => translateV32(part, locale))
      .join(' — ');
  if (text.includes('\n'))
    return text
      .split('\n')
      .map((line) => translateV32(line, locale))
      .join('\n');
  return translate(text, locale);
}
