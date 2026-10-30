'use client';
import { useState } from 'react';
import { Download, ExternalLink, Paperclip, Trash2, Upload } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Notice } from './shared';
import { api, dateLabel } from '@/lib/client';
import type { CaseView, Control } from '@/lib/domain';
import type { CasePayload } from './questionnaire';
export function EvidenceList({
  c,
  control,
  editable,
  onSaved,
}: {
  c: CaseView;
  control: Control;
  editable: boolean;
  onSaved: (p: CasePayload) => void;
}) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [inputKey, setInputKey] = useState(0);
  const documents = c.evidence.filter((e) => e.controlId === control.id);
  async function upload(replaceId?: string) {
    if (!file) return;
    setError('');
    setBusy(true);
    try {
      const data = new FormData();
      data.set('file', file);
      data.set('controlId', control.id);
      let result = await api<CasePayload>(`/api/cases/${c.id}/evidence`, {
        method: 'POST',
        body: data,
      });
      if (replaceId) {
        await api(`/api/evidence/${replaceId}`, { method: 'DELETE' });
        result = await api<CasePayload>(`/api/cases/${c.id}`);
      }
      onSaved(result);
      setFile(null);
      setInputKey((k) => k + 1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function remove(id: string) {
    if (!window.confirm('Retirer ce justificatif ? Les contrôles concernés devront être revus.'))
      return;
    setBusy(true);
    setError('');
    try {
      await api(`/api/evidence/${id}`, { method: 'DELETE' });
      onSaved(await api<CasePayload>(`/api/cases/${c.id}`));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="flex flex-col gap-4">
      {error ? (
        <Notice title="Justificatif non enregistré" error>
          {error}
        </Notice>
      ) : null}
      <p className="text-sm text-muted-foreground">
        <strong>Preuve attendue :</strong> {control.evidence}
      </p>
      {documents.length ? (
        <ul className="flex flex-col gap-2">
          {documents.map((e) => (
            <li
              key={e.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-muted px-4 py-3"
            >
              <div className="flex min-w-0 items-start gap-3">
                <Paperclip size={17} className="mt-1 shrink-0" />
                <div>
                  <a
                    className="link break-all"
                    href={`/api/evidence/${e.id}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {e.originalName}
                  </a>
                  <p className="text-xs text-muted-foreground">
                    {Math.ceil(e.size / 1024)} Ko · {dateLabel(e.createdAt)}
                  </p>
                </div>
              </div>
              <div className="flex gap-1">
                <Button asChild variant="ghost" size="icon" aria-label={`Ouvrir ${e.originalName}`}>
                  <a href={`/api/evidence/${e.id}`} target="_blank" rel="noreferrer">
                    <ExternalLink />
                  </a>
                </Button>
                <Button
                  asChild
                  variant="ghost"
                  size="icon"
                  aria-label={`Télécharger ${e.originalName}`}
                >
                  <a href={`/api/evidence/${e.id}?download=1`}>
                    <Download />
                  </a>
                </Button>
                {editable ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={busy}
                    onClick={() => remove(e.id)}
                    aria-label={`Retirer ${e.originalName}`}
                  >
                    <Trash2 />
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">Aucun justificatif joint.</p>
      )}
      {editable ? (
        <div className="flex flex-col gap-3">
          <label className="text-xs text-muted-foreground" htmlFor={`file-${control.id}`}>
            Document fictif · PDF, TXT, PNG ou JPG · 10 Mo maximum
          </label>
          <Input
            key={inputKey}
            id={`file-${control.id}`}
            type="file"
            accept=".pdf,.txt,.png,.jpg,.jpeg"
            disabled={busy}
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={!file || busy}
              onClick={() => upload()}
            >
              <Upload data-icon="inline-start" />
              {busy ? 'Enregistrement…' : 'Joindre le document'}
            </Button>
            {file && documents.length === 1 ? (
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => upload(documents[0].id)}
              >
                Remplacer le justificatif existant
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
