'use client';
import { useState } from 'react';
import { scoringCriteria } from '@/config/assessment';
import type { Assessment, CaseView, Role, ScoreView } from '@/lib/domain';
import { api } from '@/lib/client';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Notice, Status } from './shared';
import type { CasePayload } from './questionnaire';
import { RuleResults } from './rule-results';
export function Scoring({
  c,
  a,
  role,
  onSaved,
}: {
  c: CaseView;
  a: Assessment;
  role: Role;
  onSaved: (p: CasePayload) => void;
}) {
  const [rows, setRows] = useState<ScoreView[]>(
    scoringCriteria.map(
      (x) =>
        c.scores.find((s) => s.criterionId === x.id) ?? {
          criterionId: x.id,
          weight: x.weight,
          value: 0,
          justification: '',
        },
    ),
  );
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const total = rows.reduce((n, x) => n + x.weight, 0);
  const score = rows.reduce((n, x) => n + (x.value / 5) * x.weight, 0);
  const editable = role === 'evaluator' && a.scoringEligible;
  function update(id: string, key: keyof ScoreView, value: string | number) {
    setRows((r) => r.map((x) => (x.criterionId === id ? { ...x, [key]: value } : x)));
  }
  async function save() {
    setBusy(true);
    setError('');
    try {
      onSaved(
        await api<CasePayload>(`/api/cases/${c.id}/scores`, {
          method: 'PUT',
          body: JSON.stringify({ scores: rows, revision: c.revision }),
        }),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="flex flex-col gap-6">
      <div className="panel p-6">
        <div className="flex flex-wrap justify-between gap-4">
          <div>
            <h2>Évaluation des offres</h2>
            <p className="mt-2 text-muted-foreground">
              L’admissibilité précède la notation comparative.
            </p>
          </div>
          <Status>{a.outcome}</Status>
        </div>
      </div>
      {!a.scoringEligible ? (
        <Notice title="Notation non disponible">
          Soumettez les deux questionnaires et résolvez les contrôles préalables. Un bon score ne
          peut pas neutraliser un blocage confirmé.
        </Notice>
      ) : (
        <Notice title="Conditions préalables validées">
          La notation compare la qualité de l’offre. Les pondérations proposées sont celles du
          projet, sans valeur de règle légale universelle.
        </Notice>
      )}
      <RuleResults results={a.ruleResults?.filter((r) => r.preventsScoring)} />
      {error ? (
        <Notice title="Notation non enregistrée" error>
          {error}
        </Notice>
      ) : null}
      <div className="panel table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>Critère</th>
              <th>Pondération (%)</th>
              <th>Note / 5</th>
              <th>Points</th>
              <th>Justification *</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.criterionId}>
                <td className="min-w-[170px]">
                  <strong>{scoringCriteria.find((x) => x.id === row.criterionId)?.label}</strong>
                </td>
                <td>
                  <Input
                    aria-label={`Pondération ${row.criterionId}`}
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={row.weight}
                    disabled={!editable}
                    onChange={(e) => update(row.criterionId, 'weight', Number(e.target.value))}
                  />
                </td>
                <td>
                  <Input
                    aria-label={`Note ${row.criterionId}`}
                    type="number"
                    min="0"
                    max="5"
                    step="0.5"
                    value={row.value}
                    disabled={!editable}
                    onChange={(e) => update(row.criterionId, 'value', Number(e.target.value))}
                  />
                </td>
                <td>{((row.value / 5) * row.weight).toFixed(1)}</td>
                <td className="min-w-[240px]">
                  <Textarea
                    aria-label={`Justification ${row.criterionId}`}
                    value={row.justification}
                    disabled={!editable}
                    maxLength={3000}
                    onChange={(e) => update(row.criterionId, 'justification', e.target.value)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="panel flex flex-wrap items-center justify-between gap-5 p-6">
        <div>
          <p className="text-sm">
            Pondérations : <strong>{total.toFixed(1)} %</strong>
          </p>
          <p className="text-xs text-muted-foreground">
            Total attendu : 100 %. Note / 5 × pondération.
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">
            {a.score !== null ? 'Score enregistré' : 'Aperçu non enregistré'}
          </p>
          <p className="text-3xl font-bold">
            {a.scoringEligible ? score.toFixed(1) : '—'}
            <span className="text-base font-normal text-muted-foreground"> / 100</span>
          </p>
        </div>
      </div>
      {editable ? (
        <Button
          disabled={
            busy ||
            Math.abs(total - 100) > 0.001 ||
            rows.some((r) => r.justification.trim().length < 10)
          }
          onClick={save}
        >
          {busy ? 'Enregistrement…' : 'Enregistrer la notation'}
        </Button>
      ) : null}
    </div>
  );
}
