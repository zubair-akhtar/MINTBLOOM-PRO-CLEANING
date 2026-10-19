// @polsia:framework-owned
import { z } from 'zod';

const keySchema = z.string().regex(/^[a-z][a-z0-9_]{0,63}$/);
const optionSchema = z
  .object({ value: z.string().min(1).max(100), label: z.string().min(1).max(200) })
  .strict();
const fieldSchema = z
  .object({
    id: keySchema,
    label: z.string().min(1).max(200),
    type: z.enum(['text', 'email', 'tel', 'single', 'multiple', 'number', 'date', 'textarea']),
    required: z.boolean().optional(),
    help: z.string().max(500).optional(),
    options: z.array(optionSchema).min(1).max(30).optional(),
    min: z.number().finite().optional(),
    max: z.number().finite().optional(),
    maxLength: z.number().int().min(1).max(4000).optional(),
  })
  .strict()
  .superRefine((field, ctx) => {
    if ((field.type === 'single' || field.type === 'multiple') && !field.options)
      ctx.addIssue({ code: 'custom', message: 'Choices need options' });
    if (field.options && new Set(field.options.map((o) => o.value)).size !== field.options.length)
      ctx.addIssue({ code: 'custom', message: 'Option values must be unique' });
    if (field.min !== undefined && field.max !== undefined && field.min > field.max)
      ctx.addIssue({ code: 'custom', message: 'Minimum exceeds maximum' });
  });
export const formSchema = z
  .object({
    id: z.string().regex(/^[a-z][a-z0-9-]{0,63}$/),
    version: z.number().int().min(1),
    title: z.string().min(1).max(200),
    description: z.string().max(1000),
    confirmation: z.string().min(1).max(1000),
    steps: z
      .array(
        z
          .object({
            id: keySchema,
            title: z.string().min(1).max(200),
            fields: z.array(fieldSchema).min(1).max(40),
          })
          .strict(),
      )
      .min(1)
      .max(10),
  })
  .strict()
  .superRefine((form, ctx) => {
    const fields = form.steps.flatMap((step) => step.fields);
    if (
      fields.length > 40 ||
      new Set(fields.map((field) => field.id)).size !== fields.length ||
      new Set(form.steps.map((step) => step.id)).size !== form.steps.length
    )
      ctx.addIssue({
        code: 'custom',
        message: 'Use at most 40 fields with unique field and step IDs',
      });
    if (fields.some((field) => ['__proto__', 'prototype', 'constructor'].includes(field.id)))
      ctx.addIssue({ code: 'custom', message: 'Reserved field ID' });
  });
export type FormDefinition = z.infer<typeof formSchema>;
export type IntakeField = FormDefinition['steps'][number]['fields'][number];
export const answerSchema = z.union([
  z.string().max(4000),
  z.number().finite(),
  z.array(z.string().max(100)).max(20),
]);
export type AnswerValue = z.infer<typeof answerSchema>;
export type Answers = Record<string, AnswerValue>;
const publicAnswersSchema = z
  .unknown()
  .superRefine((value, ctx) => {
    if (
      value &&
      typeof value === 'object' &&
      Object.keys(value).some((key) => ['__proto__', 'constructor', 'prototype'].includes(key))
    )
      ctx.addIssue({ code: 'custom', message: 'Unknown answer field' });
  })
  .pipe(
    z.record(answerSchema).refine((value) => Object.keys(value).length <= 40, 'Too many fields'),
  );
export const submissionSchema = z
  .object({
    formId: z.string().min(1).max(64),
    formVersion: z.number().int().positive(),
    attemptId: z.string().uuid(),
    answers: publicAnswersSchema,
  })
  .strict();
export type Submission = z.infer<typeof submissionSchema>;
export function answersSchema(form: FormDefinition) {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const field of form.steps.flatMap((step) => step.fields)) {
    let schema: z.ZodTypeAny;
    if (field.type === 'number') {
      let number = z.number().finite();
      if (field.min !== undefined) number = number.min(field.min);
      if (field.max !== undefined) number = number.max(field.max);
      schema = number;
    } else if (field.type === 'multiple') {
      const allowed = new Set(field.options?.map((option) => option.value));
      schema = z
        .array(z.string().refine((value) => allowed.has(value), 'Choose an available option'))
        .max(20)
        .refine((values) => new Set(values).size === values.length, 'Choose each option once');
      if (field.required)
        schema = schema.refine(
          (values: string[]) => values.length > 0,
          'Choose at least one option',
        );
    } else {
      let string = z.string().max(field.maxLength ?? (field.type === 'textarea' ? 4000 : 320));
      if (field.required) string = string.min(1, 'This field is required');
      schema = string.refine(
        (value) => !field.required || value.trim().length > 0,
        'This field is required',
      );
      if (field.type === 'email')
        schema = schema.refine(
          (value: string) =>
            (value === '' && !field.required) || z.string().email().safeParse(value).success,
          'Enter a valid email',
        );
      if (field.type === 'tel')
        schema = schema.refine(
          (value: string) => (value === '' && !field.required) || /^[+\d() .-]{5,40}$/.test(value),
          'Enter a valid phone number',
        );
      if (field.type === 'single')
        schema = schema.refine(
          (value: string) =>
            (value === '' && !field.required) ||
            !!field.options?.some((option) => option.value === value),
          'Choose an available option',
        );
      if (field.type === 'date')
        schema = schema.refine(
          (value: string) =>
            (value === '' && !field.required) ||
            (/^\d{4}-\d{2}-\d{2}$/.test(value) &&
              Number.isFinite(Date.parse(`${value}T00:00:00Z`)) &&
              new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value),
          'Enter a valid date',
        );
    }
    shape[field.id] = field.required ? schema : schema.optional();
  }
  return z.object(shape).strict();
}
export function validateAnswers(form: FormDefinition, answers: unknown): Answers {
  return answersSchema(formSchema.parse(form)).parse(answers);
}
export const statusSchema = z.enum(['received', 'in_progress', 'processed', 'declined']);
export type IntakeStatus = z.infer<typeof statusSchema>;
export const statusLabels: Record<IntakeStatus, string> = {
  received: 'Received',
  in_progress: 'In progress',
  processed: 'Processed',
  declined: 'Declined',
};
export const transitions: Record<IntakeStatus, IntakeStatus[]> = {
  received: ['in_progress', 'declined'],
  in_progress: ['processed', 'declined'],
  processed: ['in_progress'],
  declined: ['in_progress'],
};
export const notificationSchema = z.object({
  status: z.enum(['pending', 'sending', 'sent', 'failed']),
  attempts: z.number().int(),
  lastError: z.string().nullable(),
  leaseUntil: z.string().nullable(),
});
export const requestSummarySchema = z.object({
  id: z.string(),
  reference: z.string(),
  formTitle: z.string(),
  contact: z.string(),
  status: statusSchema,
  version: z.number().int(),
  createdAt: z.string(),
  notification: notificationSchema,
});
export const requestDetailSchema = requestSummarySchema.extend({
  scope: z.string(),
  snapshot: formSchema,
  answers: z.record(answerSchema),
  note: z.string(),
  history: z.array(
    z.object({
      from: statusSchema.nullable(),
      to: statusSchema,
      actorId: z.string().nullable(),
      createdAt: z.string(),
    }),
  ),
});
export type RequestDetail = z.infer<typeof requestDetailSchema>;
export const listResponseSchema = z.object({
  items: z.array(requestSummarySchema),
  total: z.number().int(),
  page: z.number().int(),
  pageSize: z.number().int(),
});
export const detailResponseSchema = z.object({ item: requestDetailSchema });
export const submissionResponseSchema = z.object({ reference: z.string() }).strict();
export const mutationSchema = z
  .object({
    expectedVersion: z.number().int().positive(),
    status: statusSchema.optional(),
    note: z.string().max(4000).optional(),
  })
  .strict()
  .refine(
    (value) => value.status !== undefined || value.note !== undefined,
    'Provide status or note',
  );
export type Mutation = z.infer<typeof mutationSchema>;
export const listQuerySchema = z
  .object({
    q: z.string().max(120).default(''),
    status: statusSchema.optional(),
    page: z.coerce.number().int().min(1).max(1000).default(1),
    pageSize: z.coerce.number().int().min(1).max(50).default(20),
  })
  .strict();
export type ListQuery = z.infer<typeof listQuerySchema>;
