'use client';
import Link from 'next/link';
import { useLanguage } from '@/components/language';
import '../../app/guide/guide.css';
export default function Guide() {
  const { locale } = useLanguage();
  const t = (fr: string, en: string) => (locale === 'en' ? en : fr);
  const stages = [
    t('Qualifier le projet', 'Define the project'),
    t('Vérifier les pratiques', 'Check practices'),
    t('Examiner les données', 'Examine data'),
    t('Préparer l’achat', 'Prepare procurement'),
    t('Évaluer le fournisseur', 'Assess the supplier'),
    t('Préparer le déploiement', 'Prepare deployment'),
  ];
  const cards = [
    [
      'A1–A5 · N3 · T1',
      t('Quel usage, quel droit ?', 'Which use, which law?'),
      t(
        'L’usage réel, le rôle des acteurs et les liens avec l’UE s’examinent séparément. L’AI Act et le RGPD ont des champs d’application différents. « Recherche » ne vaut pas exemption.',
        'Actual use, actor roles and EU links need separate examination. The AI Act and GDPR have different scopes. “Research” is not an exemption.',
      ),
      t(
        'Un usage décisionnel ouvre les contrôles de haut risque. La qualification du fournisseur reste à examiner.',
        'Decision-related use opens high-risk checks. The supplier’s classification still needs review.',
      ),
    ],
    [
      'N1–N2 · I8 · A6',
      t('Protéger les personnes', 'Protect people'),
      t(
        'Un usage potentiellement interdit se distingue d’un usage à haut risque. Si l’outil contribue à une décision, il faut examiner les possibilités d’explication et de réexamen humain.',
        'Potentially prohibited use differs from high-risk use. If a tool contributes to a decision, explanation and human review procedures need examination.',
      ),
      t(
        'Un signal d’arrêt demande une résolution documentée. A6 reste visible même hors du parcours haut risque.',
        'A stop signal needs documented resolution. A6 remains visible outside the high-risk pathway.',
      ),
    ],
    [
      'I1–I7 · D1–D14 · S6',
      t('Justifier l’usage des données', 'Justify data use'),
      t(
        'Une finalité précise ne suffit pas : il faut une justification, des données nécessaires et des garanties adaptées. Les accès, les pays de traitement et la réutilisation pour l’entraînement doivent être documentés.',
        'A clear purpose is not enough: processing needs justification, necessary data and suitable safeguards. Access, processing countries and reuse for training must be documented.',
      ),
      t(
        'Les données sensibles ouvrent des contrôles supplémentaires. Une information inconnue maintient les vérifications ouvertes.',
        'Sensitive data opens additional checks. Unknown information keeps checks open.',
      ),
    ],
    [
      'M1–M19',
      t('Comparer sur une base commune', 'Compare on a common basis'),
      t(
        'Le contrat existant, le coût total et le périmètre orientent l’examen de l’achat. Une offre gratuite ne crée pas d’exemption automatique. Les seuils applicables doivent être confirmés.',
        'The existing contract, total cost and scope guide procurement assessment. A free offer creates no automatic exemption. Applicable thresholds need confirmation.',
      ),
      t(
        'Le classement exige un périmètre commun et des examens actuels. Le barème 40/15/30/15 est une proposition de démonstration, pas une règle légale.',
        'Ranking requires a common scope and current reviews. The 40/15/30/15 weighting is a demo proposal, not a legal rule.',
      ),
    ],
    [
      'N4 · S20–S21 · T2 · M21–M29',
      t('Prévoir des garanties concrètes', 'Plan practical safeguards'),
      t(
        'Accessibilité, liberté académique, confidentialité, droits sur les contenus et sortie du contrat doivent être examinés. Le droit applicable et le tribunal compétent sont deux questions distinctes.',
        'Accessibility, academic freedom, confidentiality, content rights and exit arrangements need examination. Governing law and jurisdiction are separate questions.',
      ),
      t(
        'L’utilisation obligatoire est rapprochée de l’accessibilité. Les déclarations du fournisseur demandent des preuves et un examen.',
        'Mandatory use is considered alongside accessibility. Supplier statements need evidence and review.',
      ),
    ],
    [
      'N5–N11 · M30–M31',
      t('Organiser la mise en service', 'Organise deployment'),
      t(
        'Formation, supervision, information et gestion des incidents traduisent les engagements en mesures concrètes. Toute bonne pratique n’est pas une obligation légale générale.',
        'Training, supervision, information and incident handling turn commitments into practical measures. Not every good practice is a universal legal duty.',
      ),
      t(
        'Les actions ont une échéance : évaluation, sélection, signature ou déploiement. Un changement pertinent peut rendre une revue caduque.',
        'Actions fall due at assessment, selection, signature or deployment. A relevant change can invalidate a review.',
      ),
    ],
  ];
  return (
    <article className="guide-book">
      <header className="guide-cover">
        <small>{t('LE GUIDE CLAIR', 'THE CLAIR GUIDE')}</small>
        <h1>{t('Comprendre. Documenter. Décider.', 'Understand. Document. Decide.')}</h1>
        <p>
          {t(
            'L’essentiel pour utiliser le parcours, comprendre son raisonnement et présenter sa conception.',
            'The essentials for using the process, understanding its reasoning and explaining its design.',
          )}
        </p>
        <nav>
          <a href="#journey">{t('Le parcours', 'The process')}</a>
          <a href="#reasoning">{t('La logique juridique', 'Legal reasoning')}</a>
          <a href="#creation">{t('La conception', 'The design')}</a>
        </nav>
      </header>
      <section id="journey">
        <h2>
          <em>01</em>
          {t('Un dossier, six étapes', 'One dossier, six stages')}
        </h2>
        <p>
          {t(
            'Ouvrez un projet, choisissez votre rôle, répondez puis enregistrez vos modifications. Joignez les pièces à la question concernée. Si une information manque, indiquez « inconnu ».',
            'Open a project, choose your role, answer and save your changes. Attach evidence to the relevant question. If information is missing, select “unknown”.',
          )}
        </p>
        <ol className="guide-stages">
          {stages.map((s, i) => (
            <li key={s}>
              <span>{i + 1}</span>
              {s}
            </li>
          ))}
        </ol>
        <div className="guide-roles">
          <p>
            <strong>UNIL</strong>
            {t('Décrit le besoin et l’usage.', 'Describes the need and use.')}
          </p>
          <p>
            <strong>{t('Fournisseur', 'Supplier')}</strong>
            {t('Documente l’offre et les garanties.', 'Documents the offer and safeguards.')}
          </p>
          <p>
            <strong>{t('Évaluateur', 'Reviewer')}</strong>
            {t(
              'Examine les preuves et motive ses conclusions.',
              'Reviews evidence and gives reasons.',
            )}
          </p>
        </div>
      </section>
      <section id="reasoning">
        <h2>
          <em>02</em>
          {t('Pourquoi ces questions ?', 'Why these questions?')}
        </h2>
        <p>
          {t(
            'Les réponses orientent les contrôles. Elles ne constituent pas, à elles seules, une conclusion juridique.',
            'Answers guide the checks. They do not, on their own, establish a legal conclusion.',
          )}
        </p>
        <div className="guide-tree">
          <strong>{t('Usage et faits déclarés', 'Declared use and facts')}</strong>
          <div>
            {[
              [
                t('Critère présent', 'Criterion present'),
                t('Contrôles supplémentaires', 'Additional checks'),
              ],
              [
                t('Information inconnue', 'Unknown information'),
                t('Vérifications maintenues', 'Checks remain open'),
              ],
              [
                t('Exemption envisagée', 'Possible exemption'),
                t('Examen motivé nécessaire', 'Reasoned review required'),
              ],
            ].map(([a, b]) => (
              <p key={a}>
                {a}
                <span aria-hidden="true">↓</span>
                <b>{b}</b>
              </p>
            ))}
          </div>
        </div>
        <div className="guide-cards">
          {cards.map(([ids, title, text, logic]) => (
            <details key={ids}>
              <summary>
                <small>{ids}</small>
                <h3>{title}</h3>
              </summary>
              <p>{text}</p>
              <aside>
                <strong>{t('Dans l’application', 'In the app')}</strong>
                <p>{logic}</p>
              </aside>
            </details>
          ))}
        </div>
        <div className="guide-caution">
          <strong>
            {t(
              'Droit applicable, règle interne ou bonne pratique ?',
              'Applicable law, internal rule or good practice?',
            )}
          </strong>
          <p>
            {t(
              'Ces catégories doivent rester distinctes. Les références, dates et seuils en discussion restent à valider. Une certification ou un score ne prouve pas la conformité du projet.',
              'These categories must remain distinct. References, dates and thresholds under discussion still need validation. A certification or score does not prove project compliance.',
            )}
          </p>
          <a href="https://eur-lex.europa.eu/eli/reg/2024/1689" target="_blank" rel="noreferrer">
            AI Act
          </a>{' '}
          ·{' '}
          <a
            href="https://www.vd.ch/etat-droit-finances/protection-des-donnees-et-droit-a-linformation/protection-des-donnees"
            target="_blank"
            rel="noreferrer"
          >
            {t('Protection des données — Vaud', 'Data protection — Vaud')}
          </a>
        </div>
        <ol className="guide-flow">
          {[
            t('Réponses et pièces', 'Answers and evidence'),
            t('Examen humain', 'Human review'),
            t('Actions à résoudre', 'Actions to resolve'),
            t('Décision motivée', 'Reasoned decision'),
          ].map((s, i) => (
            <li key={s}>
              <small>{i + 1}</small>
              {s}
            </li>
          ))}
        </ol>
        <p className="guide-muted">
          {t(
            'Une pièce doit être examinée. Une modification peut rouvrir une revue. « Prêt pour une décision humaine » ne signifie pas « juridiquement approuvé ».',
            'Evidence needs examination. A change can reopen a review. “Ready for a human decision” does not mean “legally approved”.',
          )}
        </p>
      </section>
      <section id="creation">
        <h2>
          <em>03</em>
          {t('Comment l’application a été conçue', 'How the application was designed')}
        </h2>
        <p>
          {t(
            'Les deux questionnaires de l’équipe ont été structurés en six étapes, puis en champs, conditions d’affichage et points de contrôle. L’objectif : rendre le raisonnement visible et conserver les éléments qui fondent une décision.',
            'The team’s two questionnaires were organised into six stages, then into fields, display conditions and checkpoints. The aim: make reasoning visible and preserve the basis for decisions.',
          )}
        </p>
        <div className="guide-roles">
          <p>
            <strong>{t('Navigation', 'Navigation')}</strong>
            {t(
              'Questionnaire, examens, comparaison et rapports distinguent collecte, analyse et décision.',
              'Questionnaire, reviews, comparison and reports distinguish collection, assessment and decision.',
            )}
          </p>
          <p>
            <strong>{t('Identité visuelle', 'Visual identity')}</strong>
            {t(
              'Logo UNIL, bleu sobre, textes lisibles et statuts explicites pour un espace universitaire.',
              'UNIL logo, restrained blue, readable text and explicit statuses for a university workspace.',
            )}
          </p>
          <p>
            <strong>FR / EN</strong>
            {t(
              'L’interface est bilingue ; les réponses saisies restent dans leur langue d’origine.',
              'The interface is bilingual; entered answers stay in their original language.',
            )}
          </p>
        </div>
        <div className="guide-architecture">
          <p>
            <strong>{t('Interface', 'Interface')}</strong>
            <small>Next.js · React · TypeScript</small>
          </p>
          <span aria-hidden="true">→</span>
          <p>
            <strong>{t('Serveur', 'Server')}</strong>
            <small>{t('Validation · règles · rôles', 'Validation · rules · roles')}</small>
          </p>
          <span aria-hidden="true">→</span>
          <p>
            <strong>{t('Conservation', 'Storage')}</strong>
            <small>{t('Dossiers · pièces · rapports', 'Dossiers · evidence · reports')}</small>
          </p>
        </div>
        <p className="guide-muted">
          {t(
            'Les dossiers actuels sont enregistrés sur la machine hôte ; PostgreSQL conserve la version historique. Les rapports sont des instantanés qui ne changent pas avec le dossier. L’application applique des règles explicites et n’utilise pas d’IA.',
            'Current dossiers are stored on the host machine; PostgreSQL holds the historical version. Reports are snapshots that do not change with the dossier. The app applies explicit rules and uses no AI.',
          )}
        </p>
        <details className="guide-report">
          <summary>{t('Un paragraphe pour votre rapport', 'A paragraph for your report')}</summary>
          <p>
            {t(
              'L’application est un prototype académique fondé sur les questionnaires de l’équipe. Le développement a consisté à organiser les questions, définir les réponses attendues et les relier à des contrôles conditionnels. Next.js, React et TypeScript réunissent une interface interactive et un traitement structuré des données. La navigation suit le déroulement de l’évaluation et distingue les contributions de l’université, du fournisseur et de l’évaluateur. Les pièces et examens motivés documentent les décisions ; les changements pertinents demandent leur actualisation. La comparaison repose sur un périmètre commun et un barème explicite. Les rapports conservent un état du dossier. L’identité visuelle et l’interface bilingue facilitent la lecture dans un cadre universitaire. La démonstration utilise des rôles simulés et des exemples fictifs. La validation juridique et les décisions finales restent humaines.',
              'The application is an academic prototype based on the team’s questionnaires. Development involved organising questions, defining expected answers and linking them to conditional checks. Next.js, React and TypeScript combine an interactive interface with structured data handling. Navigation follows the assessment process and distinguishes university, supplier and reviewer contributions. Evidence and reasoned reviews document decisions; relevant changes require updates. Comparison uses a common scope and explicit scoring. Reports preserve a dossier snapshot. The visual identity and bilingual interface support reading in a university setting. The demonstration uses simulated roles and fictional examples. Legal validation and final decisions remain human.',
            )}
          </p>
        </details>
      </section>
      <footer>
        <p>
          {t(
            'Prototype académique · Rôles simulés · Exemples fictifs. Pour essayer, ouvrez un projet « Trial ». Pendant la démo distante, les dossiers sont partagés.',
            'Academic prototype · Simulated roles · Fictional examples. To try it, open a “Trial” project. Dossiers are shared during the remote demo.',
          )}
        </p>
        <Link href="/projects">{t('Ouvrir les projets →', 'Open projects →')}</Link>
      </footer>
    </article>
  );
}
