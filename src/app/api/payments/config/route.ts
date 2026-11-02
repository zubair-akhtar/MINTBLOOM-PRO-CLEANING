// @polsia:user-owned — public PayPal payment availability (no secrets).
import { NextResponse } from 'next/server';
import { getPublicPaymentConfig } from '@/lib/business/payments/settings';
import { publicPaymentConfigSchema } from '@/lib/contracts/payments';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const config = publicPaymentConfigSchema.parse(await getPublicPaymentConfig());
    return NextResponse.json(config, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json(
      {
        paypalEnabled: false,
        venmoEnabled: false,
        mode: 'sandbox',
        paypalClientId: '',
        onlinePaymentsAvailable: false,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
