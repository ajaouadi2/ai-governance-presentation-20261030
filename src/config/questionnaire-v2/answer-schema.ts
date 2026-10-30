import catalog from './catalog.json';
import type { V2Actor, V2Field, V2Option, V2QuestionSchema } from '@/lib/questionnaire-v2-domain';

export const ANSWER_SCHEMA_VERSION = '2026-10-25.questionnaire-v2-answers.1';
export const UNKNOWN_LABEL = 'Je ne sais pas / À vérifier';
const yesNo = [
  { value: 'yes', label: 'Oui' },
  { value: 'no', label: 'Non' },
];

// Explicit semantic IDs are stored separately from the source labels and their ordering.
// A label can be clarified without changing saved values. No source outcome is executable.
const sourceOptionIds: Record<string, string[]> = {
  N1: ['yes', 'medical_or_safety', 'no'],
  N2: ['yes', 'no'],
  N3: ['decision_use', 'simple_task_exception_claimed', 'no'],
  N4: ['yes', 'no'],
  I1: ['yes', 'no'],
  I2: ['basis_claimed', 'no_basis'],
  I3: ['no_personal_data', 'ordinary_personal_data', 'sensitive_biometric_profile'],
  I4: ['anonymised', 'pseudonymised', 'excess_data'],
  I5: ['yes', 'excess_data'],
  I6: ['two_or_more_claimed', 'fewer_than_two_claimed'],
  I7: ['no', 'yes'],
  I8: ['no_decision', 'human_control', 'fully_automated'],
  M1: ['paid', 'free', 'free_with_data_use'],
  M2: ['no', 'yes'],
  M3: ['model_provider', 'intermediary'],
  M4: ['below_150k', '150k_to_below_250k', '250k_to_below_350k', '350k_or_more'],
  M5: ['no', 'split_maintained'],
  M6: ['no', 'sole_supplier_claimed', 'below_150k'],
  M7: ['no_brand', 'brand_or_equivalent', 'brand_only'],
  M8: ['yes', 'no'],
  M9: ['no', 'yes'],
  M9a: ['yes', 'no'],
  M9b: ['yes', 'no'],
  M10: ['no_with_attestations', 'yes'],
  M11: ['yes_with_attestation', 'no'],
  M12: ['yes_with_evidence', 'no'],
  M13: ['yes', 'no'],
  M14: ['certified', 'equivalent_evidence', 'in_progress', 'none_high_risk', 'none_not_high_risk'],
  M15: ['yes', 'equivalent', 'none_high_risk', 'none_not_high_risk'],
  D1: ['switzerland', 'eu', 'other_listed_country', 'us_dpf', 'us_law_group', 'us_no_dpf', 'other'],
  D2: ['switzerland', 'eu', 'other_listed_country', 'us_dpf', 'us_law_group', 'other'],
  D3: ['switzerland', 'listed_country', 'us_dpf', 'other'],
  D4: ['switzerland', 'eea', 'us_dpf', 'other_us_law', 'other'],
  D5: [
    'consent',
    'data_subject_contract',
    'third_party_contract',
    'public_interest_or_legal_claim',
    'vital_interest',
    'public_register',
    'contractual_safeguards',
    'no_basis',
  ],
  D6: ['purpose_based_retention', 'as_long_as_necessary'],
  D7: ['encrypted_unil_keys', 'encrypted_supplier_keys', 'transit_only', 'not_encrypted'],
  D8: ['never', 'opt_in', 'opt_out', 'mandatory_reuse'],
  D9: ['yes_with_contact', 'no'],
  D10: ['within_ten_workdays', 'excluding_backups_logs', 'not_possible'],
  D11: ['24_to_72_hours', 'over_72_hours'],
  D12: ['described_audited', 'described_not_audited', 'objective_missing', 'not_described'],
  D13: ['all_metadata', 'partial', 'request_content_logged'],
  D14: ['at_least_one_year', 'no_high_risk', 'no_not_high_risk'],
  S1: ['yes', 'no_conversation', 'no'],
  S14: ['no', 'human_approval_and_disable', 'no_approval'],
  S20: ['yes', 'no_mandatory_use', 'no_optional_use'],
  M16: ['yes', 'no'],
  M17: ['complete', 'partial', 'none'],
  M19: ['quantified', 'general_statement', 'no'],
  M20: ['yes', 'with_changes', 'no'],
  M21: ['yes', 'absolute_confidentiality'],
  M22: ['yes', 'policy_no_indemnity', 'no'],
  M24: ['yes', 'no'],
  M25: ['yes', 'no'],
  M26: ['yes', 'no', 'unknown'],
  M27: ['yes', 'no'],
  M28: ['yes', 'no'],
  M29: ['export_and_attested_deletion', 'export_only', 'no'],
  M30: ['yes', 'no'],
  M31: ['yes', 'no'],
};
for (const id of ['S2', 'S3', 'S4', 'S5', 'N5', 'N6', 'N7', 'N8', 'N11']) {
  sourceOptionIds[id] = ['yes', 'no', 'not_high_risk'];
}
for (const id of [
  'S6',
  'S7',
  'S8',
  'S9',
  'S10',
  'S11',
  'S12',
  'S13',
  'S15',
  'S16',
  'S17',
  'S18',
  'S19',
  'S21',
  'N9',
  'N10',
]) {
  sourceOptionIds[id] = ['yes', 'no'];
}

function options(items: [string, string][]): V2Option[] {
  return items.map(([value, label]) => ({ value, label }));
}
function builder(questionId: string, actor: V2Actor) {
  const base = (key: string, label: string, required = false) => ({
    id: `${questionId}.${key}`,
    questionId,
    label,
    actor,
    required,
    allowUnknown: true as const,
    unknownLabel: UNKNOWN_LABEL,
  });
  return {
    choice: (
      key: string,
      label: string,
      choices = yesNo,
      multi = false,
      required = true,
    ): V2Field => ({
      ...base(key, label, required),
      type: multi ? 'multi' : 'single',
      options: choices,
    }),
    text: (key: string, label: string, required = false): V2Field => ({
      ...base(key, label, required),
      type: 'textarea',
      maxLength: 12000,
    }),
    number: (
      key: string,
      label: string,
      unit?: string,
      max?: number,
      required = true,
    ): V2Field => ({
      ...base(key, label, required),
      type: 'number',
      min: 0,
      ...(max === undefined ? {} : { max }),
      ...(unit ? { unit } : {}),
    }),
    date: (key: string, label: string): V2Field => ({ ...base(key, label), type: 'date' }),
  };
}

function reviewFields(id: string, labels: [string, string][]): V2Field[] {
  const f = builder(id, 'reviewer');
  return [
    f.choice('review_status', 'État de l’examen UNIL', options(labels)),
    f.text('review_analysis', 'Analyse, obligations, dates ou divergences à préciser', true),
    f.text('review_owner', 'Responsable de l’examen'),
    f.text('review_reference', 'Référence des documents ou de l’avis'),
    f.text('review_actions', 'Informations et actions restant à obtenir'),
  ];
}

function ahmedFields(id: string, prompt: string): V2Field[] | undefined {
  const u = builder(id, 'unil');
  const s = builder(id, 'supplier');
  switch (id) {
    case 'A1':
      return [
        u.choice(
          'activities',
          prompt,
          options([
            ['teaching', 'Enseignement ou apprentissage'],
            ['research', 'Recherche scientifique'],
            ['administration', 'Administration, ressources humaines ou communication'],
            ['other', 'Autre : préciser'],
          ]),
          true,
        ),
        u.text('use_example', 'Exemple concret d’utilisation', true),
        u.text('people_and_information', 'Personnes concernées et informations utilisées', true),
        u.text('other_activity', 'Autre activité à préciser'),
      ];
    case 'A2':
      return [
        u.choice(
          'ai_screening',
          prompt,
          options([
            ['yes_documented', 'Oui, selon la documentation disponible'],
            [
              'no_inference',
              'Non, uniquement des règles ou opérations définies à l’avance, sans cette capacité d’inférence',
            ],
          ]),
        ),
        u.text('functions', 'Principales fonctions', true),
        u.text('documentation', 'Documentation utilisée ou référence de la pièce'),
        ...reviewFields(id, [
          ['ai_confirmed', 'Qualification IA confirmée'],
          ['ai_excluded', 'Qualification IA écartée'],
          ['needs_information', 'Informations ou avis requis'],
        ]),
      ];
    case 'A3':
      return [
        u.choice(
          'eu_market',
          'A3a — Le fournisseur propose-t-il ce système sur le marché de l’Union européenne ?',
        ),
        u.text('eu_market_details', 'Informations disponibles sur l’offre dans l’UE'),
        u.choice(
          'eu_deployment',
          'A3b — L’utilisation prévue implique-t-elle un établissement ou une activité de déploiement dans l’Union européenne ?',
        ),
        u.text('eu_deployment_details', 'Établissement ou activité à préciser'),
        u.choice(
          'eu_outputs',
          'A3c — Des résultats produits par le système seront-ils utilisés dans l’Union européenne ?',
        ),
        u.text('eu_outputs_details', 'Par qui, où et pour quel usage ?'),
        ...reviewFields(id, [
          ['analysis_available', 'Analyse motivée disponible'],
          ['needs_information', 'Informations ou avis requis'],
        ]),
        builder(id, 'reviewer').text(
          'contractual_safeguards',
          'Garanties demandées au-delà de l’application directe de l’AI Act et approbateur',
        ),
      ];
    case 'A4':
      return [
        u.choice(
          'planned_changes',
          prompt,
          options([
            ['intended_use', 'Utilisation conforme à la finalité prévue par le fournisseur'],
            ['functional_change', 'Modification du fonctionnement'],
            ['purpose_change', 'Changement de finalité'],
            ['own_brand', 'Présentation sous le nom ou la marque de l’UNIL'],
            [
              'commissioned_development',
              'Développement réalisé ou commandé pour son propre usage ou sous son nom',
            ],
          ]),
          true,
        ),
        u.text('change_details', 'Finalité prévue et changements envisagés', true),
        u.text('supplier_position', 'Documentation et position du fournisseur'),
        ...reviewFields(id, [
          ['role_confirmed', 'Rôle et obligations confirmés'],
          ['needs_information', 'Informations ou avis requis'],
        ]),
      ];
    case 'A5':
      return [
        u.choice(
          'eu_establishment',
          'A5a — Le traitement est-il effectué dans le cadre des activités d’un établissement dans l’Union européenne ?',
        ),
        u.text('eu_establishment_details', 'Acteur et établissement à préciser'),
        u.choice(
          'eu_services',
          'A5b — Le traitement est-il lié à une offre de biens ou de services destinée à des personnes se trouvant dans l’Union européenne ?',
        ),
        u.text('eu_services_details', 'Services et personnes visées'),
        u.choice(
          'eu_monitoring',
          'A5c — Le traitement sert-il à suivre le comportement de personnes, dans la mesure où ce comportement a lieu dans l’Union européenne ?',
        ),
        u.text('eu_monitoring_details', 'Suivi et comportement concernés'),
        ...reviewFields(id, [
          ['analysis_available', 'Analyse motivée disponible'],
          ['needs_information', 'Avis ou informations requis'],
        ]),
      ];
    case 'A6':
      return [
        u.choice(
          'challenge_procedure',
          prompt,
          options([
            [
              'operational',
              'Procédure opérationnelle avec une personne habilitée à modifier la décision',
            ],
            ['planned', 'Procédure à mettre en place avant les décisions concernées'],
            ['none', 'Aucune procédure prévue'],
            [
              'no_person_decision',
              'L’outil ne contribue pas à des décisions concernant des personnes',
            ],
          ]),
        ),
        u.text('contact', 'Contact ou responsable de la préparation'),
        u.text('procedure', 'Modalités, délais et pouvoirs du réviseur', true),
        u.text('notice', 'Information des personnes concernées'),
        u.text('procedure_reference', 'Référence de la procédure'),
      ];
    case 'T1':
      return [
        s.text('system_version', 'Système et version', true),
        s.text('intended_uses', 'Finalité prévue et usages couverts ou exclus', true),
        s.text('classification', 'Qualification retenue et raisonnement', true),
        s.choice(
          'classification_status',
          'Disponibilité de la qualification et de la justification',
          options([
            ['provided', 'Qualification et justification fournies'],
            ['in_progress', 'Analyse en cours'],
            ['none', 'Aucune justification disponible'],
            ['scope_disputed', 'Applicabilité de l’AI Act contestée'],
          ]),
        ),
        s.date('analysis_due', 'Échéance de l’analyse en cours'),
        s.text('classification_reference', 'Documents justificatifs'),
        s.text(
          'exception_assessment',
          'Conditions et évaluation documentée d’une exception à l’annexe III, si invoquée',
        ),
        ...reviewFields(id, [
          ['consistent', 'Compatible avec l’usage prévu, avec justification'],
          ['discrepancy', 'Divergence à résoudre'],
          ['insufficient_information', 'Informations insuffisantes'],
        ]),
      ];
    case 'T2':
      return [
        s.choice(
          'governing_law',
          'T2a — Quel droit régit le contrat proposé ?',
          options([
            ['swiss', 'Droit suisse'],
            ['other', 'Autre droit'],
            ['unspecified', 'Non précisé'],
            ['to_negotiate', 'À négocier'],
          ]),
        ),
        s.text('governing_law_details', 'Droit ou points à négocier à préciser'),
        s.choice(
          'dispute_resolution',
          'T2b — Quels tribunaux ou mécanismes de règlement des litiges sont prévus ?',
          options([
            ['swiss_courts', 'Tribunaux en Suisse'],
            ['foreign_courts', 'Tribunaux à l’étranger'],
            ['arbitration', 'Arbitrage'],
            ['unspecified', 'Non précisé'],
            ['to_negotiate', 'À négocier'],
          ]),
        ),
        s.text('dispute_resolution_details', 'Tribunal ou mécanisme à préciser'),
        s.text('clause_reference', 'Clause et documents contractuels incorporés', true),
        ...reviewFields(id, [
          ['validated', 'Clauses validées'],
          ['changes_or_advice', 'Modification ou avis requis'],
        ]),
      ];
    default:
      return undefined;
  }
}

/** Move whole balanced legal parentheses to reference display, preserving ordinary examples. */
function displayText(title: string): { prompt: string; inlineReferences: string[] } {
  let prompt = '';
  const inlineReferences: string[] = [];
  for (let i = 0; i < title.length; i++) {
    if (title[i] !== '(') {
      prompt += title[i];
      continue;
    }
    let depth = 1;
    let end = i + 1;
    for (; end < title.length && depth; end++) {
      if (title[end] === '(') depth++;
      if (title[end] === ')') depth--;
    }
    const content = title.slice(i, end);
    if (
      !depth &&
      /AI Act|art\.|Cst\.|LPrD|RGPD|AIMP|LDA|LInfo|OPDo|lignes directrices|bonne pratique/.test(
        content,
      )
    ) {
      inlineReferences.push(content.slice(1, -1));
    } else {
      prompt += content;
    }
    i = end - 1;
  }
  return {
    prompt: prompt
      .replace(/^[A-Z]\d+[ab]?\.\s*/, '')
      .replace(/\s+/g, ' ')
      .trim(),
    inlineReferences,
  };
}

function sourceFields(q: (typeof catalog.questions)[number], prompt: string): V2Field[] {
  const f = builder(q.id, q.respondent as V2Actor);
  const sourceOptions = q.sourceParagraphs
    .map((paragraph, index) => ({ paragraph, index }))
    .filter(({ paragraph }) => paragraph.includes('→'));
  const ids = sourceOptionIds[q.id];
  const fields: V2Field[] = [];
  if (q.id === 'M18') {
    fields.push(f.number('total_cost', prompt));
    fields.push(f.text('currency', 'Devise du coût total', true));
    fields.push(
      f.text(
        'cost_scope',
        'Période et postes inclus : licences, intégration, formation, sortie',
        true,
      ),
    );
  } else {
    if (!ids || ids.length !== sourceOptions.length)
      throw new Error(`Options source non couvertes : ${q.id}`);
    // M26 already has an explicit unknown answer: represent it as the common unknown state.
    const choices = sourceOptions.flatMap(({ paragraph, index }, i) =>
      ids[i] === 'unknown'
        ? []
        : [
            {
              value: ids[i],
              label: paragraph.split('→')[0].trim(),
              sourceParagraph: index,
            },
          ],
    );
    fields.push(f.choice('response', prompt, choices));
    fields.push(f.text('details', 'Précisions ou situation non couverte par les réponses source'));
  }
  // This is a textual reference only. Actual file attachment and access control come later.
  fields.push(f.text('evidence_reference', 'Référence des justificatifs ou documents disponibles'));
  if (q.id === 'M4')
    fields.push(
      f.number('estimated_value', 'Valeur totale estimée, hors TVA', 'CHF', undefined, false),
    );
  if (['M16', 'M17', 'M18', 'M19'].includes(q.id)) {
    const r = builder(q.id, 'reviewer');
    fields.push(r.text('evaluation', 'Résultats et justification de l’évaluation UNIL'));
    // No scoring formula, auto-score, weight or default. The scoring rules remain step 5.
    fields.push(
      r.number('score', 'Note attribuée par l’UNIL — barème à confirmer', 'points', 5, false),
    );
  }
  return fields;
}

export const questionSchemas: V2QuestionSchema[] = catalog.questions.map((q) => {
  const { prompt, inlineReferences } = displayText(q.title);
  const instructions: string[] = q.sourceInstructionParagraphs;
  return {
    questionId: q.id,
    prompt,
    fields: ahmedFields(q.id, prompt) ?? sourceFields(q, prompt),
    helpParagraphs: q.sourceParagraphs
      .slice(1, -1)
      .filter((p) => !p.includes('→') && !p.includes('☐') && !instructions.includes(p)),
    legalBasisParagraphs: [q.legalBasisText, ...inlineReferences],
    sourceInstructions: q.sourceInstructionParagraphs,
    pendingTeamReview: q.wordingStatus === 'team-source-awaiting-review',
  };
});

export const answerFields = questionSchemas.flatMap((q) => q.fields);
export const answerFieldById = new Map(answerFields.map((field) => [field.id, field]));
if (answerFieldById.size !== answerFields.length)
  throw new Error('Identifiants de champ v2 dupliqués');
