import englishPrompts from './prompts.en.json';
import raw from './proposal.json';
export const PDF_VERSION = '2026-10-26.pdf-questionnaire.2';
export const canonicalPdfId = (id: string) =>
  (({ 'P-A10': 'P-D14', 'P-C15': 'P-A18' }) as Record<string, string>)[id] ?? id;
export type PdfActor = 'unil' | 'supplier' | 'reviewer';
export type PdfLocale = 'fr' | 'en';
export type Phase = 'procedure' | 'selection' | 'signature' | 'deployment' | 'followup';
export const phases: Phase[] = ['procedure', 'selection', 'signature', 'deployment', 'followup'];
export const phaseLabels: Record<Phase, [string, string]> = {
  procedure: ['Lancement de procédure', 'Procedure launch'],
  selection: ['Sélection', 'Selection'],
  signature: ['Signature', 'Signature'],
  deployment: ['Mise en service', 'Deployment'],
  followup: ['Suivi', 'Follow-up'],
};
export const sections = [
  ['E', 'Entrée et qualification', 'Entry and qualification'],
  ['U-D', 'UNIL · Données', 'UNIL · Data'],
  ['U-A', 'UNIL · Usage et préparation', 'UNIL · Use and preparation'],
  ['U-M', 'UNIL · Achat', 'UNIL · Procurement'],
  ['P-D', 'Fournisseur · Données', 'Supplier · Data'],
  ['P-A', 'Fournisseur · Outil et garanties', 'Supplier · Tool and safeguards'],
  ['P-C', 'Fournisseur · Participation et contrat', 'Supplier · Participation and contract'],
  ['POST', 'Publication et suivi', 'Publication and follow-up'],
] as const;
export type Choice = { value: string; fr: string; en: string; signal?: 'stop' | 'correction' };
const c = (value: string, fr: string, en: string, signal?: Choice['signal']): Choice => ({
  value,
  fr,
  en,
  ...(signal ? { signal } : {}),
});
const standard = [
  c('documented', 'Oui, documenté', 'Yes, documented'),
  c('planned', 'Prévu, pas encore réalisé', 'Planned, not yet completed', 'correction'),
  c('missing', 'Non / garantie absente', 'No / safeguard missing', 'correction'),
];
const overrides: Record<string, Choice[]> = {
  'U-D03': [
    c('none', 'Aucune donnée personnelle', 'No personal data'),
    c('ordinary', 'Données ordinaires', 'Ordinary personal data'),
    c('mixed', 'Données ordinaires et sensibles', 'Ordinary and sensitive personal data'),
    c(
      'sensitive',
      'Données sensibles / biométrie / profils à détailler',
      'Sensitive data / biometrics / profiles: specify',
    ),
  ],
  'U-D04': [
    c('anonymous', 'Anonymisation vérifiée', 'Verified anonymisation'),
    c('pseudonymous', 'Pseudonymisation documentée', 'Documented pseudonymisation'),
    c(
      'identified',
      'Identification nécessaire et justifiée',
      'Necessary, justified identification',
    ),
    c(
      'excess',
      'Identification ou collecte excessive',
      'Excessive identification or collection',
      'stop',
    ),
    c('planned', 'Analyse en cours', 'Assessment in progress', 'correction'),
  ],
  'U-D05': [
    c('documented', 'Nécessité justifiée par catégorie', 'Necessity justified by category'),
    c('excess', 'Collecte excessive', 'Excessive collection', 'stop'),
  ],
  'U-D10': [
    c('none', 'Aucune décision individuelle', 'No individual decision'),
    c('human', 'Aide avec contrôle humain effectif', 'Assistance with effective human control'),
    c('automated', 'Décision entièrement automatisée', 'Fully automated decision', 'stop'),
  ],
  'U-A02': [
    c('none', 'Aucun des sous-points déclaré', 'None of the listed practices declared'),
    c(
      'present',
      'Au moins un sous-point ou une exception à examiner',
      'At least one practice or claimed exception',
      'stop',
    ),
  ],
  'U-A03': [
    c('possible', 'Usage potentiellement à haut risque', 'Potential high-risk use'),
    c('simple', 'Exception de tâche simple invoquée', 'Simple-task exception claimed'),
    c(
      'none',
      'Aucune catégorie identifiée, à examiner',
      'No category identified, subject to review',
    ),
  ],
  'U-A10': [
    c('mandatory', 'Obligatoire', 'Mandatory'),
    c('optional', 'Facultatif', 'Optional'),
    c('mixed', 'Selon les groupes / usages', 'Depends on group / use'),
  ],
  'U-M01': [
    c('paid', 'Prix payé', 'Paid price'),
    c('data', 'Données ou autre avantage', 'Data or another advantage'),
    c('free', 'Gratuit sans contrepartie identifiée', 'Free, no consideration identified'),
  ],
  'U-M02': [
    c('none', 'Pas de contrat existant', 'No existing contract'),
    c('covered', 'Couverture confirmée', 'Coverage confirmed'),
    c('partial', 'Couverture partielle', 'Partial coverage', 'correction'),
    c('planned', 'Analyse en cours', 'Assessment in progress', 'correction'),
  ],
  'U-M03': [
    c('direct', 'Fournisseur direct', 'Direct provider'),
    c('chain', 'Intégrateur / chaîne de prestataires', 'Integrator / provider chain'),
  ],
  'U-M06': [
    c('none', 'Pas d’exception invoquée', 'No exception claimed'),
    c('claimed', 'Exception invoquée et documentée', 'Documented exception claimed'),
    c('planned', 'Analyse en cours', 'Assessment in progress', 'correction'),
  ],
  'U-M09': [
    c('quality', 'Prix et qualité', 'Price and quality'),
    c('exception', 'Prix seul avec exception à examiner', 'Price only with exception to review'),
    c('unjustified', 'Prix seul sans justification', 'Price only without justification', 'stop'),
  ],
  'P-D07': [
    c(
      'unil_keys',
      'Repos et transit, clés maîtrisées par l’UNIL',
      'At rest and in transit, UNIL-controlled keys',
    ),
    c(
      'supplier_keys',
      'Repos et transit, clés fournisseur',
      'At rest and in transit, supplier keys',
      'stop',
    ),
    c('transit', 'Transit seulement', 'In transit only', 'stop'),
    c('none', 'Pas de chiffrement', 'No encryption', 'stop'),
  ],
  'P-D08': [
    c('never', 'Aucune réutilisation', 'No reuse'),
    c('opt_in', 'Activation explicite possible', 'Explicit opt-in possible', 'stop'),
    c('opt_out', 'Activé par défaut, désactivable', 'On by default, opt-out available', 'stop'),
    c('mandatory', 'Réutilisation obligatoire', 'Mandatory reuse', 'stop'),
  ],
  'P-D11': [
    c('under24', 'Moins de 24 heures', 'Under 24 hours'),
    c('24', 'Au plus 24 heures', 'At most 24 hours'),
    c('24to72', 'Plus de 24 à 72 heures', 'Over 24 up to 72 hours'),
    c('over72', 'Plus de 72 heures', 'Over 72 hours', 'correction'),
    c('unset', 'Délai non fixé', 'No agreed delay', 'correction'),
  ],
  'P-D16': [
    c('metadata', 'Événements et métadonnées nécessaires', 'Necessary events and metadata'),
    c('content', 'Contenu des requêtes journalisé', 'Request content logged', 'stop'),
    c('none', 'Pas de journaux', 'No logs', 'correction'),
  ],
  'P-A01': [
    c('documented', 'Information fournie et documentée', 'Documented disclosure'),
    c('none', 'Aucune interaction', 'No interaction'),
    c('missing', 'Information absente', 'No disclosure', 'correction'),
  ],
  'P-A02': [
    c('documented', 'Marquage documenté', 'Documented marking'),
    c('none', 'Pas de génération de contenus', 'No content generation'),
    c('missing', 'Marquage absent', 'No marking', 'correction'),
  ],
  'P-A03': [
    c('documented', 'Déjà obtenu, preuve disponible', 'Already obtained, evidence available'),
    c('planned', 'En cours avec échéance', 'In progress with deadline', 'correction'),
    c('missing', 'Absent', 'Absent', 'stop'),
  ],
  'P-A15': [
    c('none', 'Aucune action externe', 'No external actions'),
    c('controlled', 'Actions limitées et contrôlées', 'Limited, controlled actions'),
    c(
      'uncontrolled',
      'Autonomie sans contrôle suffisant',
      'Autonomy without sufficient controls',
      'stop',
    ),
  ],
  'P-C10': [
    c('none', 'Aucun motif déclaré, attestations', 'No grounds declared, attestations'),
    c('present', 'Motif à examiner', 'Grounds requiring review', 'stop'),
  ],
  'P-C14': [
    c('certified', 'ISO 27001 et périmètre documentés', 'Documented ISO 27001 and scope'),
    c('equivalent', 'Preuves alternatives à examiner', 'Alternative evidence to examine'),
    c('planned', 'Certification en cours', 'Certification in progress', 'correction'),
    c('missing', 'Aucune preuve', 'No evidence', 'stop'),
  ],
  'P-A18': [
    c('certified', 'ISO 42001 documentée', 'Documented ISO 42001'),
    c('equivalent', 'Autre système documenté', 'Another documented system'),
    c('planned', 'En cours', 'In progress', 'correction'),
    c('missing', 'Absent', 'Absent', 'stop'),
  ],
  'P-C21': [
    c('documented', 'Clause adaptée', 'Suitable clause'),
    c('planned', 'Négociation en cours', 'Negotiation in progress', 'correction'),
    c('absolute', 'Confidentialité absolue exigée', 'Absolute confidentiality required', 'stop'),
  ],
  'P-C25': [
    c('open', 'Composants sous licence ouverte', 'Open-licensed components'),
    c('closed', 'Pas de licence ouverte', 'No open licence'),
    c('mixed', 'Licences mixtes', 'Mixed licences'),
  ],
  'P-C26': [
    c('yes', 'Régime invoqué et documenté', 'Documented regime claimed'),
    c('no', 'Non, justification', 'No, with reasons'),
    c('planned', 'Analyse en cours', 'Assessment in progress', 'correction'),
  ],
};
const countries = [
  c('switzerland', 'Suisse uniquement', 'Switzerland only'),
  c('eea', 'EEE / pays adéquat à préciser', 'EEA / adequate country: specify'),
  c('us_dpf', 'États-Unis / DPF invoqué', 'United States / DPF claimed', 'stop'),
  c(
    'other',
    'Autres pays ou droit d’accès à examiner',
    'Other countries or access law to examine',
    'stop',
  ),
  c('multiple', 'Plusieurs pays / prestataires', 'Multiple countries / providers', 'stop'),
];
for (const id of ['P-D01', 'P-D02', 'P-D03', 'P-D04']) overrides[id] = countries;
overrides['P-C15'] = overrides['P-A18'];
const stops = new Set(['U-D01', 'U-D02', 'P-C11', 'P-D05', 'P-D12', 'P-D13', 'P-A05', 'P-A22']);
export const EN_PROMPTS: Record<string, string> = englishPrompts;
export const pdfQuestions = raw.questions.map((q) => {
  const section = sections.find((s) => q.id.startsWith(s[0]))![0];
  const choices =
    overrides[q.id] ??
    standard.map((x) =>
      x.value === 'missing' && stops.has(q.id) ? { ...x, signal: 'stop' as const } : x,
    );
  let deadline: Phase =
    section === 'U-M'
      ? 'procedure'
      : /^P-C1/.test(q.id)
        ? 'selection'
        : section === 'P-D' || section === 'P-C'
          ? 'signature'
          : section === 'P-A'
            ? 'signature'
            : section === 'POST'
              ? 'followup'
              : 'deployment';
  if (
    section === 'E' ||
    ['U-D01', 'U-D02', 'U-D03', 'U-D04', 'U-D05', 'U-A01', 'U-A02', 'U-A03'].includes(q.id)
  )
    deadline = 'procedure';
  if (q.id === 'U-D09' || q.id === 'POST30') deadline = 'signature';
  if (q.id === 'POST31') deadline = 'deployment';
  if (['P-A13', 'P-A14'].includes(q.id)) deadline = 'selection';
  if (['U-M01', 'U-M02', 'U-M03', 'U-M06'].includes(q.id)) deadline = 'selection';
  return {
    ...q,
    effect: q.effect
      .replace(
        'La structure d’activation finale reste ouverte en D01.',
        'L’app conserve les questions visibles et demande une revue motivée de l’applicabilité.',
      )
      .replace(
        'Activation finale D01.',
        'Applicabilité examinée sans masquer automatiquement les questions.',
      )
      .replace(
        'Activation D01.',
        'Applicabilité examinée sans masquer automatiquement les questions.',
      )
      .replace(
        'Placement et activation réservés D01.',
        'Question conservée ; l’évaluateur confirme son applicabilité.',
      ),
    section,
    owner: (section.startsWith('P-') ? 'supplier' : 'unil') as PdfActor,
    deadline,
    choices: [
      ...choices,
      c('unknown', 'Je ne sais pas / à vérifier', 'Unknown / to verify'),
      c('not_applicable', 'Non applicable, à justifier', 'Not applicable, reasons required'),
    ],
    declarationStatus: 'legal-reference-pending-review' as const,
  };
});
export const pdfById = new Map(pdfQuestions.map((q) => [q.id, q]));
export type PdfQuestion = (typeof pdfQuestions)[number];
export const outcomeLabels = {
  continue: ['Poursuivre l’évaluation', 'Continue assessment'],
  information: ['Informations à compléter', 'Information required'],
  signature: ['Correction requise avant signature', 'Correction required before signature'],
  deployment: ['Correction requise avant mise en service', 'Correction required before deployment'],
  block: ['Point bloquant à examiner', 'Blocking point to examine'],
} as const;
