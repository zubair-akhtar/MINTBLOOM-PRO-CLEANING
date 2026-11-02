// @polsia:user-owned — optional address search via the app's Google Places routes.
'use client';

import { LoaderCircle, MapPin } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import {
  type PlaceDetails,
  type PlacesPrediction,
  placeDetailsResponseSchema,
  placesAutocompleteResponseSchema,
} from '@/lib/contracts/places';
import styles from './pricing-calculator.module.css';

export function AddressAutocomplete({
  street,
  required = false,
  error,
  onStreetChange,
  onResolved,
}: {
  street: string;
  required?: boolean;
  error?: string;
  onStreetChange: (value: string) => void;
  onResolved: (address: PlaceDetails) => void;
}) {
  const [query, setQuery] = useState(street);
  const [enabled, setEnabled] = useState(false);
  const [predictions, setPredictions] = useState<PlacesPrediction[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => setQuery(street), [street]);

  useEffect(() => {
    let active = true;
    apiFetch('/api/places/autocomplete', {
      schema: placesAutocompleteResponseSchema,
      cache: 'no-store',
    })
      .then((result) => active && setEnabled(result.enabled))
      .catch(() => active && setEnabled(false));
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!enabled || query.trim().length < 3) {
      setPredictions([]);
      setOpen(false);
      return;
    }
    let active = true;
    const timer = window.setTimeout(() => {
      setLoading(true);
      apiFetch(`/api/places/autocomplete?input=${encodeURIComponent(query.trim())}`, {
        schema: placesAutocompleteResponseSchema,
        cache: 'no-store',
      })
        .then((result) => {
          if (!active) return;
          setPredictions(result.predictions);
          setOpen(result.enabled && result.predictions.length > 0);
        })
        .catch(() => {
          if (!active) return;
          setPredictions([]);
          setOpen(false);
        })
        .finally(() => active && setLoading(false));
    }, 280);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [enabled, query]);

  async function selectPrediction(prediction: PlacesPrediction) {
    setQuery(prediction.description);
    onStreetChange(prediction.description);
    setOpen(false);
    setPredictions([]);
    setDetailsLoading(true);
    try {
      const address = await apiFetch(
        `/api/places/details?placeId=${encodeURIComponent(prediction.placeId)}`,
        { schema: placeDetailsResponseSchema, cache: 'no-store' },
      );
      onResolved(address);
      if (address.street) {
        setQuery(address.street);
        onStreetChange(address.street);
      }
    } catch {
      // Keep the selected search text and the editable address fields if details fail.
    } finally {
      setDetailsLoading(false);
    }
  }

  function closeSuggestionsSoon() {
    blurTimer.current = setTimeout(() => setOpen(false), 120);
  }

  function keepSuggestionsOpen() {
    if (blurTimer.current) clearTimeout(blurTimer.current);
  }

  return (
    <div className={`${styles.field} ${styles.fullWidth} ${styles.addressField}`}>
      <label className={styles.fieldLabel} htmlFor="street-address">
        Street address {required ? <span className={styles.requiredMark}>*</span> : null}
      </label>
      <div className={styles.addressInputWrap}>
        <MapPin className={styles.addressIcon} aria-hidden="true" />
        {loading || detailsLoading ? (
          <LoaderCircle className={styles.addressSpinner} aria-hidden="true" />
        ) : null}
        <input
          id="street-address"
          aria-invalid={!!error}
          aria-describedby={error ? 'street-address-error' : 'street-address-hint'}
          autoComplete="street-address"
          className={`${styles.control} ${styles.addressInput}`}
          placeholder="Street number and name"
          required={required}
          value={query}
          onBlur={closeSuggestionsSoon}
          onChange={(event) => {
            setQuery(event.target.value);
            onStreetChange(event.target.value);
          }}
          onFocus={keepSuggestionsOpen}
          onKeyDown={(event) => {
            if (event.key === 'Escape') setOpen(false);
            if (event.key === 'Enter' && open && predictions[0]) {
              event.preventDefault();
              void selectPrediction(predictions[0]);
            }
          }}
        />
      </div>
      {error ? (
        <span id="street-address-error" className={styles.fieldError}>
          {error}
        </span>
      ) : null}
      <span id="street-address-hint" className={styles.fieldHint}>
        {enabled
          ? 'Start typing to search for an address, or enter it manually.'
          : 'Enter the address where service is needed.'}
      </span>
      {enabled && open ? (
        <ul className={styles.addressSuggestions}>
          {predictions.map((prediction) => (
            <li key={prediction.placeId}>
              <button
                className={styles.addressSuggestion}
                type="button"
                onBlur={closeSuggestionsSoon}
                onClick={() => void selectPrediction(prediction)}
                onMouseDown={keepSuggestionsOpen}
              >
                {prediction.description}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
