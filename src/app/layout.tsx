import type { Metadata } from 'next';
import './globals.css';
import { Shell } from '@/components/shell';
import { session } from '@/lib/server';
import { cookies } from 'next/headers';
import { LanguageProvider } from '@/components/language';
export async function generateMetadata(): Promise<Metadata> {
  const en = (await cookies()).get('clair-language')?.value === 'en';
  return {
    title: {
      default: en ? 'Responsible AI tool assessment' : 'Évaluation des outils d’IA',
      template: en ? '%s · AI tool assessment' : '%s · Évaluation des outils d’IA',
    },
    description: en
      ? 'Local academic prototype for AI supplier due diligence.'
      : 'Prototype académique local de due diligence des fournisseurs d’IA.',
  };
}
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { role } = await session();
  const locale = (await cookies()).get('clair-language')?.value === 'en' ? 'en' : 'fr';
  return (
    <html lang={locale}>
      <body>
        <LanguageProvider initialLocale={locale}>
          <Shell role={role}>{children}</Shell>
        </LanguageProvider>
      </body>
    </html>
  );
}
