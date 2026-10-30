'use client';
import { DataProtectionPlan } from './data-protection';
import { useSearchParams } from 'next/navigation';
import { evaluateLegalScope } from '@/lib/legal-scope';
import { LegalScope } from './legal-scope';
import { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Field, FieldGroup, FieldLabel } from './ui/field';
import { EvidenceList } from './evidence';
import { Notice, SourceLink, Status } from './shared';
import { api, dateLabel } from '@/lib/client';
import {
  moduleLabels,
  reviewStatuses,
  statusLabels,
  type AssessedControl,
  type Assessment,
  type CaseView,
  type Module,
  type Role,
} from '@/lib/domain';
import type { CasePayload } from './questionnaire';
import { RuleResults } from './rule-results';
export function Reviews({
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
  const [module, setModule] = useState('all');
  const [status, setStatus] = useState('all');
  const params = useSearchParams();
  const [selected, setSelected] = useState<string | null>(params.get('control'));
  const control = a.controls.find((x) => x.id === selected);
  const list = a.controls.filter(
    (x) => (module === 'all' || module === x.module) && (status === 'all' || status === x.status),
  );
  return (
    <div className="flex flex-col gap-5">
      <RuleResults results={a.ruleResults?.filter((r) => r.preventsScoring)} />
      <DataProtectionPlan tasks={a.protectionTasks} caseId={c.id} />
      <div className="panel p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2>Matrice de due diligence</h2>
            <p className="mt-2 text-muted-foreground">
              {a.completed} / {a.total} contrôles satisfaits ou justifiés. Sélectionnez un contrôle
              pour examiner les réponses et les preuves.
            </p>
          </div>
          <Status>{a.outcome}</Status>
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <label>
            <span className="sr-only">Filtrer par module</span>
            <select
              className="native-select"
              value={module}
              onChange={(e) => setModule(e.target.value)}
            >
              <option value="all">Tous les modules</option>
              {Object.entries(moduleLabels).map(([id, label]) => (
                <option value={id} key={id}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="sr-only">Filtrer par statut</span>
            <select
              className="native-select"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="all">Tous les statuts</option>
              {reviewStatuses.map((id) => (
                <option value={id} key={id}>
                  {statusLabels[id]}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
      <div className="panel table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>Catégorie / contrôle</th>
              <th>Base et nature</th>
              <th>Preuves</th>
              <th>Statut</th>
              <th>Examiner</th>
            </tr>
          </thead>
          <tbody>
            {list.map((x) => (
              <tr key={x.id}>
                <td>
                  <p className="mb-1 text-xs text-muted-foreground">{moduleLabels[x.module]}</p>
                  <strong>
                    {x.id} · {x.title}
                  </strong>
                </td>
                <td className="max-w-[230px]">
                  <SourceLink id={x.source} />
                  <p className="mt-2 text-xs text-muted-foreground">{x.nature}</p>
                </td>
                <td>
                  {x.evidenceCount} document{x.evidenceCount > 1 ? 's' : ''}
                </td>
                <td>
                  <Status>{x.stale ? 'À revoir — dossier modifié' : statusLabels[x.status]}</Status>
                </td>
                <td>
                  <Button
                    type="button"
                    variant={x.id === selected ? 'secondary' : 'outline'}
                    size="sm"
                    onClick={() => setSelected(x.id === selected ? null : x.id)}
                  >
                    {x.id === selected ? 'Fermer' : 'Ouvrir'}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!list.length ? (
          <p className="p-6 text-muted-foreground">Aucun contrôle ne correspond aux filtres.</p>
        ) : null}
      </div>
      {control ? (
        <section
          id="review-detail"
          className="panel p-6 md:p-8"
          aria-label={`Examen ${control.id}`}
        >
          <div className="mb-6">
            <p className="mb-2 text-xs text-muted-foreground">
              {moduleLabels[control.module as Module]} · {control.id}
            </p>
            <h2>{control.title}</h2>
            <p className="mt-3 text-muted-foreground">{control.description}</p>
          </div>
          <div className="mb-7 flex flex-col gap-3">
            {control.questionIds.map((id) => (
              <div key={id} className="border-l-2 border-border pl-4">
                <p className="text-xs text-muted-foreground">Réponse {id}</p>
                <p className="whitespace-pre-wrap">
                  {Array.isArray(c.answers[id])
                    ? (c.answers[id] as string[]).join(', ')
                    : String(c.answers[id] ?? 'Non renseigné / non applicable')}
                </p>
              </div>
            ))}
          </div>
          <EvidenceList c={c} control={control} editable={role === 'evaluator'} onSaved={onSaved} />
          <div className="mt-8 border-t border-border pt-7">
            {role === 'evaluator' ? (
              <ReviewForm
                key={`${control.id}-${c.revision}`}
                c={c}
                control={control}
                onSaved={onSaved}
              />
            ) : control.review ? (
              <div>
                <h3>{statusLabels[control.review.status]}</h3>
                <p className="mt-3 whitespace-pre-wrap">{control.review.justification}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {control.review.reviewer} · {dateLabel(control.review.reviewedAt)}
                </p>
              </div>
            ) : (
              <p className="text-muted-foreground">
                Choisissez le rôle évaluateur pour enregistrer un examen.
              </p>
            )}
          </div>
        </section>
      ) : null}
    </div>
  );
}
function ReviewForm({
  c,
  control,
  onSaved,
}: {
  c: CaseView;
  control: AssessedControl;
  onSaved: (p: CasePayload) => void;
}) {
  const [status, setStatus] = useState(control.review?.status ?? 'human_review');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const data = Object.fromEntries(new FormData(e.currentTarget));
    try {
      onSaved(
        await api<CasePayload>(`/api/cases/${c.id}/reviews`, {
          method: 'PUT',
          body: JSON.stringify({
            ...data,
            controlId: control.id,
            revision: c.revision,
            prerequisite: data.prerequisite === 'on',
            legalConclusions: Object.fromEntries(
              Object.entries(data)
                .filter(([key]) => key.startsWith('law_'))
                .map(([key, value]) => [key.slice(4), value]),
            ),
          }),
        }),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit}>
      <FieldGroup>
        <h3>Conclusion de l’évaluateur</h3>
        {control.id === 'T02' ? (
          <div className="rounded-lg bg-muted p-5">
            <LegalScope proposals={evaluateLegalScope(c.answers)} />
            <h3 className="mb-4 mt-5">
              Conclusions de qualification — confirmation explicite requise
            </h3>
            <FieldGroup>
              {[
                { id: 'lprd', label: 'LPrD — UNIL' },
                { id: 'lpdVendor', label: 'LPD — fournisseur' },
                { id: 'gdprUnil', label: 'RGPD — UNIL' },
                { id: 'gdprVendor', label: 'RGPD — fournisseur' },
                { id: 'aiProvider', label: 'AI Act — fournisseur' },
                { id: 'aiDeployer', label: 'AI Act — UNIL déployeur' },
              ].map((l) => (
                <Field key={l.id}>
                  <FieldLabel htmlFor={`law-${l.id}`}>{l.label}</FieldLabel>
                  <select
                    id={`law-${l.id}`}
                    name={`law_${l.id}`}
                    className="native-select"
                    defaultValue={
                      control.review?.legalConclusions?.[l.id] ??
                      (['APPLICABLE', 'NOT_APPLICABLE'].includes(
                        evaluateLegalScope(c.answers).find((p) => p.key === l.id)?.state ?? '',
                      )
                        ? evaluateLegalScope(c.answers).find((p) => p.key === l.id)!.state
                        : 'UNKNOWN')
                    }
                  >
                    <option value="UNKNOWN">À clarifier</option>
                    <option value="APPLICABLE">Applicable selon l’analyse documentée</option>
                    <option value="NOT_APPLICABLE">
                      Non applicable selon l’analyse documentée
                    </option>
                  </select>
                </Field>
              ))}
              <Field>
                <FieldLabel htmlFor="scopeOverrideReason">
                  Motif d’interprétation ou d’écart aux propositions (30 caractères minimum si
                  nécessaire)
                </FieldLabel>
                <Textarea
                  id="scopeOverrideReason"
                  name="scopeOverrideReason"
                  maxLength={4000}
                  defaultValue={control.review?.legalConclusions?.scopeOverrideReason ?? ''}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="legalCategory">Qualification AI Act de l’usage</FieldLabel>
                <select
                  id="legalCategory"
                  name="law_category"
                  className="native-select"
                  defaultValue={control.review?.legalConclusions?.category ?? 'UNKNOWN'}
                >
                  <option value="UNKNOWN">À clarifier</option>
                  <option value="OUT_OF_SCOPE">Hors champ pour cet usage</option>
                  <option value="OTHER">Autres obligations / non haut risque</option>
                  <option value="HIGH_RISK">Haut risque</option>
                  <option value="PROHIBITED">Pratique interdite applicable, sans exception</option>
                </select>
              </Field>
              {c.answers.U23 === 'Oui' ? (
                <>
                  <Field>
                    <FieldLabel htmlFor="auto-exception">
                      Exception à l’art. 22 RGPD, si le RGPD est applicable
                    </FieldLabel>
                    <select
                      id="auto-exception"
                      name="law_autoException"
                      className="native-select"
                      defaultValue={control.review?.legalConclusions?.autoException ?? 'UNKNOWN'}
                    >
                      <option value="UNKNOWN">À clarifier</option>
                      <option value="YES">Exception documentée</option>
                      <option value="NO">Aucune exception applicable</option>
                    </select>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="auto-guarantees">
                      Garanties requises d’intervention et de contestation
                    </FieldLabel>
                    <select
                      id="auto-guarantees"
                      name="law_autoGuarantees"
                      className="native-select"
                      defaultValue={control.review?.legalConclusions?.autoGuarantees ?? 'UNKNOWN'}
                    >
                      <option value="UNKNOWN">À clarifier</option>
                      <option value="YES">Garanties documentées</option>
                      <option value="NO">Garanties requises absentes</option>
                    </select>
                  </Field>
                </>
              ) : null}
            </FieldGroup>
          </div>
        ) : null}
        {control.stale ? (
          <Notice title="L’examen précédent n’est plus à jour">
            Les réponses, les preuves ou le référentiel ont changé. Un nouvel examen est nécessaire.
          </Notice>
        ) : null}
        {error ? (
          <Notice title="Examen non enregistré" error>
            {error}
          </Notice>
        ) : null}
        <div className="grid gap-5 md:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="reviewer">Évaluateur fictif *</FieldLabel>
            <Input
              id="reviewer"
              name="reviewer"
              defaultValue={control.review?.reviewer ?? 'Évaluateur du groupe'}
              required
              minLength={2}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="review-status">Statut *</FieldLabel>
            <select
              id="review-status"
              name="status"
              className="native-select"
              value={status}
              onChange={(e) => setStatus(e.target.value as typeof status)}
            >
              {reviewStatuses.map((s) => (
                <option key={s} value={s}>
                  {statusLabels[s]}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field>
          <FieldLabel htmlFor="justification">
            Justification, faits et référence pertinente *
          </FieldLabel>
          <Textarea
            id="justification"
            name="justification"
            required
            minLength={20}
            maxLength={8000}
            defaultValue={control.review?.justification ?? ''}
            placeholder="Expliquez ce que les preuves établissent et la conséquence retenue."
          />
        </Field>
        {status === 'noncompliant' ? (
          <>
            <Notice title="Confirmer un obstacle précis">
              Distinguez une interdiction légale d’une exigence de marché valablement fixée. Un pays
              ou une certification absente ne suffisent pas à eux seuls.
            </Notice>
            <Field>
              <FieldLabel htmlFor="blockingType">Nature du blocage *</FieldLabel>
              <select
                className="native-select"
                name="blockingType"
                id="blockingType"
                required
                defaultValue=""
              >
                <option value="">Choisir</option>
                <option value="LEGAL_OBLIGATION">Obligation légale applicable</option>
                <option value="PROCUREMENT_REQUIREMENT">
                  Condition d’aptitude annoncée et justifiée
                </option>
              </select>
            </Field>
          </>
        ) : null}
        {status === 'conditional' || status === 'correction' ? (
          <Field>
            <FieldLabel htmlFor="condition">Mesure corrective ou condition *</FieldLabel>
            <Textarea
              id="condition"
              name="condition"
              required
              minLength={10}
              maxLength={4000}
              defaultValue={control.review?.condition.replace('[PRÉALABLE] ', '') ?? ''}
            />
            {status === 'conditional' ? (
              <label className="flex items-center gap-2 text-sm">
                <input
                  name="prerequisite"
                  type="checkbox"
                  defaultChecked={control.review?.condition.startsWith('[PRÉALABLE]')}
                />
                Cette mesure doit être réalisée avant de poursuivre.
              </label>
            ) : null}
          </Field>
        ) : null}
        <Button type="submit" disabled={busy}>
          {busy ? 'Enregistrement…' : 'Enregistrer l’examen'}
        </Button>
      </FieldGroup>
    </form>
  );
}
