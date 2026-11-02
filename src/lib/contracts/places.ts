// @polsia:user-owned — client-safe contracts for optional Google Places address lookup.
import { z } from 'zod';

export const placesPredictionSchema = z.object({
  description: z.string(),
  placeId: z.string(),
});

export const placesAutocompleteResponseSchema = z.object({
  enabled: z.boolean(),
  predictions: z.array(placesPredictionSchema),
});

export const placeDetailsResponseSchema = z.object({
  street: z.string(),
  city: z.string(),
  state: z.string(),
  zip: z.string(),
  formatted: z.string(),
});

export type PlacesPrediction = z.infer<typeof placesPredictionSchema>;
export type PlaceDetails = z.infer<typeof placeDetailsResponseSchema>;
