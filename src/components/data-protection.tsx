import type { ProtectionTask } from '@/lib/data-protection';
import { Status, SourceLink } from './shared';
import { statusLabels } from '@/lib/domain';

export function DataProtectionPlan({
  tasks,
  caseId,
}: {
  tasks?: ProtectionTask[];
  caseId?: string;
}) {
  if (!tasks) return null;
  const active = tasks.filter((t) => t.status !== 'not_applicable');
  return (
    <section className="panel p-6">
      <h2>Plan de protection des données</h2>
      <p className="my-3 text-sm text-muted-foreground">
        Réponses existantes → demandes adaptées → preuves → examen. {active.length} volet(s) à
        examiner, {tasks.filter((t) => t.preventsScoring).length} préalable(s) non résolu(s). Cette
        liste prépare les obligations selon les régimes et rôles ; elle ne les certifie pas.
      </p>
      <details className="mb-4 text-sm">
        <summary className="cursor-pointer">Régimes et acteurs retenus</summary>
        <ul className="mt-2 space-y-2">
          {tasks[0]?.regimes.map((r) => (
            <li key={r.actor + r.regime}>
              <strong>
                {r.regime} · {r.actor}
              </strong>{' '}
              : {r.status}
            </li>
          ))}
        </ul>
      </details>
      <div className="grid gap-3 lg:grid-cols-2">
        {tasks.map((t) => (
          <details key={t.id} className="rounded-lg border border-border p-4">
            <summary className="cursor-pointer">
              <strong>{t.title}</strong>
              <br />
              <Status>{statusLabels[t.status]}</Status>
            </summary>
            <p className="my-3 text-sm">{t.reason}</p>
            <p className="my-3 text-sm">{t.action}</p>
            {t.reviewCondition ? (
              <p className="my-3 text-sm">
                <strong>Condition :</strong> {t.reviewCondition}
              </p>
            ) : null}
            <p className="my-3 text-sm">
              <strong>À fournir :</strong> {t.evidence} · {t.evidenceCount} pièce(s) déposée(s).
            </p>
            <p className="my-3 text-sm">
              <strong>Responsabilités :</strong> {t.owner}
            </p>
            <ul className="my-3 space-y-2 text-xs">
              {t.facts.map((f) => (
                <li key={f.id}>
                  <a className="link" href={`/checklist#q-${f.id}`}>
                    {f.id}
                  </a>{' '}
                  :{' '}
                  {f.value === null
                    ? 'Inconnu'
                    : Array.isArray(f.value)
                      ? f.value.join(' ; ')
                      : String(f.value)}
                </li>
              ))}
            </ul>
            {caseId ? (
              <p className="my-3 text-sm">
                <a
                  className="link"
                  href={`/cases/${caseId}/reviews?control=${t.control}#review-detail`}
                >
                  Examiner {t.control}
                </a>
              </p>
            ) : (
              <p className="my-3 text-sm">Contrôle : {t.control}</p>
            )}
            <SourceLink id={t.source} />
          </details>
        ))}
      </div>
    </section>
  );
}
