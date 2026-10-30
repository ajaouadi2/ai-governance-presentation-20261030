'use client';
import { Localized } from '@/components/language';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { V2DraftSummary } from '@/lib/questionnaire-v2-view';
export function Archives() {
  const [drafts, setDrafts] = useState<V2DraftSummary[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    void fetch('/api/questionnaire-v2/archives', { cache: 'no-store' })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        setDrafts(d.drafts);
      })
      .catch((e) => setError(String(e)));
  }, []);
  async function restore(draft: V2DraftSummary) {
    setBusy(true);
    try {
      const r = await fetch(`/api/questionnaire-v2/${draft.id}/archive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ revision: draft.revision, archived: false }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setDrafts((rows) => rows.filter((row) => row.id !== draft.id));
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Localized>
      {
        <section className="space-y-6">
          <h1>Archives</h1>
          <p>
            Les projets archivés et leurs pièces sont conservés. Restaurez un projet pour le
            remettre dans la liste principale.
          </p>
          {error ? (
            <p role="alert">{error}</p>
          ) : (
            <>
              <ul className="space-y-4">
                {drafts.map((d) => (
                  <li
                    key={d.id}
                    className="panel flex flex-wrap items-center justify-between gap-4 p-5"
                  >
                    <Link className="link" href={`/projects/${d.id}`} translate="no">
                      {d.title}
                    </Link>
                    <button
                      className="native-select"
                      disabled={busy}
                      onClick={() => void restore(d)}
                    >
                      Restaurer
                    </button>
                  </li>
                ))}
              </ul>
              {!drafts.length && <p>Aucun projet archivé.</p>}
              <details className="panel p-5">
                <summary>Ancien parcours et documents de référence</summary>
                <p className="my-4">
                  Historique conservé pour consultation ; les nouvelles évaluations se font depuis
                  Projets.
                </p>
                <div className="flex flex-wrap gap-5">
                  <Link className="link" href="/archives/legacy">
                    Anciens dossiers
                  </Link>
                  <Link className="link" href="/checklist">
                    Ancienne grille et logique
                  </Link>
                  <Link className="link" href="/sources">
                    Anciennes sources et méthode
                  </Link>
                </div>
              </details>
            </>
          )}
        </section>
      }
    </Localized>
  );
}
