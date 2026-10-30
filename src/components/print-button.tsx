'use client';
import { Printer } from 'lucide-react';
import { Button } from './ui/button';
export function PrintButton() {
  return (
    <Button onClick={() => window.print()}>
      <Printer data-icon="inline-start" />
      Imprimer / Enregistrer en PDF
    </Button>
  );
}
