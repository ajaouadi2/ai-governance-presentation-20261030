'use client';
import { v32Journey, v32LocationLabel } from '@/lib/questionnaire-v32-journey';
import { v32DecisionNames, v32Readable } from '@/lib/questionnaire-v32-labels';
import { useState, type ReactNode } from 'react';
import { V32Localized } from './localized';
import { useLanguage } from '@/components/language';
import { translateV32 } from '@/lib/questionnaire-v32-i18n';
import { v32SummaryCheckTitle } from '@/lib/questionnaire-v32-summary-labels';
import { v32Automation, v32ValidDate } from '@/lib/questionnaire-v32-automation';
import type { V32BrowserDraft } from '@/lib/questionnaire-v32-draft';
import type { V32Result } from '@/lib/questionnaire-v32-engine';
const names = v32DecisionNames;
export function V32Conditions({
  result,
  draft,
  onOpen,
  onChange,
  disabled,
  children,
}: {
  result: V32Result;
  draft: V32BrowserDraft;
  onOpen: (id: string) => void;
  onChange: (patch: Partial<V32BrowserDraft>) => void;
  disabled: boolean;
  children?: ReactNode;
}) {
  const { locale } = useLanguage();
  const summary = v32Automation(result, draft);
  const [editingDecision, setEditingDecision] = useState(false);
  const confirmed = summary.decisionStatus === 'confirmed';
  const blockers = result.summary.filter(
    (s) => s.effectiveVerdict === 'NE PAS POURSUIVRE' && !s.questionId.startsWith('V32-S08'),
  );
  const outstanding = summary.conditions.filter(
    (c) => !['resolved', 'classification'].includes(c.state),
  );
  const orderedConditions = [...summary.conditions].sort(
    (a, b) =>
      Number(['resolved', 'classification'].includes(a.state)) -
      Number(['resolved', 'classification'].includes(b.state)),
  );
  const [identity, setIdentity] = useState({
    name: draft.decisionRecord?.name ?? '',
    function: draft.decisionRecord?.function ?? '',
    date: draft.decisionRecord?.date ?? '',
    reasons: draft.decisionRecord?.reasons ?? '',
  });
  const identityComplete =
    identity.name.trim() &&
    identity.function.trim() &&
    v32ValidDate(identity.date) &&
    identity.reasons.trim();
  const confirm = (choice: 'go' | 'conditional-go' | 'no-go') =>
    onChange({
      answers: {
        ...draft.answers,
        'V32-S08-Q04': { go: 'a', 'conditional-go': 'b', 'no-go': 'c' }[choice],
      },
      decisionRecord: { ...identity, choice, basis: summary.basis },
    });
  return (
    <V32Localized>
      <section aria-label="Actions et proposition de décision" className="v32-summary-item">
        <div
          className={`v32-decision-hero v32-decision-${confirmed ? draft.decisionRecord!.choice : summary.proposal}`}
        >
          <span>{confirmed ? 'DÉCISION UNIL' : 'PROPOSITION DE L’APPLICATION'}</span>
          <h3>{names[confirmed ? draft.decisionRecord!.choice : summary.proposal]}</h3>
          <p>{v32Readable(summary.reason)}</p>
          {confirmed && draft.decisionRecord!.choice !== summary.proposal && (
            <p>Proposition de l’application : {names[summary.proposal]}</p>
          )}
          {confirmed ? (
            <p className="v32-decision-record">
              <span>✓ Confirmée</span> · {draft.decisionRecord!.name} · {draft.decisionRecord!.date}
            </p>
          ) : (
            <p>
              {summary.decisionStatus === 'stale'
                ? 'À confirmer à nouveau : le dossier ou le choix a changé'
                : 'Non confirmée'}
            </p>
          )}
        </div>
        <div className="v32-clean-overview">
          <span className={blockers.length ? 'v32-status-red' : 'v32-status-green'}>
            {blockers.length
              ? blockers.length + ' ' + translateV32('point(s) bloquant(s)', locale)
              : '✓ Aucun point bloquant'}
          </span>
          <span className={outstanding.length ? 'v32-status-amber' : 'v32-status-green'}>
            {outstanding.length
              ? outstanding.length + ' ' + translateV32('action(s) à suivre', locale)
              : '✓ Aucune condition ouverte'}
          </span>
        </div>
        {blockers.length > 0 && (
          <section className="v32-clean-blockers">
            <h3>Points bloquants</h3>
            {blockers.map((s) => (
              <p key={s.questionId}>
                <button onClick={() => onOpen(s.questionId)}>
                  {v32LocationLabel(s.questionId)} — revoir le point bloquant
                </button>
              </p>
            ))}
          </section>
        )}
        <h3>{outstanding.length ? 'Actions et contrôles réalisés' : 'Contrôles réalisés'}</h3>
        {orderedConditions.map((c) => {
          const record = c.record ?? {
            resolved: false,
            actionTaken: '',
            reference: '',
            checkedBy: '',
            date: '',
            owner: '',
            deadline: '',
            basis: '',
          };
          const edit = (patch: Partial<typeof record>) =>
            onChange({
              conditionReviews: {
                ...draft.conditionReviews,
                [c.key]: { ...record, ...patch, resolved: false, basis: c.basis },
              },
            });
          const complete =
            record.actionTaken.trim() &&
            record.reference.trim() &&
            record.checkedBy.trim() &&
            v32ValidDate(record.date);
          return (
            <section
              className={`v32-clean-check ${['resolved', 'classification'].includes(c.state) ? 'v32-clean-complete' : 'v32-clean-outstanding'}`}
              key={c.key}
            >
              <div className="v32-clean-check-heading">
                <strong>
                  {v32SummaryCheckTitle(
                    c.questionId,
                    translateV32(c.actions[0] ?? c.answerLabel, locale),
                    locale,
                  )}
                </strong>
                <span
                  className={
                    c.state === 'resolved'
                      ? 'v32-status-green'
                      : c.state === 'classification'
                        ? ''
                        : 'v32-status-amber'
                  }
                >
                  {c.state === 'resolved'
                    ? '✓ Vérifié'
                    : c.state === 'classification'
                      ? 'Classement conservé'
                      : c.state === 'stale'
                        ? 'À revérifier'
                        : c.state === 'clarification'
                          ? 'Critère à préciser'
                          : 'Action ouverte'}
                </span>
              </div>
              {['resolved', 'classification'].includes(c.state) ? (
                <p className="v32-clean-meta">
                  {[record.reference, record.checkedBy, record.date].filter(Boolean).join(' · ')}
                </p>
              ) : (
                <div className="v32-clean-assignment">
                  <p>
                    <span>Responsable</span>
                    {record.owner || 'À attribuer'}
                  </p>
                  <p>
                    <span>Échéance</span>
                    {record.deadline || 'À fixer'}
                  </p>
                </div>
              )}
              <details className="v32-clean-edit">
                <summary>Preuves et modification du contrôle</summary>
                <p className="v32-source">{c.question}</p>
                {c.actions.map((a, i) => (
                  <p className="v32-source" key={i}>
                    {a}
                  </p>
                ))}
                {c.converted && (
                  <p>Exigence traitée comme une condition selon le cadrage AI Act.</p>
                )}
                {c.state === 'classification' ? (
                  <p>
                    Les exigences liées au haut risque restent dans le parcours ; ce classement
                    n’est pas une tâche à solder.
                  </p>
                ) : c.state === 'clarification' ? (
                  <p>
                    Le document ne précise pas assez le résultat attendu. Clôture à définir avec
                    l’équipe ; aucune preuve ou exigence n’a été inventée.
                  </p>
                ) : c.specialist ? (
                  <p>
                    Réalisation et validation déjà confirmées dans les contrôles d’analyses
                    ci-dessous.
                  </p>
                ) : (
                  <fieldset disabled={disabled}>
                    <label>
                      Action réalisée / constat UNIL
                      <textarea
                        value={record.actionTaken}
                        maxLength={4000}
                        onChange={(e) => edit({ actionTaken: e.target.value })}
                      />
                    </label>
                    <label>
                      Référence de la preuve
                      <input
                        value={record.reference}
                        maxLength={2000}
                        onChange={(e) => edit({ reference: e.target.value })}
                      />
                    </label>
                    <label>
                      Personne et fonction ayant vérifié
                      <input
                        value={record.checkedBy}
                        maxLength={200}
                        onChange={(e) => edit({ checkedBy: e.target.value })}
                      />
                    </label>
                    <label>
                      Date du contrôle
                      <input
                        type="date"
                        value={record.date}
                        onChange={(e) => edit({ date: e.target.value })}
                      />
                    </label>
                    <label>
                      Responsable de la condition
                      <input
                        value={record.owner}
                        maxLength={200}
                        onChange={(e) => edit({ owner: e.target.value })}
                      />
                    </label>
                    <label>
                      Échéance de la condition
                      <input
                        type="date"
                        value={record.deadline}
                        onChange={(e) => edit({ deadline: e.target.value })}
                      />
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={c.state === 'resolved'}
                        disabled={!complete}
                        onChange={(e) =>
                          onChange({
                            conditionReviews: {
                              ...draft.conditionReviews,
                              [c.key]: { ...record, resolved: e.target.checked, basis: c.basis },
                            },
                          })
                        }
                      />{' '}
                      Je confirme que l’action est réalisée et la preuve vérifiée.
                    </label>
                  </fieldset>
                )}
                {c.checks.map((check) => (
                  <p key={check.id}>
                    {check.label} :{' '}
                    {check.status === 'confirmed'
                      ? 'confirmé'
                      : check.status === 'stale'
                        ? 'à renouveler'
                        : 'à confirmer'}
                    . Les autres obligations de la ligne restent à vérifier.
                  </p>
                ))}
                <p>
                  Source : page(s) {c.pages.join(', ')} · choix {c.letter}.
                </p>
                <button onClick={() => onOpen(c.questionId)}>Revoir la réponse</button>
              </details>
            </section>
          );
        })}
        {!summary.conditions.length && !result.verificationChecks.length && (
          <div className="v32-clean-stage-list">
            {v32Journey.stages.map((stage) => {
              const ids = stage.sections.flatMap((s) => s.questionIds);
              const count = result.questions.filter(
                (q) => ids.includes(q.id) && q.state === 'answered' && !q.id.startsWith('V32-S08'),
              ).length;
              return count ? (
                <div className="v32-clean-stage" key={stage.number}>
                  <span>{stage.title}</span>
                  <span>{count} réponses prises en compte</span>
                </div>
              ) : null;
            })}
          </div>
        )}
        {children}
        <div className="v32-clean-decision">
          {confirmed && (
            <>
              <h3>Décision enregistrée</h3>
              <p className="v32-preserve" translate="no">
                {draft.decisionRecord!.reasons}
              </p>
              <button onClick={() => setEditingDecision(!editingDecision)}>
                {editingDecision ? 'Fermer la modification' : 'Modifier la décision'}
              </button>
            </>
          )}
          {(!confirmed || editingDecision) && (
            <>
              <h3>Décision de l’UNIL</h3>
              <p>
                La proposition ne devient une décision enregistrée qu’après confirmation explicite
                et sauvegarde.
              </p>
              {summary.proposal === 'conditional-go' && summary.assignmentMissing && (
                <p role="status">
                  Attribuez un responsable et une échéance à chaque condition ouverte avant de
                  confirmer un avis favorable sous conditions.
                </p>
              )}
              <fieldset disabled={disabled}>
                <label>
                  Nom de la personne décidant
                  <input
                    value={identity.name}
                    maxLength={200}
                    onChange={(e) => setIdentity({ ...identity, name: e.target.value })}
                  />
                </label>
                <label>
                  Fonction de la personne décidant
                  <input
                    value={identity.function}
                    maxLength={200}
                    onChange={(e) => setIdentity({ ...identity, function: e.target.value })}
                  />
                </label>
                <label>
                  Date de décision
                  <input
                    type="date"
                    value={identity.date}
                    onChange={(e) => setIdentity({ ...identity, date: e.target.value })}
                  />
                </label>
                <label>
                  Motifs de la décision
                  <textarea
                    value={identity.reasons}
                    maxLength={4000}
                    onChange={(e) => setIdentity({ ...identity, reasons: e.target.value })}
                  />
                </label>
                <button
                  disabled={
                    !identityComplete ||
                    summary.proposal === 'suspended' ||
                    (summary.proposal === 'conditional-go' && summary.assignmentMissing)
                  }
                  onClick={() => {
                    if (summary.proposal !== 'suspended') confirm(summary.proposal);
                  }}
                >
                  Confirmer la proposition UNIL
                </button>
                {summary.canRecordRejection && summary.proposal !== 'no-go' && (
                  <button disabled={!identityComplete} onClick={() => confirm('no-go')}>
                    Enregistrer un avis défavorable motivé
                  </button>
                )}
              </fieldset>
            </>
          )}
        </div>
        <p className="v32-clean-footer">
          Prototype académique · L’UNIL conserve l’autorité de mise en service.
        </p>
      </section>
    </V32Localized>
  );
}
