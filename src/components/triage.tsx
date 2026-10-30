import { DataProtectionPlan } from './data-protection';
import { LegalScope } from './legal-scope';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { RULE_SUMMARY } from '@/config/assessment';
import type { Assessment, CaseView } from '@/lib/domain';
import { moduleLabels } from '@/lib/domain';
import { Notice, SourceLink, Status } from './shared';
import { RuleResults } from './rule-results';
export function Triage({ c, a }: { c: CaseView; a: Assessment }) {
  return (
    <div className="flex flex-col gap-6">
      {a.blockingReasons.length ? (
        <Notice title="Motifs bloquants confirmés" error>
          <ul>
            {a.blockingReasons.map((reason, i) => (
              <li key={i}>{reason}</li>
            ))}
          </ul>
        </Notice>
      ) : null}
      {!c.internalSubmitted ? (
        <Notice title="Prétriage provisoire">
          Complétez puis soumettez le questionnaire interne. Les résultats ci-dessous reflètent les
          réponses disponibles.
        </Notice>
      ) : null}
      <div className="panel p-6">
        <h2>Résultat du prétriage</h2>
        <p className="mt-2 text-muted-foreground">
          Les signaux internes et la qualification juridique sont présentés séparément.
        </p>
        <div className="mt-7 grid gap-6 lg:grid-cols-2">
          <div className="border-l-3 border-primary pl-5">
            <p className="text-xs text-muted-foreground">RISQUE INTERNE</p>
            <p className="mt-2 text-2xl font-bold">{a.overallRisk}</p>
            <p className="mt-2 text-sm text-muted-foreground">Priorisation interne du prototype.</p>
          </div>
          <div className="border-l-3 border-border pl-5">
            <p className="text-xs text-muted-foreground">QUALIFICATION JURIDIQUE</p>
            <p className="mt-2 font-semibold">{a.legalClassification}</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Un niveau élevé n’est pas un rejet automatique.
            </p>
          </div>
        </div>
        <div className="mt-7 grid gap-4 md:grid-cols-3">
          {a.risks.map((r) => (
            <div key={r.dimension} className="rounded-lg bg-muted p-4">
              <h3>{r.dimension}</h3>
              <div className="my-3">
                <Status>{r.level}</Status>
              </div>
              <p className="text-xs text-muted-foreground">{r.explanation}</p>
            </div>
          ))}
        </div>
        <details className="mt-5 text-xs text-muted-foreground">
          <summary className="cursor-pointer">Méthode de priorisation</summary>
          <p className="mt-2">{RULE_SUMMARY}</p>
        </details>
      </div>
      <RuleResults results={a.ruleResults} />
      <LegalScope proposals={a.scopeProposals} />
      <DataProtectionPlan tasks={a.protectionTasks} caseId={c.id} />
      <div className="panel table-scroll">
        <h2 className="p-6">Cartographie juridique</h2>
        <table className="data-table">
          <thead>
            <tr>
              <th>Régime / acteur</th>
              <th>État du test</th>
              <th>Motif</th>
              <th>Source</th>
            </tr>
          </thead>
          <tbody>
            {a.laws.map((l) => (
              <tr key={l.regime + l.actor}>
                <td>
                  <strong>{l.regime}</strong>
                  <p className="text-xs text-muted-foreground">{l.actor}</p>
                </td>
                <td>{l.status}</td>
                <td className="max-w-sm text-sm text-muted-foreground">{l.reason}</td>
                <td>
                  <SourceLink id={l.source} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="panel">
        <h2 className="border-b border-border p-6">Signaux et actions à entreprendre</h2>
        {a.findings.map((f) => (
          <div key={f.id} className="flex gap-4 border-b border-border p-6 last:border-0">
            {f.critical ? (
              <AlertTriangle className="shrink-0 text-destructive" size={21} />
            ) : (
              <CheckCircle2 className="shrink-0 text-primary" size={21} />
            )}
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h3>{f.title}</h3>
                <Status>{moduleLabels[f.module]}</Status>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{f.explanation}</p>
              <p className="mt-3 text-sm">
                <strong>Action :</strong> {f.action}
              </p>
              <p className="my-2 text-xs text-muted-foreground">
                {f.id} · Déclencheur : {f.trigger}
              </p>
              <SourceLink id={f.source} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
