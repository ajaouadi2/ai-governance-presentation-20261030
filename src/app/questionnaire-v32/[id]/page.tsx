import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { V32Workspace } from '@/components/questionnaire-v32/workspace';
export const dynamic = 'force-dynamic';
export async function generateMetadata() {
  return {
    title:
      (await cookies()).get('clair-language')?.value === 'en'
        ? 'Checklist v3.2'
        : 'Dossier partagé — checklist v3.2',
  };
}
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  return <V32Workspace key={id} draftId={id} />;
}
