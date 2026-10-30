import { evaluateProtectionTasks } from './data-protection';
import { evaluateLegalScope, scopeStateLabels, scopeReviewIssues } from './legal-scope';
import { CONFIG_VERSION, controls, questions, scoringCriteria } from '@/config/assessment';
import { conditionTruth, contractEndDate, dependencyClosure, isUnknown } from './rule-facts';
import { evaluateObjectiveRules } from './objective-rules';
import type {
  Answers,
  Assessment,
  CaseView,
  Condition,
  Control,
  Finding,
  Question,
  Risk,
} from './domain';
export function includes(a: Answers, id: string, value: string) {
  const v = a[id];
  return Array.isArray(v) ? v.includes(value) : v === value;
}
export function matches(condition: Condition | undefined, a: Answers): boolean {
  const state = conditionTruth(condition, a);
  // Unresolved parents keep follow-up questions/controls active; no silent exemption.
  return state !== 'false';
}
export function visibleQuestions(audience: Question['audience'], a: Answers) {
  return questions.filter((q) => q.audience === audience && matches(q.when, a));
}
export function missingQuestions(audience: Question['audience'], a: Answers) {
  return visibleQuestions(audience, a).filter((q) => q.required && !answered(a[q.id]));
}
export function answered(v: unknown) {
  return typeof v === 'number'
    ? Number.isFinite(v)
    : Array.isArray(v)
      ? v.length > 0
      : typeof v === 'string' && v.trim().length > 0;
}
export function effectiveAnswers(answers: Answers): Answers {
  const a = { ...answers };
  // Remove answers hidden by changed parent values. Iterate to cover dependent fields.
  for (let i = 0; i < questions.length; i++) {
    let removed = false;
    for (const q of questions)
      if (q.id in a && !matches(q.when, a)) {
        delete a[q.id];
        removed = true;
      }
    if (!removed) break;
  }
  return a;
}
export function controlFingerprint(control: Control, c: CaseView) {
  const a = effectiveAnswers(c.answers);
  const dependencies = dependencyClosure(
    [...control.questionIds, ...(control.when ? [control.when.id] : [])],
    new Map(questions.map((q) => [q.id, q.when])),
  );
  return JSON.stringify({
    version: CONFIG_VERSION,
    context: [
      c.title,
      c.description,
      c.department,
      c.owner,
      c.purpose,
      c.assessmentDate,
      c.deploymentDate,
      c.vendor,
    ],
    internal: questions
      .filter((q) => q.audience === 'internal')
      .map((q) => [q.id, a[q.id] ?? null]),
    vendor: dependencies.map((id) => [id, a[id] ?? null]),
    evidence: c.evidence
      .filter((e) => e.controlId === control.id)
      .map((e) => [e.id, e.createdAt])
      .sort(),
  });
}
export function assess(c: CaseView): Assessment {
  const a = effectiveAnswers(c.answers);
  const consequentialState = conditionTruth({ id: '@consequential', values: ['Oui'] }, a);
  const consequential = consequentialState === 'true';
  const ruleResults = evaluateObjectiveRules({
    c,
    answers: a,
    visible: [...visibleQuestions('internal', a), ...visibleQuestions('vendor', a)],
    dataActive: matches({ id: '@data', values: ['Oui'] }, a),
  });
  const risks: Risk[] = [
    {
      dimension: 'Impact sur les personnes',
      level:
        a.U19 === 'Grave'
          ? 'Élevé'
          : consequential
            ? a.U19 === 'Faible'
              ? 'Modéré'
              : 'Élevé'
            : a.U19 === 'Significative'
              ? 'Modéré'
              : consequentialState === 'false' && a.U19 === 'Faible'
                ? 'Faible'
                : 'Indéterminé',
      explanation: `Décision importante : ${a.U06 ?? 'non renseigné'} ; gravité : ${a.U19 ?? 'non renseignée'}.`,
    },
    {
      dimension: 'Données et confidentialité',
      level:
        a.U12 === 'Oui' || a.U13 === 'Oui' || includes(a, 'U11', 'Confidentielles')
          ? 'Élevé'
          : includes(a, 'U11', 'Personnelles')
            ? 'Modéré'
            : isUnknown(a.U12) || isUnknown(a.U13) || !answered(a.U11)
              ? 'Indéterminé'
              : 'Faible',
      explanation: `Données : ${Array.isArray(a.U11) ? a.U11.join(', ') : 'non renseignées'} ; sensibles : ${a.U12 ?? 'inconnu'} ; recherches inédites : ${a.U13 ?? 'inconnu'}.`,
    },
    {
      dimension: 'Supervision humaine',
      level:
        a.U18 === 'Non'
          ? consequential
            ? 'Élevé'
            : 'Modéré'
          : a.U18 === 'Partiellement'
            ? 'Modéré'
            : a.U18 === 'Oui'
              ? 'Faible'
              : 'Indéterminé',
      explanation: `Capacité de vérifier, corriger ou écarter les résultats : ${a.U18 ?? 'non renseignée'}.`,
    },
  ];
  const overallRisk: Risk['level'] = risks.some((r) => r.level === 'Élevé')
    ? 'Élevé'
    : risks.some((r) => r.level === 'Indéterminé')
      ? 'Indéterminé'
      : risks.some((r) => r.level === 'Modéré')
        ? 'Modéré'
        : 'Faible';
  const findings: Finding[] = [];
  const add = (
    id: string,
    title: string,
    module: Finding['module'],
    trigger: string,
    explanation: string,
    action: string,
    source: string,
    critical = false,
  ) => findings.push({ id, title, module, trigger, explanation, action, source, critical });
  if (a.F03 === 'Non')
    add(
      'R01',
      'Nature du produit à confirmer',
      'triage',
      'F03 = Non',
      'Le fournisseur déclare ne pas fournir un système d’IA. Les autres contrôles restent pertinents.',
      'Vérifier la qualification du produit.',
      'AI',
    );
  if (matches({ id: '@data', values: ['Oui'] }, a))
    add(
      'R02',
      'Protection des données',
      'data',
      `U11 / U12 : ${JSON.stringify([a.U11, a.U12])}`,
      'Des données personnelles, sensibles ou un doute sur leur sensibilité déclenchent un examen.',
      'Qualifier le traitement et les rôles ; examiner le régime vaudois et les éventuels autres régimes.',
      'VD',
    );
  if (a.U16 !== 'Non' || a.F08 === 'Oui')
    add(
      'R04',
      'Applicabilité européenne à examiner',
      'triage',
      `U16 = ${a.U16 ?? 'inconnu'} ; F08 = ${a.F08 ?? 'inconnu'}`,
      'Le lien territorial de chaque acteur doit être examiné séparément. La commercialisation européenne du fournisseur ne tranche pas le statut de l’université.',
      'Documenter séparément les tests AI Act et RGPD.',
      'AI',
    );
  if (matches({ id: '@prohibited', values: ['Oui'] }, a))
    add(
      'R05',
      'Pratique potentiellement interdite',
      'triage',
      `F15 = ${a.F15}`,
      'Ce signal ne constitue pas une interdiction confirmée.',
      'Confirmer les faits, le champ, les exceptions et les dates avant toute conclusion.',
      'AI',
      true,
    );
  if (matches({ id: '@consequential', values: ['Oui'] }, a))
    add(
      'R06',
      'Décision importante et supervision',
      'security',
      `U06 / U07 / U08 / U09 / U10 : ${JSON.stringify([a.U06, a.U07, a.U08, a.U09, a.U10])}`,
      'Le rôle du système dans cette décision nécessite un examen renforcé.',
      'Vérifier la catégorie pertinente, les exceptions, les recours et la supervision.',
      'AI',
    );
  if (a.U12 === 'Oui' || a.U12 === 'Inconnu')
    add(
      'R07',
      'Examen renforcé des données',
      'data',
      `U12 = ${a.U12}`,
      'La sensibilité des données ou la vulnérabilité des personnes doit être clarifiée.',
      'Documenter les garanties et la nécessité d’une analyse d’impact.',
      'VD',
    );
  if (a.U13 === 'Oui' || includes(a, 'U11', 'Confidentielles'))
    add(
      'R08',
      'Confidentialité de la recherche',
      'data',
      'U13 = Oui ou U11 = Confidentielles',
      'Des documents non publics peuvent engager la confidentialité et les droits sur les contenus.',
      'Examiner licences, réutilisation, accès et clauses de confidentialité.',
      'INTERNAL',
    );
  if (a.F24a === 'Oui' || a.F24a === 'Inconnu')
    add(
      'R09',
      'Transferts et accès étrangers',
      'data',
      `F24a = ${a.F24a}`,
      'La localisation seule ne suffit pas à conclure à une interdiction.',
      'Examiner les pays, les destinataires et les garanties documentées.',
      'VD',
    );
  if (['Oui', 'Selon configuration', 'Inconnu'].includes(String(a.F22)))
    add(
      'R10',
      'Réutilisation des données',
      'data',
      `F22 = ${a.F22}`,
      'Les finalités, rôles, autorisations et clauses doivent être examinés.',
      'Obtenir les paramètres et engagements contractuels correspondants.',
      'INTERNAL',
    );
  add(
    'R14',
    'Procédure et valeur du marché',
    'contract',
    `U21 = ${a.U21 ?? 'à préciser'} CHF ; U20a = ${a.U20a ?? 'à préciser'} mois`,
    'Le budget saisi représente le coût total pour toute la durée, renouvellements inclus.',
    'Confirmer le périmètre et la procédure adaptée ; aucune procédure n’est déduite du seul montant.',
    'PROC',
  );
  if (consequential) {
    const date = c.deploymentDate;
    const contractEnd = contractEndDate(date, a.U20a);
    const crosses = date < '2027-12-02' && !!contractEnd && contractEnd > '2027-12-02';
    add(
      'DATE',
      'Calendrier des obligations renforcées',
      'triage',
      `Déploiement prévu : ${date}`,
      date >= '2027-12-02'
        ? 'La date envisagée atteint le calendrier des principales obligations de l’annexe III.'
        : crosses
          ? 'La durée déclarée du contrat traverse le 2 décembre 2027. Une condition de conformité future doit être examinée.'
          : 'La date envisagée précède le 2 décembre 2027 ; les autres dispositions, transitions et la durée du contrat restent à examiner.',
      'Vérifier les dispositions applicables sur toute la durée du contrat et les éventuelles transitions.',
      'AI-DATES',
    );
  }
  const configStale = c.configVersion !== CONFIG_VERSION;
  const active = controls
    .filter((x) => matches(x.when, a))
    .map((x) => {
      const review = c.reviews.find((r) => r.controlId === x.id);
      const stale = !!review && (review.fingerprint !== controlFingerprint(x, c) || configStale);
      const evidenceCount = c.evidence.filter((e) => e.controlId === x.id).length;
      const missing = x.questionIds.some(
        (id) =>
          visibleQuestions('vendor', a).some((q) => q.id === id) &&
          (!answered(a[id]) || ['Inconnu', 'Inconnue'].includes(String(a[id]))),
      );
      const status =
        review && !stale ? review.status : missing || !evidenceCount ? 'missing' : 'human_review';
      return { ...x, status, stale, review: review && !stale ? review : undefined, evidenceCount };
    });
  const completed = active.filter((x) =>
    ['satisfied', 'not_applicable', 'conditional'].includes(x.status),
  ).length;
  const legalReview = active.find((x) => x.id === 'T02')?.review;
  const validatedLegal =
    legalReview && ['satisfied', 'conditional'].includes(legalReview.status)
      ? legalReview.legalConclusions
      : undefined;
  const scopeIssues = scopeReviewIssues(
    a,
    validatedLegal ?? {},
    validatedLegal?.scopeOverrideReason ?? '',
  );
  const automatedGdpr = validatedLegal?.gdprUnil === 'APPLICABLE' && a.U23 === 'Oui';
  const blocked =
    active.some((x) => x.status === 'noncompliant') ||
    validatedLegal?.category === 'PROHIBITED' ||
    (automatedGdpr && validatedLegal?.autoException === 'NO');
  const blockingReasons = active
    .filter((x) => x.status === 'noncompliant')
    .map(
      (x) => `${x.review?.blockingType || 'Exigence'} — ${x.title} : ${x.review?.justification}`,
    );
  if (validatedLegal?.category === 'PROHIBITED') {
    blockingReasons.push(
      'Pratique interdite applicable, sans exception, confirmée dans la qualification.',
    );
    add(
      'AI-5-CONFIRMED',
      'Interdiction confirmée',
      'triage',
      'T02 : qualification PROHIBITED',
      'La qualification documentée constate une pratique interdite applicable.',
      'Modifier ou abandonner la configuration concernée.',
      'AI',
      true,
    );
  }
  if (automatedGdpr && validatedLegal?.autoException === 'NO') {
    blockingReasons.push(
      'RGPD applicable : décision exclusivement automatisée significative sans exception documentée.',
    );
    add(
      'GDPR-AUTO-02',
      'Décision automatisée sans exception',
      'triage',
      'U23 = Oui ; RGPD applicable ; exception = Non',
      'Le test documenté ne retient aucune exception applicable.',
      'Modifier le processus décisionnel ou établir une voie admissible.',
      'GDPR',
      true,
    );
  }
  const remediations = active
    .filter((x) => x.status === 'correction')
    .map((x) => `${x.title} : ${x.review?.condition || x.review?.justification}`);
  remediations.push(
    ...ruleResults.filter((r) => r.state === 'correction').map((r) => `${r.title} : ${r.action}`),
  );
  if (
    automatedGdpr &&
    validatedLegal?.autoException === 'YES' &&
    validatedLegal?.autoGuarantees === 'NO'
  ) {
    remediations.push(
      'Mettre en place les garanties requises d’intervention et de contestation avant de poursuivre.',
    );
    add(
      'GDPR-AUTO-03',
      'Garanties de décision à corriger',
      'triage',
      'U23 = Oui ; exception = Oui ; garanties = Non',
      'Une exception est documentée, mais les garanties requises sont absentes.',
      'Réaliser les mesures de supervision et de contestation.',
      'GDPR',
    );
  }
  const protectionTasks = evaluateProtectionTasks(a, active, validatedLegal);
  const needsCorrection =
    protectionTasks.some((t) => t.status === 'correction') ||
    ruleResults.some((r) => r.state === 'correction') ||
    (automatedGdpr &&
      validatedLegal?.autoException === 'YES' &&
      validatedLegal?.autoGuarantees === 'NO') ||
    active.some(
      (x) =>
        x.status === 'correction' ||
        (x.status === 'conditional' && x.review?.condition.startsWith('[PRÉALABLE]')),
    );
  const ready =
    c.internalSubmitted &&
    c.vendorSubmitted &&
    !configStale &&
    completed === active.length &&
    missingQuestions('internal', a).length === 0 &&
    missingQuestions('vendor', a).length === 0;
  const scoringEligible =
    ready &&
    !blocked &&
    !needsCorrection &&
    scopeIssues.length === 0 &&
    !protectionTasks.some((t) => t.preventsScoring) &&
    !ruleResults.some((r) => r.preventsScoring);
  const conditions = active
    .filter((x) => x.status === 'conditional')
    .map((x) => `${x.title} : ${x.review?.condition ?? ''}`);
  const endDate = contractEndDate(c.deploymentDate, a.U20a);
  if (
    validatedLegal?.category === 'HIGH_RISK' &&
    [validatedLegal.aiProvider, validatedLegal.aiDeployer].includes('APPLICABLE') &&
    c.deploymentDate < '2027-12-02' &&
    !!endDate &&
    endDate > '2027-12-02'
  )
    conditions.push(
      'Conformité future : inscrire au contrat les obligations applicables au plus tard le 2 décembre 2027, les justificatifs attendus et le suivi des changements.',
    );
  const missingCritical =
    protectionTasks.some((t) => ['clarify', 'missing', 'human_review'].includes(t.status)) ||
    scopeIssues.length > 0 ||
    ruleResults.some((r) => r.state === 'unknown' || r.state === 'conflict') ||
    !c.internalSubmitted ||
    !c.vendorSubmitted ||
    configStale ||
    (automatedGdpr &&
      (!['YES', 'NO'].includes(validatedLegal?.autoException ?? '') ||
        (validatedLegal?.autoException === 'YES' &&
          !['YES', 'NO'].includes(validatedLegal?.autoGuarantees ?? '')))) ||
    missingQuestions('internal', a).length > 0 ||
    missingQuestions('vendor', a).length > 0 ||
    active.some((x) => ['missing', 'clarify', 'human_review'].includes(x.status));
  const outcome = blocked
    ? 'BLOQUANT'
    : missingCritical
      ? 'À CLARIFIER'
      : needsCorrection
        ? 'À CORRIGER'
        : conditions.length
          ? 'CONFORME SOUS CONDITIONS'
          : 'CONFORME';
  const scoresValid =
    scoringCriteria.every((x) => c.scores.some((s) => s.criterionId === x.id)) &&
    Math.abs(c.scores.reduce((n, s) => n + s.weight, 0) - 100) < 0.001;
  const score =
    scoringEligible && scoresValid
      ? Math.round(c.scores.reduce((n, s) => n + (s.value / 5) * s.weight, 0) * 100) / 100
      : null;
  const legalClassification = validatedLegal?.category
    ? ({
        OUT_OF_SCOPE: 'Hors champ pour cet usage — qualification validée',
        OTHER: 'Autres obligations / non haut risque — qualification validée',
        HIGH_RISK: 'Haut risque — qualification validée',
        PROHIBITED: 'Pratique interdite applicable — qualification validée',
      }[validatedLegal.category] ?? 'Qualification à clarifier')
    : a.F15 === 'Oui'
      ? 'Pratique potentiellement interdite — à examiner'
      : consequential
        ? 'Catégorie potentiellement à haut risque — à confirmer'
        : a.F03 === 'Non'
          ? 'Règlement potentiellement hors champ — à vérifier'
          : 'Applicabilité et qualification à confirmer';
  const scopeProposals = evaluateLegalScope(a);
  const laws = scopeProposals.map((p) => ({
    regime: p.regime,
    actor: p.actor,
    source: p.source,
    status:
      validatedLegal?.[p.key] === 'APPLICABLE'
        ? 'Applicable — analyse validée'
        : validatedLegal?.[p.key] === 'NOT_APPLICABLE'
          ? 'Non applicable — analyse validée'
          : scopeStateLabels[p.state],
    reason:
      p.reason + (validatedLegal ? ' Conclusion T02 : ' + (legalReview?.justification ?? '') : ''),
  }));
  laws.push({
    regime: 'AIMP / droit vaudois',
    actor: 'Acquéreur',
    status: 'Examen activé',
    reason:
      'Valeur totale déclarée : ' +
      (a.U21 ?? 'inconnue') +
      ' CHF ; durée : ' +
      (a.U20a ?? 'inconnue') +
      ' mois.',
    source: 'PROC',
  });
  return {
    scopeProposals,
    protectionTasks,
    ruleResults,
    risks,
    overallRisk,
    legalClassification,
    laws,
    findings,
    controls: active,
    outcome,
    scoringEligible,
    completed,
    total: active.length,
    score,
    conditions,
    blockingReasons,
    remediations,
    configStale,
  };
}
