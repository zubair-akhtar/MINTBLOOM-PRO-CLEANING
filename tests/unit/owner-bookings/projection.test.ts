import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/db', () => ({ prisma: {} }));

import { normalizeOwnerBookings, type OwnerBookingSources } from '@/lib/business/owner-bookings';

const booking = {
  id: 'booking_1',
  fullName: 'Jordan Lee',
  email: 'jordan@example.com',
  phone: '806-555-0188',
  addressLine1: '100 Main Street',
  addressLine2: null,
  city: 'Lubbock',
  state: 'TX',
  zip: '79401',
  bedrooms: 2,
  bathrooms: 2,
  serviceType: 'recurringResidential' as const,
  cadence: 'biweekly',
  serviceDate: new Date('2026-09-20T00:00:00.000Z'),
  paymentAmountCents: 16900,
  totalAmountCents: 16900,
  areaClassification: 'core',
  checkoutSessionId: 'cs_paid',
  status: 'active' as const,
  cancelledAt: null,
  createdAt: new Date('2026-09-10T12:00:00.000Z'),
};

function sources(overrides: Partial<OwnerBookingSources> = {}): OwnerBookingSources {
  return {
    bookings: [booking],
    drafts: [
      {
        ...booking,
        id: 'draft_fulfilled',
        checkoutSessionId: 'cs_paid',
        amountCents: 16900,
        status: 'pending' as const,
      },
      {
        ...booking,
        id: 'draft_pending',
        checkoutSessionId: 'cs_pending',
        serviceType: 'oneTimeResidential' as const,
        cadence: null,
        serviceDate: new Date('2026-09-22T00:00:00.000Z'),
        amountCents: 18500,
        status: 'pending' as const,
      },
    ],
    quoteRequests: [],
    builders: [],
    visits: [],
    recleans: [],
    fulfillments: [
      { bookingId: 'booking_1', amountCents: 16900, paymentIntentId: 'pi_1', paidAt: new Date() },
    ],
    ...overrides,
  };
}

describe('owner booking projection', () => {
  it('consolidates paid, pending, quote, builder, and re-clean records while deduplicating drafts', () => {
    const result = normalizeOwnerBookings(
      sources({
        quoteRequests: [
          {
            id: 'quote_1',
            fullName: 'Taylor Smith',
            email: 'taylor@example.com',
            phone: '806-555-0100',
            addressLine1: '200 Oak Avenue',
            addressLine2: null,
            city: 'Lubbock',
            state: 'TX',
            zip: '79410',
            bedrooms: 3,
            bathrooms: 2,
            serviceType: 'deepCleaning',
            cadence: null,
            serviceDate: new Date('2026-09-24T00:00:00.000Z'),
            scope: 'Heavy buildup in kitchen.',
            areaClassification: 'core',
            status: 'requested',
            createdAt: new Date('2026-09-11T12:00:00.000Z'),
          },
        ],
        builders: [
          {
            id: 'builder_1',
            companyName: 'Northline Development',
            projectContactName: 'Morgan Reed',
            projectContactEmail: 'morgan@example.com',
            projectContactPhone: '806-555-0101',
            projectAddressLine1: '300 Handover Road',
            projectAddressLine2: null,
            projectCity: 'Lubbock',
            projectState: 'TX',
            projectZip: '79401',
            targetHandoverDate: new Date('2026-10-01T00:00:00.000Z'),
            preferredFinalCleanDate: new Date('2026-09-29T00:00:00.000Z'),
            isRecurring: false,
            notes: 'Coordinate with superintendent.',
            budgetaryEstimateSnapshot: { projectRange: '$18,000–$22,000 total' },
            status: 'new',
            createdAt: new Date('2026-09-12T12:00:00.000Z'),
          },
        ],
        visits: [
          {
            id: 'visit_1',
            bookingId: 'booking_1',
            customerEmail: 'jordan@example.com',
            serviceDate: new Date('2026-09-08T00:00:00.000Z'),
            serviceType: 'Recurring clean',
            addressLine1: '100 Main Street',
            addressLine2: null,
            city: 'Lubbock',
            state: 'TX',
            zip: '79401',
          },
        ],
        recleans: [
          {
            id: 'reclean_1',
            visitId: 'visit_1',
            status: 'active',
            reason: 'Please revisit the bathroom floor.',
            createdAt: new Date('2026-09-09T12:00:00.000Z'),
          },
        ],
      }),
      new Date('2026-09-15T00:00:00.000Z'),
    );

    expect(result.items).toHaveLength(5);
    expect(result.items.map((item) => item.sourceKind)).toEqual([
      'booking',
      'payment_attempt',
      'quote_request',
      'builder_inquiry',
      'reclean_request',
    ]);
    expect(result.items.find((item) => item.sourceKind === 'reclean_request')?.status).toBe(
      'reclean_active',
    );
    expect(
      result.items.find((item) => item.sourceKind === 'builder_inquiry')?.secondaryDate,
    ).toEqual({
      label: 'Handover',
      date: '2026-10-01',
    });
  });

  it('applies upcoming/past, service, and status filters', () => {
    const result = normalizeOwnerBookings(
      sources({ query: { range: 'past', service: 'booking', status: 'paid' } }),
      new Date('2026-09-21T00:00:00.000Z'),
    );
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.sourceId).toBe('booking_1');
    expect(result.meta).toEqual({ total: 1, upcomingCount: 0, pastCount: 1 });
  });
});
