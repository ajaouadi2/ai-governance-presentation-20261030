import { redirect } from 'next/navigation';
export default async function LegacyLink({ params }: { params: Promise<{ draft?: string[] }> }) {
  const { draft = [] } = await params;
  redirect('/projects' + (draft.length ? '/' + draft.map(encodeURIComponent).join('/') : ''));
}
