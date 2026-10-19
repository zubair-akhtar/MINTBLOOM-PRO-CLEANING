// @polsia:user-owned — server-priced builder budgetary estimate endpoint.
import 'server-only';

import { NextResponse } from 'next/server';
import { calculateBuilderEstimate } from '@/lib/business/builder-inquiries';
import { BuilderEstimateRequest, BuilderEstimateResponse } from '@/lib/contracts/builder-inquiries';

export const dynamic = 'force-dynamic';

function fieldErrors(error: {
  flatten: () => { fieldErrors: Record<string, string[] | undefined> };
}) {
  const errors: Record<string, string> = {};
  for (const [field, messages] of Object.entries(error.flatten().fieldErrors)) {
    if (messages?.[0]) errors[field] = messages[0];
  }
  return errors;
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = BuilderEstimateRequest.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ errors: fieldErrors(parsed.error) }, { status: 400 });
  }
  try {
    return NextResponse.json(BuilderEstimateResponse.parse(calculateBuilderEstimate(parsed.data)));
  } catch {
    return NextResponse.json({ error: 'estimate_failed' }, { status: 500 });
  }
}
