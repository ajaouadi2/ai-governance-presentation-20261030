'use client';
import { Localized } from '@/components/language';
import { useLanguage } from '@/components/language';
import { translate } from '@/lib/i18n';
import type { Locale } from '@/lib/i18n';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import catalog from '@/config/questionnaire-v2/catalog.json';
import { checkpointLabels, scopeDefinitions } from '@/config/questionnaire-v2/workflow';
import type { V2Actor, V2Answer, V2Field } from '@/lib/questionnaire-v2-domain';
import type { V2DraftSummary, V2DraftView } from '@/lib/questionnaire-v2-view';
import { useDraftGuard } from '@/components/draft-guard';
import { V2ReviewEditor } from './review-editor';
import { V2EvidencePanel } from './evidence';
import { V2Comparison } from './comparison';
import { V2Reports } from './reports';
import type { V2ReportSummary } from '@/lib/questionnaire-v2-report';
import { ArrowRight, FolderOpen, Plus, CheckCircle2, Clock3, ShieldAlert } from 'lucide-react';

const actors: Record<V2Actor, string> = {
  unil: 'UNIL',
  supplier: 'Fournisseur',
  reviewer: 'Évaluateur',
};
const date = (text: string) =>
  new Intl.DateTimeFormat('fr-CH', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'Europe/Paris',
  }).format(new Date(text));
async function request<T>(url: string, body?: unknown): Promise<T> {
  const response = await fetch(`/api/questionnaire-v2${url}`, {
    method: body === undefined ? 'GET' : 'POST',
    cache: 'no-store',
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? 'Opération impossible.');
  return data as T;
}
function answerLabel(field: V2Field, answer: V2Answer | undefined, locale: Locale = 'fr') {
  if (!answer) return 'Non renseigné';
  if (answer.state === 'unknown') return 'Je ne sais pas / À vérifier';
  const choices = field.type === 'single' || field.type === 'multi' ? field.options : [];
  const values = Array.isArray(answer.value) ? answer.value : [answer.value];
  return values
    .map((value) =>
      translate(choices.find((option) => option.value === value)?.label ?? String(value), locale),
    )
    .join(', ');
}
function AnswerField({
  field,
  answer,
  required,
  editable,
  busy,
  change,
}: {
  field: V2Field;
  answer?: V2Answer;
  required: boolean;
  editable: boolean;
  busy: boolean;
  change: (id: string, value: V2Answer | null) => void;
}) {
  const id = `v2-${field.id}`;
  const { locale } = useLanguage();
  const current = answer?.state === 'known' ? answer.value : undefined;
  const unknown = answer?.state === 'unknown';
  const set = (value: string | string[] | number) => change(field.id, { state: 'known', value });
  return (
    <Localized>
      {
        <div className="v2-field" data-field={field.id}>
          <label className="v2-field-label" htmlFor={id}>
            {field.label}
            {required && (!answer || unknown) && (
              <span className="v2-required">{unknown ? 'À vérifier' : 'À renseigner'}</span>
            )}
          </label>
          {!editable ? (
            <p
              className="v2-readonly"
              translate={
                answer?.state === 'known' && field.type !== 'single' && field.type !== 'multi'
                  ? 'no'
                  : 'yes'
              }
            >
              {answerLabel(field, answer, locale)}
            </p>
          ) : (
            <>
              {field.type === 'single' ? (
                <select
                  id={id}
                  disabled={busy}
                  value={unknown ? '__unknown' : typeof current === 'string' ? current : ''}
                  onChange={(e) =>
                    e.target.value === '__unknown'
                      ? change(field.id, { state: 'unknown' })
                      : e.target.value
                        ? set(e.target.value)
                        : change(field.id, null)
                  }
                >
                  <option value="">Choisir une réponse</option>
                  {field.options.map((option) => (
                    <option value={option.value} key={option.value}>
                      {option.label}
                    </option>
                  ))}
                  <option value="__unknown">{field.unknownLabel}</option>
                </select>
              ) : field.type === 'multi' ? (
                <fieldset id={id} className="v2-options" aria-label={field.label}>
                  {field.options.map((option) => (
                    <label key={option.value}>
                      <input
                        type="checkbox"
                        disabled={busy}
                        checked={Array.isArray(current) && current.includes(option.value)}
                        onChange={(e) => {
                          const values = Array.isArray(current) ? current : [];
                          const next = e.target.checked
                            ? [...values, option.value]
                            : values.filter((v) => v !== option.value);
                          if (next.length) set(next);
                          else change(field.id, null);
                        }}
                      />
                      {option.label}
                    </label>
                  ))}
                </fieldset>
              ) : field.type === 'text' || field.type === 'textarea' ? (
                <textarea
                  id={id}
                  value={typeof current === 'string' ? current : ''}
                  disabled={busy || unknown}
                  maxLength={field.maxLength}
                  onChange={(e) =>
                    e.target.value.trim() ? set(e.target.value) : change(field.id, null)
                  }
                />
              ) : (
                <input
                  id={id}
                  type={field.type === 'date' ? 'date' : 'number'}
                  value={typeof current === 'number' || typeof current === 'string' ? current : ''}
                  disabled={busy || unknown}
                  {...(field.type === 'number'
                    ? { min: field.min, max: field.max, step: 'any' }
                    : {})}
                  onChange={(e) =>
                    e.target.value
                      ? set(field.type === 'number' ? e.target.valueAsNumber : e.target.value)
                      : change(field.id, null)
                  }
                />
              )}
              {field.type !== 'single' && (
                <label className="v2-unknown">
                  <input
                    type="checkbox"
                    disabled={busy}
                    checked={unknown}
                    onChange={(e) =>
                      change(field.id, e.target.checked ? { state: 'unknown' } : null)
                    }
                  />
                  {field.unknownLabel}
                </label>
              )}
              {answer && (
                <button
                  type="button"
                  className="v2-text-button"
                  disabled={busy}
                  onClick={() => change(field.id, null)}
                >
                  Effacer cette réponse
                </button>
              )}
            </>
          )}
        </div>
      }
    </Localized>
  );
}
export function QuestionnaireV2Workspace({ draftId }: { draftId?: string }) {
  const router = useRouter();
  const guard = useDraftGuard();
  const [view, setView] = useState<V2DraftView | null>(null);
  const [list, setList] = useState<V2DraftSummary[]>([]);
  const [sessionActor, setSessionActor] = useState<V2Actor>('unil');
  const [boundDraftId, setBoundDraftId] = useState<string | null>(null);
  const [stage, setStage] = useState(1);
  const [overview, setOverview] = useState(false);
  const [panel, setPanel] = useState<'followup' | 'comparison' | 'reports'>('followup');
  const [allActions, setAllActions] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [saveState, setSaveState] = useState('');
  const [dirtyTick, setDirtyTick] = useState(0);
  const [title, setTitle] = useState('');
  const [context, setContext] = useState('');
  const [mode, setMode] = useState<'unil' | 'both'>('both');
  const current = useRef<V2DraftView | null>(null);
  const pending = useRef(new Map<string, V2Answer | null>());
  const queue = useRef<Promise<boolean>>(Promise.resolve(true));
  const editorDirty = useRef(new Set<string>());
  const readOnlyStates = useRef(new Map<string, HTMLDetailsElement>());
  const newProjectForm = useRef<HTMLDetailsElement>(null);
  const apply = useCallback((next: V2DraftView) => {
    const answers = { ...next.draft.answers };
    for (const [id, answer] of pending.current) {
      if (answer === null) delete answers[id];
      else answers[id] = answer;
    }
    const merged = { ...next, draft: { ...next.draft, answers } };
    current.current = merged;
    setView(merged);
    setSessionActor(next.actor);
  }, []);
  const saveAnswers = useCallback(() => {
    const task = queue.current.then(async () => {
      const snapshot = new Map(pending.current);
      const source = current.current;
      if (!source || !snapshot.size) return true;
      setSaveState('Enregistrement…');
      try {
        const answers = Object.fromEntries([...snapshot].filter(([, a]) => a !== null));
        const clear = [...snapshot].filter(([, a]) => a === null).map(([id]) => id);
        const next = await request<V2DraftView>(`/${source.draft.id}/answers`, {
          revision: source.draft.revision,
          answers,
          clear,
        });
        for (const [id, answer] of snapshot)
          if (pending.current.get(id) === answer) pending.current.delete(id);
        apply(next);
        setSaveState(pending.current.size ? 'Modifications à enregistrer' : 'Enregistré');
        setError('');
        return true;
      } catch (e) {
        setError((e as Error).message);
        setSaveState('Non enregistré');
        return false;
      }
    });
    queue.current = task;
    return task;
  }, [apply]);
  const flush = useCallback(async () => {
    if (editorDirty.current.size) {
      setError(
        'Joignez la pièce sélectionnée ou enregistrez l’examen / le contexte en cours avant de changer de page ou de rôle.',
      );
      return false;
    }
    do {
      if (!(await saveAnswers())) return false;
    } while (pending.current.size);
    return true;
  }, [saveAnswers]);
  useEffect(() => {
    guard.register(flush);
    return () => guard.register(null);
  }, [guard, flush]);
  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (pending.current.size || editorDirty.current.size) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, []);
  useEffect(() => {
    let active = true;
    pending.current.clear();
    editorDirty.current.clear();
    current.current = null;
    (async () => {
      try {
        const session = await request<{
          actor: V2Actor;
          boundDraftId: string | null;
          drafts: V2DraftSummary[];
        }>('');
        if (!active) return;
        setSessionActor(session.actor);
        setBoundDraftId(session.boundDraftId);
        setList(session.drafts);
        if (draftId) {
          const next = await request<V2DraftView>(`/${draftId}`);
          if (!active) return;
          apply(next);
          setTitle(next.draft.title);
          setContext(next.draft.sharedContext);
          setMode(next.draft.mode);
          setStage(next.actor === 'supplier' ? 5 : 1);
          setSaveState('Enregistré');
        } else setView(null);
        setError('');
      } catch (e) {
        if (active) setError((e as Error).message);
      } finally {
        if (active) setLoaded(true);
      }
    })();
    return () => {
      active = false;
    };
  }, [draftId, apply]);
  useEffect(() => {
    if (!dirtyTick) return;
    const timer = setTimeout(() => {
      void saveAnswers();
    }, 650);
    return () => clearTimeout(timer);
  }, [dirtyTick, saveAnswers]);
  function change(id: string, answer: V2Answer | null) {
    pending.current.set(id, answer);
    const source = current.current;
    if (source) {
      const answers = { ...source.draft.answers };
      if (answer === null) delete answers[id];
      else answers[id] = answer;
      const next = { ...source, draft: { ...source.draft, answers } };
      current.current = next;
      setView(next);
    }
    setSaveState('Modifications à enregistrer');
    setDirtyTick((tick) => tick + 1);
  }
  const onDirty = (id: string, dirty: boolean) => {
    if (dirty) editorDirty.current.add(id);
    else editorDirty.current.delete(id);
  };
  async function switchActor(actor: V2Actor, nextStage?: number) {
    setBusy(true);
    try {
      if (!(await flush())) return;
      await request('/session', { actor, ...(draftId ? { draftId } : {}) });
      if (draftId) {
        const next = await request<V2DraftView>(`/${draftId}`);
        apply(next);
        setStage(nextStage ?? (actor === 'supplier' ? 5 : stage));
        setOverview(false);
      } else {
        const session = await request<{
          actor: V2Actor;
          boundDraftId: string | null;
          drafts: V2DraftSummary[];
        }>('');
        setSessionActor(session.actor);
        setBoundDraftId(session.boundDraftId);
        setList(session.drafts);
      }
      setError('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function go(
    next: number,
    summary = false,
    nextPanel: 'followup' | 'comparison' | 'reports' = 'followup',
  ) {
    setBusy(true);
    try {
      if (await flush()) {
        setOverview(summary);
        setPanel(nextPanel);
        setStage(next);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } finally {
      setBusy(false);
    }
  }
  async function saveReview(kind: 'scope' | 'question', key: string, review: unknown) {
    setBusy(true);
    try {
      if (!(await saveAnswers())) return false;
      const source = current.current!;
      const next = await request<V2DraftView>(`/${source.draft.id}/reviews`, {
        revision: source.draft.revision,
        kind,
        key,
        review,
      });
      apply(next);
      setError('');
      setSaveState('Examen enregistré');
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function uploadEvidence(questionId: string, file: File, visibility: 'internal' | 'shared') {
    if ([...editorDirty.current].some((key) => key !== `evidence:${questionId}`)) {
      setError(
        'Enregistrez les autres examens, le contexte ou les pièces en cours avant cet ajout.',
      );
      return false;
    }
    setBusy(true);
    try {
      if (!(await saveAnswers())) return false;
      const source = current.current!;
      const data = new FormData();
      data.set('file', file);
      data.set('questionId', questionId);
      data.set('visibility', visibility);
      data.set('revision', String(source.draft.revision));
      const response = await fetch(`/api/questionnaire-v2/${source.draft.id}/evidence`, {
        method: 'POST',
        body: data,
      });
      const next = await response.json();
      if (!response.ok)
        throw new Error(
          next.error ?? 'Ajout impossible. Le fichier reste sélectionné pour réessayer.',
        );
      apply(next as V2DraftView);
      setSaveState('Pièce enregistrée');
      setError('');
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  const errorBox = error && (
    <div role="alert" className="v2-error">
      <p>{error}</p>
      {draftId && (
        <button
          type="button"
          onClick={() => {
            pending.current.clear();
            editorDirty.current.clear();
            window.location.reload();
          }}
        >
          Abandonner ma saisie non enregistrée et recharger
        </button>
      )}
    </div>
  );
  if (!loaded)
    return (
      <Localized>
        {
          <div className="v2-workspace">
            <p role="status">Ouverture des projets…</p>
          </div>
        }
      </Localized>
    );
  if (!draftId)
    return (
      <Localized>
        {
          <div className="v2-workspace">
            <div className="v2-dashboard-hero">
              <div>
                <div className="v2-eyebrow">ÉVALUATION & GOUVERNANCE DE L’IA</div>
                <h1>Vos projets</h1>
                <p className="v2-intro">
                  Décrivez votre projet, examinez le fournisseur et préparez la mise en service. Vos
                  réponses sont conservées au fil du parcours.
                </p>
              </div>
              <button
                className="v2-primary v2-new-project-button"
                onClick={() => {
                  if (newProjectForm.current) {
                    newProjectForm.current.open = true;
                    newProjectForm.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }
                }}
              >
                <Plus size={17} />
                Nouvelle évaluation
              </button>
            </div>
            {sessionActor !== 'supplier' && (
              <div className="v2-project-metrics">
                {[
                  { label: 'Projets en cours', value: list.length, icon: FolderOpen, tone: 'blue' },
                  {
                    label: 'Prêts pour décision',
                    value: list.filter((d) => d.status === 'ready').length,
                    icon: CheckCircle2,
                    tone: 'green',
                  },
                  {
                    label: 'À compléter',
                    value: list.filter((d) => d.status === 'needs_information').length,
                    icon: Clock3,
                    tone: 'amber',
                  },
                  {
                    label: 'À réexaminer',
                    value: list.filter((d) => d.status === 'blocked').length,
                    icon: ShieldAlert,
                    tone: 'red',
                  },
                ].map((metric) => (
                  <div className={`v2-metric ${metric.tone}`} key={metric.label}>
                    <span className="v2-metric-icon">
                      <metric.icon size={20} />
                    </span>
                    <div>
                      <strong>{metric.value}</strong>
                      <span>{metric.label}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {errorBox}
            <details className="v2-new-project" ref={newProjectForm}>
              <summary>Créer une nouvelle évaluation</summary>
              <div className="v2-entry-grid">
                <button
                  className={mode === 'unil' ? 'v2-entry selected' : 'v2-entry'}
                  disabled={busy}
                  onClick={() => {
                    setMode('unil');
                    void switchActor('unil');
                  }}
                >
                  <span>01</span>
                  <strong>Entité universitaire</strong>
                  <p>Renseigner le projet et préparer son évaluation.</p>
                </button>
                <button
                  className={mode === 'both' ? 'v2-entry selected' : 'v2-entry'}
                  disabled={busy}
                  onClick={() => {
                    setMode('both');
                    void switchActor('unil');
                  }}
                >
                  <span>02</span>
                  <strong>Compléter les deux questionnaires</strong>
                  <p>Parcourir UNIL, fournisseur, puis revenir à UNIL dans le même dossier.</p>
                </button>
                <button
                  className="v2-entry"
                  disabled={!boundDraftId || busy}
                  onClick={async () => {
                    if (!boundDraftId) return;
                    setBusy(true);
                    try {
                      await request('/session', { actor: 'supplier', draftId: boundDraftId });
                      router.push(`/projects/${boundDraftId}`);
                    } catch (e) {
                      setError((e as Error).message);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  <span>03</span>
                  <strong>Fournisseur</strong>
                  <p>
                    {boundDraftId
                      ? 'Reprendre le dossier lié et répondre aux questions fournisseur.'
                      : 'Ouvrez d’abord un dossier UNIL pour le lier au fournisseur.'}
                  </p>
                </button>
              </div>
              <section className="v2-create">
                <h2>Nouvelle évaluation</h2>
                <p>
                  Décrivez le besoin, puis invitez le rôle fournisseur à compléter ses réponses.
                </p>
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    setBusy(true);
                    try {
                      await request('/session', { actor: 'unil' });
                      const next = await request<V2DraftView>('', {
                        title,
                        sharedContext: context,
                        mode,
                      });
                      router.push(`/projects/${next.draft.id}`);
                    } catch (e) {
                      setError((e as Error).message);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  <label>
                    Titre du projet
                    <input
                      required
                      minLength={3}
                      maxLength={160}
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Ex. Traduction de documents publics"
                    />
                  </label>
                  <label>
                    Contexte à partager avec le fournisseur
                    <textarea
                      maxLength={4000}
                      value={context}
                      onChange={(e) => setContext(e.target.value)}
                      placeholder="Usage prévu et informations que vous choisissez de lui transmettre"
                    />
                  </label>
                  <button className="v2-primary" disabled={busy}>
                    Créer et commencer
                  </button>
                </form>
              </section>
            </details>
            <section className="v2-draft-list">
              <div className="v2-list-heading">
                <h2>Votre portefeuille de projets</h2>
                <span>
                  {list.length} {list.length > 1 ? 'projets' : 'projet'}
                </span>
              </div>
              {list.length ? (
                list.map((draft) => (
                  <div className="v2-project-row" key={draft.id}>
                    <Link href={`/projects/${draft.id}`}>
                      <span className="v2-project-category">
                        <FolderOpen size={14} />
                        Évaluation d’un outil d’IA
                      </span>
                      <strong translate="no">{draft.title}</strong>
                      {draft.status && (
                        <span className={`v2-project-status ${draft.status}`}>
                          {draft.status === 'ready'
                            ? 'Prêt pour une décision humaine'
                            : draft.status === 'blocked'
                              ? 'Usage à réexaminer'
                              : 'Informations à compléter'}
                        </span>
                      )}
                      <span className="v2-project-row-footer">
                        <span>Mis à jour le {date(draft.updatedAt)}</span>
                        <span className="v2-open-project">
                          Ouvrir le projet <ArrowRight size={15} />
                        </span>
                      </span>
                    </Link>
                    {sessionActor !== 'supplier' && (
                      <button
                        className="v2-text-button"
                        disabled={busy}
                        onClick={async () => {
                          setBusy(true);
                          try {
                            await request(`/${draft.id}/archive`, {
                              revision: draft.revision,
                              archived: true,
                            });
                            setList((rows) => rows.filter((row) => row.id !== draft.id));
                          } catch (e) {
                            setError(String(e));
                          } finally {
                            setBusy(false);
                          }
                        }}
                      >
                        Archiver
                      </button>
                    )}
                  </div>
                ))
              ) : (
                <p>
                  {sessionActor === 'supplier'
                    ? 'Aucun dossier lié au fournisseur.'
                    : 'Aucun projet pour le moment.'}
                </p>
              )}
            </section>
          </div>
        }
      </Localized>
    );
  if (!view)
    return (
      <Localized>
        {
          <div className="v2-workspace">
            {errorBox}
            <Link href="/projects">Revenir aux dossiers</Link>
          </div>
        }
      </Localized>
    );
  const fieldStates = new Map(view.fields.map((state) => [state.field.id, state]));
  const questions = view.questions.filter((q) => q.stage === stage);
  const ownFields = view.fields.filter(
    (item) => item.visible && item.field.actor === view.actor && item.required,
  );
  const answered = ownFields.filter(
    (item) => view.draft.answers[item.field.id] !== undefined,
  ).length;
  const availableActions = overview
    ? view.actions
    : view.actions.filter((action) => questions.some((q) => q.questionId === action.questionId));
  const ownActions = availableActions.filter((action) => action.owner === view.actor);
  const actionList = allActions ? availableActions : ownActions.slice(0, 5);
  return (
    <Localized>
      {
        <div className="v2-workspace">
          <Link className="v2-back" href="/projects">
            ← Tous les projets
          </Link>
          <header className="v2-project-header">
            <div>
              <div className="v2-eyebrow">Évaluation du projet</div>
              <h1 translate="no">{view.draft.title}</h1>
              <p>Chaque réponse est attribuée au rôle qui la renseigne.</p>
            </div>
            <div className="v2-project-tools">
              <label>
                Je complète en tant que
                <select
                  value={view.actor}
                  disabled={busy}
                  onChange={(e) => void switchActor(e.target.value as V2Actor)}
                >
                  {Object.entries(actors).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label} · simulé
                    </option>
                  ))}
                </select>
              </label>
              <span role="status" className="v2-save-status">
                {saveState}
              </span>
              <button className="v2-secondary" disabled={busy} onClick={() => void flush()}>
                Enregistrer
              </button>
            </div>
          </header>
          {errorBox}
          <div className="v2-layout">
            <aside className="v2-steps">
              <div className="v2-progress">
                <strong>
                  {answered} / {ownFields.length}
                </strong>
                <span>champs requis renseignés pour ce rôle</span>
                <progress value={answered} max={ownFields.length || 1} />
              </div>
              <nav aria-label="Étapes du questionnaire">
                {catalog.stages.map((item) => (
                  <button
                    key={item.id}
                    disabled={busy || (view.actor === 'supplier' && item.id !== 5)}
                    className={!overview && stage === item.id ? 'active' : ''}
                    aria-current={!overview && stage === item.id ? 'step' : undefined}
                    onClick={() => void go(item.id)}
                  >
                    <span>{String(item.id).padStart(2, '0')}</span>
                    <strong>{item.title}</strong>
                  </button>
                ))}
                <button
                  className={overview && panel === 'followup' ? 'active' : ''}
                  disabled={busy}
                  onClick={() => void go(stage, true)}
                >
                  <span>✓</span>
                  <strong>Suivi et examens</strong>
                </button>
                {view.actor !== 'supplier' &&
                  (['comparison', 'reports'] as const).map((section) => (
                    <button
                      key={section}
                      className={overview && panel === section ? 'active' : ''}
                      disabled={busy}
                      onClick={() => void go(stage, true, section)}
                    >
                      <span>{section === 'comparison' ? '↔' : '▤'}</span>
                      <strong>
                        {section === 'comparison' ? 'Comparaison des offres' : 'Rapports'}
                      </strong>
                    </button>
                  ))}
              </nav>
              <p className="v2-small">
                Une réponse « à vérifier » reste une action ouverte. Renseigner le questionnaire ne
                vaut pas accord de mise en service.
              </p>
            </aside>
            <div className="v2-main">
              {overview ? (
                <>
                  {view.actor !== 'supplier' && panel === 'reports' && (
                    <V2Reports
                      id={view.draft.id}
                      create={async () => {
                        if (!(await flush())) return null;
                        const saved = current.current;
                        if (!saved) return null;
                        return request<V2ReportSummary>(`/${saved.draft.id}/reports`, {
                          revision: saved.draft.revision,
                        });
                      }}
                    />
                  )}
                  {view.actor !== 'supplier' && panel === 'comparison' && (
                    <V2Comparison
                      id={view.draft.id}
                      reviewer={view.actor === 'reviewer'}
                      flush={flush}
                      prepare={async () => {
                        const own = editorDirty.current.delete('comparison');
                        try {
                          return await flush();
                        } finally {
                          if (own) editorDirty.current.add('comparison');
                        }
                      }}
                      reload={async () => apply(await request<V2DraftView>(`/${view.draft.id}`))}
                      dirty={(value) => {
                        if (value) editorDirty.current.add('comparison');
                        else editorDirty.current.delete('comparison');
                      }}
                    />
                  )}
                  {panel === 'followup' && (
                    <>
                      <div className="v2-section-heading">
                        <div className="v2-eyebrow">Suivi du dossier</div>
                        <h2>Ce qu’il reste à préparer</h2>
                      </div>
                      {view.checkpoints && (
                        <div className="v2-checkpoints">
                          {Object.entries(view.checkpoints).map(([key, checkpoint]) => (
                            <article key={key}>
                              <strong>
                                {checkpointLabels[key as keyof typeof checkpointLabels]}
                              </strong>
                              <span>
                                {checkpoint.status === 'actions_required'
                                  ? `${checkpoint.actionIds.length} actions à traiter`
                                  : 'Prêt pour une décision humaine'}
                              </span>
                            </article>
                          ))}
                        </div>
                      )}
                      <details className="v2-card">
                        <summary>Contexte partagé avec le fournisseur</summary>
                        <p
                          className="whitespace-pre-wrap"
                          translate={view.draft.sharedContext ? 'no' : 'yes'}
                        >
                          {view.draft.sharedContext || 'Aucun contexte partagé.'}
                        </p>
                        {view.actor !== 'supplier' && (
                          <form
                            onChange={() => onDirty('metadata', true)}
                            onSubmit={async (e) => {
                              e.preventDefault();
                              setBusy(true);
                              try {
                                if (!(await saveAnswers())) return;
                                const next = await request<V2DraftView>(`/${draftId}/metadata`, {
                                  revision: current.current!.draft.revision,
                                  metadata: { title, sharedContext: context, mode },
                                });
                                apply(next);
                                onDirty('metadata', false);
                                setError('');
                              } catch (e) {
                                setError((e as Error).message);
                              } finally {
                                setBusy(false);
                              }
                            }}
                          >
                            <label>
                              Titre
                              <input
                                required
                                minLength={3}
                                maxLength={160}
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                              />
                            </label>
                            <label>
                              Contexte à partager
                              <textarea
                                value={context}
                                maxLength={4000}
                                onChange={(e) => setContext(e.target.value)}
                              />
                            </label>
                            <button className="v2-primary" disabled={busy}>
                              Enregistrer le contexte
                            </button>
                          </form>
                        )}
                      </details>
                      {view.scopes && (
                        <section className="v2-card">
                          <h3>Parcours à confirmer</h3>
                          {Object.entries(scopeDefinitions).map(([id, definition]) => (
                            <details className="v2-scope" key={id}>
                              <summary>
                                {definition.label}
                                <span>
                                  {view.scopes![id as keyof typeof view.scopes] === 'unknown'
                                    ? 'À confirmer'
                                    : view.scopes![id as keyof typeof view.scopes] === 'true'
                                      ? 'Contrôles ouverts'
                                      : 'Non applicable, selon revue'}
                                </span>
                              </summary>
                              {view.actor === 'reviewer' ? (
                                <V2ReviewEditor
                                  kind="scope"
                                  id={id}
                                  existing={view.scopeReviews?.[id]}
                                  files={view.draft.evidence.filter((file) =>
                                    scopeDefinitions[
                                      id as keyof typeof scopeDefinitions
                                    ].dependencies.includes(file.questionId),
                                  )}
                                  busy={busy}
                                  onDirty={onDirty}
                                  onSave={saveReview}
                                />
                              ) : (
                                <p>
                                  À confirmer par l’évaluateur à partir des réponses et
                                  justificatifs.
                                </p>
                              )}
                            </details>
                          ))}
                        </section>
                      )}
                    </>
                  )}
                </>
              ) : (
                <>
                  <div className="v2-section-heading">
                    <div className="v2-eyebrow">Étape {stage} sur 6</div>
                    <h2>{catalog.stages.find((s) => s.id === stage)?.title}</h2>
                    <p>
                      {view.actor === 'reviewer'
                        ? 'Consultez les réponses, renseignez les champs d’évaluation et motivez vos examens.'
                        : stage === 5
                          ? 'Réponses du fournisseur, justificatifs et éléments du contrat.'
                          : 'Décrivez les faits. Les points à vérifier pourront être complétés ensuite.'}
                    </p>
                  </div>
                  {stage === 5 && view.actor !== 'supplier' && (
                    <div className="v2-transition">
                      <p>
                        Les déclarations de cette étape sont renseignées sous le rôle fournisseur.
                      </p>
                      <button
                        className="v2-secondary"
                        disabled={busy}
                        onClick={() => void switchActor('supplier', 5)}
                      >
                        Passer au fournisseur pour ce dossier
                      </button>
                    </div>
                  )}
                  {view.actor === 'supplier' && view.draft.sharedContext && (
                    <section className="v2-card">
                      <h3>Usage communiqué par l’UNIL</h3>
                      <p className="whitespace-pre-wrap" translate="no">
                        {view.draft.sharedContext}
                      </p>
                    </section>
                  )}
                  {!questions.length && (
                    <section className="v2-card">
                      <p>Aucune question active pour cette étape dans votre rôle.</p>
                    </section>
                  )}
                  {questions.map((question, index) => {
                    const visible = question.fields.filter(
                      (field) =>
                        fieldStates.get(field.id)?.visible &&
                        !['M17.score', 'M18.score', 'M19.score'].includes(field.id),
                    );
                    const main = visible.filter(
                      (field) =>
                        field.required ||
                        ['single', 'multi', 'number'].includes(field.type) ||
                        fieldStates.get(field.id)?.required,
                    );
                    const extra = visible.filter((field) => !main.includes(field));
                    const render = (field: V2Field) => (
                      <AnswerField
                        key={field.id}
                        field={field}
                        required={fieldStates.get(field.id)?.required ?? false}
                        answer={view.draft.answers[field.id]}
                        editable={field.actor === view.actor}
                        busy={busy}
                        change={change}
                      />
                    );
                    return (
                      <Localized key={question.questionId}>
                        {
                          <details
                            className="v2-question"
                            key={question.questionId}
                            open={index === 0 ? true : undefined}
                            ref={(element) => {
                              if (element) readOnlyStates.current.set(question.questionId, element);
                              else readOnlyStates.current.delete(question.questionId);
                            }}
                          >
                            <summary>
                              <span className="v2-question-id">{question.questionId}</span>
                              <span>{question.prompt}</span>
                              <span className="v2-expand">+</span>
                            </summary>
                            <div className="v2-question-body">
                              {main.map(render)}
                              <details className="v2-extra">
                                <summary>À propos de cette question</summary>
                                <p>
                                  Auteur : {question.author}.{' '}
                                  {question.pendingTeamReview
                                    ? 'Formulation à valider par l’équipe.'
                                    : 'Formulation révisée avec Ahmed.'}
                                </p>
                              </details>
                              {extra.length > 0 && (
                                <details className="v2-extra">
                                  <summary>Précisions et références ({extra.length})</summary>
                                  {extra.map(render)}
                                </details>
                              )}
                              {question.helpParagraphs.length > 0 && (
                                <details className="v2-extra">
                                  <summary>Aide à la réponse</summary>
                                  {question.helpParagraphs.map((paragraph, i) => (
                                    <p key={i}>{paragraph}</p>
                                  ))}
                                </details>
                              )}
                              <V2EvidencePanel
                                key={`${question.questionId}:${view.actor}`}
                                draftId={view.draft.id}
                                questionId={question.questionId}
                                actor={view.actor}
                                supplierQuestion={question.fields.some(
                                  (field) => field.actor === 'supplier',
                                )}
                                files={view.draft.evidence.filter(
                                  (file) => file.questionId === question.questionId,
                                )}
                                busy={busy}
                                onDirty={onDirty}
                                onUpload={uploadEvidence}
                              />
                              <details className="v2-legal">
                                <summary>Base légale et références</summary>
                                {question.legalBasisParagraphs.map((paragraph, i) => (
                                  <p key={i}>{paragraph}</p>
                                ))}
                                {question.sourceUrls.map((url, i) => (
                                  <a
                                    key={url}
                                    className="link block text-xs"
                                    href={url}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    Consulter la source officielle {i + 1} ↗
                                  </a>
                                ))}
                              </details>
                              {view.actor === 'reviewer' && (
                                <details className="v2-extra">
                                  <summary>
                                    Examen de {question.questionId}
                                    {view.questionReviews?.[question.questionId]?.current === false
                                      ? ' · à actualiser'
                                      : ''}
                                  </summary>
                                  <V2ReviewEditor
                                    kind="question"
                                    id={question.questionId}
                                    existing={view.questionReviews?.[question.questionId]}
                                    files={view.draft.evidence.filter(
                                      (file) => file.questionId === question.questionId,
                                    )}
                                    busy={busy}
                                    onDirty={onDirty}
                                    onSave={saveReview}
                                  />
                                </details>
                              )}
                            </div>
                          </details>
                        }
                      </Localized>
                    );
                  })}
                  <div className="v2-stage-footer">
                    <button
                      className="v2-secondary"
                      disabled={busy || stage === 1 || view.actor === 'supplier'}
                      onClick={() => void go(stage - 1)}
                    >
                      ← Étape précédente
                    </button>
                    <button
                      className="v2-primary"
                      disabled={busy}
                      onClick={() => {
                        if (stage === 4 && view.actor === 'unil' && view.draft.mode === 'both')
                          void switchActor('supplier', 5);
                        else if (stage === 5 && view.actor === 'supplier')
                          void switchActor('unil', 6);
                        else if (stage < 6) void go(stage + 1);
                        else void go(stage, true);
                      }}
                    >
                      {stage === 4 && view.actor === 'unil' && view.draft.mode === 'both'
                        ? 'Enregistrer et passer au fournisseur →'
                        : stage === 5 && view.actor === 'supplier'
                          ? 'Enregistrer et revenir à UNIL →'
                          : stage === 6
                            ? 'Voir les actions du dossier →'
                            : 'Enregistrer et continuer →'}
                    </button>
                  </div>
                </>
              )}
              {(!overview || panel === 'followup') && (
                <section className="v2-actions">
                  <h3>
                    {allActions ? 'Toutes les actions' : 'Vos prochaines actions'}{' '}
                    <span>{allActions ? availableActions.length : ownActions.length}</span>
                  </h3>
                  <p className="v2-small">Les actions sont recalculées après enregistrement.</p>
                  <button
                    className="v2-text-button"
                    onClick={() => setAllActions((value) => !value)}
                  >
                    {allActions
                      ? 'Voir mes prochaines actions'
                      : `Voir toutes les actions (${availableActions.length})`}
                  </button>
                  {actionList.length ? (
                    <ul>
                      {actionList.map((action) => (
                        <li key={action.id}>
                          <div>
                            <strong>{action.questionId ?? 'Parcours'}</strong>
                            <p>{action.message}</p>
                            <small>
                              {actors[action.owner]} · Avant : {checkpointLabels[action.before]}
                            </small>
                          </div>
                          {action.questionId && (
                            <button
                              className="v2-text-button"
                              disabled={busy}
                              onClick={async () => {
                                const target = view.questions.find(
                                  (q) => q.questionId === action.questionId,
                                );
                                if (!target || !(await flush())) return;
                                setOverview(false);
                                setStage(target.stage);
                                setTimeout(() => {
                                  const element = readOnlyStates.current.get(action.questionId!);
                                  if (element) {
                                    element.open = true;
                                    element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                  }
                                }, 80);
                              }}
                            >
                              Ouvrir
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p>
                      Aucune action dans cette vue. Les décisions restent à confirmer par les
                      personnes responsables.
                    </p>
                  )}
                </section>
              )}
            </div>
          </div>
        </div>
      }
    </Localized>
  );
}
