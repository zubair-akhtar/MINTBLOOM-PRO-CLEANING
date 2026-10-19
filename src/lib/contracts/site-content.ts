// @polsia:user-owned — client-safe contract for the customer-facing homepage.
import { z } from 'zod';

const textList = z.array(z.string().min(1));

export const SiteContentResponse = z.object({
  hero: z.object({
    eyebrow: z.string().min(1),
    title: z.string().min(1),
    accent: z.string().min(1),
    description: z.string().min(1),
    reassurance: z.string().min(1),
  }),
  trustPills: z.array(z.object({ label: z.string().min(1), icon: z.string().min(1) })).min(3),
  values: z
    .array(
      z.object({
        eyebrow: z.string().min(1),
        title: z.string().min(1),
        body: z.string().min(1),
        bullets: textList,
        icon: z.string().min(1),
      }),
    )
    .min(3),
  steps: z
    .array(
      z.object({ number: z.string().min(1), title: z.string().min(1), body: z.string().min(1) }),
    )
    .min(3),
  faith: z.object({
    eyebrow: z.string().min(1),
    title: z.string().min(1),
    intro: z.string().min(1),
    verses: z.array(z.object({ reference: z.string().min(1), text: z.string().min(1) })).length(7),
  }),
  plans: z
    .array(
      z.object({
        name: z.string().min(1),
        audience: z.string().min(1),
        body: z.string().min(1),
        features: textList,
        priceLabel: z.string().min(1).nullable(),
        cta: z.string().min(1),
        emphasis: z.boolean(),
      }),
    )
    .min(3),
  specialty: z.array(z.object({ label: z.string().min(1), icon: z.string().min(1) })).min(3),
  guarantees: z
    .array(z.object({ title: z.string().min(1), body: z.string().min(1), icon: z.string().min(1) }))
    .min(3),
  faqs: z.array(z.object({ question: z.string().min(1), answer: z.string().min(1) })).min(4),
  closing: z.object({
    eyebrow: z.string().min(1),
    title: z.string().min(1),
    body: z.string().min(1),
    note: z.string().min(1),
  }),
  serviceNotes: z.object({ title: z.string().min(1), body: z.string().min(1), bullets: textList }),
});

export type SiteContentResponse = z.infer<typeof SiteContentResponse>;
