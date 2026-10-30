import { V32Localized } from './localized';
import { v32Journey } from '@/lib/questionnaire-v32-journey';
import Link from 'next/link';
import './workspace.css';
export function V32Guide() {
  return (
    <V32Localized>
      <article className="v32-workspace">
        <header className="v32-hero">
          <span>GUIDE DU PARCOURS</span>
          <h1>Évaluer un outil, étape par étape</h1>
          <p>
            Un espace UNIL unique pour évaluer l’outil et le fournisseur, puis enregistrer la
            décision.
          </p>
        </header>
        <section className="v32-question">
          <h2>Commencer et reprendre</h2>
          <p>
            Depuis Projets, créez une nouvelle évaluation. Donnez-lui un nom, puis répondez à la
            question proposée. « Enregistrer et continuer » sauvegarde votre contribution sur le
            serveur et suit le parcours prévu par le questionnaire. Le même lien permet de rouvrir
            le dossier.
          </p>
          <Link href="/projects">Voir mes projets →</Link>
        </section>
        <section className="v32-question">
          <h2>Les six étapes</h2>
          <ol>
            {v32Journey.stages.map((s) => (
              <li key={s.number}>
                {s.phase} — {s.title}
              </li>
            ))}
          </ol>
          <p>
            L’étape 5 comprend quatre sous-sections : éligibilité, données et sécurité, outil IA et
            contrat. Les réponses déterminent les questions suivantes. Les questions omises restent
            consultables, mais leurs anciennes réponses ne contribuent pas au résultat courant. Les
            questions de publication et de suivi gardent leur déclencheur après signature ; les
            phases ne constatent pas à elles seules qu’un achat ou une signature a eu lieu.
          </p>
        </section>
        <div className="v32-archive-grid">
          <section className="v32-question">
            <h2>Qui utilise l’application ?</h2>
            <p>
              L’UNIL renseigne toutes les étapes à partir des informations disponibles et des
              documents reçus du fournisseur. Une déclaration fournisseur est distinguée d’un écrit
              vérifié par l’UNIL. Les avis du DPO, du service juridique et de l’informatique restent
              à obtenir lorsqu’ils sont demandés. La synthèse est calculée ; la décision reste
              humaine.
            </p>
          </section>
          <section className="v32-question">
            <h2>Comprendre les résultats</h2>
            <p>
              <b>Point bloquant :</b> arrêt et examen de la décision. <b>Action requise :</b> mesure
              à suivre dans la synthèse. <b>Information de parcours :</b> détermine les contrôles
              pertinents. Les couleurs accompagnent ces libellés sans remplacer leur sens.
            </p>
            <p>
              Un avis manquant ou une règle non résolue peut suspendre le parcours. Le prototype
              n’autorise pas une mise en service à lui seul.
            </p>
          </section>
        </div>
        <section className="v32-notice">
          <h2>Ce qui reste à compléter</h2>
          <p>
            Le PDF source conserve 97 questions et 254 réponses. Le parcours actif exclut la
            question 4.4, retirée à la demande de l’UNIL. Les points non résolus restent signalés
            dans le dossier. Les pièces v3.2 ne sont pas téléversées. Depuis Rapports, générez un
            instantané de la révision enregistrée, puis imprimez-le ou enregistrez-le en PDF. Chaque
            version reste conservée ; un rapport sans décision actuelle confirmée est provisoire. La
            synthèse propose une décision et suit les conditions ; l’UNIL confirme sa décision avec
            son nom, sa fonction, la date et les motifs. Utilisez uniquement des données fictives ;
            aucun compte universitaire réel n’est intégré.
          </p>
        </section>
        <p>
          <Link href="/demo">Préparer une démonstration en 3 minutes →</Link>
        </p>
        <p>
          <Link href="/archives">Les versions antérieures sont dans Archives →</Link>
        </p>
      </article>
    </V32Localized>
  );
}
