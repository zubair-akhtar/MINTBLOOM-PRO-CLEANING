// @polsia:user-owned — builder/developer inquiry persistence endpoint.
import 'server-only';

import { NextResponse } from 'next/server';
import { createBuilderInquiry } from '@/lib/business/builder-inquiries';
import {
  BuilderInquiryResponse,
  BuilderInquirySubmission,
} from '@/lib/contracts/builder-inquiries';

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
  const parsed = BuilderInquirySubmission.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ errors: fieldErrors(parsed.error) }, { status: 400 });
  }
  try {
    return NextResponse.json(
      BuilderInquiryResponse.parse(await createBuilderInquiry(parsed.data)),
      { status: 201 },
    );
  } catch {
    return NextResponse.json({ error: 'builder_inquiry_failed' }, { status: 500 });
  }
}
