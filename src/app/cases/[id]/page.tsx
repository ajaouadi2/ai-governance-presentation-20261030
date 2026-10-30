import { redirect } from 'next/navigation';
import { session } from '@/lib/server';
export default async function CaseIndex({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { role } = await session();
  redirect(`/cases/${id}/${role === 'supplier' ? 'vendor' : 'need'}`);
}
