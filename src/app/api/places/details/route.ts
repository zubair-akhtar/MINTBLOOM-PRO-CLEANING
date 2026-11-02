// @polsia:user-owned — Google Place Details to address fields (optional server key).
import 'server-only';

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { placeDetailsResponseSchema } from '@/lib/contracts/places';

export const dynamic = 'force-dynamic';

const googleResponseSchema = z.object({
  status: z.string(),
  result: z
    .object({
      address_components: z
        .array(
          z.object({
            long_name: z.string(),
            short_name: z.string(),
            types: z.array(z.string()),
          }),
        )
        .optional(),
      formatted_address: z.string().optional(),
    })
    .optional(),
});

const placeIdSchema = z.string().trim().min(3).max(300);

function addressPart(
  components: NonNullable<z.infer<typeof googleResponseSchema>['result']>['address_components'],
  type: string,
  useShortName = false,
) {
  const component = components?.find((candidate) => candidate.types.includes(type));
  return component ? (useShortName ? component.short_name : component.long_name) : '';
}

export async function GET(request: Request) {
  const headers = { 'Cache-Control': 'no-store' };
  const key = process.env.GOOGLE_MAPS_API_KEY?.trim();
  if (!key) {
    return NextResponse.json({ error: 'places_disabled' }, { status: 503, headers });
  }

  const parsedId = placeIdSchema.safeParse(new URL(request.url).searchParams.get('placeId') ?? '');
  if (!parsedId.success) {
    return NextResponse.json({ error: 'invalid_place' }, { status: 400, headers });
  }

  const url = new URL('https://maps.googleapis.com/maps/api/place/details/json');
  url.searchParams.set('place_id', parsedId.data);
  url.searchParams.set('fields', 'address_component,formatted_address');
  url.searchParams.set('key', key);

  try {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) {
      return NextResponse.json({ error: 'places_unavailable' }, { status: 502, headers });
    }
    const result = googleResponseSchema.safeParse(await response.json());
    if (!result.success || result.data.status !== 'OK' || !result.data.result?.address_components) {
      return NextResponse.json({ error: 'places_unavailable' }, { status: 502, headers });
    }

    const components = result.data.result.address_components;
    const street = [addressPart(components, 'street_number'), addressPart(components, 'route')]
      .filter(Boolean)
      .join(' ');
    const address = placeDetailsResponseSchema.parse({
      street,
      city:
        addressPart(components, 'locality') ||
        addressPart(components, 'sublocality') ||
        addressPart(components, 'administrative_area_level_2'),
      state: addressPart(components, 'administrative_area_level_1', true),
      zip: addressPart(components, 'postal_code'),
      formatted: result.data.result.formatted_address ?? street,
    });
    return NextResponse.json(address, { headers });
  } catch {
    return NextResponse.json({ error: 'places_unavailable' }, { status: 502, headers });
  }
}
