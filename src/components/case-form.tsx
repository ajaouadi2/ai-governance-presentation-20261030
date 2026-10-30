'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Field, FieldGroup, FieldLabel, FieldDescription } from './ui/field';
import { Notice } from './shared';
import { api } from '@/lib/client';
import type { CaseView } from '@/lib/domain';
export function CaseForm({ existing, onSaved }: { existing?: CaseView; onSaved?: () => void }) {
  const router = useRouter();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const d = Object.fromEntries(new FormData(e.currentTarget));
    try {
      const result = await api<{ id: string }>(
        existing ? `/api/cases/${existing.id}` : '/api/cases',
        {
          method: existing ? 'PATCH' : 'POST',
          body: JSON.stringify({ ...d, ...(existing ? { revision: existing.revision } : {}) }),
        },
      );
      if (existing) onSaved?.();
      else router.push(`/cases/${result.id}/need`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="panel p-6 md:p-8">
      <FieldGroup>
        <div>
          <h2>{existing ? 'Identification du dossier' : 'Créer un dossier'}</h2>
          <p className="mt-2 text-muted-foreground">
            Utilisez exclusivement des informations fictives pour cette démonstration.
          </p>
        </div>
        {error ? (
          <Notice title="Enregistrement impossible" error>
            {error}
          </Notice>
        ) : null}
        <Field>
          <FieldLabel htmlFor="title">Nom du dossier / outil *</FieldLabel>
          <Input
            id="title"
            name="title"
            defaultValue={existing?.title}
            required
            minLength={3}
            maxLength={160}
            placeholder="Ex. Assistant de traduction pédagogique"
          />
        </Field>
        <div className="grid gap-6 sm:grid-cols-2">
          {[
            { id: 'department', label: 'Service ou faculté', value: existing?.department },
            { id: 'owner', label: 'Responsable fictif', value: existing?.owner },
            {
              id: 'vendorName',
              label: 'Fournisseur envisagé',
              value: existing?.vendor?.name,
              optional: true,
            },
            {
              id: 'product',
              label: 'Produit / version',
              value: existing?.vendor?.product,
              optional: true,
            },
          ].map((f) => (
            <Field key={f.id}>
              <FieldLabel htmlFor={f.id}>
                {f.label}
                {f.optional ? '' : ' *'}
              </FieldLabel>
              <Input
                id={f.id}
                name={f.id}
                defaultValue={f.value ?? ''}
                required={!f.optional}
                minLength={f.optional ? 0 : 2}
                maxLength={200}
              />
            </Field>
          ))}
        </div>
        <Field>
          <FieldLabel htmlFor="purpose">Finalité *</FieldLabel>
          <select
            id="purpose"
            name="purpose"
            className="native-select"
            defaultValue={existing?.purpose || 'Enseignement'}
          >
            {['Enseignement', 'Recherche', 'Administration', 'RH', 'Autre', 'Mixte'].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </Field>
        <Field>
          <FieldLabel htmlFor="description">Description du besoin *</FieldLabel>
          <Textarea
            id="description"
            name="description"
            defaultValue={existing?.description}
            required
            minLength={10}
            maxLength={8000}
          />
          <FieldDescription>
            Décrivez la tâche et l’utilisation prévue des résultats.
          </FieldDescription>
        </Field>
        <div className="grid gap-6 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="assessmentDate">Date de l’évaluation *</FieldLabel>
            <Input
              id="assessmentDate"
              type="date"
              name="assessmentDate"
              defaultValue={existing?.assessmentDate || new Date().toLocaleDateString('en-CA')}
              required
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="deploymentDate">Mise en service envisagée *</FieldLabel>
            <Input
              id="deploymentDate"
              type="date"
              name="deploymentDate"
              defaultValue={existing?.deploymentDate}
              required
            />
          </Field>
        </div>
        <Button disabled={busy} type="submit">
          {busy
            ? 'Enregistrement…'
            : existing
              ? 'Enregistrer les modifications'
              : 'Créer et décrire le besoin'}
        </Button>
      </FieldGroup>
    </form>
  );
}
