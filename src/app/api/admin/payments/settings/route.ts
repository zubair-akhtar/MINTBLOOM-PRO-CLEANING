// @polsia:user-owned — admin payment gateway settings.
import { NextResponse } from 'next/server';
import { noStore, requireAdminUser } from '@/lib/business/payments/admin-auth';
import {
  getPaymentGatewaySettings,
  savePaymentGatewaySettings,
  toAdminPaymentSettings,
} from '@/lib/business/payments/settings';
import { paymentSettingsAdminSchema, savePaymentSettingsSchema } from '@/lib/contracts/payments';
import { sameOrigin } from '@/lib/same-origin';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const user = await requireAdminUser(request);
  if (user instanceof NextResponse) return user;
  const settings = paymentSettingsAdminSchema.parse(
    toAdminPaymentSettings(await getPaymentGatewaySettings()),
  );
  return NextResponse.json(settings, { headers: noStore });
}

export async function PUT(request: Request) {
  if (!sameOrigin(request))
    return NextResponse.json({ error: 'forbidden_origin' }, { status: 403, headers: noStore });
  const user = await requireAdminUser(request);
  if (user instanceof NextResponse) return user;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400, headers: noStore });
  }
  const parsed = savePaymentSettingsSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ errors: parsed.error.flatten() }, { status: 400, headers: noStore });

  const saved = await savePaymentGatewaySettings(parsed.data, user.id);
  return NextResponse.json(
    paymentSettingsAdminSchema.parse(toAdminPaymentSettings(saved)),
    { headers: noStore },
  );
}
