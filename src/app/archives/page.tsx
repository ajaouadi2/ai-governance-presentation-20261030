import Link from 'next/link';
import { V32Archives } from '@/components/questionnaire-v32/archives';
import { Archives } from '@/components/questionnaire-v2/archives';
import { v32OpenIssues } from '@/lib/questionnaire-v32-engine';
import { v32DpfPolicy } from '@/lib/questionnaire-v32-policy';
import { V32Localized } from '@/components/questionnaire-v32/localized';
import '@/components/questionnaire-v32/workspace.css';
export default async function ArchivePage({
  searchParams,
}: {
  searchParams: Promise<{ version?: string }>;
}) {
  if ((await searchParams).version === 'v2') return <Archives />;
  return (
    <article className="v32-workspace" translate="no">
      <header className="v32-hero">
        <span>HISTORIQUE</span>
        <h1>Archives</h1>
        <p>
          Retrouvez les anciens parcours, leurs dossiers et leurs rapports. Rien n’a été supprimé ni
          converti.
        </p>
      </header>
      <V32Archives />
      <V32Localized>
        <details id="reference-notes" className="v32-context" translate="yes">
          <summary>Notes de référence archivées</summary>
          <h2>Politique d’évaluation</h2>
          <p>{v32DpfPolicy.fr}</p>
          <p>
            Source PDF conservée : 5.2 d, verdict initial « Ne pas poursuivre ». Politique
            d’application actuelle : contrôle satisfait sur la réponse déclarée.
          </p>
          {v32OpenIssues.map((issue) => (
            <details key={issue.id}>
              <summary>
                {issue.id} — {issue.topic}
              </summary>
              <p>{issue.description}</p>
            </details>
          ))}
        </details>
      </V32Localized>
      <div className="v32-archive-grid">
        <section className="v32-question">
          <h2>Questionnaire du 26 octobre</h2>
          <p>Le parcours PDF précédent, avec ses projets, preuves et rapports conservés.</p>
          <Link href="/projects?version=pdf">Consulter les dossiers →</Link>
          <p>
            <Link href="/guide?version=pdf">Guide de cette version</Link>
          </p>
        </section>
        <section className="v32-question">
          <h2>Questionnaires du 25 octobre</h2>
          <p>Les premières évaluations de l’équipe et leurs comparaisons.</p>
          <Link href="/projects?version=previous">Consulter les dossiers →</Link>
          <p>
            <Link href="/archives?version=v2">Dossiers archivés de cette version</Link>
          </p>
          <p>
            <Link href="/guide?version=previous">Ancien guide</Link>
          </p>
        </section>
        <section className="v32-question">
          <h2>Première démonstration</h2>
          <p>Le parcours initial reste disponible dans son espace historique.</p>
          <Link href="/archives/legacy">Consulter les archives initiales →</Link>
        </section>
      </div>
      <details className="v32-context">
        <summary>Outils de travail conservés</summary>
        <p>
          <Link href="/questionnaire-v32">Brouillon local v3.2</Link> — espace individuel, distinct
          des dossiers partagés.
        </p>
        <p>
          Les dossiers d’essai v3.2 retirés de la démonstration restent accessibles ci-dessus, sans
          suppression de données.
        </p>
      </details>
    </article>
  );
}
