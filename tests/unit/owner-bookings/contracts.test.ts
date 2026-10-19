import { describe, expect, it } from 'vitest';
import {
  OwnerBookingRecord,
  OwnerBookingsQuery,
  OwnerBookingsResponse,
} from '@/lib/contracts/owner-bookings';

const record = {
  id: 'booking:booking_1',
  sourceId: 'booking_1',
  sourceKind: 'booking',
  customer: { name: 'Jordan Lee', email: 'jordan@example.com', phone: '806-555-0188' },
  serviceType: 'recurringResidential',
  serviceLabel: 'Recurring residential clean',
  address: {
    line1: '100 Main Street',
    line2: null,
    city: 'Lubbock',
    state: 'TX',
    zip: '79401',
  },
  serviceDate: '2026-09-20',
  secondaryDate: null,
  amountCents: 16900,
  amountLabel: '$169.00',
  status: 'active',
  statusLabel: 'Active',
  paymentStatus: 'paid',
  submissionDate: '2026-09-10T12:00:00.000Z',
  details: {
    organization: null,
    cadence: 'biweekly',
    area: 'core',
    recurring: true,
    bedrooms: 2,
    bathrooms: 2,
    sourceStatus: 'active',
    note: null,
  },
};

describe('owner bookings contract', () => {
  it('defaults missing query filters to upcoming/all/all', () => {
    expect(OwnerBookingsQuery.parse({})).toEqual({
      range: 'upcoming',
      service: 'all',
      status: 'all',
    });
  });

  it('rejects unsupported query values and accepts normalized source variants', () => {
    expect(OwnerBookingsQuery.safeParse({ range: 'tomorrow' }).success).toBe(false);
    expect(
      OwnerBookingRecord.safeParse({
        ...record,
        sourceKind: 'builder_inquiry',
        secondaryDate: { label: 'Handover', date: '2026-09-19' },
        amountCents: null,
        amountLabel: '$18,000–$22,000 total',
        status: 'builder_new',
        statusLabel: 'New request',
        paymentStatus: 'quote_required',
        details: { ...record.details, recurring: false, sourceStatus: 'new' },
      }).success,
    ).toBe(true);
  });

  it('validates the list wrapper and keeps empty results explicit', () => {
    expect(
      OwnerBookingsResponse.safeParse({
        items: [],
        meta: { total: 0, upcomingCount: 0, pastCount: 0 },
      }).success,
    ).toBe(true);
  });
});
