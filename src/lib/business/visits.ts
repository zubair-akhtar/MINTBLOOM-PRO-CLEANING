// @polsia:user-owned — server-only authorization and report projections.
import 'server-only';

import { prisma } from '@/lib/db';
import type { SessionUser } from '@/lib/require-auth';

export function normalizedVisitEmail(email: string): string {
  return email.trim().toLowerCase();
}

const visitSelect = {
  id: true,
  bookingId: true,
  customerUserId: true,
  customerEmail: true,
  serviceDate: true,
  serviceType: true,
  serviceDetails: true,
  addressLine1: true,
  addressLine2: true,
  city: true,
  state: true,
  zip: true,
  completionStatus: true,
  completionSummary: true,
  completedAt: true,
  photos: {
    orderBy: { displayOrder: 'asc' as const },
    select: { id: true, url: true, altText: true, caption: true, capturedAt: true },
  },
} as const;

const recleanSelect = {
  id: true,
  status: true,
  reason: true,
  createdAt: true,
} as const;

function isAuthorizedVisit(
  visit: { customerUserId: string | null; customerEmail: string },
  user: SessionUser,
  bookingEmail: string | null,
): boolean {
  const sessionEmail = normalizedVisitEmail(user.email);
  return (
    visit.customerUserId === user.id ||
    normalizedVisitEmail(visit.customerEmail) === sessionEmail ||
    (bookingEmail !== null && normalizedVisitEmail(bookingEmail) === sessionEmail)
  );
}

export async function findAuthorizedVisit(visitId: string, user: SessionUser) {
  const visit = await prisma.visit.findUnique({ where: { id: visitId }, select: visitSelect });
  if (!visit) return null;

  const booking = visit.bookingId
    ? await prisma.booking.findUnique({ where: { id: visit.bookingId }, select: { email: true } })
    : null;
  if (!isAuthorizedVisit(visit, user, booking?.email ?? null)) return null;

  const activeRecleanRequest = await prisma.recleanRequest.findFirst({
    where: { visitId: visit.id, status: 'active' },
    orderBy: { createdAt: 'desc' },
    select: recleanSelect,
  });

  return { visit, activeRecleanRequest };
}

export async function findAuthorizedVisitSummaries(user: SessionUser) {
  const email = normalizedVisitEmail(user.email);
  const bookings = await prisma.booking.findMany({
    where: { email: { equals: email, mode: 'insensitive' } },
    select: { id: true },
  });
  const bookingIds = bookings.map((booking) => booking.id);
  const visits = await prisma.visit.findMany({
    where: {
      OR: [
        { customerUserId: user.id },
        { customerEmail: { equals: email, mode: 'insensitive' } },
        { bookingId: { in: bookingIds } },
      ],
    },
    orderBy: [{ serviceDate: 'desc' }, { createdAt: 'desc' }],
    select: {
      id: true,
      serviceDate: true,
      serviceType: true,
      completionStatus: true,
    },
  });
  return visits.map((visit) => ({
    id: visit.id,
    serviceDate: visit.serviceDate.toISOString().slice(0, 10),
    serviceType: visit.serviceType,
    completionStatus: visit.completionStatus,
  }));
}

export function visitReportProjection(input: Awaited<ReturnType<typeof findAuthorizedVisit>>) {
  if (!input) return null;
  const { visit, activeRecleanRequest } = input;
  return {
    id: visit.id,
    serviceDate: visit.serviceDate.toISOString().slice(0, 10),
    serviceType: visit.serviceType,
    serviceDetails: visit.serviceDetails,
    address: {
      addressLine1: visit.addressLine1,
      addressLine2: visit.addressLine2,
      city: visit.city,
      state: visit.state,
      zip: visit.zip,
    },
    completionStatus: visit.completionStatus,
    completionSummary: visit.completionSummary,
    completedAt: visit.completedAt?.toISOString() ?? null,
    photos: visit.photos.map((photo) => ({
      id: photo.id,
      url: photo.url,
      alt: photo.altText,
      caption: photo.caption,
      capturedAt: photo.capturedAt.toISOString(),
    })),
    activeRecleanRequest: activeRecleanRequest
      ? {
          id: activeRecleanRequest.id,
          status: activeRecleanRequest.status,
          reason: activeRecleanRequest.reason,
          createdAt: activeRecleanRequest.createdAt.toISOString(),
        }
      : null,
  };
}
