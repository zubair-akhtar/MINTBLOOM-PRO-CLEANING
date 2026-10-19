// @polsia:user-owned — shared client/server contract for the careers resource.
// Keep this file client-safe: it contains zod only, never Prisma or server imports.

import { z } from 'zod';

export const ServiceMarket = z.object({
  id: z.string(),
  name: z.string(),
  state: z.string(),
  city: z.string(),
});

export const JobOpening = z.object({
  id: z.string(),
  title: z.string(),
  role: z.string(),
  employmentArea: z.string(),
  state: z.string(),
  city: z.string(),
  marketId: z.string(),
  schedule: z.string(),
  requirements: z.string(),
  compensation: z.string().nullable(),
  publishedAt: z.string().datetime(),
});

export const CareersResponse = z.object({
  openings: z.array(JobOpening),
  markets: z.array(ServiceMarket),
});

export const CareersApplicationInput = z.object({
  fullName: z.string().trim().min(2, 'Full name is required').max(120, 'Name is too long'),
  email: z.string().trim().email('Enter a valid email address').max(254, 'Email is too long'),
  phone: z.string().trim().max(40, 'Phone number is too long').optional(),
  roleInterest: z
    .string()
    .trim()
    .min(2, 'Tell us which role interests you')
    .max(120, 'Role is too long'),
  openingId: z.string().min(1).optional(),
  marketId: z.string().min(1).optional(),
  availability: z
    .string()
    .trim()
    .min(2, 'Tell us about your availability')
    .max(240, 'Availability is too long'),
  experience: z.string().trim().max(2000, 'Experience details are too long').optional(),
  message: z.string().trim().max(2000, 'Message is too long').optional(),
  consent: z.boolean().refine((value) => value, {
    message: 'Please confirm we may review your information',
  }),
});

export const CareersApplicationResult = z.object({
  applicationId: z.string(),
  message: z.string(),
});

export type ServiceMarket = z.infer<typeof ServiceMarket>;
export type JobOpening = z.infer<typeof JobOpening>;
export type CareersResponse = z.infer<typeof CareersResponse>;
export type CareersApplicationInput = z.infer<typeof CareersApplicationInput>;
export type CareersApplicationResult = z.infer<typeof CareersApplicationResult>;
