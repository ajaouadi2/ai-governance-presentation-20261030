// Application policy changes are separate from the immutable imported PDF.
export const v32DpfPolicy = {
  questionId: 'V32-S05-Q02',
  letter: 'd',
  date: '2026-10-30',
  fr: 'Depuis le 30 octobre 2026, la certification DPF déclarée satisfait ce contrôle dans l’application. Les autres contrôles restent indépendants. Le verdict du PDF original reste conservé dans les archives.',
  en: 'Since 30 October 2026, declared DPF certification satisfies this application check. Other checks remain independent. The original PDF verdict is preserved in the archives.',
};

export function v32CaseIssues(issues: string[], decisionConfirmed: boolean) {
  return issues.filter((code) => !decisionConfirmed || !['A11', 'A18'].includes(code));
}
