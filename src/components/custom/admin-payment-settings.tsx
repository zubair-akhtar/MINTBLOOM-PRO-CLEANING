// @polsia:user-owned — admin PayPal / Venmo gateway settings.
'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api-client';
import {
  paymentSettingsAdminSchema,
  type SavePaymentSettingsInput,
} from '@/lib/contracts/payments';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

export function AdminPaymentSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState<'sandbox' | 'live'>('sandbox');
  const [paypalEnabled, setPaypalEnabled] = useState(false);
  const [venmoEnabled, setVenmoEnabled] = useState(false);
  const [paypalClientId, setPaypalClientId] = useState('');
  const [paypalClientSecret, setPaypalClientSecret] = useState('');
  const [secretSet, setSecretSet] = useState(false);
  const [paypalWebhookId, setPaypalWebhookId] = useState('');
  const [clearSecret, setClearSecret] = useState(false);

  useEffect(() => {
    apiFetch('/api/admin/payments/settings', { schema: paymentSettingsAdminSchema })
      .then((settings) => {
        setMode(settings.mode);
        setPaypalEnabled(settings.paypalEnabled);
        setVenmoEnabled(settings.venmoEnabled);
        setPaypalClientId(settings.paypalClientId);
        setSecretSet(settings.paypalClientSecretSet);
        setPaypalWebhookId(settings.paypalWebhookId);
      })
      .catch(() => toast.error('Could not load payment settings.'))
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    setSaving(true);
    try {
      const body: SavePaymentSettingsInput = {
        mode,
        paypalEnabled,
        venmoEnabled,
        paypalClientId,
        paypalWebhookId,
        clearSecret,
      };
      if (paypalClientSecret.trim()) body.paypalClientSecret = paypalClientSecret.trim();
      const settings = await apiFetch('/api/admin/payments/settings', {
        method: 'PUT',
        body: JSON.stringify(body),
        schema: paymentSettingsAdminSchema,
      });
      setSecretSet(settings.paypalClientSecretSet);
      setPaypalClientSecret('');
      setClearSecret(false);
      toast.success('Payment settings saved.');
    } catch {
      toast.error('Could not save payment settings.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-muted-foreground">Loading payment settings…</p>;

  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  return (
    <div className="grid max-w-2xl gap-6">
      <section className="grid gap-4 rounded-xl border border-border bg-card p-6">
        <div>
          <h2 className="text-lg font-semibold">PayPal Commerce</h2>
          <p className="text-sm text-muted-foreground">
            Online booking uses PayPal Checkout with optional Venmo. If both are inactive, customers
            only see quote requests.
          </p>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="mode">Mode</Label>
          <select
            id="mode"
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={mode}
            onChange={(event) => setMode(event.target.value as 'sandbox' | 'live')}
          >
            <option value="sandbox">Sandbox (testing payments)</option>
            <option value="live">Live</option>
          </select>
        </div>

        <div className="flex items-center justify-between gap-4 rounded-lg border border-border px-4 py-3">
          <div>
            <p className="font-medium">Enable PayPal</p>
            <p className="text-sm text-muted-foreground">Show PayPal button when credentials are set.</p>
          </div>
          <Switch checked={paypalEnabled} onCheckedChange={setPaypalEnabled} />
        </div>

        <div className="flex items-center justify-between gap-4 rounded-lg border border-border px-4 py-3">
          <div>
            <p className="font-medium">Enable Venmo</p>
            <p className="text-sm text-muted-foreground">
              Venmo appears through PayPal when available to the buyer.
            </p>
          </div>
          <Switch checked={venmoEnabled} onCheckedChange={setVenmoEnabled} />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="clientId">PayPal Client ID</Label>
          <Input
            id="clientId"
            value={paypalClientId}
            onChange={(event) => setPaypalClientId(event.target.value)}
            autoComplete="off"
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="clientSecret">
            PayPal Client Secret {secretSet ? '(saved — leave blank to keep)' : ''}
          </Label>
          <Input
            id="clientSecret"
            type="password"
            value={paypalClientSecret}
            onChange={(event) => setPaypalClientSecret(event.target.value)}
            autoComplete="new-password"
            placeholder={secretSet ? '••••••••' : ''}
          />
          {secretSet ? (
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={clearSecret}
                onChange={(event) => setClearSecret(event.target.checked)}
              />
              Clear saved secret
            </label>
          ) : null}
        </div>

        <div className="grid gap-2">
          <Label htmlFor="webhookId">PayPal Webhook ID</Label>
          <Input
            id="webhookId"
            value={paypalWebhookId}
            onChange={(event) => setPaypalWebhookId(event.target.value)}
            autoComplete="off"
          />
          <p className="text-xs text-muted-foreground">
            Webhook URL: <code>{origin}/api/payments/paypal/webhook</code>
          </p>
        </div>

        <Button onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save payment settings'}
        </Button>
      </section>
    </div>
  );
}
