// @polsia:user-owned — payment gateway settings (PayPal Commerce).
import 'server-only';

import { prisma } from '@/lib/db';
import type { SavePaymentSettingsInput } from '@/lib/contracts/payments';

export async function getPaymentGatewaySettings() {
  return prisma.paymentGatewaySettings.upsert({
    where: { id: 'default' },
    create: {
      id: 'default',
      mode: 'sandbox',
      paypalEnabled: false,
      venmoEnabled: false,
      paypalClientId: '',
      paypalClientSecret: '',
      paypalWebhookId: '',
    },
    update: {},
  });
}

export async function getPublicPaymentConfig() {
  const settings = await getPaymentGatewaySettings();
  const hasCredentials = Boolean(settings.paypalClientId && settings.paypalClientSecret);
  const paypalEnabled = settings.paypalEnabled && hasCredentials;
  const venmoEnabled = settings.venmoEnabled && hasCredentials;
  return {
    paypalEnabled,
    venmoEnabled,
    mode: settings.mode,
    paypalClientId: paypalEnabled || venmoEnabled ? settings.paypalClientId : '',
    onlinePaymentsAvailable: paypalEnabled || venmoEnabled,
  };
}

export function toAdminPaymentSettings(settings: Awaited<ReturnType<typeof getPaymentGatewaySettings>>) {
  return {
    mode: settings.mode,
    paypalEnabled: settings.paypalEnabled,
    venmoEnabled: settings.venmoEnabled,
    paypalClientId: settings.paypalClientId,
    paypalClientSecretSet: Boolean(settings.paypalClientSecret),
    paypalWebhookId: settings.paypalWebhookId,
    updatedAt: settings.updatedAt.toISOString(),
  };
}

export async function savePaymentGatewaySettings(
  input: SavePaymentSettingsInput,
  userId?: string,
) {
  const existing = await getPaymentGatewaySettings();
  let secret = existing.paypalClientSecret;
  if (input.clearSecret) secret = '';
  if (typeof input.paypalClientSecret === 'string' && input.paypalClientSecret.length > 0) {
    secret = input.paypalClientSecret;
  }

  return prisma.paymentGatewaySettings.update({
    where: { id: 'default' },
    data: {
      mode: input.mode,
      paypalEnabled: input.paypalEnabled,
      venmoEnabled: input.venmoEnabled,
      paypalClientId: input.paypalClientId,
      paypalClientSecret: secret,
      paypalWebhookId: input.paypalWebhookId ?? existing.paypalWebhookId,
      updatedByUserId: userId ?? null,
    },
  });
}
