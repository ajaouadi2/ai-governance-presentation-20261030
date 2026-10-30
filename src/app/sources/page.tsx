import { CONFIG_VERSION, RULE_SUMMARY, sources } from '@/config/assessment';
import originalQuestions from '@/config/source-questions.json';
import { Notice, Status } from '@/components/shared';
export default function Sources() {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1>Sources et méthode</h1>
        <p className="mt-2 text-muted-foreground">
          Des conclusions explicables, des références conservées et des limites visibles.
        </p>
      </div>
      <Notice title={`Référentiel ${CONFIG_VERSION}`}>
        {RULE_SUMMARY} Les contrôles détaillés sont une consolidation de prototype ; leur validation
        par le groupe est distincte de la consultation des sources.
      </Notice>
      <div className="panel table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>Référence</th>
              <th>Périmètre</th>
              <th>Vérification</th>
            </tr>
          </thead>
          <tbody>
            {sources.map((s) => (
              <tr key={s.id}>
                <td>
                  <h3>{s.title}</h3>
                  <p className="mt-2 text-xs text-muted-foreground">{s.articles}</p>
                  {s.url ? (
                    <a
                      className="link mt-3 inline-block"
                      href={s.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Consulter la source officielle ↗
                    </a>
                  ) : null}
                </td>
                <td>
                  {s.jurisdiction}
                  <p className="mt-2 text-sm text-muted-foreground">{s.note}</p>
                </td>
                <td>
                  <Status>{s.status}</Status>
                  <p className="mt-2 text-xs">
                    {s.verifiedAt
                      ? `Consultée le ${s.verifiedAt}`
                      : 'Vérification détaillée à compléter'}
                  </p>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <section className="panel p-6">
        <h2>Traçabilité des formulations d’origine</h2>
        <p className="mt-2 text-muted-foreground">
          Les formulations ci-dessous sont conservées telles que reproduites dans le dernier rapport
          transmis. Les éventuels passages abrégés ne remplacent pas les PDF originaux. Les
          conséquences de décision restent séparées des options sources.
        </p>
        <details className="mt-5">
          <summary className="cursor-pointer font-semibold">
            Consulter les {originalQuestions.length} entrées sources
          </summary>
          <div className="mt-4 flex flex-col gap-3">
            {originalQuestions.map((q, i) => (
              <div key={`${q.sourceId}-${i}`} className="border-t border-border py-3">
                <strong>{q.sourceId}</strong>
                <p>{q.sourceTextExact}</p>
                <p className="text-xs text-muted-foreground">{q.sourceOptionsExact.join(' · ')}</p>
              </div>
            ))}
          </div>
        </details>
      </section>
    </div>
  );
}
