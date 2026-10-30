'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/components/language';
import { useDraftGuard } from '@/components/draft-guard';
import {
  canonicalPdfId,
  pdfQuestions,
  pdfById,
  sections,
  EN_PROMPTS,
  phases,
  phaseLabels,
  outcomeLabels,
  type PdfActor,
  type Phase,
} from '@/config/questionnaire-pdf/catalog';
import type { PdfView, PdfAnswer, PdfReview, PdfCondition } from '@/lib/questionnaire-pdf';
import {
  recommendPdf,
  journeyStep as journeyStepForDisplay,
} from '@/lib/questionnaire-pdf-routing';
import './workspace.css';
const roleLabels = {
  unil: ['Entité universitaire', 'University unit'],
  supplier: ['Fournisseur', 'Supplier'],
  reviewer: ['Évaluateur', 'Reviewer'],
};
type Summary = {
  id: string;
  title: string;
  version: string;
  revision: number;
  status: string;
  remaining: number;
  updatedAt: string;
};
async function request<T>(url: string, body?: unknown): Promise<T> {
  const r = await fetch('/api/assessments' + url, {
    cache: 'no-store',
    method: body === undefined ? 'GET' : 'POST',
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error ?? 'Opération impossible.');
  return d;
}
export function PdfWorkspace({ draftId }: { draftId?: string }) {
  const { locale } = useLanguage();
  const en = locale === 'en';
  const t = (fr: string, english: string) => (en ? english : fr);
  const router = useRouter();
  const guard = useDraftGuard();
  const [view, setView] = useState<PdfView | null>(null);
  const [list, setList] = useState<Summary[]>([]);
  const [actor, setActor] = useState<PdfActor>('unil');
  const [archived, setArchived] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [title, setTitle] = useState('');
  const [section, setSection] = useState<string>('E');
  const [qid, setQid] = useState('E01');
  const [tab, setTab] = useState<'journey' | 'questions' | 'followup' | 'reports'>('journey');
  const [pending, setPending] = useState<Record<string, PdfAnswer>>({});
  const [reports, setReports] = useState<string[]>([]);
  const [internalDirty, setInternalDirty] = useState(false);
  const [internalReset, setInternalReset] = useState(0);
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      if (draftId) {
        const v = await request<PdfView>('/' + draftId);
        setView(v);
        setActor(v.actor);
        const first = pdfQuestions.find((q) => v.actor !== 'supplier' || q.owner === 'supplier')!;
        setSection(first.section);
        setQid(first.id);
        if (v.actor !== 'supplier')
          setReports((await request<{ reports: string[] }>('/' + draftId + '/reports')).reports);
      } else {
        const r = await request<{ actor: PdfActor; drafts: Summary[] }>(
          '' + (archived ? '?archived=1' : ''),
        );
        setList(r.drafts);
        setActor(r.actor);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [draftId, archived]);
  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (!cancelled) return load();
    });
    return () => {
      cancelled = true;
    };
  }, [load]);
  const flush = useCallback(async () => {
    if (!draftId || !view || !Object.keys(pending).length) return view ?? false;
    setBusy(true);
    setError('');
    try {
      let v = view;
      for (const [questionId, answer] of Object.entries(pending))
        v = await request<PdfView>('/' + draftId + '/answer', {
          revision: v.revision,
          questionId,
          answer,
        });
      setView(v);
      setPending({});
      return v;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }, [draftId, view, pending]);
  const navigate = useCallback(async () => {
    if (internalDirty) {
      setError(
        locale === 'en'
          ? 'Save the review or decision before leaving this view.'
          : 'Enregistrez l’examen ou la décision avant de quitter cette vue.',
      );
      return false;
    }
    // The project list has no loaded dossier or pending answers to save.
    // It must not veto links merely because flush has no dossier to return.
    return !view || !!(await flush());
  }, [internalDirty, flush, locale, view]);
  useEffect(() => {
    guard.register(navigate);
    return () => guard.register(null);
  }, [guard, navigate]);
  useEffect(() => {
    const fn = (e: BeforeUnloadEvent) => {
      if (Object.keys(pending).length || internalDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', fn);
    return () => window.removeEventListener('beforeunload', fn);
  }, [pending, internalDirty]);
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function switchActor(next: PdfActor) {
    if (!(await navigate())) return;
    await run(async () => {
      await request('/session', { actor: next, ...(draftId ? { draftId } : {}) });
      await load();
      setTab('journey');
    });
  }
  const filtered = pdfQuestions.filter((q) => actor !== 'supplier' || q.owner === 'supplier');
  const visibleSections = sections.filter((s) => filtered.some((q) => q.section === s[0]));
  const question = pdfById.get(qid);
  const inSection = filtered.filter((q) => q.section === section);
  const index = filtered.findIndex((q) => q.id === qid);
  const answer = pending[qid] ?? view?.answers[qid] ?? { choice: '', details: '', reference: '' };
  const editable = question?.owner === actor;
  async function navigateQuestion(id: string) {
    if (!(await navigate())) return;
    const q = pdfById.get(id)!;
    setSection(q.section);
    setQid(id);
  }
  const journey = view ? recommendPdf(view) : null;
  const statusText = (s: string) =>
    s === 'ready'
      ? t('Prêt pour une décision humaine', 'Ready for a human decision')
      : s === 'blocked'
        ? t('Point bloquant à examiner', 'Blocking point to examine')
        : t('Informations à compléter', 'Information required');
  return (
    <article className="pdf-workspace">
      <header className="pdf-hero">
        <div>
          <span className="pdf-kicker">
            {t('QUESTIONNAIRE DE L’ÉQUIPE · 26 OCTOBRE', 'TEAM QUESTIONNAIRE · 26 OCTOBER')}
          </span>
          <h1>{view?.title ?? t('Vos projets', 'Your projects')}</h1>
          <p>
            {t(
              'Le parcours fondé sur la checklist de l’équipe, avec réponses, preuves et décisions motivées.',
              'The team checklist process, with answers, evidence and reasoned decisions.',
            )}
          </p>
        </div>
        {draftId && <Link href="/projects">{t('← Tous les projets', '← All projects')}</Link>}
      </header>
      <div className="pdf-toolbar">
        <label>
          {t('Rôle simulé', 'Simulated role')}{' '}
          <select
            aria-label={t('Rôle simulé', 'Simulated role')}
            value={actor}
            disabled={busy || loading}
            onChange={(e) => void switchActor(e.target.value as PdfActor)}
          >
            {Object.entries(roleLabels)
              .filter(([k]) => k !== 'supplier' || draftId || actor === 'supplier')
              .map(([k, v]) => (
                <option key={k} value={k}>
                  {v[en ? 1 : 0]}
                </option>
              ))}
          </select>
        </label>
        <span>
          {t(
            'Références juridiques à vérifier · Aucune certification',
            'Legal references need verification · No certification',
          )}
        </span>
      </div>
      {error && (
        <div role="alert" className="pdf-error">
          {error}
          <button onClick={() => void load()} disabled={busy}>
            {t('Recharger la version enregistrée', 'Reload saved version')}
          </button>
          {!!Object.keys(pending).length && (
            <p>
              {t(
                'Vos modifications locales restent affichées. Copiez-les avant de recharger puis réappliquez-les à la version actuelle.',
                'Your local edits remain visible. Copy them before reloading, then reapply them to the current version.',
              )}
            </p>
          )}
        </div>
      )}
      {internalDirty && (
        <div className="pdf-guidance" role="status">
          {t('Examen ou décision non enregistré.', 'Unsaved review or decision.')}{' '}
          <button
            onClick={() => {
              setInternalDirty(false);
              setInternalReset((n) => n + 1);
              setError('');
            }}
          >
            {t('Annuler ces modifications', 'Discard these edits')}
          </button>
        </div>
      )}
      {loading ? (
        <p role="status">{t('Chargement…', 'Loading…')}</p>
      ) : !draftId ? (
        <>
          {actor !== 'supplier' && (
            <form
              className="pdf-create"
              onSubmit={(e) => {
                e.preventDefault();
                void run(async () => {
                  const d = await request<PdfView>('', { title });
                  router.push('/projects/' + d.id);
                });
              }}
            >
              <h2>{t('Nouvelle évaluation', 'New assessment')}</h2>
              <div>
                <label htmlFor="pdf-title">{t('Nom du projet', 'Project name')}</label>
                <input
                  id="pdf-title"
                  minLength={3}
                  maxLength={160}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  placeholder={t('Ex. Assistant pédagogique', 'E.g. Teaching assistant')}
                />
                <button disabled={busy} type="submit">
                  {t('Créer le projet', 'Create project')}
                </button>
              </div>
            </form>
          )}
          <div className="pdf-list-heading">
            <h2>
              {archived
                ? t('Projets archivés', 'Archived projects')
                : t('Projets du nouveau questionnaire', 'New questionnaire projects')}
            </h2>
            {actor !== 'supplier' && (
              <button onClick={() => setArchived(!archived)}>
                {archived
                  ? t('Voir les projets actifs', 'Show active projects')
                  : t('Voir les archives', 'Show archives')}
              </button>
            )}
          </div>
          <div className="pdf-project-grid">
            {list.map((d) => (
              <section key={d.id} className="pdf-project">
                <span className={'pdf-status ' + d.status}>{statusText(d.status)}</span>
                <h3>
                  <Link href={'/projects/' + d.id}>{d.title}</Link>
                </h3>
                <p>
                  {d.remaining} {t('actions à examiner', 'actions to review')}
                </p>
                <div>
                  <Link href={'/projects/' + d.id}>
                    {t('Ouvrir le projet →', 'Open project →')}
                  </Link>
                  {actor !== 'supplier' && (
                    <button
                      disabled={busy}
                      onClick={() =>
                        void run(async () => {
                          await request('/' + d.id + '/archive', {
                            revision: d.revision,
                            archived: !archived,
                          });
                          await load();
                        })
                      }
                    >
                      {archived ? t('Restaurer', 'Restore') : t('Archiver', 'Archive')}
                    </button>
                  )}
                </div>
              </section>
            ))}
          </div>
          {!list.length && (
            <p>{t('Aucun projet dans cette liste.', 'No projects in this list.')}</p>
          )}
          {actor !== 'supplier' && (
            <aside className="pdf-history">
              <strong>{t('Dossiers de la version précédente', 'Previous-version dossiers')}</strong>
              <p>
                {t(
                  'Vos réponses, pièces, comparaisons et rapports antérieurs sont conservés dans leur parcours d’origine.',
                  'Your previous answers, evidence, comparisons and reports remain in their original process.',
                )}
              </p>
              <Link href="/projects?version=previous">
                {t('Consulter les projets précédents →', 'View previous projects →')}
              </Link>
            </aside>
          )}
        </>
      ) : view && question ? (
        <>
          <div className="pdf-tabs" role="group" aria-label={t('Vue du dossier', 'Dossier view')}>
            {(
              [
                'journey',
                'questions',
                ...(actor === 'supplier' ? [] : ['followup', 'reports']),
              ] as ('journey' | 'questions' | 'followup' | 'reports')[]
            ).map((k) => (
              <button
                key={k}
                className={tab === k ? 'selected' : ''}
                disabled={busy}
                onClick={async () => {
                  if (await navigate()) setTab(k);
                }}
              >
                {k === 'journey'
                  ? t('Parcours guidé', 'Guided journey')
                  : k === 'questions'
                    ? t('Questionnaire', 'Questionnaire')
                    : k === 'followup'
                      ? t('Suivi et décisions', 'Follow-up and decisions')
                      : t('Rapports', 'Reports')}
              </button>
            ))}
          </div>
          {tab === 'journey' && journey ? (
            <section className="pdf-panel pdf-journey">
              <span className="pdf-kicker">{t('VOTRE PROCHAINE ÉTAPE', 'YOUR NEXT STEP')}</span>
              <h2>{t('Un parcours adapté à votre rôle', 'A journey for your role')}</h2>
              <p>
                {t(
                  'Les recommandations organisent le travail. Elles ne valident pas juridiquement le dossier et ne masquent aucune question.',
                  'Recommendations organise the work. They do not legally approve the dossier or hide questions.',
                )}
              </p>
              <label htmlFor="journey-progress">
                {journey.completed} / {journey.total}{' '}
                {actor === 'reviewer'
                  ? t('contrôles sans action restante', 'checks with no remaining action')
                  : t('réponses renseignées avec référence', 'answers completed with a reference')}
              </label>
              <progress id="journey-progress" max={journey.total || 1} value={journey.completed} />
              {journey.next ? (
                <div className="pdf-recommendation">
                  <p className="pdf-kicker">
                    {journey.next.id} ·{' '}
                    {journey.steps[journeyStepForDisplay(journey.next.id)]?.label[en ? 1 : 0]}
                  </p>
                  <h3>{en ? EN_PROMPTS[journey.next.id] : journey.next.question}</h3>
                  <p>
                    {journey.reason === 'context'
                      ? t(
                          'Précisez d’abord le contexte du projet.',
                          'First establish the project context.',
                        )
                      : journey.reason === 'priority'
                        ? t(
                            'Vos réponses rendent ce contrôle prioritaire. Son applicabilité reste à examiner.',
                            'Your answers make this check a priority. Applicability still requires review.',
                          )
                        : journey.reason === 'review'
                          ? t(
                              'Ce contrôle comporte une action à examiner. Les points bloquants sont présentés en priorité.',
                              'This check has an action to examine. Blocking issues are prioritised.',
                            )
                          : t(
                              'Cette question est le prochain élément à compléter pour votre rôle.',
                              'This is the next item to complete for your role.',
                            )}
                  </p>
                  <button
                    disabled={busy}
                    onClick={async () => {
                      if (await navigate()) {
                        const next = journey.next!;
                        setQid(next.id);
                        setSection(next.section);
                        setTab('questions');
                      }
                    }}
                  >
                    {journey.completed
                      ? t('Continuer l’évaluation →', 'Continue assessment →')
                      : t('Commencer l’évaluation →', 'Start assessment →')}
                  </button>
                </div>
              ) : (
                <div className="pdf-recommendation">
                  <h3>{t('Votre contribution est renseignée', 'Your contribution is complete')}</h3>
                  <p>
                    {actor === 'supplier'
                      ? t(
                          'L’évaluateur doit encore examiner les éléments du dossier. Aucune approbation automatique.',
                          'The reviewer must still examine the dossier. No automatic approval.',
                        )
                      : t(
                          'Consultez le suivi pour les contributions des autres rôles et les décisions humaines.',
                          'Open follow-up for other roles’ contributions and human decisions.',
                        )}
                  </p>
                  {actor !== 'supplier' && (
                    <button
                      disabled={busy}
                      onClick={async () => {
                        if (await navigate()) setTab('followup');
                      }}
                    >
                      {t('Ouvrir le suivi et les décisions', 'Open follow-up and decisions')}
                    </button>
                  )}
                </div>
              )}
              <ol className="pdf-journey-steps">
                {journey.steps
                  .filter((s) => s.total)
                  .map((s) => (
                    <li key={s.label[0]}>
                      <strong>{s.label[en ? 1 : 0]}</strong>
                      <span>
                        {s.total - s.remaining}/{s.total} · {s.remaining}{' '}
                        {t('à traiter', 'remaining')}
                      </span>
                    </li>
                  ))}
              </ol>
              <p className="pdf-muted">
                {t(
                  'Les étapes ne retardent pas les échéances : les exigences dues avant procédure ou sélection restent prioritaires. Les rôles peuvent contribuer en parallèle.',
                  'Steps do not postpone deadlines: requirements due before procedure or selection remain priorities. Roles can contribute in parallel.',
                )}
              </p>
              <button
                disabled={busy}
                onClick={async () => {
                  if (await navigate()) setTab('questions');
                }}
              >
                {t('Consulter tout le questionnaire', 'Browse the full questionnaire')}
              </button>
            </section>
          ) : tab === 'questions' ? (
            <div className="pdf-layout">
              <nav
                className="pdf-sections"
                aria-label={t('Sections du questionnaire', 'Questionnaire sections')}
              >
                {visibleSections.map((s) => (
                  <button
                    key={s[0]}
                    className={section === s[0] ? 'selected' : ''}
                    disabled={busy}
                    onClick={() =>
                      void navigateQuestion(filtered.find((q) => q.section === s[0])!.id)
                    }
                  >
                    {s[en ? 2 : 1]}
                    <small>
                      {filtered.filter((q) => q.section === s[0] && !!view.answers[q.id]).length}/
                      {filtered.filter((q) => q.section === s[0]).length}
                    </small>
                  </button>
                ))}
              </nav>
              <div>
                <div
                  className="pdf-question-index"
                  aria-label={t('Questions de la section', 'Section questions')}
                >
                  {inSection.map((q) => (
                    <button
                      key={q.id}
                      className={qid === q.id ? 'selected' : ''}
                      disabled={busy}
                      onClick={() => void navigateQuestion(q.id)}
                    >
                      {q.id}
                      {view.answers[q.id] && ' •'}
                    </button>
                  ))}
                </div>
                <section className="pdf-question">
                  <span className="pdf-kicker">
                    {question.id} · {roleLabels[question.owner][en ? 1 : 0]}
                  </span>
                  <h2>{en ? EN_PROMPTS[qid] : question.question}</h2>
                  <p className="pdf-muted">
                    {t('Origine', 'Source')}: {question.source}
                  </p>
                  <p className="pdf-guidance">
                    {t(
                      'Les questions restent visibles. Une réponse « non applicable » exige une justification et un examen ; elle ne ferme pas automatiquement une branche.',
                      'Questions remain visible. “Not applicable” requires reasons and a review; it does not automatically close a branch.',
                    )}
                  </p>
                  {editable ? (
                    <fieldset disabled={busy}>
                      <label htmlFor="pdf-choice">{t('Votre réponse', 'Your answer')}</label>
                      <select
                        id="pdf-choice"
                        value={answer.choice}
                        onChange={(e) =>
                          setPending({ ...pending, [qid]: { ...answer, choice: e.target.value } })
                        }
                      >
                        <option value="">{t('Choisir une réponse', 'Choose an answer')}</option>
                        {question.choices.map((c) => (
                          <option key={c.value} value={c.value}>
                            {en ? c.en : c.fr}
                          </option>
                        ))}
                      </select>
                      <label htmlFor="pdf-details">
                        {t('Précisions et justification', 'Details and reasons')}
                      </label>
                      <textarea
                        id="pdf-details"
                        rows={5}
                        maxLength={12000}
                        value={answer.details}
                        onChange={(e) =>
                          setPending({ ...pending, [qid]: { ...answer, details: e.target.value } })
                        }
                      />
                      <label htmlFor="pdf-reference">
                        {t(
                          'Référence du justificatif ou document',
                          'Evidence or document reference',
                        )}
                      </label>
                      <input
                        id="pdf-reference"
                        maxLength={2000}
                        value={answer.reference}
                        onChange={(e) =>
                          setPending({
                            ...pending,
                            [qid]: { ...answer, reference: e.target.value },
                          })
                        }
                      />
                      <button
                        type="button"
                        className="primary"
                        disabled={!Object.keys(pending).length}
                        onClick={() => void flush()}
                      >
                        {t('Enregistrer les réponses', 'Save answers')}
                      </button>
                      <span role="status" className="pdf-save-status">
                        {Object.keys(pending).length
                          ? t('Modifications non enregistrées', 'Unsaved changes')
                          : t('Version enregistrée', 'Saved version')}
                      </span>
                      <button
                        type="button"
                        onClick={async () => {
                          if (internalDirty) return;
                          const saved = await flush();
                          if (!saved) return;
                          const route = recommendPdf(saved);
                          if (route.next && route.next.id !== qid) {
                            setQid(route.next.id);
                            setSection(route.next.section);
                          } else {
                            setTab('journey');
                          }
                        }}
                      >
                        {t('Enregistrer et continuer →', 'Save and continue →')}
                      </button>
                    </fieldset>
                  ) : (
                    <div className="pdf-answer">
                      <strong>
                        {question.choices.find((c) => c.value === answer.choice)?.[
                          en ? 'en' : 'fr'
                        ] ?? t('Non renseigné', 'Unanswered')}
                      </strong>
                      <p>{answer.details}</p>
                      <p>{answer.reference}</p>
                      <small>
                        {t(
                          'Choisissez le rôle répondant pour modifier cette réponse.',
                          'Choose the responding role to edit this answer.',
                        )}
                      </small>
                    </div>
                  )}
                  <details className="pdf-source">
                    <summary>
                      {t('Ce qu’il faut documenter et pourquoi', 'What to document and why')}
                    </summary>
                    {en && (
                      <p>
                        {t(
                          '',
                          'The source guidance below is retained in French for traceability. It is not a verified legal conclusion.',
                        )}
                      </p>
                    )}
                    <h3>{t('Informations attendues', 'Expected information')}</h3>
                    <p>{question.answers}</p>
                    <h3>{t('Logique et échéance proposées', 'Proposed logic and deadline')}</h3>
                    <p>{question.effect}</p>
                    <h3>
                      {t('Référence documentaire à vérifier', 'Documentary reference to verify')}
                    </h3>
                    <p>{question.legal}</p>
                  </details>
                  <PdfEvidencePanel
                    key={qid + view.revision}
                    view={view}
                    questionId={qid}
                    actor={actor}
                    editable={!!editable || actor === 'reviewer'}
                    before={navigate}
                    changed={setView}
                    fail={setError}
                  />
                  {actor === 'reviewer' && (
                    <ReviewForm
                      key={'review' + qid + view.revision + internalReset}
                      view={view}
                      questionId={qid}
                      before={async () => !!(await flush())}
                      changed={(v) => {
                        setView(v);
                        setInternalDirty(false);
                      }}
                      onDirty={setInternalDirty}
                      fail={setError}
                    />
                  )}
                </section>
                <div className="pdf-next">
                  <button
                    disabled={index <= 0 || busy}
                    onClick={() => void navigateQuestion(filtered[index - 1].id)}
                  >
                    {t('← Précédente', '← Previous')}
                  </button>
                  <span>
                    {index + 1} / {filtered.length}
                  </span>
                  <button
                    disabled={index >= filtered.length - 1 || busy}
                    onClick={() => void navigateQuestion(filtered[index + 1].id)}
                  >
                    {t('Suivante →', 'Next →')}
                  </button>
                </div>
              </div>
            </div>
          ) : tab === 'followup' ? (
            <section className="pdf-panel">
              <h2>{t('Actions et décisions humaines', 'Actions and human decisions')}</h2>
              <p>
                {t(
                  'Une signature et une mise en service sont deux décisions distinctes. Les conditions ne peuvent pas être reportées au-delà de leur échéance.',
                  'Signature and deployment are separate decisions. Conditions cannot be postponed beyond their deadline.',
                )}
              </p>
              <div className="pdf-checkpoints">
                {view.evaluation?.checkpoints.map((c) => (
                  <div key={c.phase}>
                    <strong>{phaseLabels[c.phase][en ? 1 : 0]}</strong>
                    <p>
                      {c.remaining} {t('actions restantes', 'remaining actions')}
                    </p>
                    <small>
                      {view.decisionCurrent?.[c.phase]
                        ? view.decisions?.[c.phase]?.decision === 'approved'
                          ? t('Décision confirmée', 'Decision confirmed')
                          : t('Décision reportée', 'Decision deferred')
                        : t('Décision à examiner', 'Decision to review')}
                    </small>
                  </div>
                ))}
              </div>
              <details open>
                <summary>
                  {t('Actions à résoudre', 'Actions to resolve')} ({view.evaluation?.actions.length}
                  )
                </summary>
                <ul className="pdf-actions">
                  {view.evaluation?.actions.map((a, i) => (
                    <li key={i}>
                      <button
                        onClick={() => {
                          setTab('journey');
                          void navigateQuestion(a.questionId);
                        }}
                      >
                        {a.questionId}
                      </button>
                      <strong>
                        {outcomeLabels[a.kind === 'review' ? 'information' : a.kind][en ? 1 : 0]}
                      </strong>
                      <span>
                        {phaseLabels[a.before][en ? 1 : 0]} · {roleLabels[a.owner][en ? 1 : 0]}
                      </span>
                      <small>
                        {t('Motif', 'Reason')}: {a.reason}
                        {a.description ? ' · ' + a.description : ''}
                      </small>
                    </li>
                  ))}
                </ul>
              </details>
              {actor === 'reviewer' && (
                <DecisionForm
                  key={'decision' + view.revision + internalReset}
                  view={view}
                  changed={(v) => {
                    setView(v);
                    setInternalDirty(false);
                  }}
                  onDirty={setInternalDirty}
                  fail={setError}
                />
              )}
            </section>
          ) : (
            <section className="pdf-panel">
              <h2>{t('Rapports conservés', 'Saved reports')}</h2>
              <p>
                {t(
                  'Chaque rapport conserve les réponses, pièces référencées, examens et décisions à cet instant. Les modifications futures ne changent pas les rapports déjà créés.',
                  'Each report preserves answers, evidence references, reviews and decisions at that point. Later edits do not change saved reports.',
                )}
              </p>
              <button
                className="primary"
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    const r = await request<{ id: string }>('/' + view.id + '/reports', {
                      revision: view.revision,
                    });
                    setReports([...reports, r.id]);
                  })
                }
              >
                {t(
                  'Créer un rapport dans la langue affichée',
                  'Create report in the current language',
                )}
              </button>
              <ul>
                {reports.map((id, i) => (
                  <li key={id}>
                    <a
                      target="_blank"
                      rel="noreferrer"
                      href={'/api/assessments/' + view.id + '/reports/' + id}
                    >
                      {t('Ouvrir le rapport', 'Open report')} {i + 1}
                    </a>{' '}
                    ·{' '}
                    <a
                      href={'/api/assessments/' + view.id + '/reports/' + id + '?format=json'}
                      target="_blank"
                      rel="noreferrer"
                    >
                      JSON
                    </a>
                  </li>
                ))}
              </ul>
              <p className="pdf-muted">
                {t(
                  'Imprimez le rapport depuis le navigateur pour l’enregistrer en PDF.',
                  'Print the report in your browser to save it as PDF.',
                )}
              </p>
            </section>
          )}
        </>
      ) : null}
    </article>
  );
}
function PdfEvidencePanel({
  view,
  questionId,
  actor,
  editable,
  before,
  changed,
  fail,
}: {
  view: PdfView;
  questionId: string;
  actor: PdfActor;
  editable: boolean;
  before: () => Promise<boolean>;
  changed: (v: PdfView) => void;
  fail: (s: string) => void;
}) {
  const { locale } = useLanguage();
  const en = locale === 'en';
  const t = (f: string, e: string) => (en ? e : f);
  const [file, setFile] = useState<File | null>(null);
  const [shared, setShared] = useState(actor === 'supplier');
  const [busy, setBusy] = useState(false);
  return (
    <div className="pdf-evidence">
      <h3>{t('Pièces justificatives', 'Supporting evidence')}</h3>
      <ul>
        {view.evidence
          .filter((e) => e.questionId === canonicalPdfId(questionId))
          .map((e) => (
            <li key={e.id}>
              <a href={'/api/assessments/' + view.id + '/evidence/' + e.id}>{e.name}</a>{' '}
              <small>
                {e.visibility === 'shared' ? t('Partagée', 'Shared') : t('Interne', 'Internal')}
              </small>
            </li>
          ))}
      </ul>
      {editable && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!file) return;
            if (!(await before())) return;
            setBusy(true);
            try {
              const latest = await request<PdfView>('/' + view.id);
              const f = new FormData();
              f.set('file', file);
              f.set('questionId', questionId);
              f.set('revision', String(latest.revision));
              f.set('visibility', shared ? 'shared' : 'internal');
              const r = await fetch('/api/assessments/' + view.id + '/evidence', {
                method: 'POST',
                body: f,
              });
              const v = await r.json();
              if (!r.ok) throw new Error(v.error);
              changed(v);
              setFile(null);
            } catch (err) {
              fail((err as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <label htmlFor="pdf-file">
            {t('Ajouter une pièce · 10 Mo maximum', 'Add evidence · maximum 10 MB')}
          </label>
          <input
            id="pdf-file"
            type="file"
            accept=".pdf,.txt,.png,.jpg,.jpeg,.docx"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          <label>
            <input
              type="checkbox"
              checked={shared}
              disabled={actor === 'supplier'}
              onChange={(e) => setShared(e.target.checked)}
            />
            {t('Partager avec le fournisseur', 'Share with supplier')}
          </label>
          <button disabled={busy || !file}>{t('Joindre le fichier', 'Attach file')}</button>
        </form>
      )}
    </div>
  );
}
function ReviewForm({
  view,
  questionId,
  changed,
  fail,
  before,
  onDirty,
}: {
  view: PdfView;
  questionId: string;
  changed: (v: PdfView) => void;
  fail: (s: string) => void;
  before: () => Promise<boolean>;
  onDirty: (value: boolean) => void;
}) {
  const { locale } = useLanguage();
  const en = locale === 'en';
  const t = (f: string, e: string) => (en ? e : f);
  const prior = view.reviews?.[questionId];
  const [status, setStatus] = useState<PdfReview['status']>(prior?.status ?? 'needs_work');
  const [justification, setJustification] = useState(prior?.justification ?? '');
  const [reference, setReference] = useState(prior?.reference ?? '');
  const [resolution, setResolution] = useState<PdfReview['resolution']>(
    prior?.resolution ?? 'none',
  );
  const [conditions, setConditions] = useState<PdfCondition[]>(prior?.conditions ?? []);
  const [busy, setBusy] = useState(false);
  const current = view.evaluation?.questions.find((q) => q.id === questionId)?.reviewCurrent;
  return (
    <details className="pdf-review" open>
      <summary>
        {t('Examen de l’évaluateur', 'Reviewer examination')} ·{' '}
        {current ? t('actuel', 'current') : t('à réaliser ou actualiser', 'pending or stale')}
      </summary>
      <form
        onChangeCapture={() => onDirty(true)}
        onSubmit={async (e) => {
          e.preventDefault();
          if (!(await before())) return;
          setBusy(true);
          try {
            changed(
              await request('/' + view.id + '/review', {
                revision: view.revision,
                questionId,
                review: { status, justification, reference, resolution, conditions },
              }),
            );
            onDirty(false);
          } catch (err) {
            fail((err as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <fieldset disabled={busy}>
          <label htmlFor="review-state">{t('Conclusion de l’examen', 'Review conclusion')}</label>
          <select
            id="review-state"
            value={status}
            onChange={(e) => setStatus(e.target.value as PdfReview['status'])}
          >
            <option value="needs_work">{t('À compléter', 'Needs work')}</option>
            <option value="accepted">
              {t('Examen accepté, motifs requis', 'Review accepted, reasons required')}
            </option>
            <option value="blocked">{t('Point bloquant', 'Blocking point')}</option>
            <option value="exempt">
              {t('Non applicable confirmé', 'Non-applicability confirmed')}
            </option>
          </select>
          <label htmlFor="review-why">{t('Justification motivée', 'Reasoned justification')}</label>
          <textarea
            id="review-why"
            rows={3}
            minLength={10}
            maxLength={6000}
            required
            value={justification}
            onChange={(e) => setJustification(e.target.value)}
          />
          <label htmlFor="review-ref">{t('Référence vérifiée', 'Reviewed reference')}</label>
          <input
            id="review-ref"
            required
            minLength={3}
            maxLength={2000}
            value={reference}
            onChange={(e) => setReference(e.target.value)}
          />
          <label htmlFor="review-resolution">
            {t('Résolution d’un signal ou d’une condition', 'Resolution of a signal or condition')}
          </label>
          <select
            id="review-resolution"
            value={resolution}
            onChange={(e) => setResolution(e.target.value as PdfReview['resolution'])}
          >
            <option value="none">
              {t('Aucune exception ou correction déclarée', 'No exception or correction declared')}
            </option>
            <option value="corrected">
              {t('Faits corrigés et preuve vérifiée', 'Corrected facts and reviewed evidence')}
            </option>
            <option value="not_applicable">
              {t(
                'Exigence non applicable, fondement vérifié',
                'Requirement inapplicable, basis reviewed',
              )}
            </option>
            <option value="lawful_exception">
              {t(
                'Exception autorisée par le cadre applicable',
                'Exception permitted by the applicable framework',
              )}
            </option>
          </select>
          <h3>{t('Conditions et échéances', 'Conditions and deadlines')}</h3>
          {conditions.map((c, i) => (
            <div key={i} className="pdf-condition">
              <label>
                {t('Mesure à réaliser', 'Measure to complete')}
                <input
                  required
                  minLength={5}
                  value={c.description}
                  onChange={(e) =>
                    setConditions(
                      conditions.map((x, j) =>
                        j === i ? { ...x, description: e.target.value } : x,
                      ),
                    )
                  }
                />
              </label>
              <label>
                {t('Responsable', 'Owner')}
                <select
                  value={c.owner}
                  onChange={(e) =>
                    setConditions(
                      conditions.map((x, j) =>
                        j === i ? { ...x, owner: e.target.value as PdfActor } : x,
                      ),
                    )
                  }
                >
                  {Object.entries(roleLabels).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v[en ? 1 : 0]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {t('Avant', 'Before')}
                <select
                  value={c.before}
                  onChange={(e) =>
                    setConditions(
                      conditions.map((x, j) =>
                        j === i ? { ...x, before: e.target.value as Phase } : x,
                      ),
                    )
                  }
                >
                  {phases.map((p) => (
                    <option key={p} value={p}>
                      {phaseLabels[p][en ? 1 : 0]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={c.done}
                  onChange={(e) =>
                    setConditions(
                      conditions.map((x, j) => (j === i ? { ...x, done: e.target.checked } : x)),
                    )
                  }
                />
                {t('Réalisée', 'Completed')}
              </label>
              <label>
                {t('Preuve de réalisation', 'Completion evidence')}
                <input
                  required={c.done}
                  value={c.completionReference}
                  onChange={(e) =>
                    setConditions(
                      conditions.map((x, j) =>
                        j === i ? { ...x, completionReference: e.target.value } : x,
                      ),
                    )
                  }
                />
              </label>
              <button
                type="button"
                onClick={() => (onDirty(true), setConditions(conditions.filter((_, j) => j !== i)))}
              >
                {t('Retirer cette condition', 'Remove this condition')}
              </button>
            </div>
          ))}
          <button
            type="button"
            disabled={conditions.length >= 12}
            onClick={() => {
              onDirty(true);
              setConditions([
                ...conditions,
                {
                  description: '',
                  owner: 'unil',
                  before: 'deployment',
                  done: false,
                  completionReference: '',
                },
              ]);
            }}
          >
            {t('Ajouter une condition', 'Add condition')}
          </button>
          <button className="primary">{t('Enregistrer l’examen', 'Save review')}</button>
        </fieldset>
      </form>
    </details>
  );
}
function DecisionForm({
  view,
  changed,
  fail,
  onDirty,
}: {
  view: PdfView;
  changed: (v: PdfView) => void;
  fail: (s: string) => void;
  onDirty: (value: boolean) => void;
}) {
  const { locale } = useLanguage();
  const en = locale === 'en';
  const t = (f: string, e: string) => (en ? e : f);
  const [phase, setPhase] = useState<Phase>('signature');
  const [decision, setDecision] = useState<'approved' | 'deferred'>('deferred');
  const [why, setWhy] = useState('');
  const [reference, setReference] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="pdf-decision"
      onChangeCapture={() => onDirty(true)}
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          changed(
            await request('/' + view.id + '/decision', {
              revision: view.revision,
              phase,
              decision,
              justification: why,
              reference,
            }),
          );
        } catch (err) {
          fail((err as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <h3>{t('Consigner une décision humaine', 'Record a human decision')}</h3>
      <fieldset disabled={busy}>
        <label htmlFor="decision-phase">{t('Point de contrôle', 'Checkpoint')}</label>
        <select
          id="decision-phase"
          value={phase}
          onChange={(e) => setPhase(e.target.value as Phase)}
        >
          {phases
            .filter((p) => p !== 'followup')
            .map((p) => (
              <option key={p} value={p}>
                {phaseLabels[p][en ? 1 : 0]}
              </option>
            ))}
        </select>
        <label htmlFor="decision-value">{t('Décision', 'Decision')}</label>
        <select
          id="decision-value"
          value={decision}
          onChange={(e) => setDecision(e.target.value as 'approved' | 'deferred')}
        >
          <option value="deferred">{t('Reporter la décision', 'Defer decision')}</option>
          <option value="approved">
            {t('Autorisation humaine pour ce point', 'Human authorisation for this checkpoint')}
          </option>
        </select>
        <label htmlFor="decision-why">
          {t('Motifs et autorité compétente', 'Reasons and competent authority')}
        </label>
        <textarea
          id="decision-why"
          minLength={10}
          maxLength={6000}
          required
          value={why}
          onChange={(e) => setWhy(e.target.value)}
        />
        <label htmlFor="decision-ref">{t('Référence de la décision', 'Decision reference')}</label>
        <input
          id="decision-ref"
          minLength={3}
          maxLength={2000}
          required
          value={reference}
          onChange={(e) => setReference(e.target.value)}
        />
        <button className="primary">{t('Enregistrer la décision', 'Save decision')}</button>
      </fieldset>
    </form>
  );
}
