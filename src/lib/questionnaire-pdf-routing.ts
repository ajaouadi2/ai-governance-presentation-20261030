import { canonicalPdfId, pdfQuestions } from '@/config/questionnaire-pdf/catalog';
import type { PdfView } from './questionnaire-pdf';

export const journeySteps = [
  ['Décrire le projet', 'Describe the project'],
  ['Identifier les données', 'Identify the data'],
  ['Examiner les usages IA', 'Examine AI use'],
  ['Préparer l’achat', 'Prepare procurement'],
  ['Recueillir les garanties fournisseur', 'Collect supplier safeguards'],
  ['Examiner avant signature', 'Review before signature'],
  ['Préparer la mise en service et le suivi', 'Prepare deployment and follow-up'],
];
export function journeyStep(id: string) {
  if (id.startsWith('E')) return 0;
  if (['U-D01', 'U-D02', 'U-D03', 'U-D04', 'U-D05', 'U-D07', 'U-D10'].includes(id)) return 1;
  if (['U-A01', 'U-A02', 'U-A03', 'U-A05', 'U-A10'].includes(id)) return 2;
  if (id.startsWith('U-M')) return 3;
  if (['U-D09', 'P-C20', 'P-C21', 'P-C22', 'P-C24', 'P-C25', 'POST30'].includes(id)) return 5;
  return id.startsWith('P-') ? 4 : 6;
}
/** Navigation only. Uses the already authorised projection, never hidden supplier facts. */
export function recommendPdf(view: PdfView) {
  const questions = pdfQuestions.filter(
    (q) => canonicalPdfId(q.id) === q.id && (view.actor === 'reviewer' || q.owner === view.actor),
  );
  const unresolved = questions.filter((q) => {
    if (view.actor === 'reviewer')
      return view.evaluation?.actions.some((a) => a.questionId === q.id) ?? false;
    const a = view.answers[q.id];
    return (
      !a ||
      !a.choice ||
      a.choice === 'unknown' ||
      !a.details.trim() ||
      (!a.reference.trim() &&
        !view.evidence.some(
          (e) =>
            canonicalPdfId(e.questionId) === q.id &&
            (q.owner !== 'supplier' || e.visibility === 'shared'),
        ))
    );
  });
  const priority = (id: string) => {
    if (
      view.actor === 'reviewer' &&
      view.evaluation?.actions.some((a) => a.questionId === id && a.kind === 'block')
    )
      return -20;
    if (
      ['sensitive', 'mixed'].includes(view.answers['U-D03']?.choice ?? '') &&
      ['U-D07', 'P-D02', 'P-D04'].includes(id)
    )
      return -5;
    if (['possible', 'simple'].includes(view.answers['U-A03']?.choice ?? '') && id === 'U-A05')
      return -4;
    if (
      ['P-D01', 'P-D02', 'P-D03', 'P-D04'].some((key) =>
        ['us_dpf', 'other', 'multiple', 'unknown'].includes(view.answers[key]?.choice ?? ''),
      ) &&
      id === 'P-D05'
    )
      return -6;
    if (
      ['covered', 'partial', 'planned'].includes(view.answers['U-M02']?.choice ?? '') &&
      ['U-M03', 'U-M04'].includes(id)
    )
      return -3;
    return journeyStep(id);
  };
  // Establish context first for UNIL; otherwise recommend explicit issue priorities.
  unresolved.sort((a, b) => {
    if (view.actor === 'unil' && (a.section === 'E' || b.section === 'E'))
      return Number(b.section === 'E') - Number(a.section === 'E');
    return priority(a.id) - priority(b.id);
  });
  const next = unresolved[0];
  const reason = !next
    ? 'complete'
    : view.actor === 'reviewer'
      ? 'review'
      : next.section === 'E'
        ? 'context'
        : priority(next.id) < 0
          ? 'priority'
          : 'sequence';
  return {
    next,
    reason,
    total: questions.length,
    completed: questions.length - unresolved.length,
    remaining: unresolved.length,
    steps: journeySteps.map((label, step) => ({
      label,
      total: questions.filter((q) => journeyStep(q.id) === step).length,
      remaining: unresolved.filter((q) => journeyStep(q.id) === step).length,
    })),
  };
}
