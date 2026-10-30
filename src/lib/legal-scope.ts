import {
  aiRoutes,
  scopeDefinitions,
  scopeQuestions,
  territorialRoutes,
} from '@/config/legal-scope';
import type { Answers } from './domain';
import { isUnknown } from './rule-facts';

export type ScopeState =
  'APPLICABLE' | 'NOT_APPLICABLE' | 'UNKNOWN' | 'CONFLICT' | 'REVIEW_REQUIRED';
export type ScopeProposal = {
  key: string;
  regime: string;
  actor: string;
  source: string;
  state: ScopeState;
  reason: string;
  logic: string;
  facts: { id: string; label: string; value: Answers[string] | null }[];
};
export const scopeStateLabels: Record<ScopeState, string> = {
  APPLICABLE: 'Applicabilité proposée',
  NOT_APPLICABLE: 'Hors champ proposé',
  UNKNOWN: 'Faits manquants',
  CONFLICT: 'Déclarations contradictoires',
  REVIEW_REQUIRED: 'Interprétation juridique requise',
};

function answer(a: Answers, id: string): 'yes' | 'no' | 'unknown' {
  return a[id] === 'Oui' ? 'yes' : a[id] === 'Non' ? 'no' : 'unknown';
}
function routes(a: Answers, id: string): 'yes' | 'no' | 'unknown' | 'conflict' {
  const v = a[id];
  const options = id.includes('GDPR') ? territorialRoutes : aiRoutes;
  if (!Array.isArray(v) || !v.length || v.some((x) => !options.includes(x))) return 'unknown';
  if (v.length > 1 && (v.includes('Aucun de ces liens') || v.includes('Inconnu')))
    return 'conflict';
  return v.includes('Inconnu') ? 'unknown' : v.includes('Aucun de ces liens') ? 'no' : 'yes';
}
export function evaluateLegalScope(a: Answers): ScopeProposal[] {
  return scopeDefinitions.map((d) => {
    let state: ScopeState = 'UNKNOWN';
    let reason =
      'Compléter les faits structurés pour cet acteur et cette activité ; aucune déduction depuis les anciens champs libres.';
    const values = d.ids.map((id) => answer(a, id));
    const set = (s: ScopeState, r: string) => {
      state = s;
      reason = r;
    };
    if (d.key === 'lprd' || d.key === 'lpdVendor') {
      if (values.includes('no'))
        set(
          'NOT_APPLICABLE',
          'Au moins un critère nécessaire est déclaré absent ; confirmer le fait et le périmètre dans T02.',
        );
      else if (values.every((v) => v === 'yes'))
        set(
          'APPLICABLE',
          'Tous les critères du test structuré sont déclarés présents ; validation T02 requise.',
        );
    } else {
      const link = routes(a, d.ids[1]);
      if (link === 'conflict')
        set(
          'CONFLICT',
          'Une absence de lien ou une incertitude est sélectionnée avec un autre lien. Corriger la déclaration.',
        );
      else if (d.regime === 'AI Act' && values[3] === 'no')
        set(
          'REVIEW_REQUIRED',
          'Modèle seul ou qualification du produit : vérifier les règles GPAI et les autres opérateurs ; aucune exclusion automatique.',
        );
      else if (d.regime === 'AI Act' && values[3] === 'unknown')
        set(
          'UNKNOWN',
          'Préciser si cette activité concerne un système ou seulement un modèle autonome.',
        );
      else if (values[2] === 'yes')
        set(
          'REVIEW_REQUIRED',
          'Une exclusion ou limitation est invoquée : vérifier les conditions précises et les obligations résiduelles ; aucune dispense automatique.',
        );
      else if (values[2] === 'no') {
        if (d.regime === 'AI Act' && values[0] === 'no')
          set(
            'REVIEW_REQUIRED',
            'Autre rôle ou qualification du produit : examiner notamment les autres opérateurs et les modèles ; ne pas conclure automatiquement hors champ.',
          );
        else if (values[0] === 'no' || link === 'no')
          set(
            'NOT_APPLICABLE',
            'Un critère du test est déclaré absent. Les autres rôles, personnes affectées et régimes particuliers restent à vérifier dans T02.',
          );
        else if (values[0] === 'yes' && link === 'yes')
          set(
            'APPLICABLE',
            'Champ matériel / rôle et lien territorial déclarés présents, sans exclusion invoquée. Proposition à confirmer dans T02.',
          );
      }
    }
    if (isUnknown(a['S-U-OP']))
      set(
        'UNKNOWN',
        'Décrire d’abord l’activité évaluée pour ne pas confondre plusieurs traitements ou acteurs.',
      );
    return {
      key: d.key,
      regime: d.regime,
      actor: d.actor,
      source: d.source,
      state,
      reason,
      logic: d.fr,
      facts: ['S-U-OP', ...d.ids].map((id) => ({
        id,
        label: scopeQuestions.find((q) => q.id === id)!.label,
        value: a[id] ?? null,
      })),
    };
  });
}

// A reviewer can depart from a proposal, but must record a dedicated explanation.
export function scopeReviewIssues(
  a: Answers,
  conclusions: Record<string, string>,
  explanation: string,
): string[] {
  const proposals = evaluateLegalScope(a);
  if (proposals.some((p) => p.state === 'CONFLICT'))
    return ['Corriger les déclarations territoriales contradictoires avant de valider T02.'];
  if (proposals.some((p) => p.state === 'UNKNOWN'))
    return ['Compléter les faits structurés manquants avant de valider T02.'];
  if (
    proposals.some(
      (p) => !['APPLICABLE', 'NOT_APPLICABLE'].includes(p.state) || conclusions[p.key] !== p.state,
    ) &&
    explanation.trim().length < 30
  )
    return [
      'Documenter au moins 30 caractères expliquant les faits manquants, l’interprétation ou tout écart aux propositions automatiques.',
    ];
  return [];
}
