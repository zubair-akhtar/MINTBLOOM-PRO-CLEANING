const BASE = (process.env.VERIFY_URL || 'http://localhost:3000').replace(/\/$/, '');
const defaults = {
  service: 'standard',
  squareFeet: 500,
  bedrooms: 0,
  fullBaths: 1,
  halfBaths: 0,
  kitchens: 1,
  offices: 0,
  extraRooms: 0,
  condition: 'routine',
  highWork: false,
  heavyConditionApproved: false,
  cadence: null,
  returningRecurring: false,
  ovenCavities: 0,
  refrigeratorCount: 0,
  cabinetDoors: 0,
  baseboards: false,
  windowPanes: 0,
  windowTracks: 0,
  blinds: 0,
  linenBeds: 0,
  laundryLoads: 0,
  dishBlocks: 0,
  garageBays: 0,
  petHair: false,
  rush: false,
  travelMiles: 0,
  city: 'Lubbock',
  state: 'TX',
};

async function estimate(overrides) {
  const response = await fetch(`${BASE}/api/pricing/estimate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: BASE },
    body: JSON.stringify({ ...defaults, ...overrides }),
  });
  if (!response.ok) {
    throw new Error(`POST /api/pricing/estimate returned ${response.status}: ${await response.text()}`);
  }
  if (!response.headers.get('Cache-Control')?.includes('no-store')) {
    throw new Error('POST /api/pricing/estimate did not return Cache-Control: no-store.');
  }
  return response.json();
}

const checks = [];
function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${expected}, received ${actual}`);
  }
  checks.push(label);
}

async function main() {
  const studio = await estimate({ fullBaths: 0 });
  assertEqual(studio.status, 'priced', '500 sq ft studio Standard status');
  assertEqual(studio.coreCents, 14500, '500 sq ft studio Standard core cents');

  const sixHundredOne = await estimate({ squareFeet: 601, fullBaths: 0 });
  assertEqual(sixHundredOne.coreCents, 14508, '601 sq ft studio Standard core cents');

  const twoBedTwoBath = await estimate({ squareFeet: 1200, bedrooms: 2, fullBaths: 2 });
  assertEqual(twoBedTwoBath.coreCents, 26800, '1200 sq ft 2-bedroom/2-bath Standard core cents');

  const addOns = await estimate({
    squareFeet: 1200,
    bedrooms: 2,
    fullBaths: 2,
    ovenCavities: 1,
    refrigeratorCount: 1,
  });
  assertEqual(addOns.subtotalCents, 37300, '1200 sq ft Standard plus oven and refrigerator subtotal cents');

  const moveIncluded = await estimate({ service: 'move', ovenCavities: 1, refrigeratorCount: 1 });
  assertEqual(moveIncluded.addOnsCents, 0, 'Move with one oven and one refrigerator add-on cents');
  assertEqual(
    moveIncluded.lines.find((line) => line.id === 'oven-included')?.amountCents,
    0,
    'Move included oven line cents',
  );
  assertEqual(
    moveIncluded.lines.find((line) => line.id === 'refrigerator')?.amountCents,
    0,
    'Move included refrigerator line cents',
  );

  const moveSecondOven = await estimate({ service: 'move', ovenCavities: 2, refrigeratorCount: 1 });
  assertEqual(moveSecondOven.addOnsCents, 6000, 'Move second oven add-on cents');
  assertEqual(
    moveSecondOven.lines.find((line) => line.id === 'oven-extra')?.label,
    'Oven interior (extra)',
    'Move one extra oven label',
  );

  const moveExtras = await estimate({ service: 'move', ovenCavities: 3, refrigeratorCount: 3 });
  assertEqual(moveExtras.addOnsCents, 21000, 'Move two extra ovens and two extra refrigerators add-on cents');
  assertEqual(
    moveExtras.lines.find((line) => line.id === 'oven-extra')?.label,
    'Oven interior (extra) ×2',
    'Move multiple extra oven label',
  );
  assertEqual(
    moveExtras.lines.find((line) => line.id === 'refrigerator-extra')?.label,
    'Refrigerator interior (extra) ×2',
    'Move multiple extra refrigerator label',
  );

  for (const [squareFeet, expectedCents] of [[1000, 4000], [1001, 8000]]) {
    const baseboards = await estimate({ squareFeet, fullBaths: 0, baseboards: true });
    assertEqual(
      baseboards.lines.find((line) => line.id === 'baseboards')?.amountCents,
      expectedCents,
      `Baseboards at ${squareFeet} sq ft cents`,
    );
  }

  for (const service of ['commercial', 'postConstruction']) {
    const quote = await estimate({ service, squareFeet: 1 });
    assertEqual(quote.status, 'quote_required', `${service} quote gate`);
    assertEqual(quote.totalCents, null, `${service} quote-only total`);
  }

  for (const label of checks) console.log(`PASS | ${label}`);
  console.log(`Pricing verification passed (${checks.length} checks) at ${BASE}`);
}

main().catch((error) => {
  console.error(`FAIL | ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
