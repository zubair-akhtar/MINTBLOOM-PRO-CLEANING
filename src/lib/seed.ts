// @polsia:user-owned — deploy-time database seed. You OWN this file.
//
// seed() runs once when the server boots (via the framework-owned
// src/instrumentation.ts), on the Node server, AFTER the schema is applied. Use it
// for reference/lookup data your app needs to exist BEFORE the first request:
// plans, categories, feature defaults, a first admin row, etc. Read/write the DB
// through the Prisma singleton in @/lib/db (server startup — there is no request,
// so this does NOT go through /api).
//
// RULES — this runs on EVERY deploy/boot, possibly more than once, possibly on more
// than one instance at the same time:
//   1. Make every write IDEMPOTENT — upsert (`where` + `create` + `update`) or
//      `createMany({ ..., skipDuplicates: true })`, NEVER a bare `create`/`insert`.
//   2. Keep it fast and small — it runs before the server serves traffic.
//   3. NOT for recurring work (that's polsia.toml `[[crons]]`) or per-user/
//      request-time logic (that's an /api route handler). There is no request here.
//
// The template ships an empty seed (a no-op). Fill in the body when your app needs
// it; leave it empty to keep seeding off. Don't delete the file — instrumentation.ts
// imports it.
export async function seed(): Promise<void> {
  const { prisma } = await import('@/lib/db');
  const { DEFAULT_PRICING_SETTINGS, LAUNCH_PRICING_LABEL } = await import(
    '@/lib/business/pricing/defaults'
  );

  /** Launch markets with automated residential pricing + Lubbock-area tax default. */
  const launchPricingCities = new Set(['Lubbock', 'New Deal', 'Wolfforth', 'Plainview']);
  const markets = [
    { name: 'Lubbock', city: 'Lubbock', state: 'TX' },
    { name: 'New Deal', city: 'New Deal', state: 'TX' },
    { name: 'Wolfforth', city: 'Wolfforth', state: 'TX' },
    { name: 'Plainview', city: 'Plainview', state: 'TX' },
    { name: 'Houston', city: 'Houston', state: 'TX' },
    { name: 'Dallas', city: 'Dallas', state: 'TX' },
    { name: 'Austin', city: 'Austin', state: 'TX' },
  ];

  await prisma.$transaction(async (tx) => {
    const legacyMarket = await tx.serviceMarket.findUnique({
      where: { city_state: { city: 'Plains', state: 'TX' } },
    });
    const existingPlainviewMarket = await tx.serviceMarket.findUnique({
      where: { city_state: { city: 'Plainview', state: 'TX' } },
    });

    let plainviewMarketId: string;
    if (legacyMarket && existingPlainviewMarket) {
      await tx.jobOpening.updateMany({
        where: { marketId: legacyMarket.id },
        data: { marketId: existingPlainviewMarket.id, city: 'Plainview', state: 'TX' },
      });
      await tx.jobApplication.updateMany({
        where: { marketId: legacyMarket.id },
        data: { marketId: existingPlainviewMarket.id },
      });
      await tx.serviceMarket.update({
        where: { id: legacyMarket.id },
        data: { isActive: false },
      });
      plainviewMarketId = existingPlainviewMarket.id;
    } else if (legacyMarket) {
      // Preserve the legacy market ID and its relations when no duplicate exists.
      plainviewMarketId = legacyMarket.id;
    } else {
      const plainviewMarket = await tx.serviceMarket.upsert({
        where: { city_state: { city: 'Plainview', state: 'TX' } },
        create: { name: 'Plainview', city: 'Plainview', state: 'TX' },
        update: { name: 'Plainview', isActive: true },
      });
      plainviewMarketId = plainviewMarket.id;
    }

    await tx.serviceMarket.update({
      where: { id: plainviewMarketId },
      data: {
        name: 'Plainview',
        city: 'Plainview',
        state: 'TX',
        isActive: true,
        pricingEnabled: true,
        combinedTaxRateBps: 825,
      },
    });
    await tx.jobOpening.updateMany({
      where: { marketId: plainviewMarketId },
      data: { city: 'Plainview', state: 'TX' },
    });

    for (const market of markets) {
      if (market.city === 'Plainview' && market.state === 'TX') continue;
      const pricingEnabled = launchPricingCities.has(market.city);
      await tx.serviceMarket.upsert({
        where: { city_state: { city: market.city, state: market.state } },
        create: {
          ...market,
          pricingEnabled,
          combinedTaxRateBps: pricingEnabled ? 825 : null,
        },
        update: {
          name: market.name,
          isActive: true,
          pricingEnabled,
          combinedTaxRateBps: pricingEnabled ? 825 : null,
        },
      });
    }

    const activeCard = await tx.pricingRateCard.findFirst({ where: { isActive: true } });
    if (!activeCard) {
      await tx.pricingRateCard.create({
        data: {
          version: 1,
          label: LAUNCH_PRICING_LABEL,
          isActive: true,
          settings: DEFAULT_PRICING_SETTINGS as object,
        },
      });
    }
  });
}
