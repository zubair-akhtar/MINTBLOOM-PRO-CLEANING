// @polsia:user-owned — Google Place Details → structured US address.
import 'server-only';

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { env } from '@/lib/env';

export const dynamic = 'force-dynamic';

const Query = z.object({
  placeId: z.string().trim().min(3).max(300),
});

type Component = { long_name: string; short_name: string; types: string[] };

function pick(components: Component[], type: string, short = false): string {
  const hit = components.find((c) => c.types.includes(type));
  if (!hit) return '';
  return short ? hit.short_name : hit.long_name;
}

export async function GET(request: Request) {
  const key = env.GOOGLE_MAPS_API_KEY;
  if (!key) {
    return NextResponse.json({ error: 'places_disabled' }, { status: 503 });
  }

  const parsed = Query.safeParse({
    placeId: new URL(request.url).searchParams.get('placeId') ?? '',
  });
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_place' }, { status: 400 });
  }

  const url = new URL('https://maps.googleapis.com/maps/api/place/details/json');
  url.searchParams.set('place_id', parsed.data.placeId);
  url.searchParams.set('fields', 'address_component,formatted_address');
  url.searchParams.set('key', key);

  const res = await fetch(url, { next: { revalidate: 0 } });
  if (!res.ok) {
    return NextResponse.json({ error: 'places_unavailable' }, { status: 502 });
  }

  const data = (await res.json()) as {
    status: string;
    result?: { address_component?: Component[]; formatted_address?: string };
  };
  if (data.status !== 'OK' || !data.result?.address_component) {
    return NextResponse.json({ error: data.status }, { status: 502 });
  }

  const c = data.result.address_component;
  const streetNumber = pick(c, 'street_number');
  const route = pick(c, 'route');
  const street = [streetNumber, route].filter(Boolean).join(' ').trim();

  return NextResponse.json({
    street,
    city: pick(c, 'locality') || pick(c, 'sublocality') || pick(c, 'administrative_area_level_2'),
    state: pick(c, 'administrative_area_level_1', true),
    zip: pick(c, 'postal_code'),
    formatted: data.result.formatted_address ?? street,
  });
}
