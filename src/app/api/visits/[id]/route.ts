// @polsia:user-owned — protected visit completion report projection.
import 'server-only';

import { NextResponse } from 'next/server';
import { findAuthorizedVisit, visitReportProjection } from '@/lib/business/visits';
import { VisitReportResponse } from '@/lib/contracts/visits';
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

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const authenticated = await authenticatedUser(request);
  if (authenticated instanceof Response) return authenticated;

  const { id } = await context.params;
  try {
    const authorizedVisit = await findAuthorizedVisit(id, authenticated);
    if (!authorizedVisit) {
      return NextResponse.json({ error: 'Visit not found' }, { status: 404 });
    }
    return NextResponse.json(
      VisitReportResponse.parse({ visit: visitReportProjection(authorizedVisit) }),
    );
  } catch {
    return NextResponse.json({ error: 'Could not load visit report' }, { status: 500 });
  }
}
