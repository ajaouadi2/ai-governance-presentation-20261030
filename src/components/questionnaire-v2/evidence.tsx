'use client';
import { Localized } from '@/components/language';

import { useRef, useState } from 'react';
import { V2_FILE_ACCEPT, V2_MAX_FILE_BYTES } from '@/lib/questionnaire-v2-evidence';
import type { V2Evidence } from '@/lib/questionnaire-v2-evidence';
import type { V2Actor } from '@/lib/questionnaire-v2-domain';

const labels: Record<V2Actor, string> = {
  unil: 'UNIL',
  supplier: 'Fournisseur',
  reviewer: 'Évaluateur',
};
export function V2EvidencePanel({
  draftId,
  questionId,
  actor,
  supplierQuestion,
  files,
  busy,
  onDirty,
  onUpload,
}: {
  draftId: string;
  questionId: string;
  actor: V2Actor;
  supplierQuestion: boolean;
  files: V2Evidence[];
  busy: boolean;
  onDirty: (key: string, dirty: boolean) => void;
  onUpload: (questionId: string, file: File, visibility: 'internal' | 'shared') => Promise<boolean>;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [shared, setShared] = useState(actor === 'supplier');
  const [error, setError] = useState('');
  const input = useRef<HTMLInputElement>(null);
  return (
    <Localized>
      {
        <section className="v2-evidence" aria-label={`Pièces jointes de ${questionId}`}>
          <h4>
            Pièces jointes <span>({files.length})</span>
          </h4>
          {files.length ? (
            <ul>
              {files.map((item) => (
                <li key={item.id}>
                  <div>
                    <strong translate="no">{item.originalName}</strong>
                    <small>
                      {Math.max(1, Math.round(item.size / 1024))} Ko · {labels[item.uploadedBy]} ·{' '}
                      {item.visibility === 'shared'
                        ? 'Partagée avec le fournisseur'
                        : 'Interne UNIL'}
                    </small>
                  </div>
                  <a
                    className="link"
                    href={`/api/questionnaire-v2/${draftId}/evidence/${item.id}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Télécharger
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="v2-small">Aucune pièce jointe à cette question.</p>
          )}
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              if (!file) return;
              if (!file.size || file.size > V2_MAX_FILE_BYTES) {
                setError('Choisissez un fichier entre 1 octet et 10 Mo.');
                return;
              }
              if (
                await onUpload(
                  questionId,
                  file,
                  actor === 'supplier' || shared ? 'shared' : 'internal',
                )
              ) {
                setFile(null);
                setError('');
                onDirty(`evidence:${questionId}`, false);
                if (input.current) input.current.value = '';
              }
            }}
          >
            <label htmlFor={`evidence-${questionId}`}>Ajouter un justificatif</label>
            <input
              ref={input}
              id={`evidence-${questionId}`}
              type="file"
              accept={V2_FILE_ACCEPT}
              disabled={busy}
              onChange={(event) => {
                const selected = event.target.files?.[0] ?? null;
                setFile(selected);
                setError('');
                onDirty(`evidence:${questionId}`, !!selected);
              }}
            />
            <p className="v2-small">PDF, TXT, PNG, JPG ou DOCX · 10 Mo maximum par fichier.</p>
            {actor !== 'supplier' && supplierQuestion && (
              <label className="v2-unknown">
                <input
                  type="checkbox"
                  checked={shared}
                  disabled={busy}
                  onChange={(event) => setShared(event.target.checked)}
                />
                Partager cette pièce avec le fournisseur lié
              </label>
            )}
            {actor !== 'supplier' && !supplierQuestion && (
              <p className="v2-small">Cette pièce reste réservée à l’UNIL et à l’évaluateur.</p>
            )}
            {actor === 'supplier' && (
              <p className="v2-small">
                Cette pièce sera disponible pour l’UNIL et l’évaluateur du dossier.
              </p>
            )}
            {error && (
              <p role="alert" className="v2-small text-destructive">
                {error}
              </p>
            )}
            <button className="v2-secondary" disabled={busy || !file}>
              Joindre le fichier
            </button>
            {file && (
              <button
                className="v2-text-button"
                type="button"
                disabled={busy}
                onClick={() => {
                  setFile(null);
                  setError('');
                  if (input.current) input.current.value = '';
                  onDirty(`evidence:${questionId}`, false);
                }}
              >
                Annuler la sélection
              </button>
            )}
          </form>
        </section>
      }
    </Localized>
  );
}
