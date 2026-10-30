export type Bilingual = { fr: string; en: string };
export const bi = (fr: string, en: string): Bilingual => ({ fr, en });
export type GuideEntry = {
  id: string;
  title: Bilingual;
  logic: Bilingual;
  effect: Bilingual;
  source: string;
  implementation: string;
};

export const objectiveGuide: Record<string, [Bilingual, Bilingual]> = {
  'FACT-COMPLETENESS': [
    bi(
      'Questions obligatoires visibles → réponse absente, vide ou Inconnu/Inconnue : état inconnu.',
      'Visible required questions → missing, empty or Unknown answer: unknown state.',
    ),
    bi(
      'À CLARIFIER ; notation fermée. Une réponse déterminée ne valide pas son contenu.',
      'CLARIFICATION REQUIRED; scoring closed. A definite answer does not validate its substance.',
    ),
  ],
  'DECISION-CONSISTENCY': [
    bi(
      'U06 = Non ET au moins un de U07/U08/U09/U10/U23 = Oui.',
      'U06 = No AND at least one of U07/U08/U09/U10/U23 = Yes.',
    ),
    bi(
      'Divergence à réconcilier ; notation fermée, sans interdiction juridique automatique.',
      'Reconcile the divergence; scoring closed, with no automatic legal prohibition.',
    ),
  ],
  'BASIS-DECLARATION': [
    bi(
      'Branche données active : I-U02 = Non → correction ; inconnu → clarification ; Oui → justification déclarée.',
      'Data branch active: I-U02 = No → correction; unknown → clarification; Yes → declared justification.',
    ),
    bi(
      'Une correction préalable ne peut pas être neutralisée par un examen global positif. La base déclarée reste à examiner dans D01.',
      'A positive overall review cannot override a prerequisite correction. D01 still examines the declared basis.',
    ),
  ],
  'MINIMISATION-DECLARATION': [
    bi(
      'Branche données active : I-U04 = Non → correction ; inconnu → clarification ; Oui → mesure déclarée.',
      'Data branch active: I-U04 = No → correction; unknown → clarification; Yes → declared measure.',
    ),
    bi(
      'Résoudre la correction avant notation ; D02 examine la suffisance des mesures.',
      'Resolve the correction before scoring; D02 examines the adequacy of measures.',
    ),
  ],
  'CONTRACT-PERIOD': [
    bi(
      'Date de déploiement valide + U20a entier entre 1 et 1 200 → ajout de mois calendaires ; fin de mois ajustée. Exemple : 31/01/2028 + 1 mois = 29/02/2028.',
      'Valid deployment date + integer U20a from 1 to 1,200 → add calendar months, clamping month ends. Example: 2028-01-31 + 1 month = 2028-02-29.',
    ),
    bi(
      'Borne de fin exclusive calculée ; fait invalide → clarification. Ce calcul ne tranche pas les transitions légales.',
      'Calculated exclusive end boundary; invalid input → clarification. This calculation does not decide legal transitions.',
    ),
  ],
  'DURATION-JUSTIFICATION': [
    bi(
      'Durée inconnue → clarification ; ≤ 60 mois → branche non activée ; > 60 mois sans M-U03 → clarification.',
      'Unknown duration → clarification; ≤ 60 months → inactive branch; > 60 months without M-U03 → clarification.',
    ),
    bi(
      'Une justification renseignée permet de poursuivre ce check de complétude ; sa validité reste à examiner dans C01.',
      'A supplied justification completes this completeness check; C01 still examines its validity.',
    ),
  ],
  'COST-COMPARISON': [
    bi(
      'U21 et C03 : montants CHF finis, positifs ou nuls, ≤ 10¹² et au plus deux décimales. Écart = offre − estimation, calculé en centimes.',
      'U21 and C03: finite, non-negative CHF amounts, ≤ 10¹² and at most two decimals. Difference = offer − estimate, calculated in cents.',
    ),
    bi(
      'Les totaux ne sont pas multipliés par la durée. Un écart appelle une vérification de périmètre, sans rejet automatique ; montant invalide → clarification.',
      'Totals are not multiplied by duration. A difference prompts a scope check, not automatic rejection; invalid amount → clarification.',
    ),
  ],
};

export const activationGuide: Record<string, Bilingual> = {
  '@subprocessors': bi(
    'Branche données ET P-F-SUB = Oui ; si le périmètre ou la présence reste inconnu, conserver la demande d’autorisation ouverte.',
    'Data branch AND P-F-SUB = Yes; if scope or presence is unknown, retain the authorisation follow-up.',
  ),
  '@transfer': bi(
    'Branche données ET (F24a OU P-U-EEA OU P-F-EEA = Oui) ; inconnus conservés. Active D04 et F26, sans conclure automatiquement à un transfert RGPD ni à une interdiction.',
    'Data branch AND (F24a OR P-U-EEA OR P-F-EEA = Yes); unknowns retained. Activates D04 and F26 without automatically classifying a GDPR transfer or prohibition.',
  ),
  '@data': bi(
    'U11 contient Personnelles OU U12 = Oui OU S-U-GDPR-DATA / S-F-GDPR-DATA / S-F-LPD-DATA / S-U-VD-DATA = Oui. Si ces faits restent inconnus, la branche reste ouverte.',
    'U11 includes Personal OR U12 = Yes OR S-U-GDPR-DATA / S-F-GDPR-DATA / S-F-LPD-DATA / S-U-VD-DATA = Yes. If these facts remain unknown, the branch stays open.',
  ),
  '@confidential': bi(
    'U11 contient Confidentielles OU U13 = Oui OU F22 = Oui / Selon configuration ; incertitude conservée.',
    'U11 includes Confidential OR U13 = Yes OR F22 = Yes / Depending on configuration; uncertainty is retained.',
  ),
  '@consequential': bi(
    'Au moins un de U06/U07/U08/U09/U10/U23 = Oui ; si le signal interne est indéterminé, F13 = Oui active aussi la branche. Inconnu ne ferme pas les contrôles.',
    'Any of U06/U07/U08/U09/U10/U23 = Yes; if internal use is unresolved, F13 = Yes also activates the branch. Unknown does not close controls.',
  ),
  '@prohibited': bi(
    'F15 = Oui OU F14 = Inférence des émotions / Les deux. Les réponses inconnues gardent la branche ouverte ; ce signal ne confirme aucune interdiction.',
    'F15 = Yes OR F14 = Emotion inference / Both. Unknown answers keep the branch open; this signal confirms no prohibition.',
  ),
};

const entry = (
  id: string,
  title: Bilingual,
  logic: Bilingual,
  effect: Bilingual,
  source = 'INTERNAL',
  implementation = 'src/lib/engine.ts · assess',
): GuideEntry => ({ id, title, logic, effect, source, implementation });
export const engineGuide: GuideEntry[] = [
  entry(
    'R01',
    bi('Nature du produit', 'Product nature'),
    bi('F03 = Non.', 'F03 = No.'),
    bi(
      'Demander confirmation de la qualification ; les autres contrôles restent actifs.',
      'Request classification confirmation; other controls remain active.',
    ),
    'AI',
  ),
  entry(
    'R02',
    bi('Protection des données', 'Data protection'),
    activationGuide['@data'],
    bi(
      'Activer l’examen des données et des rôles ; aucun régime définitivement applicable n’est déduit de ce signal seul.',
      'Activate data and role review; this signal alone does not determine legal applicability.',
    ),
    'VD',
  ),
  entry(
    'R04',
    bi('Lien européen', 'European connection'),
    bi(
      'U16 différent de Non, y compris absent, OU F08 = Oui.',
      'U16 is not No, including missing, OR F08 = Yes.',
    ),
    bi(
      'Examiner séparément AI Act et RGPD pour chaque acteur.',
      'Examine AI Act and GDPR separately for each actor.',
    ),
    'AI',
  ),
  entry(
    'R05',
    bi('Pratique potentiellement interdite', 'Potentially prohibited practice'),
    activationGuide['@prohibited'],
    bi(
      'Alerte critique : vérifier faits, champ, exceptions et dates ; pas de rejet automatique.',
      'Critical alert: check facts, scope, exceptions and dates; no automatic rejection.',
    ),
    'AI',
  ),
  entry(
    'R06',
    bi('Décisions et supervision', 'Decisions and oversight'),
    activationGuide['@consequential'],
    bi(
      'Examen renforcé de la catégorie, des exceptions, recours et supervision.',
      'Enhanced review of classification, exceptions, appeals and oversight.',
    ),
    'AI',
  ),
  entry(
    'R07',
    bi('Données sensibles ou vulnérabilité', 'Sensitive data or vulnerability'),
    bi('U12 = Oui ou Inconnu.', 'U12 = Yes or Unknown.'),
    bi(
      'Demander analyse des garanties et de la nécessité d’une analyse d’impact.',
      'Request safeguard analysis and consideration of an impact assessment.',
    ),
    'VD',
  ),
  entry(
    'R08',
    bi('Confidentialité de la recherche', 'Research confidentiality'),
    bi('U13 = Oui OU U11 contient Confidentielles.', 'U13 = Yes OR U11 includes Confidential.'),
    bi(
      'Examiner licences, réutilisation, accès et confidentialité.',
      'Examine licences, reuse, access and confidentiality.',
    ),
  ),
  entry(
    'R09',
    bi('Transferts étrangers', 'Foreign transfers'),
    bi('F24a = Oui ou Inconnu.', 'F24a = Yes or Unknown.'),
    bi(
      'Examiner pays, destinataires et garanties. Aucun pays ne déclenche à lui seul une exclusion.',
      'Examine countries, recipients and safeguards. No country alone triggers exclusion.',
    ),
    'VD',
  ),
  entry(
    'R10',
    bi('Réutilisation', 'Reuse'),
    bi(
      'F22 = Oui, Selon configuration ou Inconnu.',
      'F22 = Yes, Depending on configuration or Unknown.',
    ),
    bi(
      'Demander finalités, rôles, paramètres et engagements contractuels.',
      'Request purposes, roles, settings and contractual commitments.',
    ),
  ),
  entry(
    'R14',
    bi('Valeur du marché', 'Procurement value'),
    bi('Toujours affiché, avec U21 et U20a.', 'Always displayed, using U21 and U20a.'),
    bi(
      'U21 représente déjà le coût total. Le code ne choisit pas automatiquement une procédure à partir du montant.',
      'U21 already represents total cost. The code does not automatically choose a procurement procedure from the amount.',
    ),
    'PROC',
  ),
  entry(
    'DATE',
    bi('Calendrier renforcé', 'Enhanced-obligation calendar'),
    bi(
      'Signal décisionnel confirmé : comparer le déploiement et la fin du contrat au 02/12/2027.',
      'Confirmed decision signal: compare deployment and contract end with 2027-12-02.',
    ),
    bi(
      'Afficher avant/après/traversée du jalon. Une condition future est ajoutée si T02 valide HIGH_RISK, un acteur AI Act applicable et un contrat traversant cette date. Le calcul actuel ne distingue pas annexe I/III.',
      'Display before/after/crossing of the milestone. A future condition is added when T02 validates HIGH_RISK, an applicable AI Act actor and a contract crossing that date. The current calculation does not distinguish Annex I/III.',
    ),
    'AI-DATES',
  ),
  entry(
    'AI-5-CONFIRMED',
    bi('Interdiction confirmée', 'Confirmed prohibition'),
    bi(
      'Examen T02 actuel satisfait ou conditionnel ; category = PROHIBITED.',
      'Current T02 review satisfied or conditional; category = PROHIBITED.',
    ),
    bi(
      'BLOQUANT ; modifier ou abandonner la configuration. Cette conséquence repose sur une qualification humaine enregistrée.',
      'BLOCKING; change or abandon the configuration. This consequence relies on a recorded human classification.',
    ),
    'AI',
  ),
  entry(
    'GDPR-AUTO-02',
    bi('Décision automatisée sans exception', 'Automated decision without exception'),
    bi(
      'T02 valide RGPD UNIL applicable ; U23 = Oui ; autoException = NO.',
      'T02 validates GDPR applicable to UNIL; U23 = Yes; autoException = NO.',
    ),
    bi(
      'BLOQUANT ; modifier le processus ou établir une voie admissible.',
      'BLOCKING; change the process or establish an admissible route.',
    ),
    'GDPR',
  ),
  entry(
    'GDPR-AUTO-03',
    bi('Garanties de décision manquantes', 'Missing decision safeguards'),
    bi(
      'Même champ ; autoException = YES et autoGuarantees = NO.',
      'Same scope; autoException = YES and autoGuarantees = NO.',
    ),
    bi(
      'Correction préalable. Une exception ou des garanties non précisées entraînent plutôt À CLARIFIER.',
      'Prerequisite correction. Unspecified exception or safeguards instead produce CLARIFICATION REQUIRED.',
    ),
    'GDPR',
  ),
];

export const generalGuide: GuideEntry[] = [
  entry(
    'REVIEW-STATES',
    bi('Les huit statuts d’examen', 'The eight review states'),
    bi(
      'Satisfait ; Non applicable ; Information manquante ; À clarifier ; Examen humain requis ; À corriger ; Blocage confirmé ; Satisfait sous conditions.',
      'Satisfied; Not applicable; Missing information; Clarification required; Human review required; Correction required; Confirmed blocker; Satisfied under conditions.',
    ),
    bi(
      'Un statut est enregistré pour chaque contrôle avec motif et auteur. Non applicable ne signifie pas que les informations manquantes sont acceptées ; une condition marquée [PRÉALABLE] ferme la notation.',
      'Each control records a state with reasons and author. Not applicable does not mean missing information is accepted; a condition marked [PRÉALABLE] closes scoring.',
    ),
  ),
  entry(
    'OUTCOME',
    bi('Les cinq résultats', 'The five outcomes'),
    bi(
      'Dans cet ordre : blocage confirmé → information indispensable manquante/conflit/examen requis → correction/préalable → condition → conformité.',
      'In this order: confirmed blocker → missing essential information/conflict/required review → correction/prerequisite → condition → compliance.',
    ),
    bi(
      'Toutes les actions restent visibles même si un résultat prioritaire domine. Un risque élevé n’est pas un résultat de rejet.',
      'All actions remain visible even when a higher-priority outcome dominates. High risk is not a rejection outcome.',
    ),
  ),
  entry(
    'CONTROL-STATUS',
    bi('Statut d’un contrôle', 'Control status'),
    bi(
      'Examen actuel et empreinte valide → statut enregistré. Sinon : réponse fournisseur pertinente absente/inconnue ou aucune pièce → information manquante ; sinon examen humain requis.',
      'Current review with valid fingerprint → recorded status. Otherwise: missing/unknown relevant supplier answer or no evidence → missing information; otherwise human review required.',
    ),
    bi(
      'Satisfait, non applicable et conditionnel comptent comme contrôles terminés. Un préalable conditionnel ferme néanmoins la notation. Le calcul ne vérifie pas le contenu des pièces.',
      'Satisfied, not applicable and conditional count as completed controls. A conditional prerequisite nevertheless closes scoring. The calculation does not verify evidence contents.',
    ),
  ),
  entry(
    'RISK-IMPACT',
    bi('Risque interne sur les personnes', 'Internal risk to people'),
    bi(
      'Gravité Grave → élevé. Signal décisionnel vrai → modéré si gravité Faible, sinon élevé. Sans ce signal : gravité Significative → modéré ; signal faux et gravité Faible → faible ; sinon indéterminé.',
      'Severe impact → high. True decision signal → moderate if severity is Low, otherwise high. Without that signal: Significant severity → moderate; false signal and Low severity → low; otherwise undetermined.',
    ),
    bi(
      'Priorisation académique ; ne constitue pas une catégorie juridique officielle.',
      'Academic prioritisation; not an official legal category.',
    ),
  ),
  entry(
    'RISK-DATA',
    bi('Risque interne données', 'Internal data risk'),
    bi(
      'U12 Oui, U13 Oui ou données confidentielles → élevé ; sinon données personnelles → modéré ; sinon faits inconnus → indéterminé ; sinon faible.',
      'U12 Yes, U13 Yes or confidential data → high; otherwise personal data → moderate; otherwise unknown facts → undetermined; otherwise low.',
    ),
    bi(
      'Le niveau global retient Élevé, puis Indéterminé, puis Modéré, sinon Faible.',
      'Overall level takes High, then Undetermined, then Moderate, otherwise Low.',
    ),
  ),
  entry(
    'RISK-OVERSIGHT',
    bi('Risque interne supervision', 'Internal oversight risk'),
    bi(
      'U18 Non → élevé si signal décisionnel vrai, sinon modéré ; Partiellement → modéré ; Oui → faible ; autre → indéterminé.',
      'U18 No → high if the decision signal is true, otherwise moderate; Partly → moderate; Yes → low; otherwise undetermined.',
    ),
    bi(
      'La possibilité de supervision ne démontre pas, seule, que celle-ci est effective.',
      'The possibility of oversight does not alone demonstrate its effectiveness.',
    ),
  ),
  entry(
    'VISIBILITY',
    bi('Questions conditionnelles', 'Conditional questions'),
    bi(
      'Condition vraie → afficher ; fausse → masquer et retirer la réponse du contexte effectif ; inconnue/conflit → garder la branche ouverte.',
      'True condition → show; false → hide and remove the answer from effective context; unknown/conflict → keep the branch open.',
    ),
    bi(
      'Le nettoyage des réponses cachées est itératif. Le fournisseur reçoit seulement les identifiants activés par le serveur.',
      'Hidden-answer removal is iterative. Suppliers receive only the question IDs activated by the server.',
    ),
    'INTERNAL',
    'src/lib/engine.ts · matches/effectiveAnswers ; src/lib/rule-facts.ts',
  ),
  entry(
    'LEGAL-MAPPING',
    bi('Cartographie par acteur', 'Mapping by actor'),
    bi(
      'Six propositions calculées depuis les déclarations S-U / S-F, par acteur et activité : LPrD, surveillance LPD, deux tests RGPD et deux tests AI Act. Les faits manquants, conflits et exclusions restent explicites.',
      'Six proposals calculated from S-U / S-F declarations, by actor and activity: LPrD, FADP supervision, two GDPR tests and two AI Act tests. Missing facts, conflicts and exclusions remain explicit.',
    ),
    bi(
      'T02 actuel satisfait/conditionnel remplace ces états par les conclusions applicables/non applicables. Le RGPD fournisseur est visible dès le prétriage. Tout écart ou interprétation exige un motif dédié ; une contradiction territoriale empêche la validation. La catégorie validée prime sur les candidats automatiques.',
      'Current satisfied/conditional T02 replaces these states with applicable/not-applicable conclusions. Supplier GDPR is visible from pre-triage. Departures or interpretations require a dedicated explanation; territorial contradictions prevent validation. The validated category overrides automatic candidates.',
    ),
    'AI',
  ),
  entry(
    'SCORING',
    bi('Admissibilité et score', 'Eligibility and score'),
    bi(
      'Deux soumissions, référentiel actuel, tous contrôles terminés, questions requises remplies, aucun blocage/correction/préalable ni résultat automatique empêchant la notation.',
      'Both submissions, current rule version, all controls complete, required questions filled, no blocker/correction/prerequisite or automatic result preventing scoring.',
    ),
    bi(
      'Score = somme(note / 5 × poids), arrondie à deux décimales. Tous les critères doivent être présents ; poids total = 100 %. Ce score n’est pas une certification.',
      'Score = sum(mark / 5 × weight), rounded to two decimals. All criteria must be present; weights total 100%. This score is not certification.',
    ),
    'INTERNAL',
    'src/lib/engine.ts · assess ; src/app/api/[...path]/route.ts · scores',
  ),
];

export const safeguards = [
  bi(
    'Les rôles sont simulés : Demandeur crée et remplit l’interne ; Fournisseur répond et joint les pièces ; Évaluateur examine, qualifie, actualise le référentiel et note. Toute personne de la démo peut changer de rôle. Données fictives uniquement.',
    'Roles are simulated: Requester creates and fills internal answers; Supplier responds and uploads evidence; Evaluator reviews, classifies, updates the rule version and scores. Anyone in the demo can switch roles. Fictional data only.',
  ),
  bi(
    'Sauvegarde après une courte pause et avant navigation. Chaque écriture incrémente la révision ; une révision dépassée est refusée pour éviter d’écraser un autre changement. Une modification interne retire la soumission fournisseur ; les réponses cachées sont supprimées lors de l’enregistrement.',
    'Answers save after a short pause and before navigation. Each write increments revision; outdated revisions are rejected to prevent overwriting another change. An internal change withdraws supplier submission; hidden answers are removed when saved.',
  ),
  bi(
    'Un changement de réponses retire les notes. L’empreinte d’un examen inclut référentiel, identité, dates, fournisseur, toutes les réponses internes, dépendances directes/indirectes et pièces du contrôle. Une différence rend cet examen caduc.',
    'An answer change removes scores. A review fingerprint includes rule version, identity, dates, supplier, all internal answers, direct/indirect dependencies and control evidence. Any difference invalidates that review.',
  ),
  bi(
    'Un upload/retrait de pièce retire la soumission fournisseur et les notes. Formats acceptés : PDF, TXT, PNG, JPG/JPEG ; fichier non vide, maximum 10 Mio, signature vérifiée pour les formats binaires. Le contenu n’est pas analysé automatiquement comme preuve juridique.',
    'Uploading/removing evidence withdraws supplier submission and scores. Accepted formats: PDF, TXT, PNG, JPG/JPEG; non-empty, up to 10 MiB, with signatures checked for binary formats. Contents are not automatically analysed as legal evidence.',
  ),
  bi(
    'Un examen doit être motivé et attribué. Satisfait/conditionnel exige des réponses fournisseur pertinentes déterminées et une pièce ; correction/condition exige une mesure ; blocage exige une nature légale ou de marché. T02 ne peut être écarté globalement comme non applicable.',
    'Reviews require reasons and attribution. Satisfied/conditional requires determinate relevant supplier answers and evidence; correction/condition requires a measure; a blocker requires a legal or procurement basis. T02 cannot be dismissed globally as not applicable.',
  ),
  bi(
    'Actualiser explicitement un ancien référentiel retire examens, notes et soumissions du dossier pour réévaluation. Les réponses, pièces et rapports historiques restent conservés. L’historique enregistre les actions importantes.',
    'Explicitly updating an old rule version removes dossier reviews, scores and submissions for reassessment. Answers, evidence and historical reports remain preserved. Important actions are recorded in the audit history.',
  ),
  bi(
    'Chaque rapport est un instantané autonome de réponses, contrôles, résultats, sources, questions, notes, version et auteur. Les nouveaux calculs ne réécrivent pas les rapports existants. Un rapport peut documenter un dossier incomplet ; sa présence ne signifie pas approbation.',
    'Each report is a self-contained snapshot of answers, controls, results, sources, questions, scores, version and author. New calculations do not rewrite existing reports. A report can document an incomplete case; its existence does not mean approval.',
  ),
  bi(
    'Le fournisseur est lié à un dossier et ne reçoit ni réponses internes, ni examens, notes, rapports ou événements. Les pièces sont hors du répertoire public et servies par une route contrôlée. Cette isolation de démo ne constitue pas une authentification de production.',
    'The supplier is linked to one dossier and receives no internal answers, reviews, scores, reports or events. Evidence sits outside the public directory and is served through a controlled route. This demo isolation is not production authentication.',
  ),
  bi(
    'L’application tourne sur Node/Next.js avec PostgreSQL en Docker, sur 127.0.0.1. Aucun appel d’IA ne participe à l’évaluation. Les liens de sources s’ouvrent sur des sites externes. Sauvegardes : npm run local:backup ; ne pas supprimer le volume PostgreSQL.',
    'The app runs on Node/Next.js with PostgreSQL in Docker, on 127.0.0.1. No AI call participates in assessment. Source links open external websites. Backups: npm run local:backup; never delete the PostgreSQL volume.',
  ),
];

export const planned = [
  bi(
    'Approfondir les autres rôles AI Act, modèles seuls, régimes spéciaux et exclusions : les propositions structurées existantes restent soumises à T02.',
    'Extend other AI Act roles, standalone models, special regimes and exclusions: existing structured proposals remain subject to T02.',
  ),
  bi(
    'Le plan de protection comporte une revue d’impact, de chaîne et de clauses. Restent : décision juridique DPIA par régime et rôle, listes et exceptions, consultation préalable, FRIA, registre cantonal, GPAI, transparence et obligations high-risk détaillées.',
    'The protection plan includes impact, processing-chain and clause review. Remaining: regime- and role-specific legal DPIA decisions, lists and exceptions, prior consultation, FRIA, cantonal register, GPAI, transparency and detailed high-risk obligations.',
  ),
  bi(
    'Calcul automatique du contrat indéterminé, agrégation des achats liés et procédure par seuil/régime : non implémentés. U21 est un total déclaré.',
    'Automatic indefinite-contract valuation, related-purchase aggregation and procedure by threshold/regime: not implemented. U21 is a declared total.',
  ),
  bi(
    'Gestion structurée de validité/périmètre des preuves et lecture automatisée de documents : non implémentées ; dépôt de fichier ≠ preuve validée.',
    'Structured evidence validity/scope management and automated document reading: not implemented; uploading a file does not mean verified evidence.',
  ),
  bi(
    'Calendrier complet annexe I/III, transitions et dates par obligation : incomplet. Le jalon 02/12/2027 est calculé ; la référence annexe I 02/08/2028 n’a pas de branche de calcul dédiée.',
    'Complete Annex I/III calendar, transitions and per-obligation dates: incomplete. The 2027-12-02 milestone is calculated; the referenced Annex I date 2028-08-02 has no dedicated calculation branch.',
  ),
  bi(
    'Administration graphique des règles, verrouillage d’une grille publiée et comparaison de plusieurs fournisseurs sous un même besoin : non implémentés.',
    'Graphical rule administration, locking published weights and comparing multiple suppliers for one need: not implemented.',
  ),
];

export const sourceEnglish: Record<string, [string, string, string, string]> = {
  'DP-GUIDE': [
    'EDPB — impact assessment',
    'GDPR Articles 35–36; high risk and authority lists',
    'Institutional guide consulted',
    'High-risk and prior-consultation principles consulted. Prototype indicators are neither exhaustive nor an exemption.',
  ],
  'DP-TRANSFER': [
    'EDPB — international transfers',
    'GDPR Chapter V; three cumulative criteria and safeguards',
    'Institutional guide consulted',
    'Check exporter processing, disclosure to another organisation and destination. No adequacy list or safeguard is automatically validated.',
  ],
  'VD-CONTRACT': [
    'Vaud APDI — IT processing checklist',
    'LPrD Article 18; checklist version 2025-08-06',
    'Institutional checklist consulted',
    'Processing questions and clauses need role- and regime-specific adaptation. GDPR or federal obligations are not inferred solely from cantonal guidance.',
  ],
  'AI-SCOPE': [
    'European Commission — AI Act Article 2',
    'Article 2: operators, territories, exclusions and limitations',
    'Article consulted',
    'Scope consulted on the official Commission service. This does not validate categories, exceptions or dates in a dossier.',
  ],
  'GDPR-SCOPE': [
    'EDPB — Guidelines 3/2018',
    'GDPR Article 3: establishment, targeting, public international law',
    'Final guidelines consulted',
    'Assessment by actor and processing activity. Material scope and special regimes require confirmation.',
  ],
  'LPD-SCOPE': [
    'Federal Office of Justice — FADP reform FAQ',
    'Section 1.2; Article 3: Swiss effects, supervision and conflicts of law',
    'Institutional FAQ',
    'Institutional reference located; PDF access unavailable at the last check. The proposed test concerns supervision; private and criminal conflicts need separate review.',
  ],
  VD: [
    'Vaud Data Protection Act (LPrD)',
    'Scope; principles; Articles 17–18',
    'Institutional source',
    'Institutional page consulted. Precise application and case requirements still need group validation.',
  ],
  LPD: [
    'Federal Data Protection Act (FADP)',
    'Articles 2–3; obligations according to roles',
    'Reference text',
    'Reference provided by the group; detailed legal verification remains to be completed.',
  ],
  GDPR: [
    'General Data Protection Regulation (GDPR)',
    'Articles 3, 22, 28, 32, 35 and Chapter V',
    'Reference text',
    'Examine applicability separately for each actor and processing operation.',
  ],
  AI: [
    'European AI Act',
    'Articles 2–6, 8–15, 26–27, 50; Annex III',
    'Reference text',
    'Classification, exceptions, transitions and actor roles require confirmation; no automatic exclusion.',
  ],
  'AI-DATES': [
    'Amending Regulation (EU) 2026/1744',
    'Article 1(40): amendment to Article 113',
    'Calendar consulted',
    'Reference calendar: main Chapter III Sections 1–3 obligations, Annex III from 2027-12-02; Annex I from 2028-08-02, subject to specific provisions. The app does not fully implement every transition.',
  ],
  PROC: [
    'Vaud public procurement',
    'AIMP 2019, particularly Article 27; LMP-VD / RLMP-VD',
    'Reference framework to validate',
    'Justify suitability criteria and procedure for the specific procurement.',
  ],
  INTERNAL: [
    'Prototype internal framework',
    'Prioritisation rubric and demonstration requirements',
    'Prototype proposal',
    'Neither legislation nor official UNIL policy. Detailed modules still need alignment with the group contributions.',
  ],
};
