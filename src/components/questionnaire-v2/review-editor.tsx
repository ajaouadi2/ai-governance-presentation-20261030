'use client';
import { Localized } from '@/components/language';

import { useState } from 'react';
import type { V2WorkflowReview } from '@/lib/questionnaire-v2-workflow';
import type { V2Evidence } from '@/lib/questionnaire-v2-evidence';

type ReviewInput = Omit<V2WorkflowReview, 'fingerprint'>;
export function V2ReviewEditor({
  id,
  kind,
  existing,
  busy,
  onDirty,
  onSave,
  files = [],
}: {
  id: string;
  kind: 'scope' | 'question';
  existing?: Record<string, unknown>;
  busy: boolean;
  onDirty: (key: string, dirty: boolean) => void;
  onSave: (kind: 'scope' | 'question', id: string, review: unknown) => Promise<boolean>;
  files?: V2Evidence[];
}) {
  const key = `${kind}:${id}`;
  const [status, setStatus] = useState(
    String(existing?.[kind === 'scope' ? 'decision' : 'status'] ?? ''),
  );
  const [reviewer, setReviewer] = useState(String(existing?.reviewer ?? 'Évaluateur démo'));
  const [reason, setReason] = useState(String(existing?.justification ?? ''));
  const [references, setReferences] = useState(
    (existing?.evidenceReferences as string[] | undefined)?.join('\n') ?? '',
  );
  const oldResolution = existing?.sourceResolution as ReviewInput['sourceResolution'];
  const [resolution, setResolution] = useState(oldResolution?.kind ?? '');
  const [resolutionReason, setResolutionReason] = useState(oldResolution?.explanation ?? '');
  const [conditions, setConditions] = useState<NonNullable<ReviewInput['conditions']>>(
    (existing?.conditions as ReviewInput['conditions']) ?? [],
  );
  const dirty = () => onDirty(key, true);
  const refs = () =>
    references
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
  return (
    <Localized>
      {
        <form
          className="v2-review"
          onChange={dirty}
          onSubmit={async (e) => {
            e.preventDefault();
            const base = { reviewer, justification: reason, evidenceReferences: refs() };
            const review =
              kind === 'scope'
                ? { ...base, decision: status }
                : {
                    ...base,
                    status,
                    ...(resolution
                      ? {
                          sourceResolution: {
                            kind: resolution,
                            explanation: resolutionReason,
                            evidenceReferences: refs(),
                          },
                        }
                      : {}),
                    ...(conditions.length
                      ? {
                          conditions: conditions.map((c) => ({
                            ...c,
                            ...(c.completionReference ? {} : { completionReference: undefined }),
                          })),
                        }
                      : {}),
                  };
            if (await onSave(kind, id, review)) onDirty(key, false);
          }}
        >
          <p className="text-sm text-muted-foreground">
            {existing?.current === false
              ? 'Les faits, les pièces ou le référentiel ont changé : cet examen doit être actualisé.'
              : 'Décision motivée de l’évaluateur. Les actions non résolues restent ouvertes.'}
          </p>
          <label>
            Décision
            <select
              required
              value={status}
              disabled={busy}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">Choisir une décision</option>
              {(kind === 'scope'
                ? [
                    ['applies', 'Parcours applicable'],
                    ['does_not_apply', 'Non applicable — justifier'],
                    ['unresolved', 'À clarifier'],
                  ]
                : [
                    ['accepted', 'Examen accepté'],
                    ['needs_work', 'À compléter ou corriger'],
                    ['blocked', 'Bloqué en attente de résolution'],
                  ]
              ).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Évaluateur
            <input
              required
              value={reviewer}
              disabled={busy}
              onChange={(e) => setReviewer(e.target.value)}
            />
          </label>
          <label>
            Justification
            <textarea
              required
              value={reason}
              disabled={busy}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          {files.length > 0 && (
            <fieldset className="v2-evidence-selection">
              <legend>Pièces examinées pour cet avis</legend>
              {files.map((file) => {
                const reference = `piece:${file.id}`;
                return (
                  <Localized key={file.id}>
                    {
                      <label key={file.id} className="v2-unknown">
                        <input
                          type="checkbox"
                          disabled={busy}
                          checked={refs().includes(reference)}
                          onChange={(event) => {
                            const next = refs().filter((ref) => ref !== reference);
                            if (event.target.checked) next.push(reference);
                            setReferences(next.join('\n'));
                          }}
                        />
                        {file.originalName}
                      </label>
                    }
                  </Localized>
                );
              })}
            </fieldset>
          )}
          <label>
            Références examinées — une par ligne
            <textarea
              required
              value={references}
              disabled={busy}
              onChange={(e) => setReferences(e.target.value)}
              placeholder="Avis, document, test ou analyse du dossier"
            />
          </label>
          {kind === 'question' && (
            <>
              <label>
                Résolution d’une recommandation source
                <select
                  value={resolution}
                  disabled={busy}
                  onChange={(e) => setResolution(e.target.value as typeof resolution)}
                >
                  <option value="">Aucune résolution particulière</option>
                  <option value="not_applicable">Recommandation non applicable — justifier</option>
                  <option value="exception_approved">
                    Exception explicitement approuvée — justifier
                  </option>
                  <option value="conditioned">Condition à suivre — ajouter ci-dessous</option>
                </select>
              </label>
              {resolution && (
                <label>
                  Motif de la résolution
                  <textarea
                    required
                    value={resolutionReason}
                    disabled={busy}
                    onChange={(e) => setResolutionReason(e.target.value)}
                  />
                </label>
              )}
              {conditions.map((condition, index) => (
                <fieldset className="v2-condition" key={condition.id}>
                  <legend>Condition {index + 1}</legend>
                  <label>
                    Action à réaliser
                    <textarea
                      required
                      value={condition.description}
                      disabled={busy}
                      onChange={(e) =>
                        setConditions((rows) =>
                          rows.map((r, i) =>
                            i === index ? { ...r, description: e.target.value } : r,
                          ),
                        )
                      }
                    />
                  </label>
                  <label>
                    Responsable
                    <select
                      value={condition.owner}
                      disabled={busy}
                      onChange={(e) =>
                        setConditions((rows) =>
                          rows.map((r, i) =>
                            i === index ? { ...r, owner: e.target.value as typeof r.owner } : r,
                          ),
                        )
                      }
                    >
                      <option value="unil">UNIL</option>
                      <option value="supplier">Fournisseur</option>
                      <option value="reviewer">Évaluateur</option>
                    </select>
                  </label>
                  <label>
                    À réaliser avant
                    <select
                      value={condition.before}
                      disabled={busy}
                      onChange={(e) =>
                        setConditions((rows) =>
                          rows.map((r, i) =>
                            i === index ? { ...r, before: e.target.value as typeof r.before } : r,
                          ),
                        )
                      }
                    >
                      <option value="assessment">Poursuite de l’évaluation</option>
                      <option value="supplier-selection">Sélection</option>
                      <option value="signature">Signature</option>
                      <option value="deployment">Mise en service</option>
                    </select>
                  </label>
                  <label>
                    État
                    <select
                      value={condition.status}
                      disabled={busy}
                      onChange={(e) =>
                        setConditions((rows) =>
                          rows.map((r, i) =>
                            i === index ? { ...r, status: e.target.value as typeof r.status } : r,
                          ),
                        )
                      }
                    >
                      <option value="open">À réaliser</option>
                      <option value="done">Réalisée</option>
                    </select>
                  </label>
                  {condition.status === 'done' && (
                    <label>
                      Référence de réalisation
                      <input
                        required
                        value={condition.completionReference ?? ''}
                        disabled={busy}
                        onChange={(e) =>
                          setConditions((rows) =>
                            rows.map((r, i) =>
                              i === index ? { ...r, completionReference: e.target.value } : r,
                            ),
                          )
                        }
                      />
                    </label>
                  )}
                  <button
                    type="button"
                    className="v2-text-button"
                    disabled={busy}
                    onClick={() => {
                      dirty();
                      setConditions((rows) => rows.filter((_, i) => i !== index));
                    }}
                  >
                    Retirer cette condition
                  </button>
                </fieldset>
              ))}
              <button
                type="button"
                className="v2-secondary"
                disabled={busy}
                onClick={() => {
                  dirty();
                  setConditions((rows) => [
                    ...rows,
                    {
                      id: crypto.randomUUID(),
                      description: '',
                      owner: 'unil',
                      before: 'deployment',
                      status: 'open',
                    },
                  ]);
                }}
              >
                Ajouter une condition
              </button>
            </>
          )}
          <button className="v2-primary" disabled={busy} type="submit">
            Enregistrer l’examen
          </button>
        </form>
      }
    </Localized>
  );
}
