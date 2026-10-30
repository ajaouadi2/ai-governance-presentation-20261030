'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
export function V32Archives() {
  const [items, setItems] = useState<{ id: string; title: string }[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  useEffect(() => {
    let cancelled = false;
    fetch('/api/questionnaire-v32?archived=true', { cache: 'no-store' })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error);
        if (!cancelled) {
          setItems(data.drafts);
          setLoaded(true);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e.message);
          setLoaded(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);
  async function restore(id: string) {
    setBusy(id);
    setError('');
    try {
      const r = await fetch(`/api/questionnaire-v32/${id}/archive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Clair-Workspace': 'unil-3' },
        body: JSON.stringify({ archived: false }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      setItems((old) => old.filter((d) => d.id !== id));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy('');
    }
  }
  return (
    <section className="v32-question">
      <h2>Dossiers d’essai v3.2</h2>
      <p>
        Les essais précédents sont conservés avec leurs réponses, révisions et rapports. Restaurer
        remet un dossier dans Projets.
      </p>
      {error && <p role="alert">{error}</p>}
      {!loaded ? (
        <p>Chargement…</p>
      ) : items.length ? (
        <details>
          <summary>Consulter les {items.length} dossiers archivés</summary>
          {items.map((d) => (
            <div className="v32-archived-row" key={d.id}>
              <Link href={'/questionnaire-v32/' + d.id}>{d.title}</Link>
              <button disabled={!!busy} onClick={() => void restore(d.id)}>
                {busy === d.id ? 'Restauration…' : 'Restaurer dans Projets'}
              </button>
            </div>
          ))}
        </details>
      ) : (
        <p>Aucun dossier v3.2 archivé.</p>
      )}
    </section>
  );
}
