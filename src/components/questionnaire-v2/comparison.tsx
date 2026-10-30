'use client';
import { Localized } from '@/components/language';

import { useEffect, useState } from 'react';
import type { V2DraftStore } from '@/lib/questionnaire-v2-store';
type Data = Awaited<ReturnType<V2DraftStore['comparison']>>;
export function V2Comparison({
  id,
  reviewer,
  flush,
  prepare,
  reload,
  dirty,
}: {
  id: string;
  reviewer: boolean;
  flush: () => Promise<boolean>;
  prepare: () => Promise<boolean>;
  reload: () => Promise<void>;
  dirty: (value: boolean) => void;
}) {
  const [data, setData] = useState<Data | null>(null);
  const [ids, setIds] = useState<string[]>([id]);
  const [scope, setScope] = useState('');
  const [currency, setCurrency] = useState('CHF');
  const [name, setName] = useState('');
  const [reason, setReason] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [edited, setEdited] = useState(false);
  async function load() {
    const response = await fetch(`/api/questionnaire-v2/${id}/comparison`, { cache: 'no-store' });
    const value = await response.json();
    if (!response.ok) throw new Error(value.error);
    return value as Data;
  }
  useEffect(() => {
    let active = true;
    void load()
      .then((value) => {
        if (!active) return;
        setData(value);
        if (value.plan) {
          setIds(value.plan.offerIds);
          setScope(value.plan.scope);
          setCurrency(value.plan.currency);
          setName(value.plan.reviewer);
          setReason(value.plan.justification);
        }
      })
      .catch((e) => {
        if (active) setError(String(e));
      });
    return () => {
      active = false;
    };
    // The component is remounted when the dossier changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  function change() {
    dirty(true);
    setEdited(true);
    setConfirmed(false);
  }
  async function save() {
    setBusy(true);
    setError('');
    try {
      if (!(await prepare()))
        throw new Error('Enregistrez les autres modifications avant la comparaison.');
      const fresh = await load();
      if (data && fresh.revision !== data.revision)
        throw new Error('Le dossier a changé. Actualisez la comparaison avant de confirmer.');
      const response = await fetch(`/api/questionnaire-v2/${id}/comparison`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          revision: fresh.revision,
          expectedRevisions: Object.fromEntries(
            (data?.available ?? []).map((d) => [d.id, d.revision]),
          ),
          plan: {
            offerIds: ids,
            scope,
            currency,
            reviewer: name,
            justification: reason,
            confirmed,
          },
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setData(result);
      dirty(false);
      setEdited(false);
      setConfirmed(false);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Enregistrement impossible.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Localized>
      {
        <section className="v2-card">
          <h2>Comparaison des offres · M16–M19</h2>
          <p>
            Barème proposé par l’équipe : qualité 40 %, intégration 15 %, coût 30 %, environnement
            15 %. Les notes ne constituent pas une attribution du marché.
          </p>
          <p>
            Chaque dossier sélectionné représente une offre pour un même besoin. Confirmez le même
            périmètre de coût, la durée, les prestations et la devise. Aucun taux de change n’est
            appliqué.
          </p>
          {error && <p role="alert">{error}</p>}
          {data && (
            <>
              <details open={!data.plan} className="v2-extra">
                <summary>Paramètres et sélection des offres</summary>
                <fieldset disabled={!reviewer || busy} className="v2-field">
                  <legend>Offres à comparer (8 maximum)</legend>
                  {data.available.map((offer) => (
                    <label key={offer.id} style={{ display: 'block' }}>
                      <input
                        type="checkbox"
                        checked={ids.includes(offer.id)}
                        disabled={offer.id === id}
                        onChange={(e) => {
                          change();
                          setIds(
                            e.target.checked
                              ? [...ids, offer.id]
                              : ids.filter((key) => key !== offer.id),
                          );
                        }}
                      />{' '}
                      {offer.title}
                    </label>
                  ))}
                  <label>
                    Périmètre commun de comparaison
                    <textarea
                      value={scope}
                      onChange={(e) => {
                        change();
                        setScope(e.target.value);
                      }}
                    />
                  </label>
                  <label>
                    Devise (code, par exemple CHF)
                    <input
                      value={currency}
                      maxLength={3}
                      onChange={(e) => {
                        change();
                        setCurrency(e.target.value.toUpperCase());
                      }}
                    />
                  </label>
                  <label>
                    Évaluateur
                    <input
                      value={name}
                      onChange={(e) => {
                        change();
                        setName(e.target.value);
                      }}
                    />
                  </label>
                  <label>
                    Pourquoi ces offres et ces coûts sont comparables
                    <textarea
                      value={reason}
                      onChange={(e) => {
                        change();
                        setReason(e.target.value);
                      }}
                    />
                  </label>
                  <p>
                    Prix : 5 × coût minimum / coût de l’offre. Si le minimum est nul : 5 pour les
                    offres gratuites, 0 pour les autres. Intégration : 5 / 3 / 0 ; environnement : 5
                    / 2 / 0. Total arrondi à deux décimales ; ex æquo conservés.
                  </p>
                  <label>
                    <input
                      type="checkbox"
                      checked={confirmed}
                      onChange={(e) => {
                        dirty(true);
                        setEdited(true);
                        setConfirmed(e.target.checked);
                      }}
                    />{' '}
                    Je confirme le périmètre commun et ce barème de démonstration pour les réponses
                    actuellement enregistrées.
                  </label>
                  <button className="v2-primary" disabled={!confirmed} onClick={() => void save()}>
                    Confirmer et calculer
                  </button>
                </fieldset>
              </details>
              {edited && (
                <button
                  className="v2-secondary"
                  disabled={busy}
                  onClick={() => {
                    const plan = data.plan;
                    setIds(plan?.offerIds ?? [id]);
                    setScope(plan?.scope ?? '');
                    setCurrency(plan?.currency ?? 'CHF');
                    setName(plan?.reviewer ?? '');
                    setReason(plan?.justification ?? '');
                    setConfirmed(false);
                    setEdited(false);
                    dirty(false);
                  }}
                >
                  Annuler les modifications du comparatif
                </button>
              )}
              <button
                className="v2-secondary"
                disabled={busy}
                onClick={() =>
                  void (async () => {
                    if (await flush()) {
                      setData(await load());
                      setError('');
                    }
                  })().catch((e) => setError(String(e)))
                }
              >
                Actualiser les résultats
              </button>
              {data.result && (
                <>
                  <p role="status">
                    {edited
                      ? 'Modifications non enregistrées : résultats précédents, aucun rang affiché.'
                      : !data.result.current
                        ? 'Confirmation périmée : réexaminer les offres et confirmer à nouveau.'
                        : data.result.ranked
                          ? 'Classement indicatif — décision humaine requise.'
                          : 'Classement indisponible : au moins deux offres, toutes complètes et sans prérequis ouverts, sont nécessaires.'}
                  </p>
                  <div style={{ overflowX: 'auto' }}>
                    <table>
                      <thead>
                        <tr>
                          {[
                            'Offre',
                            'Coût',
                            'Qualité /5',
                            'Intégration /5',
                            'Prix /5',
                            'Environnement /5',
                            'Total /100',
                            'Rang',
                          ].map((label) => (
                            <th key={label}>{label}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {data.result.rows.map((row) => (
                          <tr key={row.id}>
                            <td translate="no">{row.title}</td>
                            <td>
                              {row.cost ?? '—'} {data.plan?.currency}
                            </td>
                            <td>{row.quality ?? '—'}</td>
                            <td>{row.integration ?? '—'}</td>
                            <td>{row.price === null ? '—' : row.price.toFixed(2)}</td>
                            <td>{row.environment ?? '—'}</td>
                            <td>{row.total ?? '—'}</td>
                            <td>{edited ? '—' : (row.rank ?? '—')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {data.result.rows.map((row) => (
                    <div key={row.id}>
                      <strong translate="no">{row.title}</strong>
                      <p>
                        Périmètre déclaré :{' '}
                        {row.costScope ? (
                          <span translate="no">{String(row.costScope)}</span>
                        ) : (
                          'Non renseigné'
                        )}
                      </p>
                      {row.reasons.length > 0 && (
                        <ul>
                          {row.reasons.map((reason) => (
                            <li key={reason}>{reason}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </>
              )}
            </>
          )}
        </section>
      }
    </Localized>
  );
}
