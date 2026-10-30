'use client';
import { useCallback, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, Check, FileText } from 'lucide-react';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import { Notice, Status } from './shared';
import { Questionnaire, type CasePayload } from './questionnaire';
import { CaseForm } from './case-form';
import { Triage } from './triage';
import { Reviews } from './reviews';
import { EvidenceList } from './evidence';
import { Scoring } from './scoring';
import { controls } from '@/config/assessment';
import { api, dateLabel } from '@/lib/client';
import type { Role } from '@/lib/domain';
import { cn } from '@/lib/utils';
import { useDraftGuard } from './draft-guard';
const stages = [
  { id: 'need', label: 'Besoin' },
  { id: 'triage', label: 'Triage' },
  { id: 'vendor', label: 'Fournisseur' },
  { id: 'reviews', label: 'Contrôles' },
  { id: 'scoring', label: 'Évaluation' },
  { id: 'report', label: 'Rapport' },
];
export function Workspace({
  initial,
  role,
  stage,
}: {
  initial: CasePayload;
  role: Role;
  stage: string;
}) {
  const [data, setData] = useState(initial);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [edit, setEdit] = useState(false);
  const [questionnaireEpoch, setQuestionnaireEpoch] = useState(0);
  const draftGuard = useDraftGuard();
  const router = useRouter();
  const flush = useRef<(() => Promise<boolean>) | null>(null);
  const registerFlush = useCallback(
    (fn: (() => Promise<boolean>) | null) => {
      flush.current = fn;
      draftGuard.register(fn);
    },
    [draftGuard],
  );
  const c = data.case;
  const a = data.assessment;
  async function navigate(next: string) {
    if (flush.current && !(await flush.current())) return;
    router.push(`/cases/${c.id}/${next}`);
  }
  async function refresh() {
    setData(await api<CasePayload>(`/api/cases/${c.id}`));
    setQuestionnaireEpoch((x) => x + 1);
    setEdit(false);
  }
  async function createReport() {
    setBusy(true);
    setError('');
    try {
      const result = await api<{ id: string }>(`/api/cases/${c.id}/reports`, {
        method: 'POST',
        body: JSON.stringify({ revision: c.revision }),
      });
      router.push(`/reports/${result.id}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function updateConfig() {
    setBusy(true);
    setError('');
    try {
      setData(await api<CasePayload>(`/api/cases/${c.id}/config`, { method: 'POST', body: '{}' }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const completion = [
    c.internalSubmitted,
    c.internalSubmitted,
    c.vendorSubmitted,
    !!a && a.completed === a.total && !a.ruleResults?.some((r) => r.preventsScoring),
    !!a && a.score !== null,
    c.reports.length > 0,
  ];
  const next = !c.internalSubmitted
    ? 'need'
    : !c.vendorSubmitted
      ? 'vendor'
      : a && !a.scoringEligible
        ? 'reviews'
        : a?.score === null
          ? 'scoring'
          : 'report';
  return (
    <div className="flex flex-col gap-7">
      <div>
        <Link className="text-xs text-muted-foreground hover:text-primary" href="/dashboard">
          Dossiers / {c.id.slice(-8).toUpperCase()}
        </Link>
        <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1>{c.title}</h1>
            <p className="mt-2 text-muted-foreground">
              {c.purpose}
              {c.department ? ` · ${c.department}` : ''} · Mise en service : {c.deploymentDate}
            </p>
          </div>
          {a ? <Status>{a.outcome}</Status> : <Status>Espace fournisseur</Status>}
        </div>
      </div>
      {a?.configStale ? (
        <Notice title="Le référentiel a évolué">
          Les rapports historiques sont préservés. Actualisez ce dossier puis soumettez à nouveau
          les questionnaires et les examens.
          {role === 'evaluator' ? (
            <Button className="mt-3" disabled={busy} onClick={updateConfig}>
              Appliquer le référentiel courant
            </Button>
          ) : null}
        </Notice>
      ) : null}
      {error ? (
        <Notice title="Action impossible" error>
          {error}
        </Notice>
      ) : null}
      <nav
        className="no-print grid grid-cols-3 gap-2 border-b border-border pb-5 lg:grid-cols-6"
        aria-label="Étapes du dossier"
      >
        {stages.map((s, i) => (
          <button
            key={s.id}
            disabled={role === 'supplier' && s.id !== 'vendor'}
            aria-current={stage === s.id ? 'step' : undefined}
            className={cn(
              'flex items-center gap-2 rounded-lg px-2 py-3 text-left text-sm transition-colors disabled:opacity-35',
              stage === s.id ? 'bg-accent font-semibold text-primary' : 'hover:bg-muted',
            )}
            onClick={() => navigate(s.id)}
          >
            <span
              className={cn(
                'flex size-7 shrink-0 items-center justify-center rounded-full border text-xs',
                stage === s.id ? 'border-primary bg-primary text-white' : 'border-border',
              )}
            >
              {completion[i] ? <Check size={13} /> : i + 1}
            </span>
            {s.label}
          </button>
        ))}
      </nav>
      <div className="grid items-start gap-7 xl:grid-cols-[minmax(0,1fr)_270px]">
        <div className="min-w-0">
          {stage === 'need' ? (
            <div className="flex flex-col gap-6">
              <div className="flex flex-wrap justify-between gap-3">
                <p className="text-sm text-muted-foreground">
                  Évaluation du {c.assessmentDate} · Responsable : {c.owner}
                </p>
                {role !== 'supplier' ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      if (!flush.current || (await flush.current())) setEdit(!edit);
                    }}
                  >
                    {edit ? 'Fermer' : 'Modifier l’identification'}
                  </Button>
                ) : null}
              </div>
              {edit ? <CaseForm existing={c} onSaved={refresh} /> : null}
              <Questionnaire
                key={c.id + 'internal' + questionnaireEpoch}
                c={c}
                audience="internal"
                readOnly={role === 'supplier'}
                onSaved={setData}
                vendorQuestionIds={data.vendorQuestionIds}
                registerFlush={registerFlush}
              />
              {c.internalSubmitted ? (
                <Button onClick={() => navigate('triage')}>
                  Voir le prétriage
                  <ArrowRight data-icon="inline-end" />
                </Button>
              ) : null}
            </div>
          ) : null}
          {stage === 'triage' && a ? <Triage c={c} a={a} /> : null}
          {stage === 'vendor' ? (
            <div className="flex flex-col gap-7">
              <Questionnaire
                key={c.id + 'vendor'}
                c={c}
                audience="vendor"
                readOnly={role === 'requester'}
                onSaved={setData}
                vendorQuestionIds={data.vendorQuestionIds}
                registerFlush={registerFlush}
              />
              <section className="panel p-6">
                <h2 className="mb-3">Justificatifs du fournisseur</h2>
                <p className="mb-6 text-muted-foreground">
                  Joignez les documents fictifs aux contrôles correspondants. Un document ajouté ne
                  constitue pas une validation.
                </p>
                {controls
                  .filter((x) => data.vendorControlIds.includes(x.id))
                  .map((control) => (
                    <details className="border-t border-border py-5" key={control.id}>
                      <summary className="cursor-pointer font-semibold">
                        {control.id} · {control.title}{' '}
                        <span className="text-xs font-normal text-muted-foreground">
                          ({c.evidence.filter((e) => e.controlId === control.id).length}{' '}
                          document(s))
                        </span>
                      </summary>
                      <div className="mt-5">
                        <EvidenceList
                          c={c}
                          control={control}
                          editable={role !== 'requester'}
                          onSaved={setData}
                        />
                      </div>
                    </details>
                  ))}
              </section>
            </div>
          ) : null}
          {stage === 'reviews' && a ? <Reviews c={c} a={a} role={role} onSaved={setData} /> : null}
          {stage === 'scoring' && a ? (
            <Scoring key={c.id + c.revision} c={c} a={a} role={role} onSaved={setData} />
          ) : null}
          {stage === 'report' && a ? (
            <div className="flex flex-col gap-6">
              <section className="panel p-7">
                <FileText className="mb-5 text-primary" size={28} />
                <h2>Conserver une version du rapport</h2>
                <p className="mt-3 text-muted-foreground">
                  La version inclut les réponses, les contrôles, les pièces référencées, les sources
                  et la conclusion actuelle. Un dossier incomplet peut être documenté comme tel.
                </p>
                <div className="my-6 flex flex-wrap gap-3">
                  <Status>{a.outcome}</Status>
                  <Status>
                    {a.completed} / {a.total} contrôles
                  </Status>
                  {a.score !== null ? <Status>{a.score} / 100</Status> : null}
                </div>
                <Button disabled={busy} onClick={createReport}>
                  {busy ? 'Génération…' : 'Générer le rapport'}
                </Button>
              </section>
              <section className="panel p-7">
                <h2>Versions conservées</h2>
                {c.reports.length ? (
                  <ul className="mt-5 flex flex-col gap-3">
                    {c.reports.map((r) => (
                      <li
                        key={r.id}
                        className="flex flex-wrap justify-between gap-3 border-t border-border pt-4"
                      >
                        <Link href={`/reports/${r.id}`} className="link">
                          Rapport v{r.version}
                        </Link>
                        <span className="text-xs text-muted-foreground">
                          {dateLabel(r.createdAt)}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-4 text-muted-foreground">
                    Aucun rapport généré pour ce dossier.
                  </p>
                )}
              </section>
              <details className="panel p-6">
                <summary className="cursor-pointer font-semibold">Historique des actions</summary>
                <ol className="mt-5 flex flex-col gap-4">
                  {c.events.map((e) => (
                    <li key={e.id}>
                      <p className="font-semibold">{e.action}</p>
                      <p className="text-xs text-muted-foreground">
                        {e.actor} · {dateLabel(e.createdAt)}
                      </p>
                      <details>
                        <summary className="cursor-pointer text-xs text-primary">
                          Détails enregistrés
                        </summary>
                        <pre className="mt-2 overflow-auto text-xs">
                          {JSON.stringify(e.detail, null, 2)}
                        </pre>
                      </details>
                    </li>
                  ))}
                </ol>
              </details>
            </div>
          ) : null}
        </div>
        <aside className="no-print panel flex flex-col gap-6 p-5">
          <div>
            <h3>Avancement du dossier</h3>
            <p className="mt-3 text-xs text-muted-foreground">
              Les soumissions et les examens restent distincts.
            </p>
          </div>
          <ol className="flex flex-col gap-4">
            {stages.map((s, i) => (
              <li key={s.id} className="flex items-center gap-3">
                <span
                  className={cn(
                    'flex size-6 shrink-0 items-center justify-center rounded-full border',
                    completion[i] ? 'border-primary bg-primary text-white' : 'border-border',
                  )}
                >
                  {completion[i] ? <Check size={12} /> : <span className="text-xs">{i + 1}</span>}
                </span>
                <div>
                  <p className="font-semibold">{s.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {completion[i] ? 'Renseigné / enregistré' : 'À compléter'}
                  </p>
                </div>
              </li>
            ))}
          </ol>
          {a ? (
            <>
              <div className="border-t border-border pt-5">
                <p className="mb-3 text-xs text-muted-foreground">
                  Contrôles validés : {a.completed} / {a.total}
                </p>
                <Progress value={a.total ? (a.completed / a.total) * 100 : 0} />
              </div>
              <Button disabled={busy} onClick={() => navigate(next)}>
                Continuer
                <ArrowRight data-icon="inline-end" />
              </Button>
            </>
          ) : null}
          <p className="text-xs text-muted-foreground">
            Dernière mise à jour
            <br />
            {dateLabel(c.updatedAt)}
          </p>
        </aside>
      </div>
    </div>
  );
}
