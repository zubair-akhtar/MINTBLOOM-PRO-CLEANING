// @polsia:user-owned — canonical public FAQ data endpoint.
import 'server-only';

import { NextResponse } from 'next/server';
import { FaqResponse } from '@/lib/contracts/faq';
import { faqContent } from '@/lib/faq/content';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(FaqResponse.parse({ items: faqContent.items }));
}
