import { z } from 'zod';
import { apiService, ApiError } from './apiService';
const profileSchema = z.object({
  school: z.object({
    id: z.string(),
    name: z.string(),
    slug: z.string(),
    code: z.string().nullable(),
    email: z.string().nullable(),
    phone: z.string().nullable(),
    timezone: z.string(),
    status: z.literal('active'),
    profileRevision: z.number().int().nonnegative().default(0),
    academicRevision: z.number().int().nonnegative().default(0),
    address: z.string().default(''),
    city: z.string().default(''),
    region: z.string().default(''),
    country: z.string().default(''),
    postalCode: z.string().default(''),
    logoDataUrl: z.string().default(''),
    motto: z.string().default(''),
    website: z.string().default(''),
    board: z.string().default(''),
    affiliationNumber: z.string().default(''),
    principalName: z.string().default(''),
    accentColor: z
      .string()
      .regex(/^#[a-f\d]{6}$/i)
      .default('#245e63'),
    hours: z
      .object({ start: z.string(), end: z.string(), days: z.array(z.string()) })
      .nullable()
      .default(null),
  }),
  academicYear: z
    .object({ id: z.string(), name: z.string(), start: z.string(), end: z.string() })
    .nullable(),
  setupRequired: z.boolean(),
});
export type SchoolProfile = z.infer<typeof profileSchema>;
export async function getSchoolProfile(
  schoolId: string,
  signal: AbortSignal,
): Promise<SchoolProfile> {
  const data = await apiService.request(`/schools/${encodeURIComponent(schoolId)}/profile`, {
    signal,
  });
  const result = profileSchema.safeParse(data);
  if (!result.success || result.data.school.id !== schoolId)
    throw new ApiError(0, 'INVALID_RESPONSE', 'The school profile response could not be read.');
  return result.data;
}

export type ProfileInput = Omit<
  SchoolProfile['school'],
  | 'id'
  | 'slug'
  | 'code'
  | 'status'
  | 'profileRevision'
  | 'academicRevision'
  | 'email'
  | 'phone'
  | 'hours'
> & {
  revision: number;
  email: string;
  phone: string;
  hours: { start: string; end: string; days: string[] };
};
export async function saveSchoolProfile(schoolId: string, input: ProfileInput) {
  const result = z.object({ revision: z.number().int().nonnegative() }).safeParse(
    await apiService.request(`/schools/${encodeURIComponent(schoolId)}/profile`, {
      method: 'PATCH',
      body: {
        ...input,
        hours: input.hours.start || input.hours.end || input.hours.days.length ? input.hours : null,
      },
    }),
  );
  if (!result.success)
    throw new ApiError(
      0,
      'INVALID_RESPONSE',
      'The save response could not be read. Reload to check your changes.',
    );
  return result.data;
}
