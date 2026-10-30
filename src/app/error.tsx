'use client';
import { V32Localized } from '@/components/questionnaire-v32/localized';
import { Button } from '@/components/ui/button';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <V32Localized>
      <div className="panel p-8">
        <h2>Impossible d’ouvrir cette page</h2>
        <p className="my-4 text-muted-foreground">
          Vérifiez que la base locale est démarrée, puis réessayez. Vos dossiers enregistrés sont
          conservés.
        </p>
        <Button onClick={reset}>Réessayer</Button>
      </div>
    </V32Localized>
  );
}
