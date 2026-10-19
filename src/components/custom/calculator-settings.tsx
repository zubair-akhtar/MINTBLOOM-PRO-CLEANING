// @polsia:user-owned — admin UI for v3 calculator rates and market tax.
'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiFetch } from '@/lib/api-client';
import {
  AdminPricingSettingsResponse,
  type AdminPricingSettingsResponse as SettingsPayload,
} from '@/lib/contracts/pricing';

type ServiceKey = 'standard' | 'deep' | 'move' | 'airbnb';

function dollarsFromCents(cents: unknown): string {
  const n = typeof cents === 'number' ? cents : 0;
  return (n / 100).toFixed(2);
}

function centsFromDollars(value: string): number {
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

export function CalculatorSettings() {
  const [data, setData] = useState<SettingsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch('/api/admin/pricing-settings', { schema: AdminPricingSettingsResponse })
      .then(setData)
      .catch(() => setError('Could not load pricing settings. Sign in as admin and retry.'))
      .finally(() => setLoading(false));
  }, []);

  function updateService(service: ServiceKey, field: string, dollars: string) {
    if (!data) return;
    const services = { ...(data.settings.services as Record<string, Record<string, number>>) };
    services[service] = {
      ...services[service],
      [field]: centsFromDollars(dollars),
    };
    setData({
      ...data,
      settings: { ...data.settings, services },
    });
  }

  function updateSettingNumber(key: string, dollarsOrNumber: string, asCents: boolean) {
    if (!data) return;
    const value = asCents ? centsFromDollars(dollarsOrNumber) : Number.parseInt(dollarsOrNumber, 10);
    setData({
      ...data,
      settings: { ...data.settings, [key]: Number.isFinite(value) ? value : 0 },
    });
  }

  function updateMarket(
    id: string,
    patch: Partial<{ combinedTaxRateBps: number | null; pricingEnabled: boolean; isActive: boolean }>,
  ) {
    if (!data) return;
    setData({
      ...data,
      markets: data.markets.map((m) => (m.id === id ? { ...m, ...patch } : m)),
    });
  }

  async function save() {
    if (!data) return;
    setSaving(true);
    try {
      const next = await apiFetch('/api/admin/pricing-settings', {
        method: 'PUT',
        body: JSON.stringify({
          label: data.label,
          settings: data.settings,
          markets: data.markets.map((m) => ({
            id: m.id,
            combinedTaxRateBps: m.combinedTaxRateBps,
            pricingEnabled: m.pricingEnabled,
            isActive: m.isActive,
          })),
        }),
        schema: AdminPricingSettingsResponse,
      });
      setData(next);
      toast.success(`Saved pricing version ${next.version}. New estimates use these rates.`);
    } catch {
      toast.error('Could not save pricing settings.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading calculator settings…</p>;
  }
  if (error || !data) {
    return <p className="text-sm text-destructive">{error ?? 'Unavailable'}</p>;
  }

  const services = data.settings.services as Record<ServiceKey, Record<string, number>>;

  return (
    <div className="grid max-w-4xl gap-8">
      <div>
        <p className="text-sm font-medium text-muted-foreground">Admin</p>
        <h1 className="text-3xl font-semibold tracking-normal">Calculator settings</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Active version <strong>v{data.version}</strong> — {data.label}. Changes create a new
          version and apply only to new estimates.
        </p>
      </div>

      <section className="grid gap-4 rounded-xl border border-border bg-card p-5">
        <h2 className="font-semibold">Service bases &amp; rates (USD)</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="py-2 pr-2">Service</th>
                <th className="py-2 pr-2">Base / min</th>
                <th className="py-2 pr-2">$/sqft over 600</th>
                <th className="py-2 pr-2">Bedroom</th>
                <th className="py-2 pr-2">Extra bath</th>
              </tr>
            </thead>
            <tbody>
              {(Object.keys(services) as ServiceKey[]).map((key) => (
                <tr key={key} className="border-b border-border/60">
                  <td className="py-2 pr-2 font-medium capitalize">{key}</td>
                  <td className="py-2 pr-2">
                    <Input
                      className="h-8 w-24"
                      value={dollarsFromCents(services[key]?.baseCents)}
                      onChange={(e) => {
                        updateService(key, 'baseCents', e.target.value);
                        updateService(key, 'minimumCents', e.target.value);
                      }}
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <Input
                      className="h-8 w-24"
                      value={dollarsFromCents(services[key]?.areaRateCentsPerSqFt)}
                      onChange={(e) => updateService(key, 'areaRateCentsPerSqFt', e.target.value)}
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <Input
                      className="h-8 w-24"
                      value={dollarsFromCents(services[key]?.bedroomCents)}
                      onChange={(e) => updateService(key, 'bedroomCents', e.target.value)}
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <Input
                      className="h-8 w-24"
                      value={dollarsFromCents(services[key]?.bathCents)}
                      onChange={(e) => updateService(key, 'bathCents', e.target.value)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="grid gap-1">
            <Label>Included sq. ft.</Label>
            <Input
              value={String(data.settings.includedSqFt ?? 600)}
              onChange={(e) => updateSettingNumber('includedSqFt', e.target.value, false)}
            />
          </div>
          <div className="grid gap-1">
            <Label>Max auto sq. ft.</Label>
            <Input
              value={String(data.settings.maxAutoSqFt ?? 3500)}
              onChange={(e) => updateSettingNumber('maxAutoSqFt', e.target.value, false)}
            />
          </div>
          <div className="grid gap-1">
            <Label>Commercial $/sqft</Label>
            <Input
              value={dollarsFromCents(data.settings.commercialPerSqFtCents)}
              onChange={(e) => updateSettingNumber('commercialPerSqFtCents', e.target.value, true)}
            />
          </div>
        </div>
      </section>

      <section className="grid gap-4 rounded-xl border border-border bg-card p-5">
        <h2 className="font-semibold">Markets &amp; tax</h2>
        <p className="text-sm text-muted-foreground">
          Combined tax is stored in basis points (825 = 8.25%). Enable pricing only for markets
          ready for automated residential estimates.
        </p>
        <ul className="space-y-3">
          {data.markets.map((market) => (
            <li
              key={market.id}
              className="grid gap-2 rounded-lg border border-border/70 p-3 sm:grid-cols-[1fr_8rem_auto_auto] sm:items-center"
            >
              <div>
                <p className="font-medium">
                  {market.city}, {market.state}
                </p>
                <p className="text-xs text-muted-foreground">{market.name}</p>
              </div>
              <div className="grid gap-1">
                <Label className="text-xs">Tax %</Label>
                <Input
                  className="h-8"
                  value={
                    market.combinedTaxRateBps == null
                      ? ''
                      : (market.combinedTaxRateBps / 100).toFixed(2)
                  }
                  placeholder="e.g. 8.25"
                  onChange={(e) => {
                    const raw = e.target.value.trim();
                    if (raw === '') {
                      updateMarket(market.id, { combinedTaxRateBps: null });
                      return;
                    }
                    const pct = Number.parseFloat(raw);
                    updateMarket(market.id, {
                      combinedTaxRateBps: Number.isFinite(pct) ? Math.round(pct * 100) : null,
                    });
                  }}
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={market.pricingEnabled}
                  onChange={(e) => updateMarket(market.id, { pricingEnabled: e.target.checked })}
                />
                Pricing on
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={market.isActive}
                  onChange={(e) => updateMarket(market.id, { isActive: e.target.checked })}
                />
                Active
              </label>
            </li>
          ))}
        </ul>
      </section>

      <div className="flex gap-3">
        <Button type="button" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save new pricing version'}
        </Button>
      </div>
    </div>
  );
}
