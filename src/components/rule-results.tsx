import type { RuleResult, RuleState } from '@/lib/objective-rules';

const labels: Record<RuleState, string> = {
  calculated: 'Calcul effectué',
  not_applicable: 'Non activé',
  unknown: 'À compléter',
  conflict: 'Réponses à réconcilier',
  correction: 'Correction préalable',
};

export function RuleResults({ results }: { results: RuleResult[] | undefined }) {
  if (!results?.length) return null;
  const pending = results.filter((r) => r.preventsScoring).length;
  return (
    <section className="panel p-6">
      <h2>Vérifications automatiques</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        {pending
          ? `${pending} vérification(s) à résoudre avant la notation.`
          : 'Les vérifications objectives sont terminées.'}{' '}
        Un calcul ou une déclaration complète ne valide pas les preuves ni les conclusions
        juridiques.
      </p>
      <div className="mt-5 flex flex-col gap-4">
        {results
          .filter((r) => r.state !== 'not_applicable')
          .map((r) => (
            <div key={r.id} className="border-l-2 border-border pl-4">
              <h3>{r.title}</h3>
              <p className="mt-1 text-sm font-medium">{labels[r.state]}</p>
              <p className="mt-1 text-sm">{r.explanation}</p>
              {r.action ? (
                <p className="mt-2 whitespace-pre-line text-sm">
                  <strong>Action : </strong>
                  {r.action}
                </p>
              ) : null}
              <details className="mt-2 text-xs text-muted-foreground">
                <summary className="cursor-pointer">Faits et traçabilité</summary>
                <p>
                  {r.id} · version {r.version} · règle de{' '}
                  {r.nature === 'calculation' ? 'calcul' : 'parcours'} · {r.source}
                </p>
                <ul className="mt-2">
                  {Object.entries(r.facts).map(([id, f]) => (
                    <li key={id}>
                      {id} :{' '}
                      {f.state === 'known'
                        ? String(f.value)
                        : f.state === 'conflict'
                          ? 'contradictoire'
                          : 'inconnu'}{' '}
                      · {f.origins.join(', ')}
                    </li>
                  ))}
                </ul>
              </details>
            </div>
          ))}
      </div>
    </section>
  );
}
