'use client';
import { protectionDefinitions } from '@/config/data-protection';
import { scopeDefinitions } from '@/config/legal-scope';
import { useEffect, useState } from 'react';
import { BookOpen, Search, Printer, GitBranch, ArrowDown, ExternalLink } from 'lucide-react';
import type { ChecklistModel } from '@/lib/checklist-model';
import type { Condition, Module } from '@/lib/domain';
import {
  questionEnglish,
  vocabularyEnglish,
  helpEnglish,
  controlEnglish,
} from '@/config/checklist-en';
import {
  activationGuide,
  bi,
  engineGuide,
  generalGuide,
  objectiveGuide,
  planned,
  safeguards,
  sourceEnglish,
  type Bilingual,
  type GuideEntry,
} from '@/config/checklist-guide';

type Language = 'fr' | 'en';
const moduleNames: Record<Module, Bilingual> = {
  triage: bi('Cartographie juridique', 'Legal mapping'),
  data: bi('Protection des données', 'Data protection'),
  security: bi('Sécurité et gouvernance', 'Security and governance'),
  contract: bi('Marchés publics et contrats', 'Procurement and contracts'),
};
const normalise = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

export function ChecklistReference({
  model,
  initialLanguage = 'fr',
}: {
  model: ChecklistModel;
  initialLanguage?: Language;
}) {
  const [lang, setLang] = useState<Language>(initialLanguage);
  const [search, setSearch] = useState('');
  const [audience, setAudience] = useState('all');
  const [module, setModule] = useState('all');
  const [expand, setExpand] = useState(false);
  const [printAll, setPrintAll] = useState(false);
  const t = (fr: string, en: string) => (lang === 'fr' ? fr : en);
  const text = (value: Bilingual) => value[lang];
  const translated = (value: string) =>
    lang === 'en' ? (vocabularyEnglish[value] ?? value) : value;
  const matches = (value: unknown) =>
    printAll ||
    !search.trim() ||
    normalise(JSON.stringify(value)).includes(normalise(search.trim()));
  const conditionLabel = (condition?: Condition): string =>
    !condition
      ? t('Toujours affiché / actif.', 'Always displayed / active.')
      : condition.id.startsWith('@')
        ? text(activationGuide[condition.id])
        : `${condition.id} ∈ { ${condition.values.map(translated).join(' / ')} }. ${t('Inconnu conserve la branche ouverte.', 'Unknown keeps the branch open.')}`;
  const refs = (ids: string[], prefix: 'q' | 'c' | 'r' | 'source') =>
    ids.length ? (
      ids.map((id) => (
        <a className="checklist-chip" key={id} href={`#${prefix}-${id}`}>
          {id}
        </a>
      ))
    ) : (
      <span className="text-muted-foreground">—</span>
    );
  const sourceRefs = (ids: string[]) => refs([...new Set(ids)], 'source');
  const qName = (id: string) =>
    lang === 'en'
      ? (questionEnglish[id] ?? id)
      : (model.questions.find((q) => q.id === id)?.label ?? id);
  const visibleQuestions = model.questions.filter(
    (q) =>
      (printAll || audience === 'all' || q.audience === audience) &&
      (printAll || module === 'all' || q.module === module) &&
      matches([
        q,
        questionEnglish[q.id],
        (q.options ?? []).map((o) => vocabularyEnglish[o]),
        moduleNames[q.module],
        model.controls.filter((c) => c.dependencies.includes(q.id)).map((c) => [c.id, c.source]),
      ]),
  );

  useEffect(() => {
    const done = () => setPrintAll(false);
    window.addEventListener('afterprint', done);
    return () => window.removeEventListener('afterprint', done);
  }, []);
  useEffect(() => {
    if (!printAll) return;
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => window.print());
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, [printAll]);

  function guideCard(g: GuideEntry) {
    return (
      <details
        className="checklist-card"
        id={`r-${g.id}`}
        key={g.id}
        open={expand || printAll || !!search.trim() ? true : undefined}
      >
        <summary>
          <span className="checklist-id">{g.id}</span>
          <span>{text(g.title)}</span>
          <span className="checklist-tag">{t('Implémenté', 'Implemented')}</span>
        </summary>
        <div className="checklist-detail">
          <p>
            <strong>{t('Condition / calcul : ', 'Condition / calculation: ')}</strong>
            {text(g.logic)}
          </p>
          <p>
            <strong>{t('Conséquence : ', 'Effect: ')}</strong>
            {text(g.effect)}
          </p>
          <div>{sourceRefs([g.source])}</div>
          <p className="text-xs text-muted-foreground">
            {t('Implémentation', 'Implementation')}: <code>{g.implementation}</code>
          </p>
        </div>
      </details>
    );
  }

  const sections: [string, string, string][] = [
    ['overview', 'Vue d’ensemble', 'Overview'],
    ['questions', 'Questions', 'Questions'],
    ['controls', 'Contrôles', 'Controls'],
    ['rules', 'Règles', 'Rules'],
    ['maps', 'Arbres logiques', 'Logic trees'],
    ['references', 'Sources', 'Sources'],
    ['scoring', 'Notation', 'Scoring'],
    ['safeguards', 'Fonctionnement', 'How it works'],
    ['limits', 'Limites', 'Limits'],
  ];
  return (
    <div
      className={`checklist-reference ${printAll ? 'checklist-print-all' : ''}`}
      lang={lang}
      onClickCapture={(event) => {
        const link = (event.target as Element).closest('a[href^="#"]');
        const id = link?.getAttribute('href')?.slice(1);
        if (!id || !/^(q|c|r|source)-/.test(id) || event.ctrlKey || event.metaKey || event.shiftKey)
          return;
        event.preventDefault();
        setSearch('');
        setAudience('all');
        setModule('all');
        requestAnimationFrame(() => {
          const target = document.getElementById(id);
          if (target instanceof HTMLDetailsElement) target.open = true;
          target?.scrollIntoView({ block: 'start' });
          target?.querySelector('summary')?.focus({ preventScroll: true });
          const url = new URL(window.location.href);
          url.hash = id;
          window.history.replaceState(null, '', url);
        });
      }}
    >
      <header className="checklist-hero">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest">
            <BookOpen size={16} />
            {t('Manuel du référentiel', 'Assessment reference manual')}
          </p>
          <div className="no-print flex items-center gap-2" aria-label="Language / Langue">
            {(['fr', 'en'] as const).map((language) => (
              <button
                key={language}
                type="button"
                aria-pressed={lang === language}
                className={`checklist-language ${lang === language ? 'active' : ''}`}
                onClick={() => {
                  setLang(language);
                  const url = new URL(window.location.href);
                  url.searchParams.set('lang', language);
                  window.history.replaceState(null, '', url);
                }}
              >
                {language === 'fr' ? 'Français' : 'English'}
              </button>
            ))}
          </div>
        </div>
        <h1 className="mt-5">{t('Checklist et logique', 'Checklist & Logic')}</h1>
        <p className="mt-3 max-w-3xl text-base">
          {t(
            'Toutes les questions, les contrôles et les règles du logiciel, expliqués avec leurs dépendances, leurs sources et leurs limites.',
            'Every question, control and software rule, explained with its dependencies, sources and limitations.',
          )}
        </p>
        <p className="mt-3 text-sm opacity-80">
          {t('Référentiel', 'Rule version')} {model.version} ·{' '}
          {t('Demandeurs et évaluateurs', 'Requesters and evaluators')} ·{' '}
          {t('Aucune donnée de dossier sur cette page', 'No dossier data on this page')}
        </p>
        <div className="mt-7 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            [model.questions.length, t('questions', 'questions')],
            [model.controls.length, t('contrôles examinés', 'reviewed controls')],
            [model.rules.length, t('checks automatiques', 'automatic checks')],
            [model.sources.length, t('sources référencées', 'source references')],
          ].map(([count, label]) => (
            <div className="checklist-stat" key={String(label)}>
              <strong>{count}</strong>
              <span>{label}</span>
            </div>
          ))}
        </div>
      </header>
      <nav
        className="checklist-sections no-print"
        aria-label={t('Sections du manuel', 'Manual sections')}
      >
        {sections.map(([id, fr, en]) => (
          <a href={`#${id}`} key={id}>
            {t(fr, en)}
          </a>
        ))}
      </nav>
      <div className="checklist-toolbar no-print">
        <label className="flex min-w-48 flex-1 items-center gap-2">
          <Search size={17} />
          <span className="sr-only">
            {t('Rechercher dans la référence', 'Search the reference')}
          </span>
          <input
            className="min-w-0 flex-1 bg-transparent p-2 outline-none"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t(
              'Rechercher : ID, question, règle, source…',
              'Search: ID, question, rule, source…',
            )}
          />
        </label>
        <button type="button" className="checklist-button" onClick={() => setExpand(!expand)}>
          {expand ? t('Replier', 'Collapse') : t('Tout développer', 'Expand all')}
        </button>
        <button type="button" className="checklist-button" onClick={() => setPrintAll(true)}>
          <Printer size={16} />
          {t('Imprimer la référence complète', 'Print complete reference')}
        </button>
      </div>
      {search && (
        <p className="no-print text-sm" role="status">
          {t(
            'Recherche dans les questions, contrôles, règles et sources. Les sections générales restent visibles.',
            'Search covers questions, controls, rules and sources. General sections remain visible.',
          )}{' '}
          <button
            className="link"
            onClick={() => {
              setSearch('');
              setAudience('all');
              setModule('all');
            }}
          >
            {t('Effacer les filtres', 'Clear filters')}
          </button>
        </p>
      )}

      <section id="overview" className="checklist-section">
        <h2>01 · {t('Du besoin à la décision', 'From need to decision')}</h2>
        <p>
          {t(
            'Le demandeur décrit l’usage ; le fournisseur documente le produit ; le moteur active les branches et effectue les calculs ; l’évaluateur confirme les conclusions critiques. Le rapport conserve un instantané, même si le dossier est incomplet.',
            'The requester describes the use; the supplier documents the product; the engine activates branches and calculates results; the evaluator confirms critical conclusions. The report preserves a snapshot, even for an incomplete dossier.',
          )}
        </p>
        <div className="checklist-flow">
          {[
            t('Besoin', 'Need'),
            t('Triage', 'Triage'),
            t('Fournisseur', 'Supplier'),
            t('Contrôles', 'Controls'),
            t('Évaluation', 'Scoring'),
            t('Rapport', 'Report'),
          ].map((label, i) => (
            <div key={label}>
              <span>{String(i + 1).padStart(2, '0')}</span>
              <strong>{label}</strong>
              {i < 5 && <ArrowDown size={16} />}
            </div>
          ))}
        </div>
        <div className="checklist-notice">
          {t(
            'Lire les catégories séparément : un contrôle actif n’est pas une obligation légalement confirmée ; une pièce déposée n’est pas une preuve validée ; un risque interne élevé n’est pas une interdiction.',
            'Read categories separately: an active control is not a confirmed legal obligation; an uploaded file is not verified evidence; high internal risk is not a prohibition.',
          )}
        </div>
      </section>

      <section id="questions" className="checklist-section">
        <h2>02 · {t('Le questionnaire complet', 'The complete questionnaire')}</h2>
        <p>
          {t(
            'Libellés, options, conditions et rattachements proviennent de la configuration utilisée par le logiciel. Le champ « obligatoire » signifie obligatoire dans ce parcours, pas obligation légale universelle.',
            'Labels, options, conditions and links come from the configuration used by the software. “Required” means required in this workflow, not a universal legal obligation.',
          )}
        </p>
        <div className="no-print my-4 flex flex-wrap gap-3">
          <label>
            {t('Répondant', 'Respondent')}{' '}
            <select
              className="native-select"
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
            >
              <option value="all">{t('Tous', 'All')}</option>
              <option value="internal">{t('Interne UNIL', 'Internal UNIL')}</option>
              <option value="vendor">{t('Fournisseur', 'Supplier')}</option>
            </select>
          </label>
          <label>
            {t('Module', 'Module')}{' '}
            <select
              className="native-select"
              value={module}
              onChange={(e) => setModule(e.target.value)}
            >
              <option value="all">{t('Tous', 'All')}</option>
              {Object.entries(moduleNames).map(([id, label]) => (
                <option key={id} value={id}>
                  {text(label)}
                </option>
              ))}
            </select>
          </label>
          <p className="self-center text-sm" role="status">
            {visibleQuestions.length} / {model.questions.length}
          </p>
        </div>
        <div className="flex flex-col gap-3">
          {visibleQuestions.map((q) => {
            const linked = model.controls.filter((c) => c.dependencies.includes(q.id));
            const rules = model.rules.filter(
              (r) =>
                r.dependencies.includes(q.id) ||
                (q.required && r.dependencies.includes('@visible-required')),
            );
            const purpose = t(
              `Cette information alimente le module ${moduleNames[q.module].fr.toLowerCase()} et les rattachements indiqués ci-dessous.`,
              `This information feeds ${moduleNames[q.module].en.toLowerCase()} and the links listed below.`,
            );
            return (
              <details
                id={`q-${q.id}`}
                key={q.id}
                className="checklist-card"
                open={expand || printAll || !!search.trim() ? true : undefined}
              >
                <summary>
                  <span className="checklist-id">{q.id}</span>
                  <span>{qName(q.id)}</span>
                  <span className="checklist-tag">
                    {q.audience === 'internal'
                      ? t('Interne', 'Internal')
                      : t('Fournisseur', 'Supplier')}
                  </span>
                </summary>
                <div className="checklist-detail">
                  {lang === 'en' && (
                    <p className="text-sm text-muted-foreground" lang="fr">
                      <strong>Original FR : </strong>
                      {q.label}
                    </p>
                  )}
                  <p>{purpose}</p>
                  <p>
                    {text(moduleNames[q.module])} · {translated(q.section)} ·{' '}
                    {t('Responsable du contenu', 'Content owner')}: {q.owner} ·{' '}
                    {q.required
                      ? t('Requis dans le parcours', 'Required in workflow')
                      : t('Facultatif', 'Optional')}
                  </p>
                  <p>
                    <strong>{t('Réponse : ', 'Answer: ')}</strong>
                    {q.options?.length
                      ? q.options.map(translated).join(' · ')
                      : q.type === 'number'
                        ? t('Nombre', 'Number')
                        : q.type === 'textarea'
                          ? t('Texte détaillé', 'Detailed text')
                          : t('Texte', 'Text')}
                    {q.type === 'multi' ? t(' (plusieurs choix)', ' (multiple selections)') : ''}
                  </p>
                  <p>
                    <strong>{t('Condition : ', 'Condition: ')}</strong>
                    {conditionLabel(q.when)}
                  </p>
                  {q.help && <p>{lang === 'en' ? helpEnglish[q.id] : q.help}</p>}
                  <div>
                    <strong>{t('Contrôles liés : ', 'Linked controls: ')}</strong>
                    {refs(
                      linked.map((c) => c.id),
                      'c',
                    )}
                  </div>
                  <div>
                    <strong>{t('Checks automatiques : ', 'Automatic checks: ')}</strong>
                    {refs(
                      rules.map((r) => r.id),
                      'r',
                    )}
                  </div>
                  {q.audience === 'internal' && (
                    <p className="text-sm">
                      {t(
                        'Toute modification interne entre dans l’empreinte de tous les examens, même sans rattachement direct affiché.',
                        'Every internal change enters every review fingerprint, even without a displayed direct link.',
                      )}
                    </p>
                  )}
                  <div>
                    <strong>
                      {t(
                        'Références héritées des contrôles : ',
                        'References inherited from controls: ',
                      )}
                    </strong>
                    {sourceRefs(linked.map((c) => c.source))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t(
                      'Ces références donnent le contexte du contrôle, sans attribuer une obligation légale autonome à chaque question.',
                      'These references provide control context without assigning a standalone legal obligation to every question.',
                    )}
                  </p>
                  {q.sourceIds?.length ? (
                    <details
                      className="checklist-original"
                      open={printAll || expand ? true : undefined}
                    >
                      <summary>
                        {t(
                          'Formulations sources archivées en français',
                          'Archived original French wording',
                        )}{' '}
                        · {q.sourceIds.join(', ')}
                      </summary>
                      {q.sourceIds.map((id, i) => (
                        <blockquote key={id} lang="fr">
                          <strong>{id}</strong> — {q.source_text_exact?.[i]}
                          {q.source_options_exact?.[i]?.length ? (
                            <p>{q.source_options_exact[i].join(' · ')}</p>
                          ) : null}
                        </blockquote>
                      ))}
                    </details>
                  ) : (
                    <p className="text-xs">
                      {t(
                        'Ajout du prototype ; aucune formulation source archivée associée.',
                        'Prototype addition; no associated archived source wording.',
                      )}
                    </p>
                  )}
                  <code className="text-xs">src/config/assessment.ts · {q.id}</code>
                </div>
              </details>
            );
          })}
        </div>
        {!visibleQuestions.length && (
          <p>
            {t('Aucune question ne correspond aux filtres.', 'No questions match these filters.')}
          </p>
        )}
      </section>

      <section id="controls" className="checklist-section">
        <h2>03 · {t('Matrice des contrôles', 'Control matrix')}</h2>
        <p>
          {t(
            'Ces contrôles regroupent les réponses et les justificatifs pour un examen motivé. Ils ne sont pas tous auto-validés par le logiciel.',
            'These controls group answers and evidence for a reasoned review. The software does not automatically approve them all.',
          )}
        </p>
        <div className="mt-4 flex flex-col gap-3">
          {model.controls
            .filter((c) => matches([c, controlEnglish[c.id]]))
            .map((c) => {
              const en = controlEnglish[c.id];
              return (
                <details
                  className="checklist-card"
                  key={c.id}
                  id={`c-${c.id}`}
                  open={expand || printAll || !!search.trim() ? true : undefined}
                >
                  <summary>
                    <span className="checklist-id">{c.id}</span>
                    <span>{lang === 'fr' ? c.title : en[0]}</span>
                    <span className="checklist-tag">{t('Examen humain', 'Human review')}</span>
                  </summary>
                  <div className="checklist-detail">
                    <p>{lang === 'fr' ? c.description : en[1]}</p>
                    <p>
                      <strong>{t('Nature : ', 'Nature: ')}</strong>
                      {translated(c.nature)}
                    </p>
                    <p>
                      <strong>{t('Activation : ', 'Activation: ')}</strong>
                      {conditionLabel(c.when)}
                    </p>
                    <p>
                      <strong>{t('Preuves attendues : ', 'Expected evidence: ')}</strong>
                      {lang === 'fr' ? c.evidence : en[2]}
                    </p>
                    <div>
                      <strong>{t('Questions directes : ', 'Direct questions: ')}</strong>
                      {refs(c.questionIds, 'q')}
                    </div>
                    <div>
                      <strong>{t('Dépendances complètes : ', 'Full dependencies: ')}</strong>
                      {refs(c.dependencies, 'q')}
                    </div>
                    <p>
                      {t(
                        'Toutes les réponses internes et le contexte du dossier participent aussi à l’empreinte. Une validation positive nécessite une pièce et des réponses fournisseur pertinentes déterminées.',
                        'All internal answers and dossier context also enter the fingerprint. Positive validation requires evidence and determinate relevant supplier answers.',
                      )}
                    </p>
                    {sourceRefs([c.source])}
                    <code className="text-xs">src/config/assessment.ts · controls · {c.id}</code>
                  </div>
                </details>
              );
            })}
        </div>
      </section>

      <section id="rules" className="checklist-section">
        <h2>04 · {t('Règles exécutées et conséquences', 'Executed rules and consequences')}</h2>
        <p>
          {t(
            'Les sept checks ci-dessous sont des règles de parcours ou de calcul. Les alertes et règles d’agrégation existantes sont détaillées ensuite.',
            'The seven checks below are workflow or calculation rules. Existing alerts and aggregation rules are detailed next.',
          )}
        </p>
        <div className="mt-4 flex flex-col gap-3">
          {protectionDefinitions
            .filter((d) => matches(d))
            .map((d) =>
              guideCard({
                id: d.id,
                title: bi(d.title, d.enTitle),
                logic: bi(d.fr, d.en),
                effect: bi(
                  'Demande préparatoire et preuves liées au contrôle ' +
                    d.control +
                    ' ; inconnus et préalables non résolus ferment la notation.',
                  'Preparatory request and evidence linked to control ' +
                    d.control +
                    '; unknowns and unresolved prerequisites close scoring.',
                ),
                source: d.source,
                implementation: 'src/lib/data-protection.ts · ' + d.id + ' · ' + d.ids.join(', '),
              }),
            )}
          {scopeDefinitions
            .filter((d) => matches(d))
            .map((d) =>
              guideCard({
                id: `SCOPE-${d.key}`,
                title: bi(
                  `${d.regime} · ${d.actor}`,
                  `${d.regime} · ${d.actor.startsWith('Fournisseur') ? 'Supplier' : 'UNIL'}`,
                ),
                logic: bi(d.fr, d.en),
                effect: bi(
                  'Faits → critères → proposition → confirmation T02. Inconnu reste inconnu ; exclusions en examen ; contradictions à corriger.',
                  'Facts → criteria → proposal → T02 confirmation. Unknown stays unknown; exclusions require review; contradictions must be corrected.',
                ),
                source: d.source,
                implementation: `src/lib/legal-scope.ts · ${d.key} · ${d.ids.join(', ')}`,
              }),
            )}
          {model.rules
            .filter((r) => matches([r, objectiveGuide[r.id]]))
            .map((r) =>
              guideCard({
                id: r.id,
                title: bi(
                  r.title,
                  (
                    {
                      'FACT-COMPLETENESS': 'Essential information',
                      'DECISION-CONSISTENCY': 'Decision consistency',
                      'BASIS-DECLARATION': 'Processing justification',
                      'MINIMISATION-DECLARATION': 'Declared minimisation',
                      'CONTRACT-PERIOD': 'Contract period',
                      'DURATION-JUSTIFICATION': 'Long-duration justification',
                      'COST-COMPARISON': 'Declared cost comparison',
                    } as Record<string, string>
                  )[r.id],
                ),
                logic: objectiveGuide[r.id][0],
                effect: objectiveGuide[r.id][1],
                source: r.source,
                implementation: `src/lib/objective-rules.ts · ${r.id} · v${r.version}`,
              }),
            )}
        </div>
        <p className="mt-4 text-sm">{t('Dépendances des checks : ', 'Check dependencies: ')}</p>
        <div className="mt-2 flex flex-col gap-2">
          {model.rules.map((r) => (
            <div key={r.id} className="text-xs">
              <a className="link" href={`#r-${r.id}`}>
                {r.id}
              </a>{' '}
              :{' '}
              {r.dependencies.includes('@visible-required')
                ? t(
                    'toutes les questions requises actuellement visibles',
                    'all currently visible required questions',
                  )
                : r.dependencies.map((id) =>
                    id.startsWith('$') ? (
                      <code key={id}>{id} </code>
                    ) : (
                      <a className="checklist-chip" key={id} href={`#q-${id}`}>
                        {id}
                      </a>
                    ),
                  )}
            </div>
          ))}
        </div>
        <h3 className="mt-7 mb-4">
          {t(
            'Signaux de triage et conclusions confirmées',
            'Triage signals and confirmed conclusions',
          )}
        </h3>
        <div className="flex flex-col gap-3">
          {engineGuide.filter((g) => matches(g)).map(guideCard)}
        </div>
        <h3 className="mt-7 mb-4">
          {t('Agrégation, visibilité et risques', 'Aggregation, visibility and risks')}
        </h3>
        <div className="flex flex-col gap-3">
          {generalGuide.filter((g) => matches(g)).map(guideCard)}
        </div>
      </section>

      <section id="maps" className="checklist-section">
        <h2>05 · {t('Cartes et arbres de décision', 'Maps and decision trees')}</h2>
        <LogicMaps model={model} lang={lang} printAll={printAll} />
      </section>

      <section id="references" className="checklist-section">
        <h2>06 · {t('Références et sources', 'References and sources')}</h2>
        <div className="checklist-notice">
          {t(
            'Dates et statuts repris du registre actuel : une consultation ne vaut pas validation juridique complète. Cette page documente le logiciel et n’actualise pas les textes juridiques.',
            'Dates and statuses are taken from the current register: consultation is not full legal validation. This page documents the software and does not update legal texts.',
          )}
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {model.sources
            .filter((s) => matches([s, sourceEnglish[s.id]]))
            .map((s) => {
              const en = sourceEnglish[s.id];
              return (
                <article className="checklist-source" id={`source-${s.id}`} key={s.id}>
                  <p className="checklist-id">{s.id}</p>
                  <h3 className="mt-2">{lang === 'fr' ? s.title : en[0]}</h3>
                  <p className="mt-2 text-sm">{lang === 'fr' ? s.articles : en[1]}</p>
                  <p className="mt-2 text-xs font-semibold">
                    {lang === 'fr' ? s.status : en[2]} ·{' '}
                    {s.verifiedAt
                      ? t(`Consultée le ${s.verifiedAt}`, `Consulted on ${s.verifiedAt}`)
                      : t(
                          'Vérification détaillée non enregistrée',
                          'Detailed verification not recorded',
                        )}
                  </p>
                  <p className="mt-3 text-sm">{lang === 'fr' ? s.note : en[3]}</p>
                  {s.url ? (
                    <a
                      className="link mt-3 inline-flex items-center gap-1 text-sm"
                      href={s.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {t('Source officielle', 'Official source')}
                      <ExternalLink size={13} />
                    </a>
                  ) : (
                    <p className="mt-3 text-sm">
                      {t(
                        'Référentiel de démonstration interne ; aucune source légale externe.',
                        'Internal demonstration framework; no external legal source.',
                      )}
                    </p>
                  )}
                  <div className="mt-3">
                    {refs(
                      model.controls.filter((c) => c.source === s.id).map((c) => c.id),
                      'c',
                    )}
                  </div>
                </article>
              );
            })}
        </div>
        <h3 className="mt-6">
          {t('Documents du groupe et traçabilité', 'Group documents and traceability')}
        </h3>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm">
          {[
            bi(
              'AI PROJECT (1).pdf — cahier des charges : parcours, rôles, questions, matrice, notation, garde-fous G1–G8.',
              'AI PROJECT (1).pdf — specification: workflow, roles, questions, matrix, scoring and safeguards G1–G8.',
            ),
            bi(
              'Cartographie juridique et moteur de triage pour l’acquisition de systèmes d’IA par l’UNIL.docx — cartographie cible, tests par acteur et règles DATA/GDPR/AIA ; toutes ne sont pas encore implémentées.',
              'Cartographie juridique et moteur de triage pour l’acquisition de systèmes d’IA par l’UNIL.docx — target mapping, per-actor tests and DATA/GDPR/AIA rules; not all are implemented.',
            ),
            bi(
              'Corrections juridiques à proposer à l’équipe.docx — corrections des exclusions automatiques et distinction loi / exigences du marché.',
              'Corrections juridiques à proposer à l’équipe.docx — corrections to automatic exclusions and distinction between legislation and procurement requirements.',
            ),
            bi(
              'AI governance.pdf — contribution de Manel : achats, aptitude, pondérations et contrat ; lire avec les corrections.',
              'AI governance.pdf — Manel’s contribution: procurement, suitability, weights and contract; read alongside the corrections.',
            ),
            bi(
              'Données personnelles IA Gouvernance.pdf — contribution d’Iliana : finalités, flux, droits, sécurité, conservation ; lire avec les corrections.',
              'Données personnelles IA Gouvernance.pdf — Iliana’s contribution: purposes, flows, rights, security and retention; read alongside the corrections.',
            ),
          ].map((v, i) => (
            <li key={i}>{text(v)}</li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-muted-foreground">
          {t(
            'Le détail des écarts est conservé dans docs/AUTOMATION_RULES.md. Les formulations originales proviennent de src/config/source-questions.json ; elles sont archivées, pas appliquées automatiquement comme règles. Les traductions anglaises sont explicatives ; les valeurs enregistrées restent en français.',
            'The gap inventory is maintained in docs/AUTOMATION_RULES.md. Original wording comes from src/config/source-questions.json; it is archived, not automatically enforced as rules. English translations are explanatory; stored values remain French.',
          )}
        </p>
      </section>

      <section id="scoring" className="checklist-section">
        <h2>07 · {t('Notation et conditions d’ouverture', 'Scoring and eligibility')}</h2>
        <p>{text(generalGuide.find((g) => g.id === 'SCORING')!.logic)}</p>
        <div className="checklist-formula">
          Σ ({t('note', 'mark')} / 5 × {t('poids', 'weight')}) ={' '}
          {t('score sur 100', 'score out of 100')}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {model.scoringCriteria.map((c) => (
            <div className="checklist-source" key={c.id}>
              <strong className="text-2xl">{c.weight}%</strong>
              <p>
                {lang === 'fr'
                  ? c.label
                  : (
                      {
                        quality: 'Technical quality',
                        cost: 'Total lifecycle cost',
                        integration: 'Integration and deployment',
                        sustainability: 'Sustainability',
                      } as Record<string, string>
                    )[c.id]}
              </p>
            </div>
          ))}
        </div>
        <p className="mt-4">
          {t(
            'Ces poids sont les valeurs proposées par le projet, modifiables à l’étape de notation ; le logiciel vérifie le total mais ne verrouille pas encore une grille publiée. Exemple : notes 4, 3, 5, 4 → 32 + 18 + 15 + 12 = 77/100.',
            'These weights are project defaults, editable at scoring; the software checks the total but does not yet lock published weights. Example: marks 4, 3, 5, 4 → 32 + 18 + 15 + 12 = 77/100.',
          )}
        </p>
      </section>

      <section id="safeguards" className="checklist-section">
        <h2>08 · {t('Rôles, données et garde-fous', 'Roles, data and safeguards')}</h2>
        <div className="grid gap-4 lg:grid-cols-2">
          {safeguards.map((value, i) => (
            <article className="checklist-source" key={i}>
              <span className="checklist-id">{String(i + 1).padStart(2, '0')}</span>
              <p className="mt-3">{text(value)}</p>
            </article>
          ))}
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          {t(
            'Implémentation : src/lib/server.ts, src/app/api/[...path]/route.ts, src/components/questionnaire.tsx et src/lib/engine.ts. Cette référence ne contient aucune réponse ni pièce d’un dossier.',
            'Implementation: src/lib/server.ts, src/app/api/[...path]/route.ts, src/components/questionnaire.tsx and src/lib/engine.ts. This reference contains no dossier answers or evidence.',
          )}
        </p>
      </section>
      <section id="limits" className="checklist-section">
        <h2>09 · {t('Ce qui reste à réaliser', 'What remains to be implemented')}</h2>
        <p className="mb-4">
          {t(
            'Les éléments suivants sont proposés ou partiels. Ils ne doivent pas être lus comme des vérifications déjà exécutées.',
            'The following items are proposed or partial. They must not be read as checks already executed.',
          )}
        </p>
        <ul className="list-disc space-y-3 pl-5">
          {planned.map((value, i) => (
            <li key={i}>{text(value)}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}

type TreeNode = { label: string; note?: string; href?: string; children?: TreeNode[] };
function Tree({ node }: { node: TreeNode }) {
  return (
    <li>
      <div className="checklist-tree-node">
        {node.href ? (
          <a className="link" href={node.href}>
            {node.label}
          </a>
        ) : (
          <strong>{node.label}</strong>
        )}
        {node.note && <p>{node.note}</p>}
      </div>
      {node.children?.length ? (
        <ol>
          {node.children.map((child, i) => (
            <Tree node={child} key={i} />
          ))}
        </ol>
      ) : null}
    </li>
  );
}

function LogicMaps({
  model,
  lang,
  printAll,
}: {
  model: ChecklistModel;
  lang: Language;
  printAll: boolean;
}) {
  const [map, setMap] = useState('outcome');
  const [signal, setSignal] = useState('@data');
  const [question, setQuestion] = useState('F22');
  const [zoom, setZoom] = useState(1);
  const t = (fr: string, en: string) => (lang === 'fr' ? fr : en);
  const name = (id: string) =>
    `${id} · ${lang === 'fr' ? model.questions.find((q) => q.id === id)?.label : questionEnglish[id]}`;
  const node = (label: string, children?: TreeNode[], note?: string): TreeNode => ({
    label,
    children,
    note,
  });
  const outcomes: [string, string, string][] = [
    ['BLOQUANT', 'Blocage confirmé ?', 'Confirmed blocker?'],
    [
      'À CLARIFIER',
      'Information manquante, conflit ou examen requis ?',
      'Missing information, conflict or required review?',
    ],
    ['À CORRIGER', 'Correction ou condition préalable ?', 'Correction or prerequisite condition?'],
    ['CONFORME SOUS CONDITIONS', 'Condition continue ou future ?', 'Ongoing or future condition?'],
  ];
  let outcome = node(
    t('CONFORME', 'COMPLIANT'),
    undefined,
    t(
      'Aucune des branches précédentes. La notation conserve ses prérequis propres.',
      'None of the previous branches. Scoring still has its own prerequisites.',
    ),
  );
  for (let i = outcomes.length - 1; i >= 0; i--) {
    const [result, fr, en] = outcomes[i];
    outcome = node(t(fr, en), [
      node(`${t('Oui', 'Yes')} → ${translatedOutcome(result, lang)}`),
      node(t('Non → continuer', 'No → continue'), [outcome]),
    ]);
  }
  const flow = node(t('Dossier et usage concret', 'Dossier and specific use'), [
    node(t('Questionnaire interne', 'Internal questionnaire'), [
      node(t('Branches et signaux du moteur', 'Engine branches and signals'), [
        node(t('Réponses et pièces fournisseur', 'Supplier answers and evidence'), [
          node(
            t(
              `${model.rules.length} checks objectifs + ${model.controls.length} contrôles conditionnels`,
              `${model.rules.length} objective checks + ${model.controls.length} conditional controls`,
            ),
            [
              node(
                t(
                  'Qualification et examens humains motivés',
                  'Reasoned human classification and reviews',
                ),
                [
                  node(t('Résultat global', 'Overall outcome'), [
                    node(t('Notation si admissible', 'Scoring if eligible')),
                    node(
                      t(
                        'Rapport instantané, même incomplet',
                        'Snapshot report, even if incomplete',
                      ),
                    ),
                  ]),
                ],
              ),
            ],
          ),
        ]),
      ]),
    ]),
  ]);
  const activation = (id: string): TreeNode =>
    node(id, [
      node(
        activationGuide[id][lang],
        (model.activations[id] ?? []).map((q) => ({ label: name(q), href: `#q-${q}` })),
      ),
      node(
        t('Vrai / inconnu / conflit : branche ouverte', 'True / unknown / conflict: branch open'),
        [
          node(
            t('Questions conditionnelles', 'Conditional questions'),
            model.questions
              .filter((q) => q.when?.id === id)
              .map((q) => ({ label: name(q.id), href: `#q-${q.id}` })),
          ),
          node(
            t('Contrôles conditionnels', 'Conditional controls'),
            model.controls
              .filter((c) => c.when?.id === id)
              .map((c) => ({
                label: `${c.id} · ${lang === 'fr' ? c.title : controlEnglish[c.id][0]}`,
                href: `#c-${c.id}`,
              })),
          ),
        ],
      ),
      node(
        t(
          'Faux : masquer ; retirer la réponse du contexte effectif',
          'False: hide; remove answer from effective context',
        ),
      ),
    ]);
  const legal = node(
    t('Tests séparés par acteur et activité', 'Separate tests by actor and activity'),
    [
      ...scopeDefinitions.map((d) =>
        node(
          d.regime +
            ' · ' +
            (d.actor.startsWith('Fournisseur')
              ? t(d.actor, 'Supplier — confirm role')
              : t(d.actor, 'UNIL')),
          [
            ...d.ids.map((id) => node(name(id))),
            node(
              t('Faits → critères → proposition', 'Facts → criteria → proposal'),
              undefined,
              t(d.fr, d.en),
            ),
          ],
        ),
      ),
      node(
        t(
          'T02 : confirmer chaque régime ; motiver tout écart',
          'T02: confirm each regime; explain any departure',
        ),
        [
          node(t('Conflit → corriger les faits', 'Conflict → correct the facts')),
          node(
            t(
              'Exclusion / régime spécial → examen documenté',
              'Exclusion / special regime → documented review',
            ),
          ),
          node(
            t(
              'Conclusion enregistrée et invalidée si les faits changent',
              'Recorded conclusion invalidated when facts change',
            ),
          ),
        ],
      ),
    ],
  );
  const internal = model.questions.find((q) => q.id === question)?.audience === 'internal';
  const dependencies = node(name(question), [
    node(
      t(
        'Contrôles dont l’empreinte dépend de cette réponse',
        'Controls whose fingerprints depend on this answer',
      ),
      model.controls
        .filter((c) => internal || c.dependencies.includes(question))
        .map((c) => ({
          label: `${c.id} · ${lang === 'fr' ? c.title : controlEnglish[c.id][0]}`,
          href: `#c-${c.id}`,
        })),
    ),
    node(
      t('Checks automatiques', 'Automatic checks'),
      model.rules
        .filter(
          (r) =>
            r.dependencies.includes(question) ||
            (model.questions.find((q) => q.id === question)?.required &&
              r.dependencies.includes('@visible-required')),
        )
        .map((r) => ({ label: r.id, href: `#r-${r.id}` })),
    ),
    node(
      t('Si modification : recalcul et notes retirées', 'On change: recalculate and remove scores'),
      undefined,
      t(
        'Un examen concerné devient caduc ; un rapport existant reste inchangé. Toutes les réponses internes invalident tous les examens.',
        'Affected reviews become stale; existing reports stay unchanged. Every internal answer invalidates every review.',
      ),
    ),
  ]);
  const maps: Record<string, TreeNode> = {
    flow,
    outcome,
    activation: activation(signal),
    legal,
    protection: node(
      t('Plan de protection des données', 'Data-protection plan'),
      protectionDefinitions.map((d) =>
        node(t(d.title, d.enTitle), [
          node(t(d.fr, d.en)),
          node(t('Preuves → examen ' + d.control, 'Evidence → review ' + d.control)),
        ]),
      ),
    ),
    dependencies,
  };
  const titles: Record<string, string> = {
    flow: t('Processus complet', 'Complete process'),
    outcome: t('Priorité des cinq résultats', 'Priority of the five outcomes'),
    activation: t('Activation des branches', 'Branch activation'),
    legal: t('Cartographie par acteur', 'Mapping by actor'),
    protection: t('Protection des données', 'Data protection'),
    dependencies: t('Dépendances et invalidation', 'Dependencies and invalidation'),
  };
  return (
    <div>
      <p>
        {t(
          'Arbres explicatifs du comportement actuel. Les liens mènent aux questions, contrôles ou règles. Ils ne remplacent pas la validation juridique.',
          'Explanatory trees of current behaviour. Links lead to questions, controls or rules. They do not replace legal validation.',
        )}
      </p>
      <div className="no-print my-4 flex flex-wrap items-center gap-3">
        <GitBranch size={18} />
        <label>
          <span className="sr-only">{t('Choisir une carte', 'Choose a map')}</span>
          <select className="native-select" value={map} onChange={(e) => setMap(e.target.value)}>
            {Object.entries(titles).map(([id, title]) => (
              <option key={id} value={id}>
                {title}
              </option>
            ))}
          </select>
        </label>
        {map === 'activation' && (
          <select
            aria-label={t('Signal', 'Signal')}
            className="native-select"
            value={signal}
            onChange={(e) => setSignal(e.target.value)}
          >
            {Object.keys(model.activations).map((id) => (
              <option key={id}>{id}</option>
            ))}
          </select>
        )}
        {map === 'dependencies' && (
          <select
            aria-label={t('Question de la carte', 'Map question')}
            className="native-select max-w-72"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
          >
            {model.questions.map((q) => (
              <option key={q.id} value={q.id}>
                {name(q.id)}
              </option>
            ))}
          </select>
        )}
        <button
          className="checklist-button"
          aria-label={t('Réduire', 'Zoom out')}
          onClick={() => setZoom(Math.max(0.6, zoom - 0.2))}
        >
          −
        </button>
        <span>{Math.round(zoom * 100)}%</span>
        <button
          className="checklist-button"
          aria-label={t('Agrandir', 'Zoom in')}
          onClick={() => setZoom(Math.min(1.8, zoom + 0.2))}
        >
          +
        </button>
        <button className="checklist-button" onClick={() => setZoom(1)}>
          {t('Réinitialiser', 'Reset')}
        </button>
      </div>
      {(printAll
        ? ['flow', 'outcome', 'activation', 'legal', 'protection', 'dependencies']
        : [map]
      ).map((id) => (
        <div key={id} className="checklist-map">
          <h3>{titles[id]}</h3>
          <div className="checklist-map-scroll" tabIndex={0} aria-label={titles[id]}>
            <ol className="checklist-tree" style={{ zoom: printAll ? 1 : zoom }}>
              <Tree node={maps[id]} />
            </ol>
          </div>
        </div>
      ))}
      {printAll &&
        Object.keys(model.activations)
          .filter((id) => id !== signal)
          .map((id) => (
            <div className="checklist-map" key={id}>
              <h3>{id}</h3>
              <ol className="checklist-tree">
                <Tree node={activation(id)} />
              </ol>
            </div>
          ))}
    </div>
  );
}

function translatedOutcome(result: string, lang: Language) {
  return lang === 'fr'
    ? result
    : ((
        {
          BLOQUANT: 'BLOCKING',
          'À CLARIFIER': 'CLARIFICATION REQUIRED',
          'À CORRIGER': 'CORRECTION REQUIRED',
          'CONFORME SOUS CONDITIONS': 'COMPLIANT UNDER CONDITIONS',
          CONFORME: 'COMPLIANT',
        } as Record<string, string>
      )[result] ?? result);
}
