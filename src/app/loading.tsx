import { V32Localized } from '@/components/questionnaire-v32/localized';
export default function Loading() {
  return (
    <V32Localized>
      <p role="status" className="py-12 text-muted-foreground">
        Ouverture de l’espace d’évaluation…
      </p>
    </V32Localized>
  );
}
