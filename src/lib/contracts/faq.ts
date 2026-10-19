// @polsia:user-owned — client-safe FAQ REST contract.
import { z } from 'zod';

const FaqItem = z.object({
  id: z.string().min(1),
  question: z.string().min(1),
  answer: z.string().min(1),
});

export const FaqResponse = z.object({
  items: z.array(FaqItem).length(5),
});

export type FaqResponse = z.infer<typeof FaqResponse>;
