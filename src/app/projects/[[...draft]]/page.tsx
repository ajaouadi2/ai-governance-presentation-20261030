import { notFound } from 'next/navigation';
import { PdfWorkspace } from '@/components/questionnaire-pdf/workspace';
import { pdfStore } from '@/lib/questionnaire-pdf-store';
import { cookies } from 'next/headers';
import { QuestionnaireV2Workspace } from '@/components/questionnaire-v2/workspace';
import { draftIdSchema } from '@/lib/questionnaire-v2-store';
import '../../questionnaire-v2/questionnaire-v2.css';
import { V32Projects } from '@/components/questionnaire-v32/projects';
export const dynamic = 'force-dynamic';
export async function generateMetadata() {
  return {
    title:
      (await cookies()).get('clair-language')?.value === 'en'
        ? 'Projects and assessments'
        : 'Projets et évaluations',
  };
}
export default async function QuestionnaireV2Page({
  params,
  searchParams,
}: {
  params: Promise<{ draft?: string[] }>;
  searchParams: Promise<{ version?: string }>;
}) {
  const parts = (await params).draft ?? [];
  const version = (await searchParams).version;
  if (parts.length > 1 || (parts[0] && !draftIdSchema.safeParse(parts[0]).success)) notFound();
  if (!parts[0] && version !== 'previous' && version !== 'pdf') return <V32Projects />;
  if ((!parts[0] && version === 'pdf') || (parts[0] && (await pdfStore.exists(parts[0]))))
    return <PdfWorkspace key={parts[0] ?? 'pdf-entry'} draftId={parts[0]} />;
  return <QuestionnaireV2Workspace key={parts[0] ?? 'entry'} draftId={parts[0]} />;
}
