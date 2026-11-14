import { z } from 'zod';
export const campusSchema = z.object({
  name: z.string().trim().min(1, 'Enter a location name.').max(80),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  radius: z.number().int().min(25).max(1000),
});
export const schoolLocationsSchema = z.object({
  revision: z.number().int().min(0),
  maxAccuracy: z.number().int().min(5).max(100),
  locations: z.array(campusSchema).max(10),
});
export type SchoolLocations = z.infer<typeof schoolLocationsSchema>;
export type Campus = z.infer<typeof campusSchema>;
export function parseCoordinatePair(text: string) {
  const match = /^\s*([+-]?\d+(?:\.\d+)?)\s*,\s*([+-]?\d+(?:\.\d+)?)\s*$/.exec(text);
  if (!match)
    throw new Error(
      'Paste decimal coordinates as latitude, longitude. Example: 27.9871488, 73.3216768.',
    );
  const latitude = Number(match[1]),
    longitude = Number(match[2]);
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180)
    throw new Error('Latitude must be between −90 and 90; longitude between −180 and 180.');
  return { latitude, longitude };
}
