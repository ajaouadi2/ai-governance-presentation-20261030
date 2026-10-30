import type { Answers, AnswerValue, CaseView, Module, Question } from './domain';
import { activationDependencies, contractEndDate, fact, isUnknown, type Fact } from './rule-facts';

export type RuleState = 'calculated' | 'not_applicable' | 'unknown' | 'conflict' | 'correction';
export type RuleResult = {
  id: string;
  version: string;
  title: string;
  module: Module;
  nature: 'workflow' | 'calculation';
  source: string;
  state: RuleState;
  explanation: string;
  action: string;
  preventsScoring: boolean;
  dependencies: string[];
  facts: Record<string, Fact>;
  computed?: Record<string, string | number>;
};

type RuleContext = {
  c: CaseView;
  answers: Answers;
  visible: Question[];
  dataActive: boolean;
};
type Evaluation = Pick<RuleResult, 'state' | 'explanation' | 'action'> &
  Pick<Partial<RuleResult>, 'computed'>;
type RuleDefinition = Omit<
  RuleResult,
  'state' | 'explanation' | 'action' | 'preventsScoring' | 'facts' | 'computed'
> & {
  evaluate: (context: RuleContext) => Evaluation;
};

const rules: RuleDefinition[] = [
  {
    id: 'FACT-COMPLETENESS',
    version: '1',
    title: 'Informations indispensables',
    module: 'triage',
    nature: 'workflow',
    source: 'INTERNAL',
    dependencies: ['@visible-required'],
    evaluate: ({ answers, visible }) => {
      const unresolved = visible.filter((q) => q.required && isUnknown(answers[q.id]));
      return unresolved.length
        ? {
            state: 'unknown',
            explanation: `${unresolved.length} information(s) indispensable(s) absente(s) ou inconnue(s).`,
            action: unresolved.map((q) => `${q.id} — ${q.label}`).join('\n'),
          }
        : {
            state: 'calculated',
            explanation:
              'Les questions obligatoires visibles ont une réponse déterminée. Leur contenu et les pièces restent soumis aux contrôles applicables.',
            action: '',
          };
    },
  },
  {
    id: 'DECISION-CONSISTENCY',
    version: '1',
    title: 'Cohérence des décisions déclarées',
    module: 'triage',
    nature: 'workflow',
    source: 'INTERNAL',
    dependencies: ['U06', 'U07', 'U08', 'U09', 'U10', 'U23'],
    evaluate: ({ answers }) => {
      const specific = ['U07', 'U08', 'U09', 'U10', 'U23'].filter((id) => answers[id] === 'Oui');
      return answers.U06 === 'Non' && specific.length
        ? {
            state: 'conflict',
            explanation: `U06 exclut une décision importante, mais ${specific.join(', ')} déclare un usage décisionnel ou de surveillance nécessitant clarification.`,
            action:
              'Réconcilier le rôle exact de l’outil dans le questionnaire interne. Aucun rejet légal n’est déduit de cette divergence.',
          }
        : {
            state: 'calculated',
            explanation:
              'Aucune divergence détectée entre ces réponses structurées ; ceci ne valide pas la classification juridique.',
            action: '',
          };
    },
  },
  {
    id: 'BASIS-DECLARATION',
    version: '1',
    title: 'Justification du traitement',
    module: 'data',
    nature: 'workflow',
    source: 'INTERNAL',
    dependencies: [...activationDependencies['@data'], 'I-U02'],
    evaluate: ({ answers, dataActive }) =>
      !dataActive
        ? {
            state: 'not_applicable',
            explanation: 'Branche données personnelles non activée.',
            action: '',
          }
        : answers['I-U02'] === 'Non'
          ? {
              state: 'correction',
              explanation:
                'L’UNIL déclare ne pas disposer de la justification pertinente du traitement. Un contrôle global positif ne peut neutraliser cette réponse.',
              action:
                'Établir la justification du traitement ou modifier le périmètre, puis actualiser la réponse et faire examiner les pièces.',
            }
          : isUnknown(answers['I-U02'])
            ? {
                state: 'unknown',
                explanation: 'La justification du traitement n’est pas établie.',
                action: 'Compléter I-U02 et la justification dans le contrôle D01.',
              }
            : {
                state: 'calculated',
                explanation:
                  'Une justification est déclarée ; son adéquation juridique reste à vérifier dans D01.',
                action: '',
              },
  },
  {
    id: 'MINIMISATION-DECLARATION',
    version: '1',
    title: 'Mesures de minimisation déclarées',
    module: 'data',
    nature: 'workflow',
    source: 'INTERNAL',
    dependencies: [...activationDependencies['@data'], 'I-U04'],
    evaluate: ({ answers, dataActive }) =>
      !dataActive
        ? {
            state: 'not_applicable',
            explanation: 'Branche données personnelles non activée.',
            action: '',
          }
        : answers['I-U04'] === 'Non'
          ? {
              state: 'correction',
              explanation:
                'Le demandeur déclare utiliser des données qui ne sont pas strictement nécessaires.',
              action:
                'Réduire les données au périmètre nécessaire ou clarifier la réponse et les garanties avant la notation.',
            }
          : isUnknown(answers['I-U04'])
            ? {
                state: 'unknown',
                explanation: 'La minimisation reste à préciser.',
                action: 'Compléter I-U04 ; examiner les mesures dans D02.',
              }
            : {
                state: 'calculated',
                explanation:
                  'La minimisation est déclarée ; la suffisance des mesures reste à examiner.',
                action: '',
              },
  },
  {
    id: 'CONTRACT-PERIOD',
    version: '1',
    title: 'Période contractuelle calculée',
    module: 'contract',
    nature: 'calculation',
    source: 'INTERNAL',
    dependencies: ['$deploymentDate', 'U20a'],
    evaluate: ({ c, answers }) => {
      const end = contractEndDate(c.deploymentDate, answers.U20a);
      return end
        ? {
            state: 'calculated',
            explanation: `Début ${c.deploymentDate} ; borne de fin calculée ${end}, après ${answers.U20a} mois calendaires. Les dates de fin de mois sont ajustées au dernier jour disponible.`,
            action:
              'Confirmer la période et les options dans le contrat. Ce calcul ne tranche pas les dispositions transitoires.',
            computed: {
              start: c.deploymentDate,
              endExclusive: end,
              months: answers.U20a as number,
            },
          }
        : {
            state: 'unknown',
            explanation:
              'Une date de déploiement valide et une durée entière de 1 à 1 200 mois sont nécessaires.',
            action: 'Compléter la date de déploiement et U20a.',
          };
    },
  },
  {
    id: 'DURATION-JUSTIFICATION',
    version: '1',
    title: 'Justification de la durée longue',
    module: 'contract',
    nature: 'workflow',
    source: 'INTERNAL',
    dependencies: ['U20a', 'M-U03'],
    evaluate: ({ answers }) =>
      typeof answers.U20a !== 'number'
        ? { state: 'unknown', explanation: 'La durée est inconnue.', action: 'Compléter U20a.' }
        : answers.U20a <= 60
          ? {
              state: 'not_applicable',
              explanation: 'La durée déclarée ne dépasse pas 60 mois.',
              action: '',
            }
          : isUnknown(answers['M-U03'])
            ? {
                state: 'unknown',
                explanation: 'La durée dépasse 60 mois sans justification renseignée.',
                action:
                  'Compléter M-U03 ; faire examiner la justification et le régime applicable dans C01.',
              }
            : {
                state: 'calculated',
                explanation:
                  'Une justification de durée est renseignée ; le calcul ne valide pas son admissibilité.',
                action: 'Examiner cette justification dans C01.',
              },
  },
  {
    id: 'COST-COMPARISON',
    version: '1',
    title: 'Comparaison des totaux déclarés',
    module: 'contract',
    nature: 'calculation',
    source: 'INTERNAL',
    dependencies: ['U21', 'C03'],
    evaluate: ({ answers }) => {
      const cents = (value: AnswerValue | undefined): number | null =>
        typeof value === 'number' &&
        Number.isFinite(value) &&
        value >= 0 &&
        value <= 1e12 &&
        Number(value.toFixed(2)) === value
          ? Math.round(value * 100)
          : null;
      const estimated = cents(answers.U21);
      const offered = cents(answers.C03);
      if (estimated === null || offered === null)
        return {
          state: 'unknown',
          explanation:
            'Les deux coûts totaux doivent être des montants CHF valides, avec au plus deux décimales.',
          action:
            'Compléter U21 et C03. Ne pas multiplier à nouveau un total couvrant déjà toute la durée.',
        };
      const delta = (offered - estimated) / 100;
      return {
        state: 'calculated',
        explanation: `Estimation : ${estimated / 100} CHF ; offre : ${offered / 100} CHF ; écart : ${delta} CHF. Un écart entre estimation et offre n’est pas, à lui seul, une contradiction ou une exclusion.`,
        action: delta
          ? 'Vérifier que les deux montants couvrent le même périmètre, les frais et les options.'
          : '',
        computed: { estimatedCHF: estimated / 100, offeredCHF: offered / 100, deltaCHF: delta },
      };
    },
  },
];

export const objectiveRuleDefinitions = rules.map((rule) => ({
  id: rule.id,
  version: rule.version,
  title: rule.title,
  module: rule.module,
  nature: rule.nature,
  source: rule.source,
  dependencies: rule.dependencies,
}));

export function evaluateObjectiveRules(context: RuleContext): RuleResult[] {
  return rules.map((rule) => {
    const dependencies = rule.dependencies.includes('@visible-required')
      ? context.visible
          .filter((q) => q.required)
          .map((q) => q.id)
          .sort()
      : rule.dependencies;
    const facts = Object.fromEntries(
      dependencies.map((id) => [
        id,
        fact(
          id === '$deploymentDate' ? context.c.deploymentDate : context.answers[id],
          id.startsWith('$') ? `case:${id.slice(1)}` : `answer:${id}`,
        ),
      ]),
    );
    const result = rule.evaluate(context);
    return {
      id: rule.id,
      version: rule.version,
      title: rule.title,
      module: rule.module,
      nature: rule.nature,
      source: rule.source,
      dependencies,
      facts,
      ...result,
      preventsScoring: ['unknown', 'conflict', 'correction'].includes(result.state),
    };
  });
}
