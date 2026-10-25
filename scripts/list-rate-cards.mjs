import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const rows = await prisma.pricingRateCard.findMany({ orderBy: { version: 'desc' }, take: 8 });
for (const x of rows) {
  const s = x.settings?.services?.standard;
  console.log(
    `v${x.version} active=${x.isActive} label=${x.label} base=${s?.baseCents} min=${s?.minimumCents} area=${s?.areaRateCentsPerSqFt}`,
  );
}
await prisma.$disconnect();
