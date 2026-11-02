// @polsia:user-owned — optional Places key and response mapping checks.
// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { GET as autocomplete } from '@/app/api/places/autocomplete/route';
import { GET as details } from '@/app/api/places/details/route';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('optional Google Places address routes', () => {
  it('keeps autocomplete disabled without a configured key and makes no provider request', async () => {
    vi.stubEnv('GOOGLE_MAPS_API_KEY', '');
    const providerFetch = vi.fn();
    vi.stubGlobal('fetch', providerFetch);

    const response = await autocomplete(new Request('http://localhost/api/places/autocomplete'));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ enabled: false, predictions: [] });
    expect(providerFetch).not.toHaveBeenCalled();
  });

  it('maps configured-key autocomplete predictions without returning the key', async () => {
    vi.stubEnv('GOOGLE_MAPS_API_KEY', 'test-google-key');
    const providerFetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          status: 'OK',
          predictions: [{ description: '123 Main St, Lubbock, TX', place_id: 'place-123' }],
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal('fetch', providerFetch);

    const response = await autocomplete(
      new Request('http://localhost/api/places/autocomplete?input=123%20Main'),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(await response.json()).toEqual({
      enabled: true,
      predictions: [{ description: '123 Main St, Lubbock, TX', placeId: 'place-123' }],
    });
  });

  it('maps configured-key place details into address fields', async () => {
    vi.stubEnv('GOOGLE_MAPS_API_KEY', 'test-google-key');
    const providerFetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          status: 'OK',
          result: {
            formatted_address: '123 Main St, Lubbock, TX 79401, USA',
            address_components: [
              { long_name: '123', short_name: '123', types: ['street_number'] },
              { long_name: 'Main Street', short_name: 'Main St', types: ['route'] },
              { long_name: 'Lubbock', short_name: 'Lubbock', types: ['locality'] },
              {
                long_name: 'Texas',
                short_name: 'TX',
                types: ['administrative_area_level_1'],
              },
              { long_name: '79401', short_name: '79401', types: ['postal_code'] },
            ],
          },
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal('fetch', providerFetch);

    const response = await details(
      new Request('http://localhost/api/places/details?placeId=place-123'),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      street: '123 Main Street',
      city: 'Lubbock',
      state: 'TX',
      zip: '79401',
      formatted: '123 Main St, Lubbock, TX 79401, USA',
    });
  });
});
