// @polsia:user-owned — Google Places autocomplete (server-side; optional key).
import 'server-only';

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { env } from '@/lib/env';

export const dynamic = 'force-dynamic';

const Query = z.object({
  input: z.string().trim().min(2).max(200),
});

export async function GET(request: Request) {
  const key = env.GOOGLE_MAPS_API_KEY;
  if (!key) {
    return NextResponse.json({ enabled: false, predictions: [] });
  }

  const parsed = Query.safeParse({
    input: new URL(request.url).searchParams.get('input') ?? '',
  });
  if (!parsed.success) {
    return NextResponse.json({ enabled: true, predictions: [] });
  }

  const url = new URL('https://maps.googleapis.com/maps/api/place/autocomplete/json');
  url.searchParams.set('input', parsed.data.input);
  url.searchParams.set('types', 'address');
  url.searchParams.set('components', 'country:us');
  url.searchParams.set('key', key);

  const res = await fetch(url, { next: { revalidate: 0 } });
  if (!res.ok) {
    return NextResponse.json({ enabled: true, predictions: [], error: 'places_unavailable' }, { status: 502 });
  }

  const data = (await res.json()) as {
    status: string;
    predictions?: { description: string; place_id: string }[];
  };

  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    return NextResponse.json({ enabled: true, predictions: [], error: data.status }, { status: 502 });
  }

  return NextResponse.json({
    enabled: true,
    predictions: (data.predictions ?? []).slice(0, 6).map((p) => ({
      description: p.description,
      placeId: p.place_id,
    })),
  });
}
