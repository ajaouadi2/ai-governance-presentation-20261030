import { z } from 'zod';
import catalogue from '../config/questionnaire-v32/catalogue.json';
export const V32_DRAFT_KEY = `clair-v32-preview:${catalogue.source.sha256}`;
const choices = z.record(z.string(), z.string()).superRefine((answers, ctx) => {
  for (const [id, letter] of Object.entries(answers))
    if (!catalogue.questions.some((q) => q.id === id && q.answers.some((a) => a.letter === letter)))
      ctx.addIssue({ code: 'custom', message: `Réponse hors catalogue : ${id}` });
});
export const v32DraftSchema = z
  .strictObject({
    format: z.literal('clair-v32-browser-draft.1'),
    sourceSha256: z.literal(catalogue.source.sha256),
    answers: choices,
    conditionReviews: z
      .record(
        z.string().max(80),
        z.strictObject({
          resolved: z.boolean(),
          actionTaken: z.string().max(4000),
          reference: z.string().max(2000),
          checkedBy: z.string().max(200),
          date: z.string().max(10),
          owner: z.string().max(200),
          deadline: z.string().max(10),
          basis: z.string().max(240),
        }),
      )
      .refine((v) => Object.keys(v).length <= 100, 'Trop de conditions')
      .optional(),
    decisionRecord: z
      .strictObject({
        choice: z.enum(['go', 'conditional-go', 'no-go']),
        name: z.string().trim().min(1).max(200),
        function: z.string().trim().min(1).max(200),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        reasons: z.string().trim().min(1).max(4000),
        basis: z.string().max(240),
      })
      .optional(),
    supplierEvidence: z
      .record(
        z.string(),
        z.strictObject({
          reference: z.string().max(2000),
          verified: z.boolean(),
          checkedBy: z.string().max(200),
          date: z.string().max(10),
        }),
      )
      .optional(),
    verifications: z
      .record(
        z.string().max(80),
        z.strictObject({
          confirmed: z.boolean(),
          reference: z.string().max(2000),
          reviewer: z.string().max(200),
          date: z.string().max(10),
          basis: z.string().max(120),
        }),
      )
      .refine((v) => Object.keys(v).length <= 30, 'Trop de confirmations')
      .optional(),
    notes: z.record(z.string(), z.string().max(12000)),
    followupAnswers: choices,
    context: z.strictObject({
      contractSigned: z.boolean(),
      publicProcurement: z.boolean().nullable(),
    }),
  })
  .superRefine((d, ctx) => {
    for (const key of Object.keys(d.conditionReviews ?? {})) {
      const [id, letter, ...extra] = key.split('/');
      if (
        extra.length ||
        !catalogue.questions.some(
          (q) =>
            q.id === id &&
            q.stage < 8 &&
            q.id !== 'V32-S04-Q04' &&
            q.answers.some(
              (a) =>
                a.letter === letter &&
                ['SOUS CONDITION', 'NE PAS POURSUIVRE'].includes(a.sourceVerdict),
            ),
        )
      )
        ctx.addIssue({ code: 'custom', message: 'Condition hors questionnaire.' });
    }
    for (const [key, record] of Object.entries(d.supplierEvidence ?? {})) {
      if (!catalogue.questions.some((q) => q.id === key && q.stage >= 4 && q.stage <= 7))
        ctx.addIssue({ code: 'custom', message: 'Justificatif hors section fournisseur.' });
      if (
        record.verified &&
        (!record.reference.trim() ||
          !record.checkedBy.trim() ||
          !/^\d{4}-\d{2}-\d{2}$/.test(record.date))
      )
        ctx.addIssue({ code: 'custom', message: 'Vérification fournisseur incomplète.' });
    }
    for (const key of Object.keys(d.answers))
      if (key.startsWith('V32-S09'))
        ctx.addIssue({ code: 'custom', message: 'Réponse de suivi dans le parcours principal.' });
    for (const key of Object.keys(d.followupAnswers))
      if (!key.startsWith('V32-S09'))
        ctx.addIssue({ code: 'custom', message: 'Réponse principale dans le suivi.' });
    for (const key of Object.keys(d.notes))
      if (!catalogue.questions.some((q) => q.id === key))
        ctx.addIssue({ code: 'custom', message: 'Note hors catalogue.' });
  });
export type V32BrowserDraft = z.infer<typeof v32DraftSchema>;
export const emptyV32Draft = (): V32BrowserDraft => ({
  format: 'clair-v32-browser-draft.1',
  sourceSha256: catalogue.source.sha256,
  answers: {},
  notes: {},
  followupAnswers: {},
  context: { contractSigned: false, publicProcurement: null },
});
