'use client';
import { V32Localized } from './localized';
import { v32LocationLabel } from '@/lib/questionnaire-v32-journey';
import { v32DecisionNames } from '@/lib/questionnaire-v32-labels';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import './workspace.css';
type Item = {
  id: string;
  title: string;
  revision: number;
  updatedAt: string;
  answered: number;
  status: string;
  decisionChoice?: 'go' | 'conditional-go' | 'no-go' | null;
  nextQuestion?: string | null;
  nextOwner?: string | null;
};
export function V32Projects() {
  const [items, setItems] = useState<Item[]>([]);
  const [title, setTitle] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const router = useRouter();
  useEffect(() => {
    let cancelled = false;
    void fetch('/api/questionnaire-v32', { cache: 'no-store' })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        if (!cancelled) {
          setItems(d.drafts.sort((a: Item, b: Item) => a.title.localeCompare(b.title, 'fr')));
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return (
    <V32Localized>
      <article className="v32-workspace">
        <header className="v32-hero v32-projects-hero">
          <div>
            <span>ESPACE D’ÉVALUATION</span>
            <h1>Vos projets</h1>
            <p>Un espace UNIL pour évaluer l’outil, le fournisseur et prendre une décision.</p>
          </div>
          <button onClick={() => setShowCreate(!showCreate)} disabled={busy}>
            {showCreate ? 'Fermer le formulaire' : 'Nouvelle évaluation +'}
          </button>
        </header>
        <p>
          Retrouvez vos évaluations en cours et reprenez là où vous en étiez. Les anciennes versions
          sont conservées dans Archives.
        </p>
        {error && <p role="alert">{error}</p>}
        {showCreate && (
          <>
            <form
              className="v32-context"
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                setError('');
                try {
                  const r = await fetch('/api/questionnaire-v32', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'X-Clair-Workspace': 'unil-3' },
                    body: JSON.stringify({ title }),
                  });
                  const d = await r.json();
                  if (!r.ok) throw new Error(d.error);
                  router.push('/questionnaire-v32/' + d.id);
                } catch (e) {
                  setError((e as Error).message);
                  setBusy(false);
                }
              }}
            >
              <h2>Nouvelle évaluation</h2>
              <label htmlFor="v32-project-title">Nom du projet</label>
              <input
                id="v32-project-title"
                minLength={3}
                maxLength={160}
                required
                value={title}
                disabled={busy}
                onChange={(e) => setTitle(e.target.value)}
              />
              <button disabled={busy} className="v32-primary">
                Créer et commencer →
              </button>
            </form>
          </>
        )}
        {!loaded ? (
          <p role="status">Chargement des projets…</p>
        ) : (
          <div className="v32-project-grid">
            {items.map((d) => (
              <section className="v32-project-card" key={d.id}>
                <span
                  className={`v32-project-status${d.decisionChoice ? ` v32-project-status-${d.decisionChoice}` : ''}`}
                >
                  {d.status === 'decision-recorded' && d.decisionChoice
                    ? v32DecisionNames[d.decisionChoice]
                    : d.status === 'decision-recorded'
                      ? 'Décision UNIL enregistrée'
                      : d.status === 'decision-stale'
                        ? 'Décision à reconfirmer'
                        : d.status === 'suspended'
                          ? 'En attente d’avis'
                          : d.status === 'pending-clarification'
                            ? 'À clarifier'
                            : d.status === 'no-go-proposed'
                              ? 'Avis défavorable proposé'
                              : 'En cours'}
                </span>
                <h3>
                  <Link translate="no" href={'/questionnaire-v32/' + d.id}>
                    {d.title}
                  </Link>
                </h3>
                <p>
                  {d.nextQuestion
                    ? v32LocationLabel(d.nextQuestion)
                    : d.status === 'decision-recorded'
                      ? 'Consultez la synthèse et la décision enregistrée.'
                      : 'Parcours en attente d’examen'}
                </p>
                <Link className="v32-continue" href={'/questionnaire-v32/' + d.id}>
                  Continuer →
                </Link>
                <details>
                  <summary>Détails</summary>
                  <p>
                    {d.answered} réponses sur le parcours · révision {d.revision}
                  </p>
                  <p>Checklist v3.2</p>
                </details>
              </section>
            ))}
            {!items.length && !error && (
              <p>Aucune évaluation pour le moment. Créez un projet pour commencer.</p>
            )}
          </div>
        )}
        <p className="v32-project-footer">
          Prototype académique · données fictives uniquement.{' '}
          <Link href="/guide">Comprendre le parcours</Link>
        </p>
      </article>
    </V32Localized>
  );
}
