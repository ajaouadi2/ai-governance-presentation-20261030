import {
  PDF_VERSION,
  canonicalPdfId,
  pdfQuestions,
  EN_PROMPTS,
  phaseLabels,
  type PdfLocale,
} from '@/config/questionnaire-pdf/catalog';
import { evaluatePdf, pdfDecisionCurrent, type PdfDraft } from './questionnaire-pdf';
const esc = (s: unknown) =>
  String(s ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
export function buildPdfReport(d: PdfDraft, locale: PdfLocale) {
  const t = (fr: string, en: string) => (locale === 'en' ? en : fr);
  const e = evaluatePdf(d);
  return `<!doctype html><html lang="${locale}"><head><meta charset="utf-8"><title>${esc(d.title)} · ${esc(t('Évaluation des outils d’IA', 'AI tool assessment'))}</title><style>body{font:12pt Calibri,Arial,sans-serif;max-width:850px;margin:40px auto;color:#223d55;line-height:1.5}h1{font-size:26pt}h2{font-size:16pt;border-top:1px solid #ccd9e4;padding-top:16px}h3{font-size:13pt}article{break-inside:avoid}small{color:#556b80}pre{white-space:pre-wrap;font:inherit}li{margin-bottom:6px}@media print{body{margin:0}a{color:inherit}@page{size:A4;margin:20mm}}</style></head><body><h1>${esc(t('Rapport du questionnaire PDF', 'PDF questionnaire report'))}</h1><h2>${esc(d.title)}</h2><p>${esc(PDF_VERSION)} · ${esc(t('Révision', 'Revision'))} ${d.revision} · ${esc(new Date().toISOString())}</p><p>${esc(t('Instantané académique. Références et exigences à vérifier. Aucune certification juridique. Rôles et exemples de démonstration simulés.', 'Academic snapshot. References and requirements need verification. No legal certification. Demonstration roles and examples are simulated.'))}</p><p>${esc(t('Source : Due Diligence cheklist (2).pdf ; 85 entrées source et quatre entrées proposées.', 'Source: Due Diligence cheklist (2).pdf; 85 source entries and four proposed entry questions.'))}</p><h2>${esc(t('Points de contrôle', 'Checkpoints'))}</h2><ul>${e.checkpoints.map((c) => `<li>${esc(phaseLabels[c.phase][locale === 'en' ? 1 : 0])}: ${c.remaining} ${esc(t('actions restantes', 'remaining actions'))} · ${esc(d.decisions[c.phase]?.decision ?? t('Sans décision', 'No decision'))} · ${esc(pdfDecisionCurrent(d, c.phase) ? t('décision actuelle', 'current decision') : t('à examiner', 'to review'))}</li>`).join('')}</ul><h2>${esc(t('Actions à résoudre', 'Outstanding actions'))}</h2><ul>${e.actions.map((a) => `<li>${esc(a.questionId)} · ${esc(a.kind)} · ${esc(a.reason)} · ${esc(phaseLabels[a.before][locale === 'en' ? 1 : 0])} · ${esc(a.owner)} ${esc(a.description ?? '')}</li>`).join('')}</ul>${pdfQuestions
    .map((q) => {
      const a = d.answers[canonicalPdfId(q.id)];
      const r = d.reviews[canonicalPdfId(q.id)];
      const state = e.questions.find((s) => s.id === q.id)!;
      const choice = q.choices.find((c) => c.value === a?.choice);
      return `<article><h2>${esc(q.id)} ${esc(locale === 'en' ? EN_PROMPTS[q.id] : q.question)}</h2><small>${esc(q.source)}</small><p>${esc(choice ? (locale === 'en' ? choice.en : choice.fr) : t('Non renseigné', 'Unanswered'))}</p><pre>${esc(a?.details)}</pre><p>${esc(t('Référence', 'Reference'))}: ${esc(a?.reference)}</p><p>${esc(t('Examen', 'Review'))}: ${esc(state.reviewStatus)} · ${esc(state.reviewCurrent ? t('actuel', 'current') : t('à actualiser', 'not current'))}</p><pre>${esc(r?.justification)}</pre><p>${esc(r?.reference)}</p>${r?.conditions.map((c) => `<p>${esc(c.description)} · ${esc(c.owner)} · ${esc(c.before)} · ${esc(c.done ? t('réalisée', 'done') : t('ouverte', 'open'))} · ${esc(c.completionReference)}</p>`).join('') ?? ''}<details open><summary>${esc(t('Référence documentaire en français', 'Documentary reference in French'))}</summary><p>${esc(q.legal)}</p></details></article>`;
    })
    .join(
      '',
    )}<h2>${esc(t('Pièces et empreintes', 'Evidence and hashes'))}</h2><p>${esc(t('Les fichiers ne sont pas incorporés. Les pièces internes restent soumises à leur visibilité dans l’application.', 'Files are not embedded. Internal evidence remains subject to its application visibility.'))}</p><ul>${d.evidence.map((f) => `<li>${esc(f.questionId)} · ${esc(f.name)} · ${esc(f.visibility)} · SHA256 ${esc(f.sha256)}</li>`).join('')}</ul><h2>${esc(t('Décisions motivées', 'Reasoned decisions'))}</h2>${Object.values(
    d.decisions,
  )
    .map(
      (r) =>
        `<p>${esc(r.phase)} · ${esc(r.decision)} · ${esc(r.justification)} · ${esc(r.reference)}</p>`,
    )
    .join('')}</body></html>`;
}
