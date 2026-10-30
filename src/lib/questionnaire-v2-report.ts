import { createHash } from 'node:crypto';
import { z } from 'zod';
import catalog from '@/config/questionnaire-v2/catalog.json';
import { questionSchemas } from '@/config/questionnaire-v2/answer-schema';
import {
  WORKFLOW_VERSION,
  checkpointLabels,
  scopeDefinitions,
} from '@/config/questionnaire-v2/workflow';
import { projectV2Draft } from './questionnaire-v2-view';
import { SCORING_VERSION, evaluateV2Comparison } from './questionnaire-v2-scoring';
import type { V2Draft } from './questionnaire-v2-store';
import type { V2Answer, V2Field } from './questionnaire-v2-domain';
import { translateReportHtml } from './i18n-report';
import type { Locale } from './i18n';
import { translate } from './i18n';

export const REPORT_VERSION = '2026-10-25.questionnaire-v2-report.2';
export const reportEnvelopeSchema = z.strictObject({
  formatVersion: z.literal(1),
  id: z.uuid(),
  draftId: z.uuid(),
  createdAt: z.iso.datetime(),
  title: z.string(),
  revision: z.number().int().nonnegative(),
  reportVersion: z.string(),
  locale: z.enum(['fr', 'en']).optional(),
  payload: z.string(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
});
export type V2ReportEnvelope = z.infer<typeof reportEnvelopeSchema>;
export type V2ReportSummary = Omit<V2ReportEnvelope, 'payload' | 'sha256' | 'formatVersion'>;
export const reportSummary = ({
  id,
  draftId,
  createdAt,
  title,
  revision,
  reportVersion,
  locale,
}: V2ReportEnvelope): V2ReportSummary => ({
  id,
  draftId,
  createdAt,
  title,
  revision,
  reportVersion,
  locale,
});
export function reportDigest(payload: string) {
  return createHash('sha256').update(payload).digest('hex');
}
const esc = (value: unknown) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
const p = (value: unknown) => `<p>${esc(value)}</p>`;
const original = (value: unknown) => `<p translate="no">${esc(value)}</p>`;
const actors = { unil: 'UNIL', supplier: 'Fournisseur', reviewer: 'Évaluateur' };
const statusLabels: Record<string, string> = {
  accepted: 'Accepté',
  needs_work: 'À compléter',
  blocked: 'Blocage',
  applies: 'Applicable',
  does_not_apply: 'Non applicable',
  unresolved: 'À confirmer',
  not_applicable: 'Non applicable',
  exception_approved: 'Exception examinée',
  conditioned: 'Sous conditions',
};
function answerText(field: V2Field, answer: V2Answer | undefined, locale: Locale = 'fr') {
  if (!answer) return 'Non renseigné';
  if (answer.state === 'unknown') return 'Je ne sais pas / À vérifier';
  if (field.type === 'single' || field.type === 'multi')
    return (Array.isArray(answer.value) ? answer.value : [answer.value])
      .map((value) =>
        translate(
          field.options.find((option) => option.value === value)?.label ?? String(value),
          locale,
        ),
      )
      .join(' ; ');
  return `${Array.isArray(answer.value) ? answer.value.join('; ') : answer.value}${field.type === 'number' && field.unit ? ` ${field.unit}` : ''}`;
}
export function buildV2Report(
  draft: V2Draft,
  offers: V2Draft[],
  id: string,
  createdAt: string,
  locale: Locale = 'fr',
): V2ReportEnvelope {
  const view = projectV2Draft(draft, 'reviewer');
  const comparison = draft.comparison
    ? {
        plan: draft.comparison.plan,
        result: evaluateV2Comparison(
          draft.comparison.plan,
          offers,
          draft.comparison.version === SCORING_VERSION ? draft.comparison.fingerprint : undefined,
        ),
      }
    : null;
  const fieldStates = new Map(view.fields.map((item) => [item.field.id, item]));
  const questionStates = new Map(view.questions.map((q) => [q.questionId, q]));
  const questionReview = (questionId: string) => {
    const review = view.questionReviews?.[questionId];
    if (!review) return p('Examen : non enregistré.');
    return `<div class="review"><h4>Examen humain : ${esc(statusLabels[review.status])} · ${review.current ? 'Actuel' : 'PÉRIMÉ'}</h4>${p(`Auteur : ${review.reviewer}`)}${original(review.justification)}${`<p>Références : <span translate="no">${esc(review.evidenceReferences.join(' ; '))}</span></p>`}${review.sourceResolution ? `${p(`Suite à la recommandation source : ${statusLabels[review.sourceResolution.kind]}`)}${original(review.sourceResolution.explanation)}${`<p>Références : <span translate="no">${esc(review.sourceResolution.evidenceReferences.join(' ; '))}</span></p>`}` : ''}${(review.conditions ?? []).map((c) => p(`Condition ${c.id} : ${c.description} · Responsable : ${actors[c.owner]} · Avant : ${checkpointLabels[c.before]} · ${c.status === 'done' ? 'Réalisée' : 'OUVERTE'} · Preuve de réalisation : ${c.completionReference ?? 'Non renseignée'}`)).join('')}</div>`;
  };
  const comparisonHtml = comparison
    ? `${p(`Périmètre commun : ${comparison.plan.scope}`)}${p(`Devise : ${comparison.plan.currency} · Évaluateur : ${comparison.plan.reviewer}`)}${original(comparison.plan.justification)}${p('Barème proposé : qualité 40 %, intégration 15 %, coût 30 %, environnement 15 %. Prix = 5 × minimum admissible / prix de l’offre ; minimum nul : 5 pour les offres gratuites, 0 pour les autres. Intégration 5/3/0, environnement 5/2/0. Arrondi du total à deux décimales, ex æquo conservés. Aucune conversion monétaire.')}<p class="notice">${comparison.result.ranked ? 'Classement indicatif : décision humaine requise.' : !comparison.result.current ? 'Confirmation périmée : aucun classement actuel. Totaux éventuels provisoires.' : 'Classement indisponible : prérequis ouverts ou moins de deux offres complètes. Totaux éventuels provisoires.'}</p><table><thead><tr><th>Offre</th><th>Coût</th><th>Qualité /5</th><th>Intégration /5</th><th>Prix /5</th><th>Environnement /5</th><th>Total /100</th><th>Rang</th></tr></thead><tbody>${comparison.result.rows.map((row) => `<tr><td translate="no">${esc(row.title)}</td><td>${esc(row.cost ?? '—')}</td><td>${esc(row.quality ?? '—')}</td><td>${esc(row.integration ?? '—')}</td><td>${row.price === null ? '—' : row.price.toFixed(2)}</td><td>${esc(row.environment ?? '—')}</td><td>${esc(row.total ?? '—')}</td><td>${esc(row.rank ?? '—')}</td></tr>`).join('')}</tbody></table>${comparison.result.rows.map((row) => `<h4 translate="no">${esc(row.title)}</h4>${p(`Dossier : ${row.id} · Coût déclaré : ${row.costScope ?? 'Non renseigné'}`)}<ul>${row.reasons.map((reason) => `<li>${esc(reason)}</li>`).join('')}</ul>`).join('')}`
    : p('Aucune comparaison enregistrée. Aucun score global ni classement ne peut être déduit.');
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title translate="no">${esc(draft.title)} · ${locale === 'en' ? 'Assessment report' : 'Rapport d’évaluation'}</title><style>
  @page{size:A4;margin:17mm 15mm}*{box-sizing:border-box}body{font:14px/1.5 Arial,sans-serif;color:#203831;max-width:1000px;margin:32px auto;padding:0 22px}header{border-bottom:3px solid #28735b;padding-bottom:18px}h1{font-size:30px;line-height:1.2}h2{font-size:22px;border-bottom:1px solid #ccdcd5;padding-bottom:8px;margin-top:30px}h3{font-size:17px;margin-top:24px}h4{font-size:14px;margin:14px 0 6px}p{white-space:pre-wrap;overflow-wrap:anywhere;margin:7px 0}li,td,dd{overflow-wrap:anywhere}table{width:100%;border-collapse:collapse;font-size:12px;margin:16px 0}th,td{border:1px solid #cbd9d3;padding:7px;text-align:left;vertical-align:top}th{background:#edf4f0}thead{display:table-header-group}.notice,.review{background:#f0f5f2;padding:12px;border-left:3px solid #45876d;margin:12px 0}.muted{color:#53665e;font-size:12px}.question{border-top:1px solid #cbd9d3;margin-top:20px;padding-top:8px}.field{margin-bottom:12px}h2,h3,h4{break-after:avoid}tr,.field{break-inside:avoid}a{color:#245b49;overflow-wrap:anywhere}@media print{body{margin:0;padding:0;max-width:none;font-size:10pt}.screen{display:none}h1{font-size:23pt}h2{font-size:16pt}table{font-size:8pt}a{color:inherit}.notice,.review{background:white}header{break-inside:avoid}}
  </style></head><body><header><p>CLAIR · QUESTIONNAIRE DE L’ÉQUIPE</p><h1>Rapport de due diligence</h1><h2 translate="no">${esc(draft.title)}</h2>${p(`Rapport ${id} · Généré le ${createdAt}`)}${p(`Dossier ${draft.id} · Révision ${draft.revision}`)}<p class="muted">Prototype académique · Données fictives · Usage interne UNIL / Évaluateur</p></header>
  <p class="screen notice">Pour enregistrer en PDF : utilisez la fonction Imprimer de votre navigateur, puis « Enregistrer au format PDF ». Ce fichier est autonome ; les pièces jointes restent dans le dossier.</p>
  <h2>1. Synthèse et décisions à préparer</h2><p class="notice">Ce rapport est un instantané documentaire. Il ne certifie pas la conformité juridique, ne valide pas un achat et ne désigne pas un adjudicataire. Les formulations de l’équipe restent à valider.</p>${draft.sharedContext ? original(draft.sharedContext) : p('Contexte partagé non renseigné.')}${Object.entries(
    view.checkpoints ?? {},
  )
    .map(([key, checkpoint]) =>
      p(
        `${checkpointLabels[key as keyof typeof checkpointLabels]} : ${checkpoint.status === 'actions_required' ? `${checkpoint.actionIds.length} actions à traiter` : 'Prêt pour une décision humaine'}`,
      ),
    )
    .join('')}
  <h2>2. Parcours et examens de périmètre</h2>${Object.entries(scopeDefinitions)
    .map(([key, definition]) => {
      const review = view.scopeReviews?.[key];
      return `<h3>${esc(definition.label)}</h3>${review ? `${p(`${statusLabels[review.decision]} · ${review.current ? 'Examen actuel' : 'Examen PÉRIMÉ'} · ${review.reviewer}`)}${original(review.justification)}${`<p>Références : <span translate="no">${esc(review.evidenceReferences.join(' ; '))}</span></p>`}` : p('À confirmer : aucun examen enregistré.')}`;
    })
    .join('')}
  <h2>3. Actions et conditions restant à traiter</h2>${view.actions.length ? `<ol>${view.actions.map((action) => `<li>${esc(`${action.questionId ?? 'Parcours'} : ${action.message} · Responsable : ${actors[action.owner]} · Avant : ${checkpointLabels[action.before]}`)}</li>`).join('')}</ol>` : p('Aucune action ouverte calculée. Les décisions humaines restent nécessaires.')}
  <h2>4. Comparaison des offres M16–M19</h2>${comparisonHtml}
  <h2>5. Réponses et examens par étape</h2>${catalog.stages
    .map(
      (stage) =>
        `<h2>Étape ${stage.id} · ${esc(stage.title)}</h2>${stage.questionIds
          .map((questionId) => {
            const schema = questionSchemas.find((q) => q.questionId === questionId)!;
            const source = catalog.questions.find((q) => q.id === questionId)!;
            const active = questionStates.has(questionId);
            return `<article class="question"><h3>${esc(questionId)} · ${esc(schema.prompt)}</h3>${p(`Auteur : ${source.author} · ${schema.pendingTeamReview ? 'Texte à valider par l’équipe' : 'Questions Ahmed révisées'} · ${active ? 'Question active ou à clarifier' : 'Question hors parcours actuel ; réponses conservées ci-dessous'}`)}${schema.fields
              .filter((field) => !['M17.score', 'M18.score', 'M19.score'].includes(field.id))
              .map(
                (field) =>
                  `<div class="field"><h4>${esc(field.label)} · ${esc(actors[field.actor])}</h4>${draft.answers[field.id]?.state === 'known' && field.type !== 'single' && field.type !== 'multi' ? original(answerText(field, draft.answers[field.id], locale)) : p(answerText(field, draft.answers[field.id], locale))}${!fieldStates.get(field.id)?.visible ? p('Champ hors parcours actuel : réponse non utilisée dans les décisions.') : ''}</div>`,
              )
              .join(
                '',
              )}${schema.helpParagraphs.map(p).join('')}${questionReview(questionId)}${schema.legalBasisParagraphs.length ? `<h4>Base légale et références source (texte de travail)</h4>${schema.legalBasisParagraphs.map(p).join('')}` : ''}${source.sourceUrls
              .filter((url) => url.startsWith('https://'))
              .map((url) => p(url))
              .join('')}</article>`;
          })
          .join('')}`,
    )
    .join('')}
  <h2>6. Registre des pièces jointes</h2>${p('Ce registre contient les métadonnées et empreintes, pas le contenu des fichiers. Les pièces restent téléchargeables dans le dossier, selon le rôle. Les identifiants permettent de retrouver les références piece:… des examens.')}<table><thead><tr><th>Question / fichier</th><th>Référence et empreinte</th><th>Accès / ajout</th></tr></thead><tbody>${draft.evidence.map((file) => `<tr><td>${esc(file.questionId)} · ${esc(file.originalName)}<br>${esc(file.mime)} · ${file.size} octets</td><td>${esc(`piece:${file.id}`)}<br>SHA-256 : ${esc(file.sha256)}</td><td>${file.visibility === 'shared' ? 'Partagée' : 'Interne'} · ${esc(actors[file.uploadedBy])}<br>${esc(file.createdAt)}</td></tr>`).join('')}</tbody></table>${draft.evidence.length ? '' : p('Aucune pièce jointe.')}
  <h2>7. Versions et traçabilité</h2>${p(`Format de rapport : ${REPORT_VERSION}\nCatalogue : ${catalog.version}\nRéponses : ${draft.schemaVersion}\nRègles exécutées : ${WORKFLOW_VERSION}\nDernière version enregistrée du brouillon : ${draft.workflowVersion}\nCalcul : ${SCORING_VERSION}`)}${p('Les réponses non renseignées, inconnues et hors parcours sont distinguées. Les anciens scores manuels M17–M19 sont conservés dans le JSON mais ignorés dans les calculs. La confirmation de comparaison et les examens peuvent être périmés ; cet état est conservé dans cet instantané.')}<p class="muted">Fin du rapport · ${esc(id)} · Créé le ${esc(createdAt)}</p></body></html>`;
  const snapshot = {
    locale,
    reportVersion: REPORT_VERSION,
    catalog,
    questionSchemas,
    draft,
    view,
    comparison,
    comparisonOffers: offers,
    executedVersions: { workflow: WORKFLOW_VERSION, scoring: SCORING_VERSION },
    legalApproval: false,
  };
  const payload = JSON.stringify({ html: translateReportHtml(html, locale), snapshot });
  return {
    formatVersion: 1,
    id,
    draftId: draft.id,
    createdAt,
    title: draft.title,
    revision: draft.revision,
    reportVersion: REPORT_VERSION,
    locale,
    payload,
    sha256: reportDigest(payload),
  };
}
