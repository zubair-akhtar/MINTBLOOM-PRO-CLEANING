// @polsia:user-owned — admin coupon manager.
'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api-client';
import { couponSchema, type SaveCouponInput } from '@/lib/contracts/payments';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { z } from 'zod';

const listSchema = z.object({ coupons: z.array(couponSchema) });

type Coupon = z.infer<typeof couponSchema>;

const emptyForm: SaveCouponInput = {
  code: '',
  name: '',
  percentOff: 10,
  amountOffCents: null,
  maxRedemptions: null,
  startsAt: null,
  endsAt: null,
  appliesTo: 'quote_and_online',
  isActive: true,
};

export function AdminCoupons() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [form, setForm] = useState<SaveCouponInput>(emptyForm);
  const [discountType, setDiscountType] = useState<'percent' | 'amount'>('percent');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function load() {
    const data = await apiFetch('/api/admin/coupons', { schema: listSchema });
    setCoupons(data.coupons);
  }

  useEffect(() => {
    load()
      .catch(() => toast.error('Could not load coupons.'))
      .finally(() => setLoading(false));
  }, []);

  async function createCoupon() {
    setSaving(true);
    try {
      const payload: SaveCouponInput = {
        ...form,
        code: form.code.trim().toUpperCase(),
        percentOff: discountType === 'percent' ? form.percentOff : null,
        amountOffCents: discountType === 'amount' ? form.amountOffCents : null,
      };
      await apiFetch('/api/admin/coupons', {
        method: 'POST',
        body: JSON.stringify(payload),
        schema: z.object({ coupon: couponSchema }),
      });
      toast.success('Coupon created.');
      setForm(emptyForm);
      await load();
    } catch {
      toast.error('Could not create coupon.');
    } finally {
      setSaving(false);
    }
  }

  async function removeCoupon(id: string) {
    try {
      await apiFetch(`/api/admin/coupons/${id}`, {
        method: 'DELETE',
        schema: z.object({ ok: z.literal(true) }),
      });
      toast.success('Coupon deleted.');
      await load();
    } catch {
      toast.error('Could not delete coupon.');
    }
  }

  if (loading) return <p className="text-muted-foreground">Loading coupons…</p>;

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_1.2fr]">
      <section className="grid gap-4 rounded-xl border border-border bg-card p-6">
        <h2 className="text-lg font-semibold">Create coupon</h2>
        <div className="grid gap-2">
          <Label>Code</Label>
          <Input
            value={form.code}
            onChange={(event) => setForm((current) => ({ ...current, code: event.target.value }))}
            placeholder="SPRING10"
          />
        </div>
        <div className="grid gap-2">
          <Label>Name</Label>
          <Input
            value={form.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            placeholder="Spring cleaning discount"
          />
        </div>
        <div className="grid gap-2">
          <Label>Discount type</Label>
          <select
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={discountType}
            onChange={(event) => setDiscountType(event.target.value as 'percent' | 'amount')}
          >
            <option value="percent">Percent off</option>
            <option value="amount">Fixed amount off</option>
          </select>
        </div>
        {discountType === 'percent' ? (
          <div className="grid gap-2">
            <Label>Percent off</Label>
            <Input
              type="number"
              min={1}
              max={100}
              value={form.percentOff ?? ''}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  percentOff: event.target.value ? Number(event.target.value) : null,
                }))
              }
            />
          </div>
        ) : (
          <div className="grid gap-2">
            <Label>Amount off (USD)</Label>
            <Input
              type="number"
              min={1}
              step="0.01"
              value={form.amountOffCents ? form.amountOffCents / 100 : ''}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  amountOffCents: event.target.value
                    ? Math.round(Number(event.target.value) * 100)
                    : null,
                }))
              }
            />
          </div>
        )}
        <div className="grid gap-2">
          <Label>Max redemptions (blank = unlimited)</Label>
          <Input
            type="number"
            min={1}
            value={form.maxRedemptions ?? ''}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                maxRedemptions: event.target.value ? Number(event.target.value) : null,
              }))
            }
          />
        </div>
        <div className="grid gap-2">
          <Label>Applies to</Label>
          <select
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={form.appliesTo}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                appliesTo: event.target.value as SaveCouponInput['appliesTo'],
              }))
            }
          >
            <option value="quote_and_online">Quote requests and online payments</option>
            <option value="online_only">Online payments only</option>
          </select>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label>Starts at</Label>
            <Input
              type="datetime-local"
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  startsAt: event.target.value ? new Date(event.target.value).toISOString() : null,
                }))
              }
            />
          </div>
          <div className="grid gap-2">
            <Label>Ends at</Label>
            <Input
              type="datetime-local"
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  endsAt: event.target.value ? new Date(event.target.value).toISOString() : null,
                }))
              }
            />
          </div>
        </div>
        <Button onClick={createCoupon} disabled={saving}>
          {saving ? 'Saving…' : 'Create coupon'}
        </Button>
      </section>

      <section className="grid gap-3">
        <h2 className="text-lg font-semibold">Active coupons</h2>
        {coupons.length === 0 ? (
          <p className="text-sm text-muted-foreground">No coupons yet.</p>
        ) : (
          coupons.map((coupon) => (
            <article
              key={coupon.id}
              className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-border bg-card p-4"
            >
              <div>
                <p className="font-semibold tracking-wide">{coupon.code}</p>
                <p className="text-sm text-muted-foreground">{coupon.name}</p>
                <p className="mt-1 text-sm">
                  {coupon.percentOff
                    ? `${coupon.percentOff}% off`
                    : coupon.amountOffCents
                      ? `$${(coupon.amountOffCents / 100).toFixed(2)} off`
                      : 'No discount'}
                  {' · '}
                  {coupon.appliesTo === 'online_only' ? 'Online only' : 'Quote + online'}
                  {' · '}
                  Used {coupon.redemptionCount}
                  {coupon.maxRedemptions != null ? ` / ${coupon.maxRedemptions}` : ' / ∞'}
                  {!coupon.isActive ? ' · Inactive' : ''}
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => removeCoupon(coupon.id)}>
                Delete
              </Button>
            </article>
          ))
        )}
      </section>
    </div>
  );
}
