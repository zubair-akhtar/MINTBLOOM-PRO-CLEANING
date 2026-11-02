// @polsia:user-owned — Google Places address autocomplete (optional server key).
import 'server-only';

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { placesAutocompleteResponseSchema } from '@/lib/contracts/places';

export const dynamic = 'force-dynamic';

const googleResponseSchema = z.object({
  status: z.string(),
  predictions: z.array(z.object({ description: z.string(), place_id: z.string() })).optional(),
});

export async function GET(request: Request) {
  const headers = { 'Cache-Control': 'no-store' };
  const key = process.env.GOOGLE_MAPS_API_KEY?.trim();
  if (!key) {
    return NextResponse.json({ enabled: false, predictions: [] }, { headers });
  }

  const input = new URL(request.url).searchParams.get('input')?.trim() ?? '';
  if (input.length < 3) {
    return NextResponse.json({ enabled: true, predictions: [] }, { headers });
  }
  if (input.length > 200) {
    return NextResponse.json({ error: 'invalid_input' }, { status: 400, headers });
  }

  const url = new URL('https://maps.googleapis.com/maps/api/place/autocomplete/json');
  url.searchParams.set('input', input);
  url.searchParams.set('types', 'address');
  url.searchParams.set('components', 'country:us');
  url.searchParams.set('key', key);

  try {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) {
      return NextResponse.json({ error: 'places_unavailable' }, { status: 502, headers });
    }
    const parsed = googleResponseSchema.safeParse(await response.json());
    if (!parsed.success || !['OK', 'ZERO_RESULTS'].includes(parsed.data.status)) {
      return NextResponse.json({ error: 'places_unavailable' }, { status: 502, headers });
    }
    const result = placesAutocompleteResponseSchema.parse({
      enabled: true,
      predictions: (parsed.data.predictions ?? []).slice(0, 6).map((prediction) => ({
        description: prediction.description,
        placeId: prediction.place_id,
      })),
    });
    return NextResponse.json(result, { headers });
  } catch {
    return NextResponse.json({ error: 'places_unavailable' }, { status: 502, headers });
  }
}
