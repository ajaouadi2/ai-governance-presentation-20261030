import { PdfGuide } from '@/components/questionnaire-pdf/guide';
import PreviousGuide from '@/components/questionnaire-v2/guide';
import { V32Guide } from '@/components/questionnaire-v32/guide';
export default async function Guide({
  searchParams,
}: {
  searchParams: Promise<{ version?: string }>;
}) {
  const version = (await searchParams).version;
  return version === 'previous' ? (
    <PreviousGuide />
  ) : version === 'pdf' ? (
    <PdfGuide />
  ) : (
    <V32Guide />
  );
}
