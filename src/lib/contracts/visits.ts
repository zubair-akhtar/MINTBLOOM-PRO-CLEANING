// @polsia:user-owned — client-safe contracts for visit reports and re-clean requests.
// Keep this module zod-only so route handlers and client islands share one wire shape.
import { z } from 'zod';

const calendarDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected a calendar date');
const isoDateTime = z.string().datetime({ offset: true });

export const VisitCompletionStatus = z.enum(['completed', 'needs_attention', 'cancelled']);
export const RecleanRequestStatus = z.enum(['active', 'resolved', 'cancelled']);

export const VisitSpotCheckPhoto = z.object({
  id: z.string().min(1),
  url: z.string().url(),
  alt: z.string().min(1),
  caption: z.string().nullable(),
  capturedAt: isoDateTime,
});

export const RecleanRequest = z.object({
  id: z.string().min(1),
  status: RecleanRequestStatus,
  reason: z.string().nullable(),
  createdAt: isoDateTime,
});

export const VisitSummary = z.object({
  id: z.string().min(1),
  serviceDate: calendarDate,
  serviceType: z.string().min(1),
  completionStatus: VisitCompletionStatus,
});

export const VisitReport = z.object({
  id: z.string().min(1),
  serviceDate: calendarDate,
  serviceType: z.string().min(1),
  serviceDetails: z.string().nullable(),
  address: z.object({
    addressLine1: z.string().min(1),
    addressLine2: z.string().nullable(),
    city: z.string().min(1),
    state: z.string().min(1),
    zip: z.string().min(1),
  }),
  completionStatus: VisitCompletionStatus,
  completionSummary: z.string().nullable(),
  completedAt: isoDateTime.nullable(),
  photos: z.array(VisitSpotCheckPhoto),
  activeRecleanRequest: RecleanRequest.nullable(),
});

export const VisitReportResponse = z.object({ visit: VisitReport });
export const VisitSummaryList = z.object({ visits: z.array(VisitSummary) });

export const RecleanRequestCreate = z
  .object({ reason: z.string().trim().min(1).max(500).optional() })
  .strict();

export const RecleanRequestResponse = z.object({ recleanRequest: RecleanRequest });

export type VisitCompletionStatus = z.infer<typeof VisitCompletionStatus>;
export type RecleanRequest = z.infer<typeof RecleanRequest>;
export type VisitSummary = z.infer<typeof VisitSummary>;
export type VisitReport = z.infer<typeof VisitReport>;
export type VisitReportResponse = z.infer<typeof VisitReportResponse>;
export type VisitSummaryList = z.infer<typeof VisitSummaryList>;
export type RecleanRequestCreate = z.infer<typeof RecleanRequestCreate>;
export type RecleanRequestResponse = z.infer<typeof RecleanRequestResponse>;
