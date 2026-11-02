import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Kept in sync with src/lib/business/pricing/defaults.ts. createMany with
// skipDuplicates makes this an insert-only initializer: operator values survive.
const defaultSettings = {
  services: {
    standard: { baseCents: 14500, minimumCents: 14500 },
    deep: { baseCents: 32500, minimumCents: 32500 },
    move: { baseCents: 39500, minimumCents: 39500 },
    airbnb: { baseCents: 21000, minimumCents: 21000 },
  },
  includedSqFt: 600,
  maxAutoSqFt: 3500,
  commercialReferenceCentsPerSqFt: 28,
  areaCentsPerSqFt: { standard: 8, deep: 18, move: 20, airbnb: 12 },
  bedroomCents: { standard: 2000, deep: 4000, move: 5000, airbnb: 3000 },
  bathEquivalentCents: { standard: 3500, deep: 6500, move: 7500, airbnb: 4500 },
  officeCents: { standard: 2000, deep: 3500, move: 4000, airbnb: 2500 },
  extraRoomCents: { standard: 3500, deep: 5500, move: 6500, airbnb: 4000 },
  addOns: {
    ovenCents: 6000,
    refrigeratorCents: 4500,
    cabinetBaseCents: 6000,
    cabinetIncludedDoors: 20,
    cabinetExtraDoorCents: 300,
    windowPaneCents: 800,
    windowMinimumCents: 4000,
    windowTrackCents: 500,
    blindCents: 800,
    baseboardsPerStarted1000Cents: 4000,
    linenCents: 1200,
    airbnbIncludedLinenBeds: 2,
    airbnbExtraLinenCents: 2000,
    laundryPerLoadCents: 3000,
    dishesPerBlockCents: 2500,
    garageBayCents: 4000,
    petHairCents: 3500,
    rushCents: 5000,
    heavyConditionBasisPoints: 2500,
  },
  recurringDiscountBasisPoints: { weekly: 1000, biweekly: 700, monthly: 500 },
  markets: [
    { id: 'lubbock-tx', label: 'Lubbock, TX', city: 'Lubbock', state: 'TX', taxBasisPoints: 825, pricingEnabled: true, isActive: true },
    { id: 'new-deal-tx', label: 'New Deal, TX', city: 'New Deal', state: 'TX', taxBasisPoints: 825, pricingEnabled: true, isActive: true },
    { id: 'wolfforth-tx', label: 'Wolfforth, TX', city: 'Wolfforth', state: 'TX', taxBasisPoints: 825, pricingEnabled: true, isActive: true },
    { id: 'plainview-tx', label: 'Plainview, TX', city: 'Plainview', state: 'TX', taxBasisPoints: 825, pricingEnabled: true, isActive: true },
    { id: 'houston-tx', label: 'Houston, TX', city: 'Houston', state: 'TX', taxBasisPoints: null, pricingEnabled: false, isActive: true },
    { id: 'dallas-tx', label: 'Dallas, TX', city: 'Dallas', state: 'TX', taxBasisPoints: null, pricingEnabled: false, isActive: true },
    { id: 'austin-tx', label: 'Austin, TX', city: 'Austin', state: 'TX', taxBasisPoints: null, pricingEnabled: false, isActive: true },
  ],
};

const serviceMarkets = [
  { name: 'Lubbock', city: 'Lubbock', state: 'TX' },
  { name: 'New Deal', city: 'New Deal', state: 'TX' },
  { name: 'Wolfforth', city: 'Wolfforth', state: 'TX' },
  { name: 'Plainview', city: 'Plainview', state: 'TX' },
  { name: 'Houston', city: 'Houston', state: 'TX' },
  { name: 'Dallas', city: 'Dallas', state: 'TX' },
  { name: 'Austin', city: 'Austin', state: 'TX' },
];

async function main() {
  await prisma.$transaction(async (transaction) => {
    await transaction.serviceMarket.createMany({ data: serviceMarkets, skipDuplicates: true });
    await transaction.pricingRateCardVersion.createMany({
      data: [{ version: 1, settings: defaultSettings }],
      skipDuplicates: true,
    });
  });

  const [marketCount, versions, active] = await Promise.all([
    prisma.serviceMarket.count(),
    prisma.pricingRateCardVersion.count(),
    prisma.pricingRateCardVersion.findFirst({ orderBy: { version: 'desc' } }),
  ]);
  if (!active) throw new Error('No pricing rate card is available after initialization.');

  const activeSettings = active.settings;
  const taxMarkets =
    typeof activeSettings === 'object' && activeSettings !== null && 'markets' in activeSettings
      ? activeSettings.markets
      : [];
  console.log(
    JSON.stringify({
      status: 'initialized',
      serviceMarkets: marketCount,
      pricingRateCardVersions: versions,
      activeVersion: active.version,
      taxMarketDefaults: Array.isArray(taxMarkets) ? taxMarkets.length : 0,
    }),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
