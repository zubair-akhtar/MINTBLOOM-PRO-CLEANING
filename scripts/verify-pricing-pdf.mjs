/**
 * Verify calculateEstimate against Mintbloom Pricing Calculator Spec v3 samples.
 * Run: node scripts/verify-pricing-pdf.mjs
 */
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

// Inline minimal engine copy so we don't depend on TS path aliases.
// Keep in sync with src/lib/business/pricing/* — this script calls the API when
// AVAILABLE, otherwise duplicates formula checks via HTTP localhost.

const BASE = process.env.VERIFY_URL || 'http://localhost:3000';

async function estimate(body) {
  const res = await fetch(`${BASE}/api/pricing/estimate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      city: 'Lubbock',
      state: 'TX',
      zip: '79401',
      squareFeet: 600,
      bedrooms: 0,
      fullBaths: 1,
      halfBaths: 0,
      offices: 0,
      extraLivingRooms: 0,
      kitchens: 1,
      cadence: 'one_time',
      isFirstRecurringVisit: true,
      addOnQuantities: {},
      heavyConditionApproved: false,
      petHairNeeded: false,
      rushRequested: false,
      travelMiles: null,
      highWorkRequested: false,
      severeOrUnknownCondition: false,
      service: 'standard',
      ...body,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  return res.json();
}

function money(cents) {
  return (cents / 100).toFixed(2);
}

let fails = 0;
function assert(ok, name, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'} | ${name}${detail ? ' — ' + detail : ''}`);
  if (!ok) fails++;
}

async function main() {
  console.log(`Verifying against ${BASE}\n`);

  const table = [
    ['Studio 0 bath 500', { bedrooms: 0, fullBaths: 0, halfBaths: 0, squareFeet: 500 }, { standard: 14500, deep: 32500, move: 39500, airbnb: 21000 }],
    ['Studio 1 bath 500', { bedrooms: 0, fullBaths: 1, halfBaths: 0, squareFeet: 500 }, { standard: 14500, deep: 32500, move: 39500, airbnb: 21000 }],
    ['1b1ba 800', { bedrooms: 1, fullBaths: 1, halfBaths: 0, squareFeet: 800 }, { standard: 18100, deep: 40100, move: 48500, airbnb: 26400 }],
    ['1b2ba 800', { bedrooms: 1, fullBaths: 2, halfBaths: 0, squareFeet: 800 }, { standard: 21600, deep: 46600, move: 56000, airbnb: 30900 }],
    ['2b1ba 1200', { bedrooms: 2, fullBaths: 1, halfBaths: 0, squareFeet: 1200 }, { standard: 23300, deep: 51300, move: 61500, airbnb: 34200 }],
    ['2b2ba 1200', { bedrooms: 2, fullBaths: 2, halfBaths: 0, squareFeet: 1200 }, { standard: 26800, deep: 57800, move: 69000, airbnb: 38700 }],
    ['3b2ba 1600', { bedrooms: 3, fullBaths: 2, halfBaths: 0, squareFeet: 1600 }, { standard: 32000, deep: 69000, move: 82000, airbnb: 46500 }],
    ['4b3ba 2500', { bedrooms: 4, fullBaths: 3, halfBaths: 0, squareFeet: 2500 }, { standard: 44700, deep: 95700, move: 112500, airbnb: 64800 }],
  ];

  for (const [name, home, expect] of table) {
    for (const service of ['standard', 'deep', 'move', 'airbnb']) {
      const r = await estimate({ ...home, service });
      assert(
        r.status === 'priced' && r.coreCents === expect[service],
        `${name} ${service}`,
        `core $${money(r.coreCents)} expect $${money(expect[service])}`,
      );
    }
  }

  const sizeAreas = [600, 1000, 1500, 2000, 2500, 3500];
  const sizeExpect = {
    standard: [0, 3200, 7200, 11200, 15200, 23200],
    deep: [0, 7200, 16200, 25200, 34200, 52200],
    move: [0, 8000, 18000, 28000, 38000, 58000],
    airbnb: [0, 4800, 10800, 16800, 22800, 34800],
  };
  for (let i = 0; i < sizeAreas.length; i++) {
    for (const service of ['standard', 'deep', 'move', 'airbnb']) {
      const r = await estimate({ service, squareFeet: sizeAreas[i], bedrooms: 0, fullBaths: 1, halfBaths: 0 });
      const got = r.lines?.find((l) => l.id === 'size')?.amountCents ?? 0;
      assert(got === sizeExpect[service][i], `size ${sizeAreas[i]} ${service}`, `$${money(got)} expect $${money(sizeExpect[service][i])}`);
    }
  }

  for (const [service, exp] of [
    ['standard', 5250],
    ['deep', 9750],
    ['move', 11250],
    ['airbnb', 6750],
  ]) {
    const r = await estimate({ service, squareFeet: 600, bedrooms: 0, fullBaths: 2, halfBaths: 1 });
    const bath = r.lines?.find((l) => l.id === 'baths')?.amountCents ?? 0;
    assert(bath === exp, `bath 2f+1h ${service}`, `$${money(bath)} expect $${money(exp)}`);
  }

  const worked = [
    ['Studio Standard 500', { service: 'standard', squareFeet: 500, bedrooms: 0, fullBaths: 1 }, 14500, 1196, 15696],
    ['2b2ba Standard 1200', { service: 'standard', squareFeet: 1200, bedrooms: 2, fullBaths: 2 }, 26800, 2211, 29011],
    [
      '2b2ba + oven fridge',
      { service: 'standard', squareFeet: 1200, bedrooms: 2, fullBaths: 2, addOnQuantities: { oven: 1, fridge: 1 } },
      37300,
      3077,
      40377,
    ],
    [
      '2b2ba weekly eligible',
      {
        service: 'standard',
        squareFeet: 1200,
        bedrooms: 2,
        fullBaths: 2,
        cadence: 'weekly',
        isFirstRecurringVisit: false,
      },
      24120,
      1990,
      26110,
    ],
    [
      '1b 1.5ba Deep 800',
      { service: 'deep', squareFeet: 800, bedrooms: 1, fullBaths: 1, halfBaths: 1 },
      43350,
      3576,
      46926,
    ],
    [
      'Airbnb 2b2ba + 3 beds + laundry',
      {
        service: 'airbnb',
        squareFeet: 1200,
        bedrooms: 2,
        fullBaths: 2,
        addOnQuantities: { linenChanges: 3, laundry: 1 },
      },
      43700,
      3605,
      47305,
    ],
  ];

  for (const [name, body, sub, tax, total] of worked) {
    const r = await estimate(body);
    assert(
      r.status === 'priced' && r.subtotalCents === sub && r.taxCents === tax && r.totalCents === total,
      name,
      `sub $${money(r.subtotalCents)} tax $${money(r.taxCents)} total $${money(r.totalCents)}`,
    );
  }

  // Acceptance checks
  const a601 = await estimate({ service: 'standard', squareFeet: 601, bedrooms: 0, fullBaths: 0, halfBaths: 0 });
  assert(a601.coreCents === 14508, '601 sqft studio = $145.08', `$${money(a601.coreCents)}`);

  const a1000 = await estimate({ service: 'standard', squareFeet: 1000, bedrooms: 1, fullBaths: 1 });
  assert(a1000.coreCents === 19700, '1000 1bed/1bath = $197', `$${money(a1000.coreCents)}`);

  const a1000b = await estimate({ service: 'standard', squareFeet: 1000, bedrooms: 3, fullBaths: 2 });
  assert(a1000b.coreCents === 27200, '1000 3bed/2bath = $272', `$${money(a1000b.coreCents)}`);

  const weeklyStudio = await estimate({
    service: 'standard',
    squareFeet: 500,
    bedrooms: 0,
    fullBaths: 1,
    cadence: 'weekly',
    isFirstRecurringVisit: false,
  });
  assert(
    weeklyStudio.discountCents === 1450 &&
      weeklyStudio.minimumAdjustmentCents === 1450 &&
      weeklyStudio.subtotalCents === 14500,
    'weekly $145 studio floors at minimum',
    `d=${weeklyStudio.discountCents} adj=${weeklyStudio.minimumAdjustmentCents} sub=${weeklyStudio.subtotalCents}`,
  );

  const bb1000 = await estimate({
    service: 'standard',
    squareFeet: 1000,
    bedrooms: 1,
    fullBaths: 1,
    addOnQuantities: { baseboards: 1 },
  });
  assert(bb1000.lines?.find((l) => l.id === 'baseboards')?.amountCents === 4000, 'baseboards 1000 = $40');

  const bb1001 = await estimate({
    service: 'standard',
    squareFeet: 1001,
    bedrooms: 1,
    fullBaths: 1,
    addOnQuantities: { baseboards: 1 },
  });
  assert(bb1001.lines?.find((l) => l.id === 'baseboards')?.amountCents === 8000, 'baseboards 1001 = $80');

  const moveInc = await estimate({
    service: 'move',
    squareFeet: 1000,
    bedrooms: 2,
    fullBaths: 1,
    addOnQuantities: { oven: 1, fridge: 1 },
  });
  const oven0 = moveInc.lines?.filter((l) => l.id.startsWith('oven')).reduce((a, l) => a + l.amountCents, 0) ?? -1;
  const fridge0 = moveInc.lines?.filter((l) => l.id.startsWith('fridge')).reduce((a, l) => a + l.amountCents, 0) ?? -1;
  assert(oven0 === 0 && fridge0 === 0, 'Move includes 1 oven + 1 fridge at $0');

  const move2 = await estimate({
    service: 'move',
    squareFeet: 1000,
    bedrooms: 2,
    fullBaths: 1,
    addOnQuantities: { oven: 2, fridge: 1 },
  });
  assert(move2.lines?.find((l) => l.id === 'oven')?.amountCents === 6000, 'Move second oven = $60');

  const deepBb = await estimate({ service: 'deep', squareFeet: 1200, bedrooms: 2, fullBaths: 2 });
  assert(deepBb.lines?.some((l) => l.id === 'baseboards-included'), 'Deep baseboards Included');

  const fivePlus = await estimate({ service: 'standard', squareFeet: 1200, bedrooms: '5plus', fullBaths: 2 });
  assert(fivePlus.status === 'quote_required', '5+ bedrooms → quote');

  const commercial = await estimate({ service: 'commercial', squareFeet: 4000, bedrooms: 0, fullBaths: 0 });
  assert(
    commercial.status === 'quote_required' && commercial.commercialReferenceCents === 112000,
    'Commercial 4000 sqft reference $1120',
    `ref=${commercial.commercialReferenceCents}`,
  );

  console.log(`\n${fails === 0 ? 'ALL PDF CHECKS PASSED' : `FAILED: ${fails}`}`);
  process.exit(fails === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
