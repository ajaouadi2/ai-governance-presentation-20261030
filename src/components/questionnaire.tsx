'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Save } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Field, FieldGroup, FieldLabel, FieldDescription, FieldSet, FieldLegend } from './ui/field';
import { Progress } from './ui/progress';
import { Notice } from './shared';
import { api } from '@/lib/client';
import { answered, visibleQuestions } from '@/lib/engine';
import { questions } from '@/config/assessment';
import type { Answers, AnswerValue, Assessment, CaseView, Question } from '@/lib/domain';
export type CasePayload = {
  case: CaseView;
  assessment: Assessment | null;
  vendorQuestionIds: string[];
  vendorControlIds: string[];
};
const order = [
  'Applicabilité juridique',
  'Le besoin',
  'Personnes et décisions',
  'Données et confidentialité',
  'Territoires et supervision',
  'Acquisition',
  'Caractérisation complémentaire',
  'Plan de protection des données',
  'Protection interne des données',
  'Produit et fournisseur',
  'Qualification et gouvernance',
  'Gouvernance et chaîne de fourniture',
  'Protection des données',
  'Sécurité et supervision',
  'Contrat et coût',
];
export function Questionnaire({
  c,
  audience,
  readOnly,
  onSaved,
  vendorQuestionIds,
  registerFlush,
}: {
  c: CaseView;
  audience: 'internal' | 'vendor';
  readOnly: boolean;
  onSaved: (p: CasePayload) => void;
  vendorQuestionIds: string[];
  registerFlush: (fn: (() => Promise<boolean>) | null) => void;
}) {
  const [values, setValues] = useState<Answers>(c.answers);
  const [savedSignature, setSavedSignature] = useState(JSON.stringify(c.answers));
  const [sectionIndex, setSectionIndex] = useState(0);
  const [saveState, setSaveState] = useState('Enregistré');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const current = useRef(values);
  const revision = useRef(c.revision);
  const saved = useRef(JSON.stringify(c.answers));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queue = useRef<Promise<boolean>>(Promise.resolve(true));
  const mounted = useRef(true);
  useEffect(() => {
    revision.current = Math.max(revision.current, c.revision);
  }, [c.revision]);
  const all =
    audience === 'vendor'
      ? questions.filter(
          (q) =>
            (vendorQuestionIds.includes(q.id) &&
              visibleQuestions('vendor', { ...c.answers, ...values }).some((x) => x.id === q.id)) ||
            (vendorQuestionIds.includes(q.id) && q.when?.id.startsWith('@')),
        )
      : visibleQuestions('internal', values);
  // A supplier receives only the question IDs activated by the server; local dependencies can hide a field, never reveal internal answers.
  const sections = [...new Set(all.map((q) => q.section))].sort(
    (a, b) => order.indexOf(a) - order.indexOf(b),
  );
  const section = sections[Math.min(sectionIndex, sections.length - 1)];
  const filled = all.filter((q) => answered(values[q.id])).length;
  const changed = JSON.stringify(values) !== savedSignature;
  const performSave = useCallback(
    async (submit = false): Promise<boolean> => {
      if (readOnly) return true;
      if (timer.current) clearTimeout(timer.current);
      const run = async () => {
        const snapshot = { ...current.current };
        if (!submit && JSON.stringify(snapshot) === saved.current) return true;
        if (mounted.current) {
          setBusy(true);
          setSaveState('Enregistrement…');
          setError('');
        }
        try {
          const answers = Object.fromEntries(
            Object.entries(snapshot).filter(([id]) =>
              questions.some((q) => q.id === id && q.audience === audience),
            ),
          );
          const result = await api<CasePayload>(`/api/cases/${c.id}/answers`, {
            method: 'PUT',
            body: JSON.stringify({ audience, answers, submit, revision: revision.current }),
          });
          revision.current = result.case.revision;
          saved.current = JSON.stringify(snapshot);
          if (mounted.current) {
            setSavedSignature(saved.current);
            onSaved(result);
            setSaveState(submit ? 'Questionnaire soumis' : 'Enregistré');
          }
          return true;
        } catch (e) {
          if (mounted.current) {
            setError((e as Error).message);
            setSaveState('Non enregistré');
          }
          return false;
        } finally {
          if (mounted.current) setBusy(false);
        }
      };
      queue.current = queue.current.then(run, run);
      return queue.current;
    },
    [readOnly, c.id, audience, onSaved],
  );
  const saveRef = useRef(performSave);
  useEffect(() => {
    saveRef.current = performSave;
  }, [performSave]);
  useEffect(() => {
    mounted.current = true;
    registerFlush(() => saveRef.current());
    const before = (event: BeforeUnloadEvent) => {
      if (JSON.stringify(current.current) !== saved.current) {
        event.preventDefault();
      }
    };
    window.addEventListener('beforeunload', before);
    return () => {
      mounted.current = false;
      if (timer.current) clearTimeout(timer.current);
      registerFlush(null);
      window.removeEventListener('beforeunload', before);
    };
  }, [registerFlush]);
  function change(id: string, value: AnswerValue) {
    const next = { ...current.current, [id]: value };
    current.current = next;
    setValues(next);
    setSaveState('Modifications en cours');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void saveRef.current(), 850);
  }
  async function move(next: number) {
    if (await performSave()) setSectionIndex(next);
  }
  return (
    <div className="flex flex-col gap-5">
      {readOnly ? (
        <Notice title="Consultation du questionnaire">
          Choisissez le rôle {audience === 'internal' ? 'demandeur' : 'fournisseur'} ou évaluateur
          pour modifier ces réponses.
        </Notice>
      ) : null}
      {error ? (
        <Notice title="Action à reprendre" error>
          {error}
        </Notice>
      ) : null}
      <div className="panel p-6 md:p-8">
        <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2>
              {audience === 'internal' ? 'Questionnaire interne' : 'Questionnaire fournisseur'}
            </h2>
            <p className="mt-2 text-muted-foreground">
              {filled} / {all.length} réponses renseignées · {sections.length} rubriques
            </p>
          </div>
          <span
            aria-live="polite"
            className="flex items-center gap-2 text-xs text-muted-foreground"
          >
            <Save size={14} />
            {saveState}
          </span>
        </div>
        <Progress value={all.length ? (filled / all.length) * 100 : 0} />
        <nav aria-label="Rubriques du questionnaire" className="my-7 flex flex-wrap gap-2">
          {sections.map((s, i) => (
            <Button
              type="button"
              key={s}
              variant={s === section ? 'secondary' : 'ghost'}
              size="sm"
              disabled={busy}
              onClick={() => move(i)}
            >
              {i + 1}. {s}
            </Button>
          ))}
        </nav>
        <h3 className="mb-7 border-b border-border pb-4">{section}</h3>
        <FieldGroup>
          {all
            .filter((q) => q.section === section)
            .map((q) => (
              <QuestionField
                key={q.id}
                q={q}
                value={values[q.id]}
                disabled={readOnly}
                onChange={(v) => change(q.id, v)}
              />
            ))}
        </FieldGroup>
        <div className="mt-9 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-6">
          <Button
            type="button"
            variant="outline"
            disabled={!sectionIndex || busy}
            onClick={() => move(sectionIndex - 1)}
          >
            <ArrowLeft data-icon="inline-start" />
            Précédent
          </Button>
          <div className="flex flex-wrap gap-2">
            {!readOnly ? (
              <Button
                type="button"
                variant="outline"
                disabled={busy || !changed}
                onClick={() => performSave()}
              >
                Enregistrer
              </Button>
            ) : null}
            {sectionIndex < sections.length - 1 ? (
              <Button type="button" disabled={busy} onClick={() => move(sectionIndex + 1)}>
                Suivant
                <ArrowRight data-icon="inline-end" />
              </Button>
            ) : !readOnly ? (
              <Button type="button" disabled={busy} onClick={() => performSave(true)}>
                <Check data-icon="inline-start" />
                Soumettre le questionnaire
              </Button>
            ) : null}
          </div>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Les réponses sont enregistrées automatiquement. « Inconnu » reste une information à
        clarifier. Une soumission vérifie toutes les rubriques.
      </p>
    </div>
  );
}
function QuestionField({
  q,
  value,
  disabled,
  onChange,
}: {
  q: Question;
  value: AnswerValue | undefined;
  disabled: boolean;
  onChange: (v: AnswerValue) => void;
}) {
  const label = (
    <>
      <span className="mr-2 text-xs font-normal text-muted-foreground">{q.id}</span> {q.label}
      {q.required ? ' *' : ''}
    </>
  );
  if (q.type === 'multi')
    return (
      <FieldSet disabled={disabled}>
        <FieldLegend>{label}</FieldLegend>
        <div className="flex flex-wrap gap-4">
          {q.options?.map((option) => (
            <label key={option} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={Array.isArray(value) && value.includes(option)}
                onChange={(e) =>
                  onChange(
                    e.target.checked
                      ? [...(Array.isArray(value) ? value : []), option]
                      : (Array.isArray(value) ? value : []).filter((x) => x !== option),
                  )
                }
              />
              {option}
            </label>
          ))}
        </div>
        {q.help ? <FieldDescription>{q.help}</FieldDescription> : null}
      </FieldSet>
    );
  return (
    <Field>
      <FieldLabel htmlFor={q.id}>{label}</FieldLabel>
      {q.type === 'select' ? (
        <select
          id={q.id}
          className="native-select"
          value={String(value ?? '')}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">Choisir une réponse</option>
          {q.options?.map((option) => (
            <option key={option}>{option}</option>
          ))}
        </select>
      ) : q.type === 'textarea' ? (
        <Textarea
          id={q.id}
          value={String(value ?? '')}
          disabled={disabled}
          maxLength={12000}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <Input
          id={q.id}
          type={q.type === 'number' ? 'number' : 'text'}
          min={q.type === 'number' ? 0 : undefined}
          step={q.type === 'number' ? 'any' : undefined}
          value={typeof value === 'number' || typeof value === 'string' ? value : ''}
          disabled={disabled}
          maxLength={12000}
          onChange={(e) => {
            if (q.type === 'number' && e.target.value === '') return onChange('');
            onChange(q.type === 'number' ? Number(e.target.value) : e.target.value);
          }}
        />
      )}
      {q.help ? <FieldDescription>{q.help}</FieldDescription> : null}
    </Field>
  );
}
