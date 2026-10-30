import { protectionDefinitions } from '@/config/data-protection';
import { questions } from '@/config/assessment';
import type { Answers, AssessedControl, ReviewStatus } from './domain';
import { conditionTruth, isUnknown } from './rule-facts';

export type ProtectionTask = {
  id: string;
  title: string;
  control: string;
  source: string;
  status: ReviewStatus;
  reason: string;
  action: string;
  evidence: string;
  evidenceCount: number;
  owner: string;
  facts: { id: string; value: Answers[string] | null }[];
  regimes: { actor: string; regime: string; status: string }[];
  preventsScoring: boolean;
  reviewCondition?: string;
};
export function protectionReviewIssues(control: string, a: Answers, status: string): string[] {
  if (!['DP01', 'DP02', 'DP03'].includes(control)) return [];
  if (status === 'not_applicable')
    return [
      'Documenter la décision de non-nécessité dans ce contrôle de revue, sans écarter globalement la revue préalable.',
    ];
  if (!['satisfied', 'conditional'].includes(status)) return [];
  const ids =
    control === 'DP01'
      ? ['P-U-EVAL', 'P-U-SENSITIVE', 'P-U-MONITOR', 'P-U-HIGH', 'P-U-IMPACT', 'P-F-ROLE']
      : control === 'DP02'
        ? ['P-F-ROLE', 'P-F-SUB', ...(a['P-F-SUB'] !== 'Non' ? ['P-F-AUTH'] : [])]
        : ['P-F-ROLE'];
  if (ids.some((id) => isUnknown(a[id])))
    return [
      'Compléter les faits structurés avant de valider cette revue de protection des données.',
    ];
  if (control === 'DP01' && a['P-U-IMPACT'] === 'À réaliser')
    return [
      'Réaliser l’analyse annoncée ou documenter une décision motivée de non-nécessité avant validation.',
    ];
  if (control === 'DP02' && a['P-F-SUB'] === 'Oui' && a['P-F-AUTH'] === 'Non')
    return [
      'Documenter le mécanisme d’autorisation des sous-traitants annoncé absent avant validation.',
    ];
  return [];
}
export function evaluateProtectionTasks(
  a: Answers,
  controls: AssessedControl[],
  legal?: Record<string, string>,
): ProtectionTask[] {
  const data = conditionTruth({ id: '@data', values: ['Oui'] }, a);
  const regimes = [
    ['lprd', 'UNIL', 'LPrD'],
    ['lpdVendor', 'Fournisseur', 'LPD — champ à préciser'],
    ['gdprUnil', 'UNIL', 'RGPD'],
    ['gdprVendor', 'Fournisseur', 'RGPD'],
  ].map(([key, actor, regime]) => ({
    actor,
    regime,
    status:
      legal?.[key] === 'APPLICABLE'
        ? 'Champ confirmé dans T02 — rôle et obligation à examiner'
        : legal?.[key] === 'NOT_APPLICABLE'
          ? 'Hors champ confirmé dans T02'
          : 'Champ non confirmé — liste préparatoire',
  }));
  return protectionDefinitions.map((d) => {
    const control = controls.find((c) => c.id === d.control);
    const relevant = d.ids.filter(
      (id) => conditionTruth(questions.find((q) => q.id === id)?.when, a) !== 'false',
    );
    const unknown = relevant.filter((id) => isUnknown(a[id]));
    let status: ReviewStatus =
      data === 'false' || !control
        ? 'not_applicable'
        : data !== 'true' || unknown.length
          ? 'clarify'
          : control.status;
    let reason =
      data === 'false'
        ? 'Aucune branche données déclarée active ; réévaluer si les données, journaux ou usages changent.'
        : !control
          ? 'Le contrôle conditionnel n’est pas activé par les déclarations actuelles.'
          : data !== 'true'
            ? 'Le périmètre des données reste incertain : conserver cette demande ouverte.'
            : unknown.length
              ? `Faits à préciser : ${unknown.join(', ')}.`
              : control.stale
                ? 'L’examen doit être renouvelé après modification des faits ou preuves.'
                : 'La liste prépare la revue ; seule une preuve examinée et une conclusion actuelle valident ce contrôle.';
    if (control && data === 'true' && d.id === 'DP-IMPACT') {
      const positive = ['P-U-EVAL', 'P-U-SENSITIVE', 'P-U-MONITOR', 'P-U-HIGH'].filter(
        (id) => a[id] === 'Oui',
      );
      reason += positive.length
        ? ` Indicateurs déclarés : ${positive.join(', ')} ; vérifier les obligations et risques résiduels selon le rôle et le régime.`
        : ' Aucun indicateur positif ne dispense automatiquement d’analyse ; vérifier les listes et le contexte.';
      if (a['P-U-IMPACT'] === 'À réaliser') {
        status = unknown.length ? 'clarify' : 'correction';
        reason += ' Analyse annoncée à réaliser : préalable du parcours non résolu.';
      }
    }
    if (
      control &&
      data === 'true' &&
      d.id === 'DP-CHAIN' &&
      a['P-F-SUB'] === 'Oui' &&
      a['P-F-AUTH'] === 'Non'
    ) {
      status = unknown.length ? 'clarify' : 'correction';
      reason += ' Mécanisme d’autorisation déclaré non documenté : préalable du parcours.';
    }
    if (control && ['satisfied', 'conditional'].includes(status) && !control.evidenceCount) {
      status = 'missing';
      reason += ' Une conclusion positive ne remplace pas la pièce requise.';
    }
    if (
      control &&
      data !== 'false' &&
      ['DP01', 'DP02', 'DP03'].includes(control.id) &&
      control.status === 'not_applicable'
    ) {
      status = 'clarify';
      reason +=
        ' La revue préalable doit être documentée ; une non-nécessité juridique ne supprime pas cette revue.';
    }
    // An unresolved automated prerequisite cannot be waived by a broad positive review.
    if (control?.status === 'noncompliant') status = 'noncompliant';
    return {
      id: d.id,
      title: d.title,
      control: d.control,
      source: d.source,
      status,
      reason,
      action: d.fr,
      evidence: control?.evidence ?? 'Selon activation du contrôle associé',
      evidenceCount: control?.evidenceCount ?? 0,
      owner:
        d.id === 'DP-IMPACT'
          ? 'Demandeur et évaluateur ; fournisseur en assistance selon son rôle'
          : 'Fournisseur : pièces et faits ; évaluateur : validation ; demandeur : contexte',
      facts: relevant.map((id) => ({ id, value: a[id] ?? null })),
      regimes,
      reviewCondition: control?.review?.condition,
      preventsScoring:
        !!control &&
        (!['satisfied', 'not_applicable', 'conditional'].includes(status) ||
          (status === 'conditional' && !!control.review?.condition.startsWith('[PRÉALABLE]'))),
    };
  });
}
