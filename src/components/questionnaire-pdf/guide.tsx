'use client';
import Link from 'next/link';
import { useLanguage } from '@/components/language';
import {
  pdfQuestions,
  sections,
  PDF_VERSION,
  EN_PROMPTS,
  phaseLabels,
  phases,
} from '@/config/questionnaire-pdf/catalog';
import '../../app/guide/guide.css';
export function PdfGuide() {
  const { locale } = useLanguage();
  const en = locale === 'en';
  const t = (f: string, e: string) => (en ? e : f);
  return (
    <article className="guide-book">
      <header className="guide-cover">
        <small>{t('LE GUIDE DU QUESTIONNAIRE PDF', 'THE PDF QUESTIONNAIRE GUIDE')}</small>
        <h1>
          {t('Un dossier commun, des décisions motivées', 'A shared dossier, reasoned decisions')}
        </h1>
        <p>
          {t(
            '85 entrées de la checklist de l’équipe et quatre questions d’entrée. La nouvelle version conserve les contributions UNIL et fournisseur dans un même dossier.',
            '85 entries from the team checklist and four entry questions. The new version keeps UNIL and supplier contributions in one dossier.',
          )}
        </p>
        <nav>
          <a href="#pdf-use">{t('Utiliser', 'Use')}</a>
          <a href="#pdf-rules">{t('Règles', 'Rules')}</a>
          <a href="#pdf-source">{t('Questions et sources', 'Questions and sources')}</a>
        </nav>
      </header>
      <section id="pdf-use">
        <h2>
          <em>01</em>
          {t('Répondre et documenter', 'Answer and document')}
        </h2>
        <p>
          {t(
            'Créez un projet, choisissez le rôle répondant et renseignez chaque réponse avec ses précisions et références. Enregistrez vos réponses ; changer de question ou de page les enregistre également avant de poursuivre. Les rôles restent simulés.',
            'Create a project, choose the responding role and provide answers, details and references. Save your answers; switching questions or pages also saves them before continuing. Roles remain simulated.',
          )}
        </p>
        <ol className="guide-stages">
          {sections.map((s) => (
            <li key={s[0]}>
              <span>{s[0]}</span>
              {s[en ? 2 : 1]}
            </li>
          ))}
        </ol>
        <p>
          {t(
            'Les questions restent visibles. Si une exigence n’est pas pertinente, le répondant choisit non applicable et explique pourquoi ; l’évaluateur confirme ou conteste ce choix avec une référence. Aucune branche ne disparaît sur une simple déclaration.',
            'Questions remain visible. If a requirement is irrelevant, the respondent selects not applicable and gives reasons; the reviewer confirms or disputes it with a reference. A declaration alone never hides a branch.',
          )}
        </p>
        <p>
          {t(
            'Certaines questions source se recoupent : les tests IA et leur renvoi, ainsi que la gestion de l’IA et son renvoi, partagent une réponse et une revue. Les points non négociables exigent toujours un examen.',
            'Some source questions overlap: AI testing and its cross-reference, and AI management and its cross-reference, share an answer and review. Non-negotiable points still require examination.',
          )}
        </p>
      </section>
      <section id="pdf-rules">
        <h2>
          <em>02</em>
          {t('Comprendre les règles', 'Understand the rules')}
        </h2>
        <div className="guide-tree">
          <strong>{t('Réponse et pièces', 'Answer and evidence')}</strong>
          <div>
            <p>
              {t('Inconnu ou incomplet', 'Unknown or incomplete')}
              <span>↓</span>
              <b>{t('Informations à compléter', 'Information required')}</b>
            </p>
            <p>
              {t('Écart ou signal sensible', 'Gap or sensitive signal')}
              <span>↓</span>
              <b>{t('Correction ou point bloquant', 'Correction or blocking point')}</b>
            </p>
            <p>
              {t('Examen et conditions résolus', 'Review and conditions resolved')}
              <span>↓</span>
              <b>{t('Décision humaine distincte', 'Separate human decision')}</b>
            </p>
          </div>
        </div>
        <p>
          {t(
            'Une pièce est un élément à examiner. Une réponse manquante reste une action même si une revue est acceptée. Une modification pertinente rend la revue caduque. Les situations restrictives du PDF sont signalées pour examen et ne deviennent pas automatiquement acceptables.',
            'An attachment is evidence to examine. A missing answer remains an action even if a review is accepted. A relevant change invalidates the review. Restrictive PDF situations are flagged for examination and do not automatically become acceptable.',
          )}
        </p>
        <ol className="guide-flow">
          {phases
            .filter((p) => p !== 'followup')
            .map((p, i) => (
              <li key={p}>
                <small>{i + 1}</small>
                {phaseLabels[p][en ? 1 : 0]}
              </li>
            ))}
        </ol>
        <p>
          {t(
            'Chaque mesure porte une échéance et une preuve de réalisation. La signature ne vaut pas autorisation de déployer. Une décision ne peut être confirmée tant que ses actions restent ouvertes ou que la décision précédente n’est pas actuelle. Les rapports conservent un instantané et ne changent pas après création.',
            'Each measure has a deadline and completion evidence. Signature does not authorise deployment. A decision cannot be confirmed while its actions remain open or the previous decision is not current. Reports preserve a snapshot and do not change after creation.',
          )}
        </p>
        <aside className="guide-caution">
          <strong>
            {t(
              'Le prototype ne certifie pas la légalité',
              'The prototype does not certify legality',
            )}
          </strong>
          <p>
            {t(
              'Distinguez droit applicable, exigence institutionnelle et bonne pratique. Les dates, seuils et références non confirmés restent signalés. La comparaison chiffrée de l’ancienne version ne fait pas partie de ce nouveau parcours.',
              'Distinguish applicable law, institutional requirements and good practice. Unconfirmed dates, thresholds and references remain flagged. Previous-version scoring is not part of this new process.',
            )}
          </p>
        </aside>
      </section>
      <section id="pdf-source">
        <h2>
          <em>03</em>
          {t('Questions et traçabilité', 'Questions and traceability')}
        </h2>
        <p>
          {t(
            'Chaque entrée conserve sa page et son numéro d’origine. Les notes source en français expliquent les informations attendues et les points juridiques à vérifier ; elles ne constituent pas des règles certifiées.',
            'Each entry retains its source page and number. French source notes explain expected information and legal points to verify; they are not certified rules.',
          )}
        </p>
        <div className="guide-cards">
          {sections.map((s) => (
            <details key={s[0]}>
              <summary>
                <h3>{s[en ? 2 : 1]}</h3>
              </summary>
              {pdfQuestions
                .filter((q) => q.section === s[0])
                .map((q) => (
                  <div key={q.id} style={{ padding: '0 16px' }}>
                    <strong>
                      {q.id} · {en ? EN_PROMPTS[q.id] : q.question}
                    </strong>
                    <p>{q.source}</p>
                    <p>{q.legal}</p>
                  </div>
                ))}
            </details>
          ))}
        </div>
        <p>
          <a
            href="https://www.vd.ch/etat-droit-finances/protection-des-donnees-et-droit-a-linformation/protection-des-donnees"
            target="_blank"
            rel="noreferrer"
          >
            {t('Protection des données — Vaud', 'Data protection — Vaud')}
          </a>{' '}
          ·{' '}
          <a
            href="https://www.vd.ch/etat-droit-finances/marches-publics/modeles-et-recommandations/evaluation-des-offres"
            target="_blank"
            rel="noreferrer"
          >
            {t('Marchés publics — Vaud', 'Public procurement — Vaud')}
          </a>{' '}
          ·{' '}
          <a href="https://eur-lex.europa.eu/eli/reg/2024/1689" target="_blank" rel="noreferrer">
            AI Act
          </a>
        </p>
      </section>
      <section>
        <h2>
          <em>04</em>
          {t('Comment cette version a été construite', 'How this version was built')}
        </h2>
        <p>
          {t(
            'Le PDF a été converti en un catalogue versionné avec identifiants stables, réponses structurées, précisions, pièces et revues motivées. Next.js, React et TypeScript assurent l’interface et les contrôles serveur. Les dossiers et pièces sont conservés sur la machine hôte. Les rôles, révisions concurrentes et empreintes sont contrôlés avant enregistrement. L’application n’utilise pas d’IA pour décider de la conformité.',
            'The PDF was converted into a versioned catalogue with stable identifiers, structured answers, details, evidence and reasoned reviews. Next.js, React and TypeScript provide the interface and server checks. Dossiers and evidence are stored on the host machine. Roles, concurrent revisions and fingerprints are checked before saving. The application uses no AI to decide compliance.',
          )}
        </p>
        <p>
          {t(
            'La présentation FR/EN conserve les textes libres dans leur langue d’origine et les références documentaires françaises. Les projets précédents gardent leur questionnaire, leurs réponses et leurs rapports : ils ne sont pas migrés silencieusement.',
            'The FR/EN presentation preserves free text in its original language and French documentary references. Previous projects retain their questionnaire, answers and reports: they are not silently migrated.',
          )}
        </p>
        <p className="guide-muted">{PDF_VERSION}</p>
      </section>
      <footer>
        <Link href="/projects">{t('Ouvrir les projets →', 'Open projects →')}</Link> ·{' '}
        <Link href="/guide?version=previous">
          {t('Guide de la version précédente', 'Previous-version guide')}
        </Link>
      </footer>
    </article>
  );
}
