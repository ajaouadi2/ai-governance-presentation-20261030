import catalog from './catalog.json';
import { questionSchemas } from './answer-schema';

export const WORKFLOW_VERSION = '2026-10-25.questionnaire-v2-workflow.2';
export const checkpoints = ['assessment', 'supplier-selection', 'signature', 'deployment'] as const;
export type V2Checkpoint = (typeof checkpoints)[number];
export type V2Truth = 'true' | 'false' | 'unknown';
export const checkpointLabels: Record<V2Checkpoint, string> = {
  assessment: 'Poursuite de l’évaluation',
  'supplier-selection': 'Sélection d’un fournisseur',
  signature: 'Signature du contrat',
  deployment: 'Mise en service',
};

/** Dependencies are root IDs. Their full answer blocks bind the review to its facts. */
export const scopeDefinitions = {
  ai: {
    label: 'Qualification comme système d’IA',
    dependencies: ['A1', 'A2', 'A4'],
    before: 'assessment',
  },
  personal_data: {
    label: 'Présence de données personnelles',
    dependencies: ['A1', 'I3'],
    before: 'assessment',
  },
  ordinary_data: {
    label: 'Données personnelles ordinaires',
    dependencies: ['A1', 'I3', 'D1', 'D3'],
    before: 'signature',
  },
  sensitive_data: {
    label: 'Données sensibles, biométriques ou profils',
    dependencies: ['A1', 'I3', 'D2', 'D4'],
    before: 'signature',
  },
  high_risk: {
    label: 'Parcours haut risque',
    dependencies: ['A1', 'A2', 'A4', 'N3', 'T1'],
    before: 'signature',
  },
  procurement: {
    label: 'Existence d’un marché public',
    dependencies: ['M1', 'M2', 'M3'],
    before: 'supplier-selection',
  },
  new_procurement: {
    label: 'Nouvelle procédure d’achat',
    dependencies: ['M1', 'M2', 'M3', 'M4', 'M5'],
    before: 'supplier-selection',
  },
  competition: {
    label: 'Préparation de la mise en concurrence',
    dependencies: ['M1', 'M2', 'M4', 'M5', 'M6'],
    before: 'supplier-selection',
  },
} satisfies Record<string, { label: string; dependencies: string[]; before: V2Checkpoint }>;
export type V2Scope = keyof typeof scopeDefinitions;

/** A source trigger activates checks; only a current justified review establishes an exemption. */
export type Activation = { scope: V2Scope } | { all: Activation[] };
const scope = (name: V2Scope): Activation => ({ scope: name });
const all = (...names: V2Scope[]): Activation => ({ all: names.map(scope) });
export const questionActivation: Record<string, Activation> = {};
function activate(ids: string[], rule: Activation) {
  for (const id of ids) questionActivation[id] = rule;
}
activate(
  ['A3', 'A4', 'N1', 'N2', 'N3', 'I8', 'N9', 'N10', 'M9b', 'M15', 'M20', 'M25', 'M26', 'M27'],
  scope('ai'),
);
activate(['A5', 'I1', 'I2', 'I4', 'I5', 'I6', 'I7', 'D9', 'D10', 'D11'], scope('personal_data'));
activate(['D1', 'D3', 'D5'], all('personal_data', 'ordinary_data'));
activate(['D2', 'D4'], all('personal_data', 'sensitive_data'));
activate(['S2', 'S3', 'S4', 'S5', 'N5', 'N6', 'N7', 'N8', 'N11'], all('ai', 'high_risk'));
activate(['S1', 'S9', 'S10', 'S11', 'S12', 'S14'], scope('ai'));
activate(
  ['M4', 'M5', 'M6', 'M10', 'M11', 'M12', 'M13', 'M16', 'M17', 'M18', 'M19', 'M9a'],
  all('procurement', 'new_procurement'),
);
activate(['M7', 'M8', 'M9'], all('procurement', 'new_procurement', 'competition'));
questionActivation.M9b = all('ai', 'procurement', 'new_procurement');
questionActivation.M30 = scope('procurement');
// Accessibility, confidentiality and generic contract questions remain relevant to non-AI tools.
// A6 remains visible: the right to challenge a decision is not resolved by a high-risk exemption.

export type FieldCondition = { fieldId: string; values: string[] };
export const fieldConditions: Record<string, FieldCondition> = {
  'A1.other_activity': { fieldId: 'A1.activities', values: ['other'] },
  'A3.eu_market_details': { fieldId: 'A3.eu_market', values: ['yes'] },
  'A3.eu_deployment_details': { fieldId: 'A3.eu_deployment', values: ['yes'] },
  'A3.eu_outputs_details': { fieldId: 'A3.eu_outputs', values: ['yes'] },
  'A5.eu_establishment_details': { fieldId: 'A5.eu_establishment', values: ['yes'] },
  'A5.eu_services_details': { fieldId: 'A5.eu_services', values: ['yes'] },
  'A5.eu_monitoring_details': { fieldId: 'A5.eu_monitoring', values: ['yes'] },
  'A6.procedure': { fieldId: 'A6.challenge_procedure', values: ['operational', 'planned'] },
  'A6.contact': { fieldId: 'A6.challenge_procedure', values: ['operational', 'planned', 'none'] },
  'A6.notice': { fieldId: 'A6.challenge_procedure', values: ['operational', 'planned'] },
  'A6.procedure_reference': { fieldId: 'A6.challenge_procedure', values: ['operational'] },
  'T1.analysis_due': { fieldId: 'T1.classification_status', values: ['in_progress'] },
  'T2.governing_law_details': { fieldId: 'T2.governing_law', values: ['other', 'to_negotiate'] },
  'T2.dispute_resolution_details': {
    fieldId: 'T2.dispute_resolution',
    values: ['swiss_courts', 'foreign_courts', 'arbitration', 'to_negotiate'],
  },
};
export const questionConditions: Record<string, FieldCondition> = {
  D5: { fieldId: 'D3.response', values: ['other'] },
};

export const evidenceClaims: Record<string, string[]> = {
  M10: ['no_with_attestations'],
  M11: ['yes_with_attestation'],
  M12: ['yes_with_evidence'],
  M13: ['yes'],
  M14: ['certified', 'equivalent_evidence', 'in_progress'],
  M15: ['yes', 'equivalent'],
  D7: ['encrypted_unil_keys', 'encrypted_supplier_keys'],
  D8: ['never', 'opt_in', 'opt_out'],
  D9: ['yes_with_contact'],
  D12: ['described_audited', 'described_not_audited'],
  D13: ['all_metadata'],
  D14: ['at_least_one_year'],
  M20: ['yes', 'with_changes'],
  M21: ['yes'],
  M22: ['yes'],
  M24: ['yes'],
  M29: ['export_and_attested_deletion', 'export_only'],
};
for (let i = 1; i <= 21; i++) evidenceClaims[`S${i}`] = ['yes'];

export function questionCheckpoint(id: string): V2Checkpoint {
  const question = catalog.questions.find((q) => q.id === id);
  if (!question) throw new Error(`Question inconnue : ${id}`);
  if (question.stage <= 3) return 'assessment';
  if (question.stage === 4 || /^M1[0-9]$/.test(id)) return 'supplier-selection';
  return question.stage === 6 ? 'deployment' : 'signature';
}

export type SourceSignal = {
  value: string;
  kind: 'stop' | 'condition' | 'negotiation';
  sourceText: string;
};
/** Interpret only the need for human follow-up, never automatic legality or compliance. */
export const sourceSignals: Record<string, SourceSignal[]> = Object.fromEntries(
  questionSchemas.map((schema) => {
    const source = catalog.questions.find((q) => q.id === schema.questionId)!;
    const field = schema.fields.find((f) => f.id === `${schema.questionId}.response`);
    if (!field || field.type !== 'single') return [schema.questionId, []];
    return [
      schema.questionId,
      field.options.flatMap((option): SourceSignal[] => {
        if (option.sourceParagraph === undefined) return [];
        const text = source.sourceParagraphs[option.sourceParagraph];
        const outcome = text.split('→')[1] ?? '';
        const kind = /Ne pas poursuivre/.test(outcome)
          ? 'stop'
          : /Négocier/.test(outcome)
            ? 'negotiation'
            : /sous condition/.test(outcome)
              ? 'condition'
              : null;
        return kind ? [{ value: option.value, kind, sourceText: text }] : [];
      }),
    ];
  }),
);

export function activationScopes(rule: Activation | undefined): V2Scope[] {
  if (!rule) return [];
  return 'scope' in rule ? [rule.scope] : [...new Set(rule.all.flatMap(activationScopes))];
}

const questionIds = new Set(catalog.questions.map((q) => q.id));
export const questionDependencies: Record<string, string[]> = Object.fromEntries(
  catalog.questions.map((q) => [
    q.id,
    [...new Set(q.sourceParagraphs.join('\n').match(/\b[A-Z]\d+[ab]?\b/g) ?? [])].filter(
      (id) => id !== q.id && questionIds.has(id),
    ),
  ]),
);
// Some references are written only in the opposite direction in the source documents.
for (const [id, dependencies] of Object.entries({
  S20: ['N4'],
  S21: ['A1'],
  D1: ['I3'],
  D2: ['I3'],
  D3: ['I3'],
  D4: ['I3'],
  D5: ['D3'],
  D14: ['N7', 'I7'],
  M14: ['N3', 'T1'],
  M15: ['N3', 'T1'],
}))
  questionDependencies[id] = [...new Set([...questionDependencies[id], ...dependencies])];
export function dependencyClosure(roots: string[]): string[] {
  const result = new Set(roots);
  const queue = [...roots];
  while (queue.length) {
    const id = queue.shift()!;
    for (const dependency of questionDependencies[id] ?? [])
      if (!result.has(dependency)) {
        result.add(dependency);
        queue.push(dependency);
      }
  }
  return [...result].sort();
}
