import { V32Localized } from '@/components/questionnaire-v32/localized';
import Link from 'next/link';
import { v32Store } from '@/lib/questionnaire-v32-store';
import '@/components/questionnaire-v32/workspace.css';
export const dynamic = 'force-dynamic';
export default async function DemoPage() {
  const dossiers = await v32Store.list();
  const example = (letter: string) =>
    dossiers.find((d) =>
      d.title.startsWith(
        ({ A: 'LingoCampus', B: 'ResearchDesk', C: 'InterviewSense' } as Record<string, string>)[
          letter
        ] + ' —',
      ),
    );
  return (
    <V32Localized>
      <article className="v32-workspace v32-demo-guide" lang="fr">
        <header className="v32-hero">
          <span>FICHE PRÉSENTATEUR · 2–3 MINUTES</span>
          <h1>Présenter l’outil simplement</h1>
          <p>
            Un exemple principal, deux résultats alternatifs. Ne remplissez pas tout le
            questionnaire en direct.
          </p>
          <Link href="/projects">Ouvrir les projets →</Link>
        </header>
        <section className="v32-question">
          <h2>Avant de commencer</h2>
          <ul>
            <li>
              Ouvrir le lien dans Chrome, Edge ou Safari et vérifier l’accès depuis un autre
              appareil.
            </li>
            <li>
              Garder le PC branché, éveillé et connecté ; laisser le serveur et le tunnel
              fonctionner.
            </li>
            <li>
              Préouvrir ResearchDesk, sa synthèse et un rapport. Préparer InterviewSense pour
              montrer le blocage et LingoCampus pour l’avis favorable.
            </li>
            <li>
              Tester une fois « Imprimer / Enregistrer en PDF » dans le navigateur de présentation
              et garder une copie locale du rapport.
            </li>
            <li>
              Fermer les anciens liens de tunnel, couper les notifications et répéter une fois avec
              un chronomètre.
            </li>
          </ul>
          <p>
            <b>Plan B :</b> <a href="http://127.0.0.1:3000/projects">ouvrir l’application locale</a>{' '}
            si le tunnel échoue. Le lien local fonctionne seulement sur le PC qui exécute
            l’application.
          </p>
        </section>
        <div className="v32-demo-links">
          {['B', 'C', 'A'].map((letter) => {
            const d = example(letter);
            return d ? (
              <Link translate="no" key={letter} href={'/questionnaire-v32/' + d.id}>
                {d.title} →
              </Link>
            ) : null;
          })}
        </div>
        <section className="v32-question">
          <h2>0:00–0:20 · Le besoin</h2>
          <p className="v32-demo-cue">À l’écran : Projets.</p>
          <blockquote>
            « Notre outil aide l’UNIL à examiner un projet d’acquisition d’intelligence
            artificielle. Nous avons transformé le questionnaire de l’équipe en un parcours guidé,
            de la qualification du projet à la préparation de la mise en service. »
          </blockquote>
        </section>
        <section className="v32-question">
          <h2>0:20–1:00 · Les questions et le parcours</h2>
          <p className="v32-demo-cue">
            Ouvrir ResearchDesk → étape 1 → question 1 → Bases légales. Puis question 4, via la
            sous-section « Périmètre et utilisateurs », pour montrer la recommandation liée à la
            réponse Oui. Garder les réponses préparées.
          </p>
          <blockquote>
            « L’UNIL renseigne les réponses à partir du projet et des documents du fournisseur. Les
            questions sont regroupées en six étapes. Les réponses déterminent les contrôles
            pertinents : par exemple, selon les données traitées ou le classement de l’outil. Les
            bases légales restent consultables, et les recommandations apparaissent avec la réponse
            concernée. Nous gardons ici un dossier fictif déjà rempli pour vous montrer le résultat.
            »
          </blockquote>
        </section>
        <section className="v32-question">
          <h2>1:00–1:40 · La synthèse et la décision</h2>
          <p className="v32-demo-cue">
            ResearchDesk → Synthèse → ouvrir une action. Montrer son responsable et son échéance,
            puis la décision UNIL.
          </p>
          <blockquote>
            « La synthèse rassemble les points bloquants, les actions et les validations attendues.
            Dans cet exemple, l’application propose un avis favorable sous conditions. Chaque
            condition peut être suivie avec un responsable, une échéance et une référence de preuve.
            La proposition est calculée, mais la décision reste confirmée par l’UNIL, avec une
            personne identifiée, une date et des motifs. Une information manquante n’est pas
            considérée comme une validation. »
          </blockquote>
        </section>
        <section className="v32-question">
          <h2>1:40–2:10 · Le rapport</h2>
          <p className="v32-demo-cue">
            ResearchDesk → Rapports → aperçu déjà préparé. Montrer « Générer le rapport » et le
            bouton PDF ; éviter de parcourir toute l’annexe.
          </p>
          <blockquote>
            « Nous pouvons ensuite générer un rapport à partir de la version enregistrée. Il reprend
            la synthèse, la décision, les conditions et les références. Les réponses détaillées
            figurent en annexe. Chaque version est conservée : une modification ultérieure du
            dossier ne réécrit pas un ancien rapport. Sans décision actuelle confirmée, le rapport
            reste provisoire. »
          </blockquote>
        </section>
        <section className="v32-question">
          <h2>2:10–2:40 · Les autres résultats et la conclusion</h2>
          <p className="v32-demo-cue">
            Ouvrir InterviewSense → Synthèse : avis défavorable. Puis LingoCampus → Synthèse : avis
            favorable, si le temps le permet.
          </p>
          <blockquote>
            « Ce deuxième exemple montre qu’un point bloquant conduit à un avis défavorable. À
            l’inverse, LingoCampus illustre un avis favorable lorsque les contrôles du parcours sont
            renseignés et les actions vérifiées. L’objectif est de rendre l’examen plus lisible, de
            suivre les mesures et de conserver les motifs de la décision. Il s’agit d’un prototype
            académique sur des données fictives : il assiste l’analyse sans certifier à lui seul la
            conformité juridique ni autoriser la mise en service. »
          </blockquote>
        </section>
        <section className="v32-notice">
          <h2>Si l’on vous pose la question</h2>
          <p>
            <b>Est-ce une IA ?</b> Non : les propositions suivent des règles explicites issues du
            questionnaire, sans modèle génératif.
          </p>
          <p>
            <b>Les preuves sont-elles téléversées ?</b> Pas dans ce parcours : nous conservons leurs
            références et la vérification déclarée par l’UNIL.
          </p>
          <p>
            <b>Le droit est-il définitivement validé ?</b> Non : les points documentaires encore
            ouverts sont signalés et doivent être examinés par les personnes compétentes.
          </p>
          <p>
            <b>Que reste-t-il avant la séance ?</b> Vérifier le lien et l’export PDF sur le
            navigateur qui servira réellement, puis répéter le parcours. Pour tenir en deux minutes,
            omettre A et raccourcir la présentation des questions.
          </p>
        </section>
      </article>
    </V32Localized>
  );
}
