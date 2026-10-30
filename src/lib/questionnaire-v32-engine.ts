import { v32ExecutionQuestions } from './questionnaire-v32-journey';
import catalogue from '../config/questionnaire-v32/catalogue.json';
import routing from '../config/questionnaire-v32/routing-map.json';
import { v32DpfPolicy } from './questionnaire-v32-policy';

export const V32_ENGINE_VERSION = '2026-10-30.checklist-v3.2.engine.6';
export const v32Id = (stage: number, question: number) =>
  `V32-S${String(stage).padStart(2, '0')}-Q${String(question).padStart(2, '0')}`;
// Removed from the active questionnaire at UNIL’s request; historical source and answers retained.
export const v32QuestionActive = (id: string) => id !== 'V32-S04-Q04';
export type V32Answers = Record<string, string>;
type Verdict = 'POURSUIVRE' | 'SOUS CONDITION' | 'NE PAS POURSUIVRE' | 'ORIENTATION';
type Row = {
  computed?: boolean;
  id: string;
  state: 'not-reached' | 'skipped' | 'unanswered' | 'answered';
  reason?: string;
  letter?: string;
  sourceVerdict?: Verdict;
  effectiveVerdict?: Verdict;
};
export type V32Result = {
  version: string;
  sourceSha256: string;
  status:
    'question' | 'pending-clarification' | 'suspended' | 'no-go-proposed' | 'decision-proposed';
  nextQuestion: string | null;
  questions: Row[];
  summary: {
    questionId: string;
    letter: string;
    sourceVerdict: Verdict;
    effectiveVerdict: Verdict;
    sourceAnswer: string;
    sourceNotes: string;
  }[];
  opinionRequests: { questionId: string; reason: string }[];
  verificationChecks: V32VerificationCheck[];
  pendingIssues: string[];
  documentaryWarnings: string[];
  proposedDecision: 'go' | 'conditional-go' | 'no-go' | null;
  deploymentAuthorised: false;
};

export type V32Verification = {
  confirmed: boolean;
  reference: string;
  reviewer: string;
  date: string;
  basis: string;
};
export type V32VerificationContext = {
  notes?: Record<string, string>;
  supplierEvidence?: Record<
    string,
    { reference: string; verified: boolean; checkedBy: string; date: string }
  >;
  verifications?: Record<string, V32Verification>;
};
export type V32VerificationCheck = {
  id: string;
  questionId: string;
  label: string;
  kind: 'assessment' | 'opinion';
  status: 'pending' | 'confirmed' | 'stale';
  basis: string;
};
// Change detector only: this is neither a signature nor evidence of legal validity.
export function verificationBasis(
  answers: V32Answers,
  notes: Record<string, string>,
  evidence: V32VerificationContext['supplierEvidence'],
) {
  const text = JSON.stringify([
    catalogue.source.sha256,
    Object.entries(answers).sort(),
    Object.entries(notes)
      .filter(([id]) => answers[id] !== undefined)
      .sort(),
    Object.entries(evidence ?? {})
      .filter(([id]) => answers[id] !== undefined)
      .sort(),
  ]);
  let a = 2166136261,
    b = 5381;
  for (let i = 0; i < text.length; i++) {
    a = Math.imul(a ^ text.charCodeAt(i), 16777619);
    b = Math.imul(b, 33) ^ text.charCodeAt(i);
  }
  return `${V32_ENGINE_VERSION}:${a >>> 0}:${b >>> 0}:${text.length}`;
}

/** Pure, separate engine. No storage, no role authorisation, no legal certification.
 * Only facts reached on the current path affect routing; retained off-path answers do not.
 */
export function evaluateV32(answers: V32Answers, context: V32VerificationContext = {}): V32Result {
  for (const [key, letter] of Object.entries(answers)) {
    const q = catalogue.questions.find((q) => q.id === key);
    if (!q || !q.answers.some((a) => a.letter === letter))
      throw new Error(`Réponse hors catalogue : ${key}/${letter}`);
  }
  const rows: Row[] = v32ExecutionQuestions.map((q) => ({
    id: q.id,
    state: v32QuestionActive(q.id) ? 'not-reached' : 'skipped',
    ...(!v32QuestionActive(q.id) ? { reason: 'Question retirée du parcours.' } : {}),
  }));
  const result: V32Result = {
    version: V32_ENGINE_VERSION,
    sourceSha256: catalogue.source.sha256,
    status: 'question',
    nextQuestion: null,
    questions: rows,
    summary: [],
    opinionRequests: [],
    verificationChecks: [],
    pendingIssues: [],
    documentaryWarnings: ['A07', 'A12', 'A15', 'A18'],
    proposedDecision: null,
    deploymentAuthorised: false,
  };
  const reached: V32Answers = {};
  const value = (s: number, n: number) => reached[v32Id(s, n)];
  const issue = (code: string, status: V32Result['status'] = 'pending-clarification') => {
    result.pendingIssues.push(code);
    result.status = status;
    result.nextQuestion = null;
    return result;
  };
  const omit = (s: number, from: number, to: number, reason: string) => {
    for (let n = from; n <= to; n++) {
      const row = rows.find((r) => r.id === v32Id(s, n));
      if (row && row.state === 'not-reached') {
        row.state = 'skipped';
        row.reason = reason;
      }
    }
  };
  const jump = (target: string, from: number, reason: string) => {
    const at = v32ExecutionQuestions.findIndex((q) => q.id === target);
    for (let i = from + 1; i < at; i++)
      if (rows[i].state === 'not-reached') {
        rows[i].state = 'skipped';
        rows[i].reason = reason;
      }
    return at - 1;
  };
  let terminalRed = false;
  for (let i = 0; i < v32ExecutionQuestions.length; i++) {
    const q = v32ExecutionQuestions[i],
      row = rows[i];
    if (!v32QuestionActive(q.id)) {
      row.state = 'skipped';
      row.reason = 'Question retirée du parcours à la demande de l’UNIL.';
      continue;
    }
    if (row.state === 'skipped') continue;
    const personal = ['c', 'd'].includes(value(1, 3));
    const highRisk = ['a', 'b'].includes(value(2, 2));
    let skip: string | null = null;
    if (
      q.stage === 1 &&
      q.number >= 4 &&
      (value(1, 3) === 'a' || (value(1, 3) === 'b' && q.number !== 6))
    )
      skip =
        'Catégorie de données : question personnelle omise ; sécurité confidentielle conservée.';
    if (q.badge === 'HAUT RISQUE' && !highRisk)
      skip = '2.2 : outil non classé haut risque sur le parcours courant.';
    if (q.badge === 'DONNÉES PERSONNELLES' && !personal)
      skip = '1.3 : absence de données personnelles sur le parcours courant.';
    if (q.stage === 5 && [1, 3].includes(q.number) && value(1, 3) === 'd')
      skip = '1.3=d : utiliser les questions sensibles 5.2 et 5.4.';
    if (q.stage === 5 && [2, 4].includes(q.number) && value(1, 3) === 'c')
      skip = '1.3=c : utiliser les questions ordinaires 5.1 et 5.3.';
    if (q.stage === 5 && q.number === 5 && value(5, 3) !== 'd')
      skip =
        '5.5 : aucun renvoi courant depuis 5.3=d ; renvoi sensible traité séparément comme ambiguïté.';
    if (q.stage === 3 && q.number === 6 && value(3, 4) === 'a')
      skip = '3.4=a : ne pas poser 3.6 à 3.9.';
    if (
      q.stage === 3 &&
      q.number >= 7 &&
      q.number <= 9 &&
      (value(3, 4) === 'a' || value(3, 6) === 'b')
    )
      skip = 'Procédure de gré à gré : questions d’appel d’offres omises.';
    if (skip) {
      row.state = 'skipped';
      row.reason = skip;
      continue;
    }
    // Do not fabricate the intermediary fact omitted by an earlier explicit jump.
    if (q.stage === 7 && q.number === 7 && !value(3, 3)) return issue('A02');
    if (q.stage === 8 && q.number === 4 && !terminalRed) {
      // Authority, deployment and condition-release semantics have deliberately not been resolved.
      if (!answers[q.id]) {
        row.state = 'unanswered';
        result.nextQuestion = q.id;
        return result;
      }
    }
    let letter = answers[q.id];
    if (q.stage === 8 && q.number <= 3) {
      row.computed = true;
      if (q.number === 1) {
        letter = terminalRed ? 'a' : 'b';
        if (!terminalRed) {
          const basis = verificationBasis(reached, context.notes ?? {}, context.supplierEvidence);
          const add = (
            id: string,
            questionId: string,
            label: string,
            kind: 'assessment' | 'opinion',
          ) => {
            const record = context.verifications?.[id];
            const complete =
              record?.confirmed &&
              record.reference.trim() &&
              record.reviewer.trim() &&
              /^\d{4}-\d{2}-\d{2}$/.test(record.date);
            result.verificationChecks.push({
              id,
              questionId,
              label,
              kind,
              basis,
              status: complete ? (record.basis === basis ? 'confirmed' : 'stale') : 'pending',
            });
          };
          if (value(1, 7) === 'a')
            add('aipd', v32Id(1, 7), 'AIPD réalisée et validée par le DPO', 'assessment');
          if (value(1, 7) === 'b')
            add(
              'aipd-exemption',
              v32Id(1, 7),
              'Justification détaillée de l’absence d’AIPD vérifiée',
              'assessment',
            );
          if (value(2, 5))
            add(
              'fria',
              v32Id(2, 5),
              'Analyse des droits fondamentaux réalisée et validée',
              'assessment',
            );
          if (value(5, 4) === 'c')
            add(
              'transfer-impact',
              v32Id(5, 4),
              'Analyse d’impact du transfert réalisée et validée',
              'assessment',
            );
          for (const request of result.opinionRequests)
            if (request.questionId !== v32Id(1, 7))
              add(
                `opinion-${request.questionId}`,
                request.questionId,
                request.reason + ' — écrit reçu et vérifié',
                'opinion',
              );
        }
      } else {
        const checks = result.verificationChecks.filter(
          (c) => c.kind === (q.number === 2 ? 'assessment' : 'opinion'),
        );
        const required = checks.filter((c) => c.id !== 'aipd-exemption');
        letter = checks.some((c) => c.status !== 'confirmed') ? 'c' : required.length ? 'a' : 'b';
      }
    }
    if (!letter) {
      row.state = 'unanswered';
      result.nextQuestion = q.id;
      return result;
    }
    // Guard structurally inconsistent answer variants without choosing a new legal policy.
    if (
      q.stage === 4 &&
      q.number === 6 &&
      ((letter === 'c' && !highRisk) || (letter === 'd' && highRisk))
    ) {
      row.state = 'unanswered';
      issue('A09');
      result.nextQuestion = q.id;
      return result;
    }
    if (
      q.stage === 5 &&
      q.number === 17 &&
      ((letter === 'b' && !highRisk) || (letter === 'c' && highRisk))
    ) {
      row.state = 'unanswered';
      issue('A09');
      result.nextQuestion = q.id;
      return result;
    }
    if (
      q.stage === 6 &&
      q.number === 20 &&
      ((letter === 'b' && value(2, 15) !== 'a') || (letter === 'c' && value(2, 15) !== 'b'))
    ) {
      row.state = 'unanswered';
      issue('A09');
      result.nextQuestion = q.id;
      return result;
    }
    const answer = q.answers.find((a) => a.letter === letter)!;
    const sourceVerdict = answer.sourceVerdict as Verdict;
    const convert =
      sourceVerdict === 'NE PAS POURSUIVRE' &&
      value(0, 1) === 'b' &&
      (q.badge === 'AI ACT' ||
        q.badge === 'HAUT RISQUE' ||
        (q.id === v32Id(4, 6) && letter === 'c') ||
        (q.id === v32Id(5, 17) && letter === 'b'));
    // Explicit questionnaire policy override requested by UNIL. Preserve the PDF verdict.
    const declaredDpfSatisfied = q.id === v32DpfPolicy.questionId && letter === v32DpfPolicy.letter;
    const effectiveVerdict: Verdict = declaredDpfSatisfied
      ? 'POURSUIVRE'
      : convert
        ? 'SOUS CONDITION'
        : sourceVerdict;
    Object.assign(row, { state: 'answered', letter, sourceVerdict, effectiveVerdict });
    reached[q.id] = letter;
    if (
      ['SOUS CONDITION', 'NE PAS POURSUIVRE'].includes(effectiveVerdict) ||
      (q.id === v32Id(6, 22) && letter === 'b')
    )
      result.summary.push({
        questionId: q.id,
        letter,
        sourceVerdict,
        effectiveVerdict,
        sourceAnswer: answer.sourceText,
        sourceNotes: q.notesText,
      });
    // Only explicit, answer-specific requests are triggered; no broad text matching.
    const opinion =
      q.id === v32Id(0, 1) && letter === 'c'
        ? 'Avis du service juridique sur le champ AI Act.'
        : q.id === v32Id(1, 7) && letter === 'a'
          ? 'Validation AIPD par le DPO.'
          : q.id === v32Id(1, 9) && letter === 'b'
            ? 'Avis du DPO sur la sous-traitance.'
            : q.id === v32Id(2, 3) && letter === 'b'
              ? 'Avis juridique écrit sur le rôle fournisseur de l’UNIL.'
              : q.id === v32Id(2, 10) && letter === 'c'
                ? 'Avis juridique sur l’enregistrement UE.'
                : q.id === v32Id(3, 1) && letter === 'c'
                  ? 'Consultation juridique sur la contrepartie en données.'
                  : q.id === v32Id(4, 5) && letter === 'c'
                    ? 'Vérification des mesures par le service informatique.'
                    : q.id === v32Id(5, 2) && letter === 'c'
                      ? 'Avis du DPO sur le pays concerné.'
                      : q.id === v32Id(5, 4) && letter === 'c'
                        ? 'Avis favorable du DPO et analyse d’impact.'
                        : null;
    if (opinion) result.opinionRequests.push({ questionId: q.id, reason: opinion });
    if (q.id === v32Id(8, 1)) {
      if (letter === 'a') {
        i = jump(v32Id(8, 4), i, '8.1=a : enregistrer No-go.');
        continue;
      }
    }
    if (q.id === v32Id(8, 4)) {
      if (terminalRed && letter !== 'c') return issue('A14');
      result.proposedDecision = letter === 'a' ? 'go' : letter === 'b' ? 'conditional-go' : 'no-go';
      if (letter === 'c') {
        result.status = 'no-go-proposed';
        omit(9, 1, 5, 'Outil refusé : pas de parcours d’exploitation.');
        return result;
      }
      result.status = 'decision-proposed';
      return issue(letter === 'b' ? 'A11' : 'A18');
    }
    if (effectiveVerdict === 'NE PAS POURSUIVRE') {
      terminalRed = true;
      i = jump(v32Id(8, 1), i, 'Réponse rouge effective : arrêt et synthèse.');
      continue;
    }
    if (q.id === v32Id(2, 3) && letter === 'b') return issue('A06', 'suspended');
    if (q.id === v32Id(8, 2) && letter === 'c') {
      result.status = 'suspended';
      result.nextQuestion = q.id;
      return result;
    }
    if (q.id === v32Id(8, 3) && letter === 'c') {
      result.status = 'suspended';
      result.nextQuestion = q.id;
      return result;
    }
    if (q.id === v32Id(5, 2) && letter === 'f') return issue('A01');
    if ((q.id === v32Id(3, 1) && letter === 'b') || (q.id === v32Id(3, 2) && letter === 'b')) {
      i = jump(v32Id(5, 1), i, 'Saut explicite vers l’étape 5 ; éligibilité omise.');
      continue;
    }
  }
  return result;
}

export const v32OpenIssues = routing.issues;

/** Separate follow-up entry: caller must supply the recorded lifecycle facts.
 * This does not release deployment or resolve the final-decision ambiguities.
 */
export function evaluateV32Followup(
  answers: V32Answers,
  context: { contractSigned: boolean; publicProcurement: boolean | null },
): {
  status: string;
  nextQuestion: string | null;
  questions: Row[];
  summary: { questionId: string; sourceAnswer: string; sourceNotes: string }[];
  pendingIssues: string[];
  deploymentAuthorised: false;
} {
  const questions = catalogue.questions.filter((q) => q.stage === 9);
  for (const [key, letter] of Object.entries(answers)) {
    if (!questions.some((q) => q.id === key && q.answers.some((a) => a.letter === letter)))
      throw new Error(`Réponse de suivi hors catalogue : ${key}/${letter}`);
  }
  const rows: Row[] = questions.map((q) => ({ id: q.id, state: 'not-reached' }));
  const summary: { questionId: string; sourceAnswer: string; sourceNotes: string }[] = [];
  if (!context.contractSigned)
    return {
      status: 'awaiting-signature',
      nextQuestion: null,
      questions: rows,
      summary,
      pendingIssues: [],
      deploymentAuthorised: false,
    };
  for (const [index, q] of questions.entries()) {
    if (q.number === 1 && context.publicProcurement === null)
      return {
        status: 'pending-clarification',
        nextQuestion: null,
        questions: rows,
        summary,
        pendingIssues: ['A13'],
        deploymentAuthorised: false,
      };
    if (q.number === 1 && !context.publicProcurement) {
      rows[index].state = 'skipped';
      rows[index].reason = '9.1 : seulement pour un marché public.';
      continue;
    }
    const letter = answers[q.id];
    if (!letter) {
      rows[index].state = 'unanswered';
      return {
        status: 'question',
        nextQuestion: q.id,
        questions: rows,
        summary,
        pendingIssues: [],
        deploymentAuthorised: false,
      };
    }
    const answer = q.answers.find((a) => a.letter === letter)!;
    Object.assign(rows[index], {
      state: 'answered',
      letter,
      sourceVerdict: answer.sourceVerdict,
      effectiveVerdict: answer.sourceVerdict,
    });
    if (answer.sourceVerdict === 'SOUS CONDITION')
      summary.push({ questionId: q.id, sourceAnswer: answer.sourceText, sourceNotes: q.notesText });
  }
  return {
    status: 'followup-recorded-input',
    nextQuestion: null,
    questions: rows,
    summary,
    pendingIssues: summary.some((s) => s.questionId === v32Id(9, 4)) ? ['A08'] : [],
    deploymentAuthorised: false,
  };
}
