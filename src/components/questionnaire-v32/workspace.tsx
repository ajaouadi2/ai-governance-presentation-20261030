'use client';
import { V32Localized } from './localized';
import { V32LegalBases } from './legal-bases';
import { v32Automation } from '@/lib/questionnaire-v32-automation';
import { v32CaseIssues, v32DpfPolicy } from '@/lib/questionnaire-v32-policy';
import { v32Journey, v32Location, v32LocationLabel } from '@/lib/questionnaire-v32-journey';
import { V32Reports } from './reports';
import { v32VerdictNames, v32Readable } from '@/lib/questionnaire-v32-labels';
import { V32Conditions } from './conditions';
import { v32VisibleRecommendations } from '@/lib/questionnaire-v32-recommendations';
import Link from 'next/link';
import { useEffect, useState, useCallback, useRef } from 'react';
import catalogue from '@/config/questionnaire-v32/catalogue.json';
import presentation from '@/config/questionnaire-v32/presentation.json';
import { evaluateV32, evaluateV32Followup, v32OpenIssues } from '@/lib/questionnaire-v32-engine';
import {
  emptyV32Draft,
  v32DraftSchema,
  V32_DRAFT_KEY,
  type V32BrowserDraft,
} from '@/lib/questionnaire-v32-draft';
import { useDraftGuard } from '@/components/draft-guard';
import { type V32View } from '@/lib/questionnaire-v32-roles';
import { useRouter } from 'next/navigation';
import './workspace.css';
type Tab = 'journey' | 'summary' | 'followup' | 'reference' | 'reports';
async function serverRequest(path: string, body?: unknown): Promise<V32View> {
  const r = await fetch('/api/questionnaire-v32' + path, {
    cache: 'no-store',
    method: body === undefined ? 'GET' : 'POST',
    headers:
      body === undefined
        ? {}
        : { 'Content-Type': 'application/json', 'X-Clair-Workspace': 'unil-3' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error ?? 'Opération impossible.');
  return d;
}
export function V32Workspace({ draftId }: { draftId?: string }) {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const [draft, setDraft] = useState<V32BrowserDraft>(emptyV32Draft);
  const [loaded, setLoaded] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [selected, setSelected] = useState('V32-S01-Q01');
  const [tab, setTab] = useState<Tab>('journey');
  useEffect(() => {
    document
      .getElementById('v32-question-title')
      ?.closest('section')
      ?.scrollIntoView({ block: 'start' });
  }, [selected, tab]);
  const persisted = useRef<string | null>(null);
  const [blocked, setBlocked] = useState(false);
  const guard = useDraftGuard();
  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(async () => {
      if (cancelled) return;
      try {
        if (draftId) {
          const saved = await serverRequest('/' + draftId);
          if (cancelled) return;
          setDraft(saved.draft);
          setTitle(saved.title);
          setRevision(saved.revision);
          setSelected(saved.navigation.nextQuestion ?? 'V32-S08-Q04');
          if (
            v32Automation(evaluateV32(saved.draft.answers, saved.draft), saved.draft)
              .decisionStatus === 'confirmed'
          ) {
            setTab('summary');
          }
        } else {
          const raw = localStorage.getItem(V32_DRAFT_KEY);
          persisted.current = raw;
          if (raw) {
            const saved = v32DraftSchema.parse(JSON.parse(raw));
            setDraft(saved);
            setSelected(evaluateV32(saved.answers, saved).nextQuestion ?? 'V32-S08-Q04');
          }
        }
      } catch (e) {
        if (cancelled) return;
        setBlocked(true);
        setError(
          draftId
            ? (e as Error).message
            : 'Le brouillon local ne peut pas être lu. Il est conservé sans écrasement.',
        );
      }
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [draftId]);
  const save = useCallback(async () => {
    if (!loaded) return false;
    if (!dirty) return true;
    if (blocked) return false;
    if (saving.current) return false;
    saving.current = true;
    setBusy(true);
    try {
      if (draftId) {
        const saved = await serverRequest('/' + draftId, {
          revision,
          title,
          draft: v32DraftSchema.parse(draft),
        });
        setRevision(saved.revision);
        setDraft(saved.draft);
        setDirty(false);
        setError('');
        setMessage(`Dossier partagé enregistré — révision ${saved.revision}.`);
        return true;
      }
      const raw = localStorage.getItem(V32_DRAFT_KEY);
      if (raw !== persisted.current)
        throw new Error(
          'Le brouillon a changé dans un autre onglet. Exportez vos saisies avant de recharger ; aucun écrasement effectué.',
        );
      const valid = v32DraftSchema.parse(draft);
      const next = JSON.stringify(valid);
      localStorage.setItem(V32_DRAFT_KEY, next);
      persisted.current = next;
      setDirty(false);
      setError('');
      setMessage('Brouillon enregistré dans ce navigateur.');
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }, [draft, dirty, loaded, blocked, draftId, revision, title]);
  useEffect(() => {
    guard.register(save);
    return () => guard.register(null);
  }, [guard, save]);
  useEffect(() => {
    const fn = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', fn);
    return () => window.removeEventListener('beforeunload', fn);
  }, [dirty]);
  const result = evaluateV32(draft.answers, draft);
  const followup = evaluateV32Followup(draft.followupAnswers, draft.context);
  const q = catalogue.questions.find((q) => q.id === selected)!;
  const location = v32Location(selected)!;
  const section = v32Journey.stages
    .find((s) => s.number === location.stage)!
    .sections.find((s) => s.questionIds.includes(selected))!;
  const journeyRows = [
    ...result.questions.filter((r) => !r.id.startsWith('V32-S09')),
    ...followup.questions,
  ];
  const firstRelevant = (ids: string[]) =>
    ids.find((id) => id === result.nextQuestion || id === followup.nextQuestion) ??
    ids.find((id) =>
      journeyRows.some((r) => r.id === id && ['answered', 'unanswered'].includes(r.state)),
    ) ??
    ids[0];
  const rows = tab === 'followup' ? followup.questions : result.questions;
  const state = rows.find((r) => r.id === selected);
  const canAnswer =
    loaded &&
    !blocked &&
    !busy &&
    !state?.computed &&
    ['answered', 'unanswered'].includes(state?.state ?? '');
  const currentAnswers = q.stage === 9 ? draft.followupAnswers : draft.answers;
  function update(value: Partial<V32BrowserDraft>) {
    setDraft({ ...draft, ...value });
    setDirty(true);
    setMessage('');
  }
  async function open(id: string) {
    if (await save()) {
      setSelected(id);
      setTab(id.startsWith('V32-S09') ? 'followup' : 'journey');
    }
  }
  async function changeTab(next: Tab) {
    if (await save()) {
      if (next === 'followup') setSelected(followup.nextQuestion ?? 'V32-S09-Q01');
      if (next === 'journey' && selected.startsWith('V32-S09'))
        setSelected(result.nextQuestion ?? 'V32-S08-Q04');
      setTab(next);
    }
  }
  async function continueJourney() {
    if (!(await save())) return;
    const next = tab === 'followup' ? followup.nextQuestion : result.nextQuestion;
    if (next) {
      setSelected(next);
      setMessage(next === selected ? 'Cette question reste à renseigner.' : '');
    } else {
      setTab(tab === 'followup' ? 'followup' : 'summary');
      setMessage('Parcours en attente ou prêt pour examen de la synthèse.');
    }
  }
  function exportDraft() {
    const blob = new Blob([JSON.stringify(draft, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'evaluation-ia-brouillon.json';
    link.click();
    URL.revokeObjectURL(url);
  }
  const next = tab === 'followup' ? followup.nextQuestion : result.nextQuestion;
  const pending = [
    ...new Set([
      ...v32CaseIssues(
        result.pendingIssues,
        v32Automation(result, draft).decisionStatus === 'confirmed',
      ),
      ...(tab === 'followup' ? followup.pendingIssues : []),
    ]),
  ];
  const pendingPanel = (
    <aside className="v32-pending" role="status">
      <strong>
        {result.status === 'suspended'
          ? 'Parcours suspendu'
          : pending.length > 0 && pending.every((code) => ['A11', 'A18'].includes(code))
            ? 'Validation institutionnelle avant mise en service'
            : 'Clarification en attente'}
      </strong>
      {pending.map((code) => (
        <p key={code}>
          <b>{code}</b> — {v32Readable(v32OpenIssues.find((i) => i.id === code)?.description ?? '')}
        </p>
      ))}
      {!pending.length && result.status === 'suspended' && (
        <p>
          Les analyses ou avis écrits demandés doivent être reçus et vérifiés. Aucune reprise avant
          confirmation de l’UNIL.
        </p>
      )}
      <p>
        Aucune décision juridique ou autorisation de mise en service n’est produite par cette
        démonstration.
      </p>
    </aside>
  );
  function renderQuestion() {
    const display = presentation.questions.find((row) => row.id === q.id)!;
    const selectedLetter = state?.computed ? state.letter : currentAnswers[q.id];
    const selectedAnswer = display.answers.find((a) => a.letter === selectedLetter);
    const recommendations = v32VisibleRecommendations(q.id, selectedLetter);
    const active = state?.state === 'answered' || state?.state === 'unanswered';
    const selectedVerdict = state?.state === 'answered' ? state.effectiveVerdict : undefined;
    const selectedTone = selectedVerdict
      ? {
          POURSUIVRE: 'green',
          'SOUS CONDITION': 'orange',
          'NE PAS POURSUIVRE': 'red',
          ORIENTATION: 'blue',
        }[selectedVerdict]
      : undefined;
    const blocking = result.summary.find(
      (row) =>
        row.effectiveVerdict === 'NE PAS POURSUIVRE' && !row.questionId.startsWith('V32-S08'),
    );
    const blockingQuestion = blocking
      ? catalogue.questions.find((row) => row.id === blocking.questionId)
      : undefined;
    return (
      <section className="v32-question" aria-labelledby="v32-question-title">
        {state?.state === 'skipped' && (
          <div className="v32-notice" role="status">
            <strong>
              {blockingQuestion
                ? 'Une réponse précédente a arrêté l’évaluation.'
                : 'Cette question ne fait pas partie de votre parcours actuel.'}
            </strong>
            {blockingQuestion ? (
              <>
                <p>
                  Le questionnaire prévoit un arrêt après la réponse à l’étape{' '}
                  {v32LocationLabel(blockingQuestion.id)} (repère PDF {blockingQuestion.stage}.
                  {blockingQuestion.number}). Les questions suivantes restent consultables mais ne
                  peuvent pas être cochées.
                </p>
                <p>{blockingQuestion.stemText.split('\n')[0]}</p>
                <div className="v32-buttons">
                  <button disabled={busy} onClick={() => void open(blockingQuestion.id)}>
                    Revoir la réponse bloquante →
                  </button>
                  <button disabled={busy} onClick={() => void changeTab('summary')}>
                    Ouvrir la synthèse →
                  </button>
                </div>
                <p>
                  Si la réponse a été choisie par erreur, corrigez-la dans sa question. Sinon,
                  conservez-la et poursuivez vers la synthèse.
                </p>
              </>
            ) : (
              <>
                <p>{v32Readable(state.reason ?? '')}</p>
                {next && (
                  <button disabled={busy} onClick={() => void open(next)}>
                    Aller à la prochaine question active →
                  </button>
                )}
              </>
            )}
            <p>Une ancienne réponse reste conservée sans contribuer au résultat courant.</p>
          </div>
        )}
        {state?.state === 'not-reached' && (
          <div className="v32-notice">
            <strong>Cette question est un aperçu ; elle n’est pas encore à remplir.</strong>
            <p>Répondez d’abord à la question active du parcours.</p>
            {next && (
              <button disabled={busy} onClick={() => void open(next)}>
                Aller à la prochaine question active →
              </button>
            )}
          </div>
        )}
        <div className="v32-question-meta">
          {v32LocationLabel(q.id)} · repère PDF {q.stage}.{q.number} · page(s) {q.pages.join(', ')}{' '}
          {q.badge && <strong className="v32-badge">{q.badge}</strong>}
        </div>
        <h2 id="v32-question-title" className="v32-source">
          {(q.stemText.includes('\n•')
            ? q.stemText.slice(0, q.stemText.indexOf('\n•'))
            : q.stemText
          ).replace(/^\s*(?:(?:AI ACT|HAUT RISQUE|DONNÉES PERSONNELLES)\s*)?\d+\.\s*/u, '')}
        </h2>
        {q.stemText.includes('\n•') && (
          <div className="v32-source v32-question-body">
            {q.stemText.slice(q.stemText.indexOf('\n•') + 1)}
          </div>
        )}
        {[...display.choiceGuidance, ...display.rulesForChoosing].map((text, i) => (
          <div className="v32-choice-guidance v32-source" key={i}>
            {text}
          </div>
        ))}
        <fieldset disabled={!canAnswer}>
          <legend>{state?.computed ? 'Résultat calculé automatiquement' : 'Votre réponse'}</legend>
          {q.answers.map((a) => (
            <label
              key={a.letter}
              className={`v32-choice${selectedLetter === a.letter ? ` v32-choice-selected${selectedTone ? ` v32-choice-${selectedTone}` : ''}` : ''}`}
            >
              <input
                type="radio"
                name={q.id}
                value={a.letter}
                checked={(state?.computed ? state.letter : currentAnswers[q.id]) === a.letter}
                onChange={() =>
                  update(
                    q.stage === 9
                      ? { followupAnswers: { ...draft.followupAnswers, [q.id]: a.letter } }
                      : {
                          answers: { ...draft.answers, [q.id]: a.letter },
                          ...(draft.supplierEvidence?.[q.id]
                            ? {
                                supplierEvidence: {
                                  ...draft.supplierEvidence,
                                  [q.id]: { ...draft.supplierEvidence[q.id], verified: false },
                                },
                              }
                            : {}),
                        },
                  )
                }
              />
              <span>
                {v32Readable(display.answers.find((option) => option.letter === a.letter)!.label)}
              </span>
              {selectedLetter === a.letter && selectedVerdict && (
                <span className="v32-choice-status">{v32VerdictNames[selectedVerdict]}</span>
              )}
            </label>
          ))}
        </fieldset>
        {state?.computed && (
          <div className="v32-choice-guidance">
            <p>
              Calcul fondé sur les réponses du parcours et les confirmations de l’UNIL. Les
              anciennes réponses manuelles à 8.1–8.3 sont conservées mais ne commandent plus le
              résultat.
            </p>
            <button onClick={() => setTab('summary')}>Voir les vérifications de la synthèse</button>
          </div>
        )}
        {selectedAnswer && active && recommendations.length > 0 && (
          <section aria-label="Recommandations" className="v32-selected-info" aria-live="polite">
            <strong>Recommandations</strong>
            {recommendations.map((text, i) => (
              <p key={i} className="v32-source">
                {text}
              </p>
            ))}
          </section>
        )}
        <V32LegalBases questionId={q.id} />
        {display.generalNotes.length > 0 && (
          <details className="v32-stage-context">
            <summary>Explications</summary>
            {display.generalNotes.map((text, i) => (
              <p className="v32-source" key={i}>
                {text}
              </p>
            ))}
          </details>
        )}
        {q.stage >= 4 &&
          q.stage <= 7 &&
          (() => {
            const evidence = draft.supplierEvidence?.[q.id] ?? {
              reference: '',
              verified: false,
              checkedBy: '',
              date: '',
            };
            const edit = (patch: Partial<typeof evidence>) =>
              update({
                supplierEvidence: {
                  ...draft.supplierEvidence,
                  [q.id]: { ...evidence, ...patch, verified: false },
                },
              });
            return (
              <details className="v32-summary-item" aria-label="Informations du fournisseur">
                <summary>
                  Source et vérification UNIL — {evidence.verified ? 'vérifié' : 'à vérifier'}
                </summary>
                <p>
                  {evidence.verified
                    ? 'Écrit vérifié par l’UNIL'
                    : 'Déclaration / information du fournisseur — non vérifiée par l’UNIL'}
                </p>
                <fieldset disabled={!canAnswer}>
                  <label>
                    Référence de la réponse ou du justificatif fournisseur
                    <input
                      value={evidence.reference}
                      maxLength={2000}
                      onChange={(e) => edit({ reference: e.target.value })}
                    />
                  </label>
                  <label>
                    Nom et fonction de la personne UNIL ayant vérifié
                    <input
                      value={evidence.checkedBy}
                      maxLength={200}
                      onChange={(e) => edit({ checkedBy: e.target.value })}
                    />
                  </label>
                  <label>
                    Date de vérification du justificatif
                    <input
                      type="date"
                      value={evidence.date}
                      onChange={(e) => edit({ date: e.target.value })}
                    />
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={evidence.verified}
                      disabled={
                        !evidence.reference.trim() || !evidence.checkedBy.trim() || !evidence.date
                      }
                      onChange={(e) =>
                        update({
                          supplierEvidence: {
                            ...draft.supplierEvidence,
                            [q.id]: { ...evidence, verified: e.target.checked },
                          },
                        })
                      }
                    />
                    J’ai vérifié la réponse et le justificatif indiqué.
                  </label>
                </fieldset>
                <p>
                  Une déclaration ne vaut pas vérification. La référence ne téléverse pas le
                  document.
                </p>
              </details>
            );
          })()}
        <label htmlFor="v32-notes">
          Vos précisions — champ de travail, distinct du texte source
        </label>
        <textarea
          id="v32-notes"
          rows={3}
          maxLength={12000}
          disabled={!canAnswer}
          value={draft.notes[q.id] ?? ''}
          onChange={(e) =>
            update({
              notes: { ...draft.notes, [q.id]: e.target.value },
              ...(draft.supplierEvidence?.[q.id]
                ? {
                    supplierEvidence: {
                      ...draft.supplierEvidence,
                      [q.id]: { ...draft.supplierEvidence[q.id], verified: false },
                    },
                  }
                : {}),
            })
          }
        />
        <div className="v32-buttons">
          <button onClick={() => void save()} disabled={!dirty || !loaded}>
            Enregistrer
          </button>
          <button className="v32-primary" onClick={() => void continueJourney()} disabled={!loaded}>
            Enregistrer et continuer →
          </button>
        </div>
      </section>
    );
  }
  return (
    <V32Localized>
      <article className="v32-workspace" lang="fr">
        <header className="v32-hero">
          <span>ÉVALUATION D’UN OUTIL D’IA</span>
          <h1>
            {draftId && title ? (
              <span translate="no">{title}</span>
            ) : draftId ? (
              'Votre évaluation'
            ) : (
              'Brouillon individuel'
            )}
          </h1>
          <p>Répondez à la question proposée pour avancer dans le parcours.</p>
          <Link href="/projects">← Tous les projets</Link>
        </header>
        <details className="v32-dossier-details">
          <summary>Détails du dossier et options</summary>
          <aside className="v32-notice">
            {draftId ? (
              <>
                <b>Dossier partagé v3.2.</b> Enregistré sur le serveur de démonstration ; le même
                lien ouvre les mêmes réponses depuis un autre navigateur. L’UNIL renseigne toutes
                les sections et enregistre la décision. Les références de documents ne téléversent
                pas de pièces. Texte du PDF conservé en français.
              </>
            ) : (
              <>
                <b>Parcours de démonstration distinct.</b> Texte source conservé en français, y
                compris lorsque l’interface générale est en anglais. Le brouillon reste dans ce
                navigateur, sur cette adresse ; il n’est pas partagé avec l’équipe ni enregistré
                comme dossier serveur. Pièces et habilitations seront raccordées ensuite.
              </>
            )}
          </aside>
          {draftId ? (
            <label>
              Nom du dossier
              <input
                maxLength={160}
                value={title}
                disabled={!loaded || busy || blocked}
                onChange={(e) => {
                  setTitle(e.target.value);
                  setDirty(true);
                }}
              />
            </label>
          ) : (
            <form
              className="v32-context"
              onSubmit={async (e) => {
                e.preventDefault();
                if (!(await save())) return;
                setBusy(true);
                try {
                  const created = await serverRequest('', { title, draft });
                  router.push('/questionnaire-v32/' + created.id);
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <h2>Conserver ce brouillon comme dossier partagé</h2>
              <label>
                Nom du dossier
                <input
                  value={title}
                  minLength={3}
                  maxLength={160}
                  required
                  disabled={busy}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </label>
              <button disabled={!loaded || busy || blocked}>
                Créer le dossier partagé avec ces réponses
              </button>
              <p>Le brouillon local reste conservé. Le nouveau dossier reçoit son propre lien.</p>
            </form>
          )}
          <p>Checklist v3.2 · {draftId ? `Révision ${revision}` : 'Brouillon local'}</p>
          <button onClick={exportDraft} disabled={!loaded}>
            Exporter mes réponses JSON
          </button>
        </details>
        <div className="v32-toolbar">
          <span role="status">
            {!loaded
              ? 'Chargement…'
              : busy
                ? 'Enregistrement…'
                : dirty
                  ? 'Modifications non enregistrées'
                  : draftId
                    ? 'Enregistré sur le serveur'
                    : 'Brouillon local'}{' '}
            {message}
          </span>
        </div>
        {error && (
          <p className="v32-error" role="alert">
            {error}
          </p>
        )}
        <nav className="v32-tabs" aria-label="Vues du nouveau parcours">
          {(
            [
              ['journey', 'Parcours'],
              ['summary', 'Synthèse'],
              ['reports', 'Rapports'],
              ['followup', 'Exploitation et suivi'],
              ['reference', 'Document et références'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              aria-current={tab === key ? 'page' : undefined}
              onClick={() => void changeTab(key)}
            >
              {label}
            </button>
          ))}
        </nav>
        {(tab === 'journey' || tab === 'followup') && (
          <>
            {tab === 'followup' && (
              <section className="v32-context">
                <h2>Contexte du suivi — après signature</h2>
                <p>
                  Ces informations ouvrent uniquement l’essai du suivi ; elles ne constatent aucune
                  signature réelle.
                </p>
                <label>
                  <input
                    type="checkbox"
                    checked={draft.context.contractSigned}
                    disabled={busy || !loaded || blocked}
                    onChange={(e) =>
                      update({ context: { ...draft.context, contractSigned: e.target.checked } })
                    }
                  />{' '}
                  Contrat signé dans le scénario
                </label>
                <label>
                  Marché public dans le scénario
                  <select
                    value={
                      draft.context.publicProcurement === null
                        ? 'unknown'
                        : draft.context.publicProcurement
                          ? 'yes'
                          : 'no'
                    }
                    disabled={busy || !loaded || blocked}
                    onChange={(e) =>
                      update({
                        context: {
                          ...draft.context,
                          publicProcurement:
                            e.target.value === 'unknown' ? null : e.target.value === 'yes',
                        },
                      })
                    }
                  >
                    <option value="unknown">À clarifier</option>
                    <option value="yes">Oui</option>
                    <option value="no">Non</option>
                  </select>
                </label>
                <button
                  onClick={async () => {
                    if (await save()) {
                      setSelected(followup.nextQuestion ?? 'V32-S09-Q01');
                    }
                  }}
                >
                  Ouvrir la prochaine question du suivi
                </button>
              </section>
            )}
            {tab === 'journey' &&
              (pending.length > 0 || result.status === 'suspended') &&
              pendingPanel}
            {tab === 'followup' && followup.status === 'awaiting-signature' && (
              <p className="v32-notice">Le suivi s’ouvre après signature du contrat.</p>
            )}
            {tab === 'followup' && followup.pendingIssues.length > 0 && pendingPanel}
            {next && (
              <div className="v32-next">
                <strong>{v32LocationLabel(next)}</strong>
                <button onClick={() => void open(next)}>Reprendre le parcours →</button>
              </div>
            )}
            <div className="v32-layout">
              <nav className="v32-stages" aria-label="Six étapes du parcours">
                {v32Journey.stages.map((stage) => {
                  const ids = stage.sections.flatMap((s) => s.questionIds);
                  const count = journeyRows.filter(
                    (r) => ids.includes(r.id) && r.state === 'answered',
                  ).length;
                  return (
                    <button
                      key={stage.number}
                      className={location.stage === stage.number ? 'selected' : ''}
                      onClick={() => void open(firstRelevant(ids))}
                    >
                      <small>{stage.phase}</small>
                      <strong>
                        {stage.number}. {stage.title}
                      </strong>
                      <small>
                        {count}/{ids.length} réponses sur le parcours
                        {ids.some((id) => id.startsWith('V32-S09')) && (
                          <span> · suivi après signature</span>
                        )}
                      </small>
                    </button>
                  );
                })}
              </nav>
              <div>
                <label className="v32-section-selector">
                  Sous-section de l’étape
                  <select
                    aria-label="Sous-section de l’étape"
                    value={section.name}
                    onChange={(e) => {
                      const target = v32Journey.stages
                        .find((s) => s.number === location.stage)!
                        .sections.find((s) => s.name === e.target.value)!;
                      void open(firstRelevant(target.questionIds));
                    }}
                  >
                    {v32Journey.stages
                      .find((s) => s.number === location.stage)!
                      .sections.map((s) => (
                        <option key={s.name} value={s.name}>
                          {s.name}
                        </option>
                      ))}
                  </select>
                </label>
                <p className="v32-question-meta">
                  Les renvois cités dans les questions correspondent aux repères PDF d’origine.
                  {section.questionIds.every((id) => id.startsWith('V32-S09')) && (
                    <span>
                      {' '}
                      Cette sous-section reste renseignée après signature, sans validation implicite
                      avant ce jalon.
                    </span>
                  )}
                </p>
                <div className="v32-question-list" aria-label="Questions de cette étape">
                  {section.questionIds
                    .map((id) => catalogue.questions.find((q) => q.id === id)!)
                    .map((x) => (
                      <button
                        key={x.id}
                        aria-current={x.id === selected ? 'step' : undefined}
                        onClick={() => void open(x.id)}
                      >
                        {v32Location(x.id)!.position}
                        {journeyRows.find((r) => r.id === x.id)?.state === 'skipped'
                          ? ' · omise'
                          : ''}
                      </button>
                    ))}
                </div>
                {renderQuestion()}
              </div>
            </div>
          </>
        )}
        {tab === 'summary' && (
          <section className="v32-summary">
            <h2>Étape 6 — synthèse et décision</h2>
            <V32Conditions
              result={result}
              draft={draft}
              onChange={update}
              disabled={!loaded || busy || blocked}
              onOpen={(id) => void open(id)}
            >
              {result.verificationChecks.some(
                (check) =>
                  !v32Automation(result, draft).conditions.some(
                    (c) => c.questionId === check.questionId && c.state === 'resolved',
                  ),
              ) && <h3 id="v32-required-reviews">Avis et validations</h3>}
              {result.verificationChecks.map((check) => {
                const duplicate = v32Automation(result, draft).conditions.some(
                  (c) => c.questionId === check.questionId && c.state === 'resolved',
                );
                const CheckContainer = duplicate ? 'details' : 'section';
                const record = draft.verifications?.[check.id] ?? {
                  confirmed: false,
                  reference: '',
                  reviewer: '',
                  date: '',
                  basis: '',
                };
                const change = (patch: Partial<typeof record>) =>
                  update({
                    verifications: {
                      ...draft.verifications,
                      [check.id]: { ...record, ...patch, confirmed: false, basis: check.basis },
                    },
                  });
                return (
                  <CheckContainer
                    key={check.id}
                    className={
                      duplicate
                        ? 'v32-clean-edit'
                        : `v32-clean-check ${check.status === 'confirmed' ? 'v32-clean-complete' : 'v32-clean-outstanding'}`
                    }
                  >
                    {duplicate && <summary>{check.label} — Modifier la validation</summary>}
                    <h4>{check.label}</h4>
                    <p>
                      {record.reference} · {record.reviewer} · {record.date} ·{' '}
                      {check.status === 'confirmed'
                        ? 'Confirmé'
                        : check.status === 'stale'
                          ? 'À confirmer à nouveau : le dossier a changé'
                          : 'À confirmer'}
                    </p>
                    <details className="v32-clean-edit">
                      <summary>Preuves et modification de la validation</summary>
                      <fieldset disabled={busy || blocked || !loaded}>
                        <label>
                          Référence de l’écrit / justification
                          <input
                            value={record.reference}
                            maxLength={2000}
                            onChange={(e) => change({ reference: e.target.value })}
                          />
                        </label>
                        <label>
                          Nom et fonction de la personne ayant vérifié
                          <input
                            value={record.reviewer}
                            maxLength={200}
                            onChange={(e) => change({ reviewer: e.target.value })}
                          />
                        </label>
                        <label>
                          Date de vérification
                          <input
                            type="date"
                            value={record.date}
                            onChange={(e) => change({ date: e.target.value })}
                          />
                        </label>
                        <label>
                          <input
                            type="checkbox"
                            checked={check.status === 'confirmed'}
                            disabled={
                              !record.reference.trim() || !record.reviewer.trim() || !record.date
                            }
                            onChange={(e) =>
                              update({
                                verifications: {
                                  ...draft.verifications,
                                  [check.id]: {
                                    ...record,
                                    confirmed: e.target.checked,
                                    basis: check.basis,
                                  },
                                },
                              })
                            }
                          />{' '}
                          Je confirme avoir vérifié cet écrit et son contenu.
                        </label>
                      </fieldset>
                    </details>
                  </CheckContainer>
                );
              })}
            </V32Conditions>
            {(pending.length > 0 || result.status === 'suspended') && pendingPanel}
            <details className="v32-summary-item">
              <summary>Détail des contrôles du questionnaire</summary>
              <div className="v32-summary-statuses">
                {[1, 2, 3].map((number) => {
                  const id = `V32-S08-Q0${number}`;
                  const row = result.questions.find((r) => r.id === id);
                  const label = presentation.questions
                    .find((q) => q.id === id)
                    ?.answers.find((a) => a.letter === row?.letter)?.label;
                  return (
                    <section key={id} className="v32-summary-item">
                      <strong>
                        PDF 8.{number} —{' '}
                        {['Points bloquants', 'Analyses d’impact', 'Avis écrits'][number - 1]}
                      </strong>
                      <p>
                        {row?.state === 'skipped'
                          ? 'Non requis à ce stade : parcours arrêté'
                          : v32Readable(label ?? 'Calcul en attente du parcours')}
                      </p>
                    </section>
                  );
                })}
              </div>
            </details>
            <details className="v32-summary-item">
              <summary>Réponses à l’origine de la synthèse ({result.summary.length})</summary>
              <h3>Réponses et exigences à retenir ({result.summary.length})</h3>
              {result.summary.map((s) => (
                <section key={s.questionId} className="v32-summary-item">
                  <button onClick={() => void open(s.questionId)}>
                    {s.questionId} — revoir la réponse
                  </button>
                  <p>
                    <b>{v32VerdictNames[s.effectiveVerdict]}</b>
                    {s.effectiveVerdict !== s.sourceVerdict &&
                      ` (source : ${v32VerdictNames[s.sourceVerdict]} ; conversion selon le cadrage AI Act)`}
                  </p>
                  <p className="v32-source">
                    {
                      presentation.questions
                        .find((q) => q.id === s.questionId)
                        ?.answers.find((a) => a.letter === s.letter)?.label
                    }
                  </p>
                  {presentation.questions
                    .find((q) => q.id === s.questionId)
                    ?.answers.find((a) => a.letter === s.letter)
                    ?.recommendations.map((text, i) => (
                      <p key={i} className="v32-source">
                        {text}
                      </p>
                    ))}
                  {s.sourceNotes && (
                    <details>
                      <summary>Notes complètes du document source</summary>
                      <p className="v32-source">{s.sourceNotes}</p>
                    </details>
                  )}
                </section>
              ))}
              {!result.summary.length && (
                <p>
                  Aucun élément relevé à ce stade ; cela ne signifie pas que l’évaluation est
                  terminée.
                </p>
              )}
            </details>
            <button onClick={() => void save()} disabled={!dirty || !loaded || busy || blocked}>
              Enregistrer la synthèse
            </button>{' '}
            <button onClick={() => void open(result.nextQuestion ?? 'V32-S08-Q01')}>
              {result.nextQuestion === 'V32-S08-Q04'
                ? 'Passer à la décision 8.4'
                : 'Reprendre le parcours'}
            </button>
          </section>
        )}
        {tab === 'reports' && (
          <V32Reports
            draftId={draftId}
            revision={revision}
            dirty={dirty}
            disabled={!loaded || busy || blocked}
            onSave={save}
          />
        )}
        {tab === 'reference' && (
          <section className="v32-reference">
            <h2>Règles et références source</h2>
            <p>Source : {catalogue.source.filename} · 25 pages · 97 questions · 254 réponses.</p>
            <details>
              <summary>Légende et règles de navigation du document</summary>
              <p className="v32-source">{catalogue.navigationRulesSource}</p>
            </details>
            <details>
              <summary>Notes générales du document</summary>
              {catalogue.stages
                .filter((stage) => stage.preamble.length > 0)
                .map((stage) => (
                  <section key={stage.number}>
                    <h3>{stage.title}</h3>
                    <p className="v32-source">
                      {stage.preamble.map((line) => line.text).join('\n')}
                    </p>
                  </section>
                ))}
            </details>
            <h3>Politique d’évaluation</h3>
            <p>{v32DpfPolicy.fr}</p>
            <p>
              <Link href="/archives#reference-notes">
                Consulter les notes de référence archivées
              </Link>
            </p>
            {catalogue.annexes.map((p) => (
              <details key={p.page}>
                <summary>Annexes source — page {p.page}</summary>
                <p className="v32-source">{p.text}</p>
              </details>
            ))}
          </section>
        )}
      </article>
    </V32Localized>
  );
}
