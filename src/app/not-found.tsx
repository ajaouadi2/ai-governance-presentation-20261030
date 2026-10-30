import { V32Localized } from '@/components/questionnaire-v32/localized';
import Link from 'next/link';
export default function NotFound() {
  return (
    <V32Localized>
      <div className="panel p-8">
        <h1>Page introuvable</h1>
        <p className="my-4">Cette page ou ce dossier n’existe pas.</p>
        <Link href="/dashboard" className="link">
          Retour aux dossiers
        </Link>
      </div>
    </V32Localized>
  );
}
