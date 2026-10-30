'use client';
import { useEffect, useRef, useState } from 'react';
import { translateV32 } from '@/lib/questionnaire-v32-i18n';
import { useLanguage } from '@/components/language';
type Report = {
  id: string;
  revision: number;
  generatedAt: string;
  locale: 'fr' | 'en';
  provisional: boolean;
};
export function V32Reports({
  draftId,
  revision,
  dirty,
  disabled,
  onSave,
}: {
  draftId?: string;
  revision: number;
  dirty: boolean;
  disabled: boolean;
  onSave: () => Promise<boolean>;
}) {
  const { locale } = useLanguage();
  const t = (fr: string, en: string) => (locale === 'en' ? en : fr);
  const [reports, setReports] = useState<Report[]>([]);
  const [selected, setSelected] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const frame = useRef<HTMLIFrameElement>(null);
  useEffect(() => {
    if (!draftId) return;
    let cancelled = false;
    fetch(`/api/questionnaire-v32/${draftId}/reports`, { cache: 'no-store' })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error);
        if (!cancelled) {
          setReports(data.reports);
          setSelected(
            data.reports.find((r: Report) => r.locale === locale)?.id ?? data.reports[0]?.id,
          );
        }
      })
      .catch((e) => {
        if (!cancelled) setError(translateV32(e.message, locale));
      });
    return () => {
      cancelled = true;
    };
  }, [draftId, locale]);
  async function generate() {
    setBusy(true);
    setError('');
    try {
      const r = await fetch(`/api/questionnaire-v32/${draftId}/reports`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Clair-Workspace': 'unil-3' },
        body: JSON.stringify({ revision, locale }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      setReports((old) => [data.report, ...old]);
      setReady(false);
      setSelected(data.report.id);
    } catch (e) {
      setError(translateV32((e as Error).message, locale));
    } finally {
      setBusy(false);
    }
  }
  const current = reports.find((r) => r.id === selected);
  return (
    <section className="v32-reports" lang={locale}>
      <header className="v32-report-header">
        <div>
          <span>UNIL · {t('RAPPORT D’ÉVALUATION', 'ASSESSMENT REPORT')}</span>
          <h2>{t('Un rapport clair, prêt à partager', 'A clear report, ready to share')}</h2>
          <p>
            {t(
              'La synthèse en premier, les réponses et les bases légales en annexe.',
              'Summary first, answers and legal bases in the appendix.',
            )}
          </p>
        </div>
      </header>
      {!draftId ? (
        <p className="v32-notice">
          {t(
            'Créez un dossier partagé depuis « Dossier et sauvegarde » pour conserver les versions du rapport.',
            'Create a shared assessment from the dossier and saving panel to retain report versions.',
          )}
        </p>
      ) : (
        <>
          <div className="v32-report-actions">
            {dirty ? (
              <button disabled={disabled || busy} onClick={() => void onSave()}>
                {t('Enregistrer avant de générer', 'Save before generating')}
              </button>
            ) : (
              <button disabled={disabled || busy} onClick={() => void generate()}>
                {busy
                  ? t('Génération…', 'Generating…')
                  : t('Générer le rapport', 'Generate report')}
              </button>
            )}
            <button
              disabled={!ready || !selected || busy}
              onClick={() => {
                frame.current?.contentWindow?.focus();
                frame.current?.contentWindow?.print();
              }}
            >
              {t('Imprimer / Enregistrer en PDF', 'Print / Save as PDF')}
            </button>
            {selected && (
              <a
                className="v32-print-link"
                href={`/api/questionnaire-v32/${draftId}/reports/${selected}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                {t('Ouvrir la version imprimable ↗', 'Open printable version ↗')}
              </a>
            )}
          </div>
          <p className="v32-question-meta">
            {t(
              'Le rapport conserve la révision enregistrée. Sans décision UNIL actuelle et confirmée, il porte la mention « Rapport provisoire ». Choisissez « Enregistrer au format PDF » dans la fenêtre d’impression. Si elle ne s’ouvre pas dans le navigateur intégré, ouvrez la version imprimable dans votre navigateur habituel puis utilisez Ctrl+P (Mac : ⌘P).',
              'The report preserves the saved revision. Without a current confirmed UNIL decision it is marked provisional. Choose “Save as PDF” in the print dialog. If the in-app browser does not open it, open the printable version in your usual browser and use Ctrl+P (Mac: ⌘P).',
            )}
          </p>
          {error && (
            <p role="alert" className="v32-error">
              {error}
            </p>
          )}
          {reports.length > 0 && (
            <label>
              {t('Versions conservées', 'Saved versions')}
              <select
                value={selected ?? ''}
                onChange={(e) => {
                  setReady(false);
                  setSelected(e.target.value);
                }}
              >
                {reports.map((r) => (
                  <option key={r.id} value={r.id}>
                    {new Date(r.generatedAt).toLocaleString(locale === 'en' ? 'en-GB' : 'fr-CH', {
                      timeZone: 'Europe/Paris',
                    })}{' '}
                    · {t('Révision', 'Revision')} {r.revision} ·{' '}
                    {r.provisional
                      ? t('Provisoire', 'Provisional')
                      : t('Décision confirmée', 'Confirmed decision')}{' '}
                    · {r.locale.toUpperCase()}
                  </option>
                ))}
              </select>
            </label>
          )}
          {current && (
            <>
              <p role="status" className="v32-notice">
                {dirty || current.revision !== revision
                  ? t(
                      'Ce rapport correspond à une version antérieure. Enregistrez puis générez un nouveau rapport pour inclure les modifications.',
                      'This report represents an earlier version. Save and generate a new report to include changes.',
                    )
                  : t(
                      'Ce rapport correspond à la révision enregistrée actuelle.',
                      'This report matches the current saved revision.',
                    )}
              </p>
              <iframe
                ref={frame}
                title={t('Aperçu du rapport', 'Report preview')}
                className="v32-report-preview"
                src={`/api/questionnaire-v32/${draftId}/reports/${selected}`}
                onLoad={() => setReady(true)}
              />
            </>
          )}
          {!reports.length && (
            <div className="v32-report-empty">
              <h3>{t('Votre premier rapport', 'Your first report')}</h3>
              <p>
                {t(
                  'Générez un aperçu à partir du dossier enregistré. Les rapports précédents resteront disponibles ici.',
                  'Generate a preview from the saved assessment. Previous reports will remain available here.',
                )}
              </p>
            </div>
          )}
        </>
      )}
    </section>
  );
}
