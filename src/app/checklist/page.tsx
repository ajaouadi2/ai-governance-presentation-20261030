import { redirect } from 'next/navigation';
import { session } from '@/lib/server';
import { buildChecklistModel } from '@/lib/checklist-model';
import { canReadChecklist } from '@/lib/checklist-access';
import { ChecklistReference } from '@/components/checklist-reference';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Checklist et logique / Checklist & Logic' };

export default async function ChecklistPage({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}) {
  const { role } = await session();
  if (!canReadChecklist(role)) redirect('/dashboard');
  const { lang } = await searchParams;
  return (
    <ChecklistReference
      model={buildChecklistModel()}
      initialLanguage={lang === 'en' ? 'en' : 'fr'}
    />
  );
}
