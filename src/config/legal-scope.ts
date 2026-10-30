import type { Question } from '@/lib/domain';

// Each declaration concerns the activity in S-U-OP, not the supplier's entire business.
const rows: [string, string, string, string, 'internal' | 'vendor', string[]?][] = [
  [
    'S-U-OP',
    'Décrire le traitement et l’activité précis couverts par cette cartographie (entrées, sorties, journaux, acteurs).',
    'Describe the specific processing and activity covered by this map (inputs, outputs, logs, actors).',
    'AI',
    'internal',
  ],
  [
    'S-U-VD',
    'Cette activité relève-t-elle d’une autorité vaudoise ou d’une tâche publique vaudoise déléguée ?',
    'Does this activity fall under a Vaud authority or a delegated Vaud public task?',
    'VD',
    'internal',
  ],
  [
    'S-U-VD-DATA',
    'Cette activité traite-t-elle des données protégées par la LPrD, y compris les catégories dont le champ doit être confirmé ?',
    'Does this activity process data protected by the Vaud LPrD, including categories whose coverage needs confirmation?',
    'VD',
    'internal',
  ],
  [
    'S-F-LPD-ACTOR',
    'Le fournisseur agit-il comme personne privée ou organe fédéral pour ce traitement ?',
    'Does the supplier act as a private person or federal body for this processing?',
    'LPD',
    'vendor',
  ],
  [
    'S-F-LPD-DATA',
    'Le fournisseur traite-t-il des données personnelles de personnes physiques dans cette activité, journaux compris ?',
    'Does the supplier process natural-person personal data in this activity, including logs?',
    'LPD',
    'vendor',
  ],
  [
    'S-F-LPD-CH',
    'Ce traitement produit-il des effets en Suisse (champ de la surveillance selon l’art. 3 LPD) ?',
    'Does this processing have effects in Switzerland (supervisory scope under FADP Article 3)?',
    'LPD',
    'vendor',
  ],
];
export const territorialRoutes = [
  'Établissement UE lié au traitement',
  'Offre ciblée aux personnes dans l’UE par un acteur hors UE',
  'Suivi du comportement dans l’UE par un acteur hors UE',
  'Droit d’un État membre applicable par droit international public',
  'Aucun de ces liens',
  'Inconnu',
];
export const aiRoutes = [
  'Fournisseur : mise sur le marché / mise en service dans l’UE',
  'Déployeur établi ou situé dans l’UE',
  'Fournisseur / déployeur hors UE dont les sorties sont utilisées dans l’UE',
  'Aucun de ces liens',
  'Inconnu',
];
for (const [prefix, actor, en, audience] of [
  ['S-U', 'UNIL', 'UNIL', 'internal'],
  ['S-F', 'le fournisseur', 'the supplier', 'vendor'],
] as const) {
  rows.push(
    [
      `${prefix}-AI-SYSTEM`,
      `Pour ${actor}, l’activité concerne-t-elle un système d’IA (et pas seulement la fourniture d’un modèle autonome) ?`,
      `Does ${en}’s activity involve an AI system (rather than only supplying a standalone model)?`,
      'AI',
      audience,
    ],
    [
      `${prefix}-GDPR-DATA`,
      `Pour ${actor}, le traitement concerne-t-il des données personnelles traitées automatiquement ou dans un fichier structuré ?`,
      `For ${en}, does the processing involve personal data processed automatically or in a structured filing system?`,
      'GDPR',
      audience,
    ],
    [
      `${prefix}-GDPR-LINK`,
      `Quels liens de l’art. 3 RGPD concernent ce traitement pour ${actor} ?`,
      `Which GDPR Article 3 links concern this processing by ${en}?`,
      'GDPR',
      audience,
      territorialRoutes,
    ],
    [
      `${prefix}-GDPR-EX`,
      `Une exclusion du champ matériel du RGPD ou un régime spécial est-il invoqué pour ${actor} ?`,
      `Is a GDPR material-scope exclusion or special regime claimed for ${en}?`,
      'GDPR',
      audience,
    ],
    [
      `${prefix}-AI-ROLE`,
      `Dans cette activité, ${actor} agit-il comme fournisseur ou déployeur d’un système d’IA, ou fournisseur d’un modèle d’IA à usage général ?`,
      `In this activity, does ${en} act as an AI-system provider or deployer, or as a general-purpose AI-model provider?`,
      'AI',
      audience,
    ],
    [
      `${prefix}-AI-LINK`,
      `Quels liens opérateur / territoire de l’art. 2 AI Act concernent ${actor} pour cette activité ?`,
      `Which AI Act Article 2 operator / territorial links concern ${en} for this activity?`,
      'AI',
      audience,
      aiRoutes,
    ],
    [
      `${prefix}-AI-EX`,
      `Une exclusion ou limitation AI Act est-elle invoquée pour ${actor} (recherche scientifique exclusive, précommercialisation, sécurité, logiciel libre, autre rôle ou régime spécial) ?`,
      `Is an AI Act exclusion or limitation claimed for ${en} (exclusive scientific research, pre-market research, security, open source, another role or special regime)?`,
      'AI',
      audience,
    ],
  );
}
export const scopeEnglish = Object.fromEntries(rows.map(([id, , en]) => [id, en]));
export const scopeQuestions: Question[] = rows.map(([id, label, , source, audience, options]) => ({
  id,
  label,
  source,
  audience,
  options: id === 'S-U-OP' ? undefined : (options ?? ['Oui', 'Non', 'Inconnu']),
  type: id === 'S-U-OP' ? 'textarea' : options ? 'multi' : 'select',
  section: 'Applicabilité juridique',
  module: 'triage',
  required: true,
}));

export const scopeDefinitions = [
  {
    key: 'lprd',
    regime: 'LPrD',
    actor: 'UNIL',
    source: 'VD',
    ids: ['S-U-VD', 'S-U-VD-DATA'],
    fr: 'Autorité / tâche publique vaudoise ET données protégées. Un non documenté conduit à une proposition hors champ ; le périmètre des données doit être confirmé.',
    en: 'Vaud authority / public task AND protected data. A documented negative leads to an out-of-scope proposal; the data perimeter needs confirmation.',
  },
  {
    key: 'lpdVendor',
    regime: 'LPD — surveillance',
    actor: 'Fournisseur',
    source: 'LPD-SCOPE',
    ids: ['S-F-LPD-ACTOR', 'S-F-LPD-DATA', 'S-F-LPD-CH'],
    fr: 'Personne privée / organe fédéral ET données de personnes physiques ET effets en Suisse. Ce test de surveillance ne tranche pas les conflits de lois en droit privé ou pénal.',
    en: 'Private person / federal body AND natural-person data AND effects in Switzerland. This supervisory test does not settle private-law or criminal-law conflicts.',
  },
  ...(['U', 'F'] as const).map((p) => ({
    key: p === 'U' ? 'gdprUnil' : 'gdprVendor',
    regime: 'RGPD',
    actor: p === 'U' ? 'UNIL' : 'Fournisseur',
    source: 'GDPR-SCOPE',
    ids: [`S-${p}-GDPR-DATA`, `S-${p}-GDPR-LINK`, `S-${p}-GDPR-EX`],
    fr: 'Champ matériel ET au moins un lien de l’art. 3. Une exclusion déclarée exige un examen. Nationalité, client européen et établissement d’un autre acteur ne suffisent pas.',
    en: 'Material scope AND at least one Article 3 link. A claimed exclusion needs review. Nationality, a European client and another actor’s establishment are insufficient.',
  })),
  ...(['F', 'U'] as const).map((p) => ({
    key: p === 'U' ? 'aiDeployer' : 'aiProvider',
    regime: 'AI Act',
    actor: p === 'U' ? 'UNIL — rôle à confirmer' : 'Fournisseur — rôle à confirmer',
    source: 'AI-SCOPE',
    ids: [`S-${p}-AI-ROLE`, `S-${p}-AI-LINK`, `S-${p}-AI-EX`, `S-${p}-AI-SYSTEM`],
    fr: 'Rôle couvert ET lien opérateur / territoire de l’art. 2. Absence de rôle, exclusions, modèles seuls et autres opérateurs exigent un examen ; la recherche ou le logiciel libre ne dispensent jamais automatiquement.',
    en: 'Covered role AND an Article 2 operator / territorial link. Absent role, exclusions, standalone models and other operators require review; research or open source never automatically grants an exemption.',
  })),
];
