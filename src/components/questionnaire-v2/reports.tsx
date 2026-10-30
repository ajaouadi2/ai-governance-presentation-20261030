'use client';
import { Localized } from '@/components/language';

import { useEffect, useState } from 'react';
import type { V2ReportSummary } from '@/lib/questionnaire-v2-report';

export function V2Reports({
  id,
  create,
}: {
  id: string;
  create: () => Promise<V2ReportSummary | null>;
}) {
  const [reports, setReports] = useState<V2ReportSummary[]>([]);
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    void fetch(`/api/questionnaire-v2/${id}/reports`, { cache: 'no-store' })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        if (active) setReports(data.reports);
      })
      .catch((e) => {
        if (active) setError(String(e));
      });
    return () => {
      active = false;
    };
  }, [id]);
  async function generate() {
    setBusy(true);
    setError('');
    try {
      const report = await create();
      if (report) setReports((previous) => [report, ...previous]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Création impossible.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Localized>
      {
        <section className="v2-card" aria-label="Rapports du dossier">
          <h2>Rapports du dossier</h2>
          <p>
            Enregistrez un instantané des réponses, examens, pièces référencées, actions et
            résultats de comparaison. Un rapport peut documenter un dossier incomplet. Les versions
            précédentes sont conservées.
          </p>
          <button className="v2-primary" disabled={busy} onClick={() => void generate()}>
            {busy ? 'Création du rapport…' : 'Créer un rapport de la version actuelle'}
          </button>
          {error && <p role="alert">{error}</p>}
          {!reports.length && <p>Aucun rapport enregistré.</p>}
          <ul className="v2-report-list">
            {reports.slice(0, history ? undefined : 1).map((report) => {
              const url = `/api/questionnaire-v2/${id}/reports/${report.id}`;
              return (
                <Localized key={report.id}>
                  {
                    <li key={report.id}>
                      <strong>{new Date(report.createdAt).toLocaleString('fr-CH')}</strong>
                      <span className="v2-small">
                        {' '}
                        · {report.locale === 'en' ? 'English' : 'Français'}
                      </span>
                      <p translate="no">{report.title}</p>
                      <div className="v2-report-links">
                        <a
                          className="v2-secondary"
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Ouvrir / imprimer en PDF
                        </a>
                        <a href={`${url}?download=1`}>Télécharger HTML</a>
                        <details>
                          <summary>Détails techniques</summary>
                          <p>Révision {report.revision}</p>
                          <a href={`${url}?format=json`}>Télécharger JSON</a>
                        </details>
                      </div>
                    </li>
                  }
                </Localized>
              );
            })}
          </ul>
          {reports.length > 1 && (
            <button className="v2-text-button" onClick={() => setHistory((value) => !value)}>
              {history
                ? 'Afficher le dernier rapport'
                : `Historique (${reports.length - 1} rapports précédents)`}
            </button>
          )}
          <p className="v2-small">
            Pour le PDF, ouvrez le rapport puis utilisez Imprimer → Enregistrer au format PDF. Les
            fichiers joints restent dans le dossier ; le rapport contient leurs références et
            empreintes. Usage interne UNIL / Évaluateur.
          </p>
        </section>
      }
    </Localized>
  );
}
