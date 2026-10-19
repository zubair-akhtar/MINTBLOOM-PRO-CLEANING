// @polsia:user-owned — authenticated visit summary list for the manage portal.
import 'server-only';

import { NextResponse } from 'next/server';
import { findAuthorizedVisitSummaries } from '@/lib/business/visits';
import { VisitSummaryList } from '@/lib/contracts/visits';
import { requireAuth, type SessionUser } from '@/lib/require-auth';

export const dynamic = 'force-dynamic';

async function authenticatedUser(request: Request): Promise<SessionUser | Response> {
  try {
    const user = await requireAuth(request);
    if (!user.emailVerified) {
      return NextResponse.json({ error: 'Email verification required' }, { status: 403 });
    }
    return user;
  } catch (response) {
    return response as Response;
  }
}

export async function GET(request: Request) {
  const authenticated = await authenticatedUser(request);
  if (authenticated instanceof Response) return authenticated;

  try {
    const payload = VisitSummaryList.parse({
      visits: await findAuthorizedVisitSummaries(authenticated),
    });
    return NextResponse.json(payload);
  } catch {
    return NextResponse.json({ error: 'Could not load visit reports' }, { status: 500 });
  }
}
