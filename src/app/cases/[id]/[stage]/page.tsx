import { casePayload, HttpError, session } from '@/lib/server';
import { notFound, redirect } from 'next/navigation';
import { Workspace } from '@/components/workspace';
import { Notice } from '@/components/shared';
export default async function CasePage({
  params,
}: {
  params: Promise<{ id: string; stage: string }>;
}) {
  const { id, stage } = await params;
  if (!['need', 'triage', 'vendor', 'reviews', 'scoring', 'report'].includes(stage)) notFound();
  const { role } = await session();
  if (role === 'supplier' && stage !== 'vendor') redirect(`/cases/${id}/vendor`);
  let initial;
  let forbidden = false;
  try {
    initial = await casePayload(id);
  } catch (e) {
    if (e instanceof HttpError && e.status === 404) notFound();
    if (e instanceof HttpError && e.status === 403) forbidden = true;
    else throw e;
  }
  if (forbidden || !initial)
    return (
      <Notice title="Accès au dossier limité">
        Ce dossier n’est pas lié au fournisseur simulé. Revenez au tableau de bord ou choisissez un
        autre rôle.
      </Notice>
    );
  return <Workspace key={id + stage + role} initial={initial} role={role} stage={stage} />;
}
