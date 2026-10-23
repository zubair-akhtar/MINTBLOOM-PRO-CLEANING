// @polsia:user-owned — address search via /api/places (Google, optional).
'use client';

import { MapPin, LoaderCircle } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export type ParsedAddress = {
  street: string;
  city: string;
  state: string;
  zip: string;
};

type Prediction = { description: string; placeId: string };

export function AddressAutocomplete({
  street,
  onStreetChange,
  onResolved,
  required,
  error,
}: {
  street: string;
  onStreetChange: (value: string) => void;
  onResolved: (address: ParsedAddress) => void;
  required?: boolean;
  error?: string;
}) {
  const listId = useId();
  const [query, setQuery] = useState(street);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [probed, setProbed] = useState(false);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setQuery(street);
  }, [street]);

  // Probe once whether Places is configured so we can show a plain field when off.
  useEffect(() => {
    let cancelled = false;
    fetch('/api/places/autocomplete?input=abc')
      .then((res) => res.json())
      .then((data: { enabled?: boolean }) => {
        if (!cancelled) {
          setEnabled(Boolean(data.enabled));
          setProbed(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setEnabled(false);
          setProbed(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!enabled) {
      setPredictions([]);
      setOpen(false);
      return;
    }
    if (query.trim().length < 3) {
      setPredictions([]);
      return;
    }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/places/autocomplete?input=${encodeURIComponent(query.trim())}`);
        const data = (await res.json()) as {
          enabled?: boolean;
          predictions?: Prediction[];
        };
        setEnabled(Boolean(data.enabled));
        setPredictions(data.predictions ?? []);
        setOpen(Boolean(data.enabled) && (data.predictions?.length ?? 0) > 0);
      } catch {
        setPredictions([]);
      } finally {
        setLoading(false);
      }
    }, 280);
    return () => clearTimeout(timer);
  }, [query, enabled]);

  async function selectPrediction(prediction: Prediction) {
    setQuery(prediction.description);
    onStreetChange(prediction.description);
    setOpen(false);
    setPredictions([]);
    try {
      const res = await fetch(`/api/places/details?placeId=${encodeURIComponent(prediction.placeId)}`);
      if (!res.ok) return;
      const data = (await res.json()) as ParsedAddress & { street?: string };
      onResolved({
        street: data.street || prediction.description,
        city: data.city || '',
        state: data.state || 'TX',
        zip: data.zip || '',
      });
      if (data.street) {
        setQuery(data.street);
        onStreetChange(data.street);
      }
    } catch {
      /* manual fields remain editable */
    }
  }

  // Plain street field when Places is off (or still probing) — no combobox affordance.
  if (!enabled) {
    return (
      <div className="grid gap-2">
        <Label htmlFor="street">
          Street address {required ? <span className="text-destructive">*</span> : null}
        </Label>
        <div className="relative">
          <MapPin className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-primary" />
          <Input
            id="street"
            autoComplete="street-address"
            className="h-11 pl-10"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              onStreetChange(e.target.value);
            }}
            placeholder="Street number and name"
            required={required}
            aria-invalid={error ? true : undefined}
          />
        </div>
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
        {probed ? (
          <p className="text-xs text-muted-foreground">
            Type your address, then city, state, and ZIP below.
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="relative grid gap-2">
      <Label htmlFor="street">
        Street address {required ? <span className="text-destructive">*</span> : null}
      </Label>
      <div className="relative">
        <MapPin className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-primary" />
        <Input
          id="street"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          autoComplete="street-address"
          className="h-11 pl-10"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            onStreetChange(e.target.value);
          }}
          onFocus={() => predictions.length > 0 && setOpen(true)}
          onBlur={() => {
            blurTimer.current = setTimeout(() => setOpen(false), 150);
          }}
          placeholder="Start typing your address…"
          required={required}
          aria-invalid={error ? true : undefined}
        />
        {loading ? (
          <LoaderCircle className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        ) : null}
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      <p className="text-xs text-muted-foreground">Suggestions from Google Places when available.</p>
      {open && predictions.length > 0 ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute top-full z-30 mt-1 max-h-56 w-full overflow-auto rounded-xl border border-border bg-card py-1 shadow-lg"
        >
          {predictions.map((p) => (
            <li key={p.placeId} role="option">
              <button
                type="button"
                className="flex w-full items-start gap-2 px-3 py-2.5 text-left text-sm hover:bg-primary/10"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  if (blurTimer.current) clearTimeout(blurTimer.current);
                  void selectPrediction(p);
                }}
              >
                <MapPin className="mt-0.5 size-3.5 shrink-0 text-primary" />
                <span>{p.description}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
