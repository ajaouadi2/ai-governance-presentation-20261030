import { cookies } from 'next/headers';
import { V32Workspace } from '@/components/questionnaire-v32/workspace';
export async function generateMetadata() {
  return {
    title:
      (await cookies()).get('clair-language')?.value === 'en'
        ? 'Checklist v3.2'
        : 'Checklist v3.2 — parcours de démonstration',
  };
}
export default function Page() {
  return <V32Workspace />;
}
