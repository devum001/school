import { z } from 'zod';
import { apiService, ApiError } from './apiService';
import { schoolLocationsSchema, type SchoolLocations } from '../lib/schoolLocations';
export interface SchoolLocationSource {
  load(signal: AbortSignal): Promise<SchoolLocations>;
  save(policy: SchoolLocations): Promise<SchoolLocations>;
}
export function liveSchoolLocations(schoolId: string): SchoolLocationSource {
  const path = `/schools/${encodeURIComponent(schoolId)}/hr/locations`;
  const parse = (raw: unknown) => {
    const result = schoolLocationsSchema.extend({ schoolId: z.string() }).safeParse(raw);
    if (!result.success || result.data.schoolId !== schoolId)
      throw new ApiError(0, 'INVALID_RESPONSE', 'Unable to read this school’s locations.');
    return schoolLocationsSchema.parse(result.data);
  };
  return {
    load: async (signal) => parse(await apiService.request(path, { signal, fresh: true })),
    save: async (policy) =>
      parse(
        await apiService.request(path, {
          method: 'PUT',
          body: schoolLocationsSchema.parse(policy),
        }),
      ),
  };
}
