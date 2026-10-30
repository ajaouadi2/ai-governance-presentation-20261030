import type { ScopeProposal } from '@/lib/legal-scope';
import { scopeStateLabels } from '@/lib/legal-scope';
import { SourceLink } from './shared';

export function LegalScope({ proposals }: { proposals?: ScopeProposal[] }) {
  if (!proposals) return null; // Older immutable reports have no structured scope map.
  return (
    <section className="panel p-6">
      <h2>Applicabilité proposée — par acteur et activité</h2>
      <p className="my-3 text-sm text-muted-foreground">
        Déclarations structurées → test de champ → proposition → confirmation motivée T02. Aucune
        conclusion n’est validée par ce calcul seul. Chaque acteur répond pour son propre
        traitement, journaux compris.
      </p>
      <div className="grid gap-3 lg:grid-cols-2">
        {proposals.map((p) => (
          <details key={p.key} className="rounded-lg border border-border p-4">
            <summary className="cursor-pointer">
              <strong>
                {p.regime} · {p.actor}
              </strong>
              <br />
              {scopeStateLabels[p.state]}
            </summary>
            <p className="my-3 text-sm">{p.reason}</p>
            <p className="my-3 text-sm text-muted-foreground">{p.logic}</p>
            <ol className="list-decimal space-y-3 pl-5 text-sm">
              {p.facts.map((f) => (
                <li key={f.id}>
                  <a className="link" href={`/checklist#q-${f.id}`}>
                    {f.id}
                  </a>{' '}
                  · {f.label}
                  <br />
                  <strong>
                    {f.value === null
                      ? 'Inconnu — à renseigner'
                      : Array.isArray(f.value)
                        ? f.value.join(' ; ')
                        : String(f.value)}
                  </strong>
                </li>
              ))}
            </ol>
            <div className="mt-3">
              <SourceLink id={p.source} />
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}
