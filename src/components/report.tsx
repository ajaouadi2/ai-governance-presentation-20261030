import { DataProtectionPlan } from './data-protection';
import { LegalScope } from './legal-scope';
import { moduleLabels, roleLabels, statusLabels, type ReportSnapshot } from '@/lib/domain';
import { dateLabel } from '@/lib/client';
import { RuleResults } from './rule-results';
export function ReportDocument({
  snapshot,
  version,
}: {
  snapshot: ReportSnapshot;
  version: number;
}) {
  const { case: c, assessment: a } = snapshot;
  return (
    <article className="print-report flex flex-col gap-2">
      <header className="border-b-2 border-primary pb-6">
        <p className="mb-5 text-2xl font-bold">Évaluation des outils d’IA</p>
        <h1>Rapport de due diligence</h1>
        <p className="mt-3 text-lg">{c.title}</p>
        <p className="mt-3 text-xs text-muted-foreground">
          Prototype académique · Données fictives · Version de rapport {version}
          <br />
          Dossier {c.id} · Généré le {dateLabel(snapshot.generatedAt)} · Référentiel{' '}
          {snapshot.configVersion}
        </p>
      </header>
      <section>
        <h2>1. Identification et besoin</h2>
        <dl className="grid grid-cols-2 gap-x-8 gap-y-3">
          {[
            ['Service', c.department],
            ['Responsable', c.owner],
            ['Fournisseur', c.vendor?.name || 'Non renseigné'],
            ['Produit', c.vendor?.product || c.title],
            ['Finalité', c.purpose],
            ['Évaluation', c.assessmentDate],
            ['Déploiement envisagé', c.deploymentDate],
            [
              'Soumissions',
              `Interne : ${c.internalSubmitted ? 'oui' : 'non'} ; fournisseur : ${c.vendorSubmitted ? 'oui' : 'non'}`,
            ],
          ].map(([k, v]) => (
            <div key={k}>
              <dt className="text-xs text-muted-foreground">{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-5 whitespace-pre-wrap">{c.description}</p>
      </section>
      <section className="panel p-5">
        <h2>2. Résumé exécutif</h2>
        <p className="text-xl font-bold text-primary">{a.outcome}</p>
        <p className="mt-3">
          Risque interne : <strong>{a.overallRisk}</strong>. Contrôles satisfaits ou justifiés :{' '}
          {a.completed} / {a.total}.
        </p>
        <p className="mt-2">{a.legalClassification}</p>
        {a.score !== null ? (
          <p className="mt-3">
            Score de l’offre : <strong>{a.score} / 100</strong>. Ce score n’est pas une
            certification juridique.
          </p>
        ) : (
          <p className="mt-3">Aucune notation comparative validée dans ce rapport.</p>
        )}
      </section>
      <section>
        <h2>3. Cartographie juridique</h2>
        <table className="data-table">
          <thead>
            <tr>
              <th>Régime / acteur</th>
              <th>Constat</th>
              <th>Motif / référence</th>
            </tr>
          </thead>
          <tbody>
            {a.laws.map((l) => (
              <tr key={l.regime + l.actor}>
                <td>
                  {l.regime}
                  <br />
                  {l.actor}
                </td>
                <td>{l.status}</td>
                <td>
                  {l.reason}
                  <br />
                  <small>Source : {l.source}</small>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section>
        <h2>4. Classification des risques</h2>
        {a.risks.map((r) => (
          <p className="mb-3" key={r.dimension}>
            <strong>
              {r.dimension} : {r.level}.
            </strong>{' '}
            {r.explanation}
          </p>
        ))}
        <p className="text-xs text-muted-foreground">{snapshot.ruleSummary}</p>
      </section>
      {Object.entries(moduleLabels).map(([module, label], index) => (
        <section key={module}>
          <h2>
            {index + 5}. {label}
          </h2>
          {a.controls.filter((x) => x.module === module).length ? (
            a.controls
              .filter((x) => x.module === module)
              .map((control) => (
                <div className="mb-5 border-l-2 border-border pl-4" key={control.id}>
                  <h3>
                    {control.id} · {control.title}
                  </h3>
                  <p className="mt-2">
                    <strong>
                      {control.stale
                        ? 'À revoir — données modifiées'
                        : statusLabels[control.status]}
                    </strong>{' '}
                    · {control.nature}
                  </p>
                  <p>{control.description}</p>
                  <p className="mt-2">Preuve attendue : {control.evidence}</p>
                  <p>
                    Documents joints :{' '}
                    {c.evidence
                      .filter((e) => e.controlId === control.id)
                      .map((e) => e.originalName)
                      .join(', ') || 'Aucun'}
                  </p>
                  {control.review ? (
                    <>
                      <p className="mt-2 whitespace-pre-wrap">{control.review.justification}</p>
                      {control.review.condition ? (
                        <p className="mt-2">
                          <strong>Mesure :</strong> {control.review.condition}
                        </p>
                      ) : null}
                      {control.review.blockingType ? (
                        <p>Nature du blocage : {control.review.blockingType}</p>
                      ) : null}
                      <p className="mt-2 text-xs text-muted-foreground">
                        Examiné par {control.review.reviewer}, le{' '}
                        {dateLabel(control.review.reviewedAt)}.
                      </p>
                    </>
                  ) : null}
                  <p className="text-xs text-muted-foreground">Référence : {control.source}</p>
                </div>
              ))
          ) : (
            <p>Aucun contrôle spécifique activé pour ce module.</p>
          )}
        </section>
      ))}
      <RuleResults results={a.ruleResults} />
      <LegalScope proposals={a.scopeProposals} />
      <DataProtectionPlan tasks={a.protectionTasks} />
      <section>
        <h2>9. Traçabilité des règles et actions</h2>
        {a.findings.map((f) => (
          <div className="mb-4" key={f.id}>
            <h3>
              {f.id} · {f.title}
            </h3>
            <p className="mt-1">{f.explanation}</p>
            <p>
              <strong>Action :</strong> {f.action}
            </p>
            <p className="text-xs text-muted-foreground">
              Déclencheur : {f.trigger} · Source {f.source}
            </p>
          </div>
        ))}
      </section>
      <section>
        <h2>10. Évaluation comparative</h2>
        {a.score !== null ? (
          <table className="data-table">
            <thead>
              <tr>
                <th>Critère</th>
                <th>Poids</th>
                <th>Note</th>
                <th>Justification</th>
              </tr>
            </thead>
            <tbody>
              {c.scores.map((s) => (
                <tr key={s.criterionId}>
                  <td>
                    {snapshot.scoringDefinitions.find((x) => x.id === s.criterionId)?.label ??
                      s.criterionId}
                  </td>
                  <td>{s.weight} %</td>
                  <td>{s.value} / 5</td>
                  <td>{s.justification}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>
            Notation indisponible ou non enregistrée. Les conditions préalables restent
            prioritaires.
          </p>
        )}
      </section>
      <section>
        <h2>11. Points à résoudre et conditions</h2>
        {a.blockingReasons.length ? (
          <div className="mb-4">
            <h3>Motifs bloquants</h3>
            <ul>
              {a.blockingReasons.map((reason, i) => (
                <li key={i}>{reason}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {a.remediations.length ? (
          <div className="mb-4">
            <h3>Corrections nécessaires</h3>
            <ul>
              {a.remediations.map((reason, i) => (
                <li key={i}>{reason}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {a.conditions.length ? (
          <div className="mb-4">
            <h3>Conditions enregistrées ou déduites du calendrier</h3>
            <ul>
              {a.conditions.map((condition, i) => (
                <li key={i}>{condition}</li>
              ))}
            </ul>
          </div>
        ) : null}
        <ul>
          {a.controls
            .filter((x) => !['satisfied', 'not_applicable'].includes(x.status))
            .map((x) => (
              <li key={x.id}>
                <strong>{x.title} :</strong> {statusLabels[x.status]}.{' '}
                {x.review?.condition ||
                  x.review?.justification ||
                  `Obtenir et examiner : ${x.evidence}.`}
              </li>
            ))}
        </ul>
        {a.controls.every((x) => ['satisfied', 'not_applicable'].includes(x.status)) &&
        !a.blockingReasons.length &&
        !a.remediations.length &&
        !a.conditions.length ? (
          <p>Aucun point ouvert dans les contrôles de cette version.</p>
        ) : null}
      </section>
      <section>
        <h2>12. Questions et réponses</h2>
        {snapshot.questions
          .filter((q) => c.answers[q.id] !== undefined)
          .map((q) => (
            <div className="mb-4" key={q.id}>
              <p>
                <strong>
                  {q.id} · {q.label}
                </strong>
              </p>
              <p className="whitespace-pre-wrap">
                {Array.isArray(c.answers[q.id])
                  ? (c.answers[q.id] as string[]).join(', ')
                  : String(c.answers[q.id])}
              </p>
            </div>
          ))}
      </section>
      <section>
        <h2>13. Sources, version et conclusion</h2>
        {snapshot.sources.map((s) => (
          <div className="mb-4" key={s.id}>
            <p>
              <strong>
                {s.id} · {s.title}
              </strong>{' '}
              — {s.articles}
            </p>
            <p className="text-xs">
              {s.status} ·{' '}
              {s.verifiedAt ? `Consultée le ${s.verifiedAt}` : 'Vérification détaillée à compléter'}
            </p>
            <p className="text-xs">{s.note}</p>
            {s.url ? (
              <p className="report-url">
                <a href={s.url}>{s.url}</a>
              </p>
            ) : null}
          </div>
        ))}
        <p className="mt-5">
          <strong>Conclusion proposée : {a.outcome}.</strong>
        </p>
        <p className="mt-3">
          Version conservée avec les réponses, les examens et le référentiel utilisés. Générée par
          le rôle{' '}
          {roleLabels[snapshot.generatedBy as keyof typeof roleLabels] ?? snapshot.generatedBy}.
        </p>
      </section>
      <footer className="border-t border-border pt-5 text-xs text-muted-foreground">
        {snapshot.disclaimer}
      </footer>
    </article>
  );
}
