// @polsia:user-owned — versioned Mintbloom rate-card administration.
'use client';

import { RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api-client';
import {
  type PricingSettings,
  pricedServiceIds,
  rateCardAdminResponseSchema,
} from '@/lib/contracts/pricing';
import styles from './pricing-rate-card-editor.module.css';

type ServiceId = (typeof pricedServiceIds)[number];
type MatrixKey = 'areaCentsPerSqFt' | 'bedroomCents' | 'bathEquivalentCents';

const SERVICE_LABELS: Record<ServiceId, string> = {
  standard: 'Standard',
  deep: 'Deep',
  move: 'Move-in / move-out',
  airbnb: 'Airbnb turnover',
};

const MATRIX_GROUPS: { key: MatrixKey; label: string; detail: string }[] = [
  {
    key: 'areaCentsPerSqFt',
    label: '$/sqft over included area',
    detail: 'Per additional square foot',
  },
  { key: 'bedroomCents', label: 'Bedroom', detail: 'Per bedroom, up to four' },
  {
    key: 'bathEquivalentCents',
    label: 'Extra bath equivalent',
    detail: 'After one included bath equivalent',
  },
];

function moneyInput(cents: number) {
  return (cents / 100).toFixed(2);
}

function parseMoney(value: string) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? Math.round(amount * 100) : 0;
}

export function PricingRateCardEditor() {
  const [draft, setDraft] = useState<PricingSettings | null>(null);
  const draftRef = useRef<PricingSettings | null>(null);
  const [savedDraft, setSavedDraft] = useState<PricingSettings | null>(null);
  const [version, setVersion] = useState(0);
  const [updatedAt, setUpdatedAt] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const dirty = !!draft && !!savedDraft && JSON.stringify(draft) !== JSON.stringify(savedDraft);

  const loadRateCard = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await apiFetch('/api/admin/pricing/rate-card', {
        schema: rateCardAdminResponseSchema,
      });
      draftRef.current = result.settings;
      setDraft(result.settings);
      setSavedDraft(result.settings);
      setVersion(result.version);
      setUpdatedAt(result.updatedAt);
      setNotice('');
    } catch {
      setError('The rate card could not be loaded. Sign in as an administrator and retry.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRateCard();
  }, [loadRateCard]);

  function changeDraft(update: (current: PricingSettings) => PricingSettings) {
    const current = draftRef.current;
    if (!current) return;
    const next = update(current);
    draftRef.current = next;
    setDraft(next);
    setError('');
    setNotice('');
  }

  function updateService(service: ServiceId, value: number) {
    changeDraft((current) => ({
      ...current,
      services: {
        ...current.services,
        [service]: { ...current.services[service], baseCents: value, minimumCents: value },
      },
    }));
  }

  function updateSetting(
    key: 'includedSqFt' | 'maxAutoSqFt' | 'commercialReferenceCentsPerSqFt',
    value: number,
  ) {
    changeDraft((current) => ({ ...current, [key]: value }));
  }

  function updateMatrix(group: MatrixKey, service: ServiceId, value: number) {
    changeDraft((current) => ({ ...current, [group]: { ...current[group], [service]: value } }));
  }

  function updateMarket(
    id: string,
    patch: Partial<
      Pick<PricingSettings['markets'][number], 'taxBasisPoints' | 'pricingEnabled' | 'isActive'>
    >,
  ) {
    changeDraft((current) => ({
      ...current,
      markets: current.markets.map((market) =>
        market.id === id ? { ...market, ...patch } : market,
      ),
    }));
  }

  async function save() {
    const snapshot = draftRef.current;
    if (!snapshot || saving || !dirty) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const result = await apiFetch('/api/admin/pricing/rate-card', {
        method: 'POST',
        body: JSON.stringify({ expectedVersion: version, settings: snapshot }),
        schema: rateCardAdminResponseSchema,
      });
      draftRef.current = result.settings;
      setDraft(result.settings);
      setSavedDraft(result.settings);
      setVersion(result.version);
      setUpdatedAt(result.updatedAt);
      setNotice(`Rate card v${result.version} is active on /book.`);
      toast.success(
        `Saved pricing version v${result.version}. Hard-refresh /book to use the new rate card.`,
      );
    } catch (failure) {
      const message = failure instanceof Error ? failure.message : '';
      if (message.endsWith('(409)')) {
        setError(
          'Another administrator saved a newer rate card. Reload the active version before editing again.',
        );
      } else if (message.endsWith('(400)')) {
        setError(
          'The rate card has an invalid value. Check that market names are complete and tax entries are valid.',
        );
      } else {
        setError('The rate card could not be saved. Your edits are still on this page.');
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className={styles.state}>Loading the active rate card…</div>;
  if (!draft)
    return (
      <section className={styles.state}>
        <p role="alert">{error || 'Rate card unavailable.'}</p>
        <Button type="button" variant="outline" onClick={() => void loadRateCard()}>
          <RefreshCw size={16} /> Retry
        </Button>
      </section>
    );

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Mintbloom Pro · Pricing</p>
          <h1>Calculator settings</h1>
          <p>
            Active version <strong>v{version}</strong> — saving creates a new version and applies it
            to new /book estimates after a hard refresh.
          </p>
        </div>
      </header>

      {error ? (
        <p className={styles.alert} role="alert">
          {error}
        </p>
      ) : null}
      {notice ? (
        <output className={styles.success} aria-live="polite">
          {notice}
        </output>
      ) : null}

      <section className={styles.panel}>
        <div className={styles.panelHeading}>
          <div>
            <h2>Service bases &amp; rates (USD)</h2>
            <p>Base and minimum update together. Per-unit rates apply to each listed service.</p>
          </div>
        </div>
        <div className={styles.matrixWrap}>
          <table className={styles.matrix}>
            <thead>
              <tr>
                <th scope="col">Service</th>
                <th scope="col">Base / min</th>
                {MATRIX_GROUPS.map((group) => (
                  <th scope="col" key={group.key}>
                    {group.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pricedServiceIds.map((service) => (
                <tr key={service}>
                  <th scope="row">
                    <span>{SERVICE_LABELS[service]}</span>
                  </th>
                  <td key={`${service}-base`}>
                    <MoneyField
                      label={`Base / minimum — ${SERVICE_LABELS[service]}`}
                      value={draft.services[service].baseCents}
                      onChange={(value) => updateService(service, value)}
                      compact
                    />
                  </td>
                  {MATRIX_GROUPS.map((group) => (
                    <td key={`${group.key}-${service}`}>
                      <MoneyField
                        label={`${group.detail} — ${SERVICE_LABELS[service]}`}
                        value={draft[group.key][service]}
                        onChange={(value) => updateMatrix(group.key, service, value)}
                        compact
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className={styles.rateFields}>
          <NumberField
            label="Included sq. ft."
            value={draft.includedSqFt}
            unit="sq ft"
            step="1"
            min={1}
            onChange={(value) => updateSetting('includedSqFt', value === '' ? 1 : value)}
          />
          <NumberField
            label="Maximum automatic quote size"
            value={draft.maxAutoSqFt}
            unit="sq ft"
            step="1"
            min={1}
            onChange={(value) => updateSetting('maxAutoSqFt', value === '' ? 1 : value)}
          />
          <MoneyField
            label="Commercial $/sqft (admin only)"
            value={draft.commercialReferenceCentsPerSqFt}
            onChange={(value) => updateSetting('commercialReferenceCentsPerSqFt', value)}
          />
        </div>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHeading}>
          <div>
            <h2>Markets &amp; tax</h2>
            <p>
              Combined tax is stored in basis points (825 = 8.25%). Enable pricing only for markets
              ready for automated residential estimates.
            </p>
          </div>
        </div>
        <div className={styles.markets}>
          {draft.markets.map((market) => (
            <article className={styles.marketRow} key={market.id}>
              <div className={styles.marketIdentity}>
                <p>
                  {market.city}, {market.state}
                </p>
                <span className={styles.marketLabel}>{market.label}</span>
              </div>
              <NumberField
                id={`market-tax-${market.id}`}
                label="Tax %"
                value={market.taxBasisPoints === null ? '' : market.taxBasisPoints / 100}
                unit="%"
                step="0.01"
                placeholder="e.g. 8.25"
                onChange={(value) =>
                  updateMarket(market.id, {
                    taxBasisPoints: value === '' ? null : Math.round(value * 100),
                  })
                }
              />
              <label className={styles.marketToggle}>
                <input
                  type="checkbox"
                  checked={market.pricingEnabled}
                  onChange={(event) =>
                    updateMarket(market.id, { pricingEnabled: event.target.checked })
                  }
                />
                <span>Pricing on</span>
              </label>
              <label className={styles.marketToggle}>
                <input
                  type="checkbox"
                  checked={market.isActive}
                  onChange={(event) => updateMarket(market.id, { isActive: event.target.checked })}
                />
                <span>Active</span>
              </label>
            </article>
          ))}
        </div>
      </section>

      <footer className={styles.footer}>
        <span>
          {updatedAt
            ? `Last version saved ${new Date(updatedAt).toLocaleString()}`
            : 'Not saved yet'}
        </span>
        <Button type="button" onClick={() => void save()} disabled={!dirty || saving}>
          {saving ? 'Saving…' : 'Save new version'}
        </Button>
      </footer>
    </main>
  );
}

function MoneyField({
  label,
  value,
  unit = 'money',
  compact = false,
  onChange,
}: {
  label: string;
  value: number;
  unit?: 'money' | 'count' | 'percent';
  compact?: boolean;
  onChange: (value: number) => void;
}) {
  const display =
    unit === 'money'
      ? moneyInput(value)
      : unit === 'percent'
        ? (value / 100).toFixed(2)
        : String(value);
  return (
    <NumberField
      label={label}
      value={Number(display)}
      unit={unit === 'money' ? '$' : unit === 'percent' ? '%' : 'count'}
      step={unit === 'money' || unit === 'percent' ? '0.01' : '1'}
      compact={compact}
      onChange={(next) => {
        const numeric = next === '' ? 0 : next;
        onChange(
          unit === 'money'
            ? parseMoney(String(next))
            : unit === 'percent'
              ? Math.round(numeric * 100)
              : Math.round(numeric),
        );
      }}
    />
  );
}

function NumberField({
  id: providedId,
  label,
  value,
  unit,
  step,
  min = 0,
  placeholder,
  compact = false,
  onChange,
}: {
  id?: string;
  label: string;
  value: number | '';
  unit: string;
  step: string;
  min?: number;
  placeholder?: string;
  compact?: boolean;
  onChange: (value: number | '') => void;
}) {
  const id = providedId ?? `rate-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  return (
    <label className={`${styles.field} ${compact ? styles.compactField : ''}`} htmlFor={id}>
      <span>{label}</span>
      <span className={styles.inputWrap}>
        <input
          id={id}
          type="number"
          min={min}
          step={step}
          placeholder={placeholder}
          value={value}
          onChange={(event) => {
            const raw = event.target.value;
            if (raw === '') {
              onChange('');
              return;
            }
            const parsed = Number(raw);
            onChange(Number.isFinite(parsed) ? Math.max(min, parsed) : '');
          }}
        />
        <em>{unit === 'money' ? '/ unit' : unit}</em>
      </span>
    </label>
  );
}

function _TextField({
  id: providedId,
  label,
  value,
  placeholder,
  maxLength,
  onChange,
}: {
  id?: string;
  label: string;
  value: string;
  placeholder?: string;
  maxLength?: number;
  onChange: (value: string) => void;
}) {
  const id = providedId ?? `market-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  return (
    <label className={styles.field} htmlFor={id}>
      <span>{label}</span>
      <input
        id={id}
        type="text"
        value={value}
        placeholder={placeholder}
        maxLength={maxLength}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}
