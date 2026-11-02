// @polsia:user-owned — pricing startup seed must be insert-only.
// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => {
  const tx = {
    pricingRateCardVersion: { createMany: vi.fn().mockResolvedValue({ count: 0 }) },
    serviceMarket: { createMany: vi.fn().mockResolvedValue({ count: 0 }) },
    paymentGatewaySettings: { upsert: vi.fn().mockResolvedValue({ id: 'default' }) },
  };

  return {
    tx,
    prisma: {
      $transaction: vi.fn(
        async (callback: (transaction: typeof tx) => Promise<void>) => callback(tx),
      ),
    },
  };
});

vi.mock('@/lib/db', () => ({ prisma: db.prisma }));

import { seed } from '@/lib/seed';

describe('pricing startup seed', () => {
  beforeEach(() => {
    db.prisma.$transaction.mockClear();
    db.tx.pricingRateCardVersion.createMany.mockClear();
    db.tx.serviceMarket.createMany.mockClear();
    db.tx.paymentGatewaySettings.upsert.mockClear();
  });

  it('inserts only missing rate-card and market rows without updating existing records', async () => {
    await seed();

    expect(db.prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(db.tx.pricingRateCardVersion.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ version: 1 })],
      skipDuplicates: true,
    });
    expect(db.tx.serviceMarket.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({ city: 'Lubbock', state: 'TX' }),
        expect.objectContaining({ city: 'Plainview', state: 'TX' }),
      ]),
      skipDuplicates: true,
    });
    expect(db.tx.paymentGatewaySettings.upsert).toHaveBeenCalledWith({
      where: { id: 'default' },
      create: expect.objectContaining({
        id: 'default',
        paypalEnabled: false,
        venmoEnabled: false,
      }),
      update: {},
    });
  });
});
