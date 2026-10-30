export type Role = 'requester' | 'supplier' | 'evaluator';
export const roleLabels: Record<Role, string> = {
  requester: 'Demandeur',
  supplier: 'Fournisseur',
  evaluator: 'Évaluateur',
};
export type AnswerValue = string | number | string[];
export type Answers = Record<string, AnswerValue>;
export type Module = 'triage' | 'data' | 'security' | 'contract';
export const moduleLabels: Record<Module, string> = {
  triage: 'Cartographie juridique',
  data: 'Protection des données',
  security: 'Sécurité et gouvernance',
  contract: 'Marchés publics et contrats',
};
export type Condition = { id: string; values: string[] };
export type Question = {
  id: string;
  label: string;
  type: 'text' | 'textarea' | 'select' | 'multi' | 'number';
  section: string;
  audience: 'internal' | 'vendor';
  module: Module;
  options?: string[];
  required?: boolean;
  help?: string;
  when?: Condition;
  source?: string;
  owner?: string;
  sourceIds?: string[];
  source_text_exact?: string[];
  source_options_exact?: string[][];
  obligation_type?: string;
  dedupe_group?: string;
};
export type Source = {
  id: string;
  title: string;
  articles: string;
  url: string;
  jurisdiction: string;
  status: string;
  verifiedAt: string | null;
  note: string;
};
export type Control = {
  id: string;
  module: Module;
  title: string;
  description: string;
  questionIds: string[];
  evidence: string;
  source: string;
  nature: string;
  mandatory: boolean;
  when?: Condition;
};
export const reviewStatuses = [
  'satisfied',
  'not_applicable',
  'missing',
  'clarify',
  'human_review',
  'correction',
  'noncompliant',
  'conditional',
] as const;
export type ReviewStatus = (typeof reviewStatuses)[number];
export const statusLabels: Record<ReviewStatus, string> = {
  satisfied: 'Satisfait',
  not_applicable: 'Non applicable',
  missing: 'Information manquante',
  clarify: 'À clarifier',
  human_review: 'Examen humain requis',
  correction: 'À corriger',
  noncompliant: 'Blocage confirmé',
  conditional: 'Satisfait sous conditions',
};
export type EvidenceView = {
  id: string;
  controlId: string;
  originalName: string;
  mime: string;
  size: number;
  uploadedBy: string;
  createdAt: string;
};
export type ReviewView = {
  controlId: string;
  status: ReviewStatus;
  justification: string;
  condition: string;
  reviewer: string;
  fingerprint: string;
  reviewedAt: string;
  blockingType?: string;
  legalConclusions?: Record<string, string>;
};
export type ScoreView = {
  criterionId: string;
  weight: number;
  value: number;
  justification: string;
};
export type CaseView = {
  id: string;
  title: string;
  department: string;
  owner: string;
  purpose: string;
  description: string;
  assessmentDate: string;
  deploymentDate: string;
  revision: number;
  configVersion: string;
  internalSubmitted: boolean;
  vendorSubmitted: boolean;
  createdAt: string;
  updatedAt: string;
  vendor: { name: string; product: string } | null;
  answers: Answers;
  evidence: EvidenceView[];
  reviews: ReviewView[];
  scores: ScoreView[];
  reports: { id: string; version: number; createdAt: string }[];
  events: { id: string; actor: string; action: string; detail: unknown; createdAt: string }[];
};
export type Risk = {
  dimension: string;
  level: 'Faible' | 'Modéré' | 'Élevé' | 'Indéterminé';
  explanation: string;
};
export type Finding = {
  id: string;
  title: string;
  module: Module;
  explanation: string;
  trigger: string;
  action: string;
  source: string;
  critical?: boolean;
};
export type AssessedControl = Control & {
  status: ReviewStatus;
  stale: boolean;
  review?: ReviewView;
  evidenceCount: number;
};
export type Assessment = {
  protectionTasks?: import('./data-protection').ProtectionTask[];
  scopeProposals?: import('./legal-scope').ScopeProposal[];
  // Optional for immutable reports generated before the objective engine existed.
  ruleResults?: import('./objective-rules').RuleResult[];
  risks: Risk[];
  overallRisk: Risk['level'];
  legalClassification: string;
  laws: { regime: string; actor: string; status: string; reason: string; source: string }[];
  findings: Finding[];
  controls: AssessedControl[];
  outcome: string;
  scoringEligible: boolean;
  completed: number;
  total: number;
  score: number | null;
  conditions: string[];
  blockingReasons: string[];
  remediations: string[];
  configStale: boolean;
};
export type ReportSnapshot = {
  case: CaseView;
  assessment: Assessment;
  sources: Source[];
  questions: Question[];
  scoringDefinitions: { id: string; label: string; weight: number }[];
  disclaimer: string;
  configVersion: string;
  ruleSummary: string;
  generatedBy: string;
  generatedAt: string;
};
