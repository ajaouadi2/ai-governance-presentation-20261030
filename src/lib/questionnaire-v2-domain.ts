/** V2 answers are isolated from the production v1 Answers/Question types. */
export type V2Actor = 'unil' | 'supplier' | 'reviewer';

export type V2Option = { value: string; label: string; sourceParagraph?: number };
type FieldBase = {
  id: string;
  questionId: string;
  label: string;
  actor: V2Actor;
  required: boolean;
  allowUnknown: true;
  unknownLabel: string;
  help?: string;
};
export type V2Field = FieldBase &
  (
    | { type: 'single'; options: V2Option[] }
    | { type: 'multi'; options: V2Option[] }
    | { type: 'text'; maxLength: number }
    | { type: 'textarea'; maxLength: number }
    | { type: 'number'; min: number; max?: number; unit?: string }
    | { type: 'date' }
  );

/** Missing key = unanswered. Explicit unknown is neither a known value nor an exemption. */
export type V2Answer = { state: 'unknown' } | { state: 'known'; value: string | string[] | number };
export type V2Answers = Record<string, V2Answer>;

export type V2QuestionSchema = {
  questionId: string;
  prompt: string;
  fields: V2Field[];
  helpParagraphs: string[];
  legalBasisParagraphs: string[];
  sourceInstructions: string[];
  pendingTeamReview: boolean;
};
