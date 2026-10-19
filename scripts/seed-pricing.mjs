import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEFAULT_PRICING_SETTINGS = {
  schemaVersion: 1,
  includedSqFt: 600,
  maxAutoSqFt: 3500,
  maxAutoBathEquivalents: 4,
  maxAutoBedrooms: 4,
  commercialPerSqFtCents: 28,
  services: {
    standard: {
      baseCents: 14500,
      minimumCents: 14500,
      areaRateCentsPerSqFt: 8,
      bedroomCents: 2000,
      bathCents: 3500,
      officeCents: 2000,
      extraLivingCents: 3500,
    },
    deep: {
      baseCents: 32500,
      minimumCents: 32500,
      areaRateCentsPerSqFt: 18,
      bedroomCents: 4000,
      bathCents: 6500,
      officeCents: 3500,
      extraLivingCents: 5500,
    },
    move: {
      baseCents: 39500,
      minimumCents: 39500,
      areaRateCentsPerSqFt: 20,
      bedroomCents: 5000,
      bathCents: 7500,
      officeCents: 4000,
      extraLivingCents: 6500,
    },
    airbnb: {
      baseCents: 21000,
      minimumCents: 21000,
      areaRateCentsPerSqFt: 12,
      bedroomCents: 3000,
      bathCents: 4500,
      officeCents: 2500,
      extraLivingCents: 4000,
    },
  },
  recurringDiscounts: { weekly: 0.1, biweekly: 0.07, monthly: 0.05 },
  heavyConditionPercentOfCore: 0.25,
  petHairCents: 3500,
  rushFeeCents: 5000,
  travelBands: [
    { maxMilesInclusive: 20, feeCents: 0 },
    { maxMilesInclusive: 35, feeCents: 3000 },
    { maxMilesInclusive: 50, feeCents: 6000 },
    { maxMilesInclusive: null, feeCents: 0, quoteRequired: true },
  ],
  addOns: [
    { id: 'oven', label: 'Oven interior', unitCents: 6000, includedInMove: true },
    { id: 'fridge', label: 'Refrigerator / freezer interior', unitCents: 4500, includedInMove: true },
  ],
  baseboardsPerStartedThousandCents: 4000,
  cabinetInteriorBaseCents: 6000,
  cabinetInteriorIncludedDoors: 20,
  cabinetInteriorExtraDoorCents: 300,
  linenChangeCents: 1200,
  airbnbIncludedBedChanges: 2,
  airbnbExtraBedChangeCents: 2000,
  laundryLoadCents: 3000,
  maxAutoLaundryLoads: 2,
  dishesBlockCents: 2500,
  maxAutoDishBlocks: 2,
  garageBayCents: 4000,
  windowPaneCents: 800,
  windowTracksCents: 500,
  blindCents: 800,
};

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

async function main() {
  for (const market of markets) {
    const pricingEnabled = launchPricingCities.has(market.city);
    await prisma.serviceMarket.upsert({
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

  const active = await prisma.pricingRateCard.findFirst({ where: { isActive: true } });
  if (!active) {
    await prisma.pricingRateCard.create({
      data: {
        version: 1,
        label: 'Mintbloom v3 launch',
        isActive: true,
        settings: DEFAULT_PRICING_SETTINGS,
      },
    });
  }

  const count = await prisma.serviceMarket.count();
  const card = await prisma.pricingRateCard.findFirst({ where: { isActive: true } });
  console.log(`Pricing seed OK — markets=${count} rateCard=v${card?.version ?? 'none'}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
