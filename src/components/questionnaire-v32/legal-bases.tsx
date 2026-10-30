'use client';
import { useLanguage } from '@/components/language';
import { v32LegalReferences } from '@/lib/questionnaire-v32-legal';
export function V32LegalBases({ questionId }: { questionId: string }) {
  const { locale } = useLanguage();
  const en = locale === 'en';
  const refs = v32LegalReferences(questionId, locale);
  return (
    <details className="v32-stage-context">
      <summary>{en ? 'Legal bases' : 'Bases légales'}</summary>
      {refs.length ? (
        <ul className="v32-legal-list">
          {refs.map((ref) => (
            <li key={ref.law}>
              <strong>{ref.article}</strong>
              <br />
              <a href={ref.url} target="_blank" rel="noopener noreferrer">
                {ref.title} ↗
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <p>
          {en
            ? 'No precise article identified — legal reference to verify.'
            : 'Aucun article précis identifié — référence juridique à vérifier.'}
        </p>
      )}
      {!!refs.length && (
        <p className="v32-demo-cue">
          {en
            ? 'Applicability and the version in force must be checked for this project.'
            : 'Applicabilité et version en vigueur à vérifier pour ce projet.'}
        </p>
      )}
    </details>
  );
}
