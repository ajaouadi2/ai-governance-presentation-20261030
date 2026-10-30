import { translateV32 } from './questionnaire-v32-i18n';
import { v32SummaryCheckTitle } from './questionnaire-v32-summary-labels';
import { v32CaseIssues, v32DpfPolicy } from './questionnaire-v32-policy';
import { v32LegalReferences } from './questionnaire-v32-legal';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import catalogue from '../config/questionnaire-v32/catalogue.json';
import presentation from '../config/questionnaire-v32/presentation.json';
import { V32Store, V32StoreError, type V32Document } from './questionnaire-v32-store';
import { evaluateV32, evaluateV32Followup, v32OpenIssues } from './questionnaire-v32-engine';
import { v32Automation } from './questionnaire-v32-automation';
import { v32Journey, v32LocationLabel } from './questionnaire-v32-journey';
import { v32DecisionNames, v32Readable, v32VerdictNames } from './questionnaire-v32-labels';

const escape = (value: unknown) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
export function renderV32Report(document: V32Document, generatedAt: string, locale: 'fr' | 'en') {
  const en = locale === 'en';
  const tr = (text: string) => translateV32(text, locale);
  const loc = (id: string) => tr(v32LocationLabel(id));
  const t = (fr: string, english: string) => (en ? english : fr);
  const result = evaluateV32(document.draft.answers, document.draft);
  const followup = evaluateV32Followup(document.draft.followupAnswers, document.draft.context);
  const synthesis = v32Automation(result, document.draft);
  const confirmed = synthesis.decisionStatus === 'confirmed';
  const names = en
    ? {
        go: 'Favourable assessment',
        'conditional-go': 'Favourable assessment subject to conditions',
        'no-go': 'Unfavourable assessment',
        suspended: 'Assessment incomplete / validation pending',
      }
    : v32DecisionNames;
  const rows = [
    ...result.questions.filter((r) => !r.id.startsWith('V32-S09')),
    ...followup.questions,
  ];
  const answer = (id: string, letter?: string) =>
    tr(
      v32Readable(
        presentation.questions.find((q) => q.id === id)?.answers.find((a) => a.letter === letter)
          ?.label ?? '—',
      ),
    );
  const cell = (s: unknown) => `<td>${escape(s)}</td>`;
  const table = (headers: string[], body: string) =>
    `<div class="table-wrap"><table><thead><tr>${headers.map((h) => `<th>${escape(h)}</th>`).join('')}</tr></thead><tbody>${body}</tbody></table></div>`;
  const heading = (s: string) => `<h2>${escape(s)}</h2>`;
  const p = (s: string) => `<p>${escape(s)}</p>`;
  const decision = document.draft.decisionRecord;
  const conditions = synthesis.conditions;
  const blockers = result.summary.filter(
    (r) => r.effectiveVerdict === 'NE PAS POURSUIVRE' && !r.questionId.startsWith('V32-S08'),
  );
  const sourceStatus: Record<string, string> = en
    ? {
        answered: 'Answered',
        unanswered: 'To complete',
        'not-reached': 'Not reached',
        skipped: 'Omitted from current path',
      }
    : {
        answered: 'Réponse prise en compte',
        unanswered: 'À compléter',
        'not-reached': 'Non atteinte',
        skipped: 'Omise du parcours actuel',
      };
  const conditionStatus: Record<string, string> = en
    ? {
        classification: 'Classification retained',
        clarification: 'Closure criterion to clarify',
        resolved: 'Action verified',
        stale: 'Verification to renew',
        open: 'Action outstanding',
      }
    : {
        classification: 'Classement conservé',
        clarification: 'Critère de clôture à préciser',
        resolved: 'Action vérifiée',
        stale: 'À revérifier',
        open: 'Action ouverte',
      };
  const checks = result.verificationChecks;
  const stageRows = v32Journey.stages
    .map((stage) => {
      const ids = stage.sections.flatMap((s) => s.questionIds);
      const stageRows = rows.filter((r) => ids.includes(r.id));
      const deferred = stageRows.filter(
        (r) => r.id.startsWith('V32-S09') && !document.draft.context.contractSigned,
      ).length;
      const counts = (state: string) =>
        stageRows.filter(
          (r) =>
            r.state === state &&
            !(r.id.startsWith('V32-S09') && !document.draft.context.contractSigned),
        ).length;
      // No stage is labelled legally compliant merely because all answers are present.
      return `<tr>${cell(stage.number + '. ' + tr(stage.title))}${cell(counts('answered'))}${cell(counts('unanswered') + counts('not-reached'))}${cell(counts('skipped'))}${cell(deferred)}</tr>`;
    })
    .join('');
  const appendix = v32Journey.stages
    .map((stage) => {
      const ids = stage.sections.flatMap((s) => s.questionIds);
      return (
        heading(stage.number + '. ' + tr(stage.title)) +
        ids
          .map((id) => {
            const q = catalogue.questions.find((q) => q.id === id)!;
            const row = rows.find((r) => r.id === id);
            const active = row?.state === 'answered';
            const notes = document.draft.notes[id];
            const evidence = document.draft.supplierEvidence?.[id];
            return `<section class="answer"><h3>${escape(loc(id))} · PDF ${q.stage}.${q.number} · p. ${q.pages.join(', ')}</h3>${p(tr(q.stemText))}<p><b>${escape(id.startsWith('V32-S09') && !document.draft.context.contractSigned ? t('Après signature — suivi non ouvert', 'After signing — follow-up not open') : sourceStatus[row?.state ?? 'not-reached'])}</b>${active ? ' — ' + escape(answer(id, row?.letter)) : ''}</p>${active && row?.effectiveVerdict ? p(tr(v32VerdictNames[row.effectiveVerdict])) : ''}${notes ? `<p class="muted">${escape(t('Précisions UNIL', 'UNIL notes'))} : ${escape(notes)}${!active ? ' (' + escape(t('conservées hors résultat courant', 'retained outside current result')) + ')' : ''}</p>` : ''}${evidence ? p(t('Référence fournisseur', 'Supplier reference') + ' : ' + evidence.reference + ' — ' + (evidence.verified ? t('vérification déclarée par', 'verification recorded by') + ' ' + evidence.checkedBy + ' · ' + evidence.date : t('non vérifiée', 'not verified'))) : ''}</section>`;
          })
          .join('')
      );
    })
    .join('');
  const legal = rows
    .filter((r) => r.state === 'answered')
    .map((row) => {
      const refs = v32LegalReferences(row.id, locale);
      return `<section><h3>${escape(tr(v32LocationLabel(row.id)))}</h3>${
        refs.length
          ? refs
              .map(
                (ref) =>
                  `<p><strong>${escape(ref.article)}</strong> — <a href="${escape(ref.url)}">${escape(ref.title)}</a></p>`,
              )
              .join('')
          : p(
              t(
                'Aucun article précis identifié — référence juridique à vérifier.',
                'No precise article identified — legal reference to verify.',
              ),
            )
      }</section>`;
    })
    .join('');
  const explanations = rows
    .filter((row) => row.state === 'answered')
    .flatMap((row) => {
      const notes = presentation.questions.find((q) => q.id === row.id)?.generalNotes ?? [];
      return notes.length
        ? [
            `<section><h3>${escape(tr(v32LocationLabel(row.id)))}</h3>${notes.map((note) => p(tr(note))).join('')}</section>`,
          ]
        : [];
    })
    .join('');
  const outstanding = conditions.filter((c) => !['resolved', 'classification'].includes(c.state));
  const completed = conditions.filter((c) => ['resolved', 'classification'].includes(c.state));
  const separateChecks = checks.filter(
    (c) => !completed.some((item) => item.questionId === c.questionId),
  );
  const completedBody =
    completed
      .map(
        (c) =>
          `<tr>${cell(v32SummaryCheckTitle(c.questionId, c.actions.map(tr).join('\n') || tr(c.answerLabel), locale))}${cell(conditionStatus[c.state])}${cell(c.record?.date || '—')}</tr>`,
      )
      .join('') +
    separateChecks
      .filter((c) => c.status === 'confirmed')
      .map(
        (c) =>
          `<tr>${cell(tr(c.label))}${cell(t('Confirmé', 'Confirmed'))}${cell(document.draft.verifications?.[c.id]?.date || '—')}</tr>`,
      )
      .join('');
  const outstandingBody = outstanding
    .map(
      (c) =>
        `<section class="action"><div class="action-heading"><h3>${escape(v32SummaryCheckTitle(c.questionId, c.actions.map(tr).join(' · ') || tr(c.answerLabel), locale))}</h3><span>${escape(conditionStatus[c.state])}</span></div><div class="assignment"><p><span>${t('Responsable', 'Owner')}</span>${escape(c.record?.owner || t('À attribuer', 'To assign'))}</p><p><span>${t('Échéance', 'Deadline')}</span>${escape(c.record?.deadline || t('À fixer', 'To set'))}</p></div></section>`,
    )
    .join('');
  const remainingIssues = [
    ...new Set([
      ...v32CaseIssues(result.pendingIssues, confirmed),
      ...(document.draft.context.contractSigned ? followup.pendingIssues : []),
    ]),
  ];
  const pendingChecks = separateChecks.filter((c) => c.status !== 'confirmed');
  const stageSummary = v32Journey.stages
    .map((stage) => {
      const ids = stage.sections.flatMap((s) => s.questionIds);
      const count = rows.filter(
        (r) =>
          ids.includes(r.id) &&
          r.state === 'answered' &&
          !r.id.startsWith('V32-S08') &&
          !r.id.startsWith('V32-S09'),
      ).length;
      return count
        ? `<tr>${cell(tr(stage.title))}${cell(t('Réponses prises en compte', 'Recorded answers'))}${cell(count)}</tr>`
        : '';
    })
    .join('');
  const html = `<!doctype html><html lang="${locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escape(document.title)} · ${t('Rapport d’évaluation', 'Assessment report')}</title><style>
  *{box-sizing:border-box}body{margin:0;background:#edf2f5;color:#203849;font:15px/1.6 Arial,sans-serif}main{max-width:980px;margin:28px auto;background:white;padding:52px;border-radius:12px}header{border-top:7px solid #315c73;padding-top:22px}h1{font-size:30px;line-height:1.2;margin:10px 0}h2{font-size:21px;border-bottom:1px solid #d6e2e8;padding-bottom:8px;margin-top:32px}h3{font-size:16px}p{white-space:pre-line;overflow-wrap:anywhere}.eyebrow{letter-spacing:2px;font-size:12px;font-weight:bold;color:#526e80}.muted{color:#586d7a;font-size:13px}.result{padding:22px;border:1px solid #b8cfdb;border-left:6px solid #315c73;background:#f0f6f9;margin:24px 0;border-radius:6px}.result strong{font-size:22px;display:block}.badge{display:inline-block;background:#e9eef2;padding:4px 10px;border-radius:20px;font-weight:bold;font-size:12px}.table-wrap{overflow:auto}table{width:100%;border-collapse:collapse;font-size:13px}th{text-align:left;background:#eaf1f5}td,th{padding:10px;border:1px solid #d9e3e9;vertical-align:top;overflow-wrap:anywhere}.answer{border-bottom:1px solid #d9e3e9;padding:8px 0}.appendix{break-before:page}footer{border-top:1px solid #d9e3e9;margin-top:32px;padding-top:12px;font-size:12px;color:#586d7a}.result.go{border-color:#377155;background:#f0f7f2}.result.conditional-go,.action{border-color:#a67828;background:#fff7e9}.result.no-go,.blocking{border-color:#a24e49;background:#fcf3f2}.overview{display:flex;gap:24px;flex-wrap:wrap;border-bottom:1px solid #d9e3e9;padding:12px 0}.overview span{color:#315c73}.action,.blocking{border-left:4px solid #a67828;padding:14px 18px;margin:12px 0;break-inside:avoid}.blocking{border-left-color:#a24e49}.action-heading{display:flex;justify-content:space-between;gap:15px;align-items:baseline}.action h3{margin:0}.action-heading span{font-size:12px;color:#805313}.assignment{display:flex;gap:28px;flex-wrap:wrap}.assignment p{margin-bottom:0}.assignment span{display:block;font-size:12px;color:#586d7a}.record{color:#286044;font-size:13px}.summary-foot{font-size:12px;color:#586d7a;margin-top:22px}.report-summary table td,.report-summary table th{border-width:0 0 1px;background:white}.report-summary h2{font-size:17px;margin-top:22px}.report-summary .result{margin:18px 0}.report-summary .result strong{font-size:21px}.report-summary .result p{margin:6px 0}.report-summary{break-after:page}@page{size:A4;margin:16mm}@media print{body{background:white;font-size:10pt}main{padding:0;margin:0;max-width:none;border-radius:0}h1{font-size:23pt}h2{font-size:15pt;break-after:avoid}h3{break-after:avoid}thead{display:table-header-group}tr,.result{break-inside:avoid}.table-wrap{overflow:visible}td,th{padding:6px}.answer p{orphans:3;widows:3}}
  </style></head><body><main><header><div class="eyebrow">UNIL · ${t('ÉVALUATION DES OUTILS D’IA', 'AI TOOL ASSESSMENT')}</div><h1>${escape(document.title)}</h1><span class="badge">${t(confirmed ? 'Rapport de décision' : 'Rapport provisoire', confirmed ? 'Decision report' : 'Provisional report')}</span>${p(t('Révision', 'Revision') + ' ' + document.revision + ' · ' + t('Généré le', 'Generated on') + ' ' + new Date(generatedAt).toLocaleString(en ? 'en-GB' : 'fr-CH', { timeZone: 'Europe/Paris' }) + ' (Europe/Paris)')}<p class="muted">${t('Instantané de la révision enregistrée. Les modifications ultérieures ne changent pas ce rapport.', 'Snapshot of the saved revision. Later changes do not alter this report.')}</p></header>
  <section class="report-summary">
  <section class="result ${confirmed ? decision!.choice : synthesis.proposal}"><span>${t(confirmed ? 'Décision de l’UNIL' : 'Proposition de l’application', confirmed ? 'UNIL decision' : 'Application proposal')}</span><strong>${escape(names[confirmed ? decision!.choice : synthesis.proposal])}</strong>${p(tr(v32Readable(synthesis.reason)))}${confirmed && decision && decision.choice !== synthesis.proposal ? p(t('Proposition de l’application : ', 'Application proposal: ') + names[synthesis.proposal]) : ''}${confirmed && decision ? `<p class="record">✓ ${t('Confirmée', 'Confirmed')} · ${escape(decision.name)} · ${escape(decision.date)}</p>` : p(synthesis.decisionStatus === 'stale' ? t('À confirmer à nouveau : le dossier ou le choix a changé.', 'Reconfirmation required: the assessment or choice has changed.') : t('Non encore confirmée.', 'Not yet confirmed.'))}</section>
  ${document.draft.notes['V32-S01-Q01'] ? heading(t('Usage évalué', 'Assessed use')) + p(document.draft.notes['V32-S01-Q01']) : ''}
  <div class="overview"><span>${blockers.length ? t('Points bloquants', 'Blocking points') + ': ' + blockers.length : '✓ ' + t('Aucun point bloquant', 'No blocking points')}</span><span>${outstanding.length ? t('Actions à suivre', 'Actions outstanding') + ': ' + outstanding.length : '✓ ' + t('Aucune condition ouverte', 'No open conditions')}</span></div>
  ${blockers.length ? heading(t('Points bloquants', 'Blocking points')) + blockers.map((r) => `<section class="blocking">${p(loc(r.questionId) + ' — ' + answer(r.questionId, r.letter))}</section>`).join('') : ''}
  ${outstanding.length ? heading(t('Action requise', 'Action required')) + outstandingBody : ''}
  ${pendingChecks.length ? heading(t('Validations à confirmer', 'Validations pending')) + pendingChecks.map((c) => `<section class="action">${p(tr(c.label))}${p(c.status === 'stale' ? t('À renouveler', 'To renew') : t('À confirmer', 'Pending confirmation'))}</section>`).join('') : ''}
  ${heading(t('Contrôles réalisés', 'Completed checks'))}${table([t('Contrôle', 'Check'), t('État', 'Status'), t('Date / réponses', 'Date / answers')], completedBody || stageSummary)}
  ${confirmed && decision ? heading(t('Motifs de la décision', 'Decision reasons')) + p(decision.reasons) : decision ? p(t('Enregistrement antérieur, non confirmé pour cette révision : ', 'Previous record, not confirmed for this revision: ') + names[decision.choice] + '\n' + decision.reasons) : ''}
  ${remainingIssues.length ? heading(t('Points restant à vérifier', 'Points requiring review')) + remainingIssues.map((code) => p(code + ' — ' + tr(v32Readable(v32OpenIssues.find((i) => i.id === code)?.description ?? code)))).join('') : ''}
  <p class="summary-foot">${t('Prototype académique · L’UNIL conserve l’autorité de mise en service.', 'Academic prototype · UNIL retains deployment authority.')}</p>
  </section>
  <section class="appendix">${heading(t('Annexe — parcours et preuves', 'Appendix — assessment path and evidence'))}${table([t('Étape', 'Stage'), t('Réponses', 'Answers'), t('À compléter / non atteintes', 'Missing / not reached'), t('Omises', 'Omitted'), t('Après signature', 'After signing')], stageRows)}${conditions.length ? heading(t('Vérifications documentées', 'Documented verifications')) + table([t('Contrôle', 'Check'), t('Vérification / preuve', 'Verification / evidence')], conditions.map((c) => `<tr>${cell(loc(c.questionId) + '\n' + c.actions.map(tr).join('\n'))}${cell([c.record?.actionTaken, c.record?.reference, c.record?.checkedBy, c.record?.date].filter(Boolean).join('\n') || '—')}</tr>`).join('')) : ''}${
    checks.length
      ? table(
          [t('Contrôle', 'Check'), t('Écrit / vérification', 'Written evidence / review')],
          checks
            .map((c) => {
              const record = document.draft.verifications?.[c.id];
              return `<tr>${cell(tr(c.label))}${cell([record?.reference, record?.reviewer, record?.date].filter(Boolean).join('\n') || '—')}</tr>`;
            })
            .join(''),
        )
      : ''
  }</section>
  <section class="appendix">${heading(t('Politique d’évaluation', 'Assessment policy'))}${p(en ? v32DpfPolicy.en : v32DpfPolicy.fr)}${p(t('Les notes générales du document source restent consultables dans les archives de l’application.', 'General source-document notes remain available in the application archives.'))}</section>
  <section class="appendix">${heading(t('Annexe — réponses et précisions', 'Appendix — answers and notes'))}${p(t('Le PDF français reste la source. La version anglaise traduit les questions et références, sans modifier les réponses saisies. Les anciennes réponses hors parcours ne sont pas des réponses actives.', 'The French PDF remains the source. The English version translates questions and references without changing entered answers. Retained answers outside the current path are not active answers.'))}${appendix}</section>
  ${explanations ? `<section class="appendix">${heading(t('Explications', 'Explanations'))}${explanations}</section>` : ''}
  <section class="appendix">${heading(t('Bases légales', 'Legal bases'))}${p(t('Applicabilité et version en vigueur à vérifier pour ce projet.', 'Applicability and the version in force must be checked for this project.'))}${legal}</section>
  <footer>${escape(catalogue.source.filename)}<br>SHA-256 : ${catalogue.source.sha256}<br>${escape(result.version)} · ${escape(synthesis.version)} · ${escape(v32Journey.version)}<br>${escape(document.id)} · ${t('Révision', 'Revision')} ${document.revision}</footer></main></body></html>`;
  return {
    html,
    provisional: !confirmed,
    proposal: synthesis.proposal,
    decisionStatus: synthesis.decisionStatus,
  };
}

export class V32ReportStore {
  constructor(private store = new V32Store()) {}
  private folder(id: string) {
    if (!z.uuid().safeParse(id).success) throw new V32StoreError(404, 'Rapport introuvable.');
    return path.join(this.store.directory, 'reports', id);
  }
  async create(id: string, revision: number, locale: 'fr' | 'en') {
    const document = await this.store.load(id);
    if (document.revision !== revision)
      throw new V32StoreError(
        409,
        'Le dossier a changé. Rechargez-le avant de générer le rapport.',
      );
    const generatedAt = new Date().toISOString();
    const report = {
      id: randomUUID(),
      documentId: id,
      revision,
      generatedAt,
      locale,
      title: document.title,
      ...renderV32Report(document, generatedAt, locale),
      document,
    };
    const payload = JSON.stringify(report);
    const folder = this.folder(id);
    await mkdir(folder, { recursive: true });
    await writeFile(
      path.join(folder, report.id + '.json'),
      JSON.stringify({
        sha256: createHash('sha256').update(payload).digest('hex'),
        payload: report,
      }),
      { flag: 'wx' },
    );
    return this.metadata(report);
  }
  private metadata(report: Awaited<ReturnType<V32ReportStore['load']>>) {
    const { id, revision, generatedAt, locale, title, provisional } = report;
    return { id, revision, generatedAt, locale, title, provisional };
  }
  async load(id: string, reportId: string) {
    if (!z.uuid().safeParse(reportId).success) throw new V32StoreError(404, 'Rapport introuvable.');
    try {
      const envelope = JSON.parse(
        await readFile(path.join(this.folder(id), reportId + '.json'), 'utf8'),
      );
      const payload = envelope.payload as {
        id: string;
        documentId: string;
        revision: number;
        generatedAt: string;
        locale: 'fr' | 'en';
        title: string;
        provisional: boolean;
        html: string;
        document: V32Document;
      };
      if (
        payload.id !== reportId ||
        payload.documentId !== id ||
        createHash('sha256').update(JSON.stringify(payload)).digest('hex') !== envelope.sha256
      )
        throw new V32StoreError(409, 'Intégrité du rapport à vérifier.');
      return payload;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT')
        throw new V32StoreError(404, 'Rapport introuvable.');
      throw e;
    }
  }
  async list(id: string) {
    await this.store.load(id);
    let files: string[];
    try {
      files = await readdir(this.folder(id));
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw e;
    }
    const reports = await Promise.all(
      files
        .filter((f) => /^[0-9a-f-]{36}\.json$/.test(f))
        .map(async (f) => this.metadata(await this.load(id, f.slice(0, -5)))),
    );
    return reports.sort((a, b) => b.generatedAt.localeCompare(a.generatedAt));
  }
}
export const v32ReportStore = new V32ReportStore();
