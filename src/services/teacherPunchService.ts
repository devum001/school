import { attendanceRequestSchema } from './attendanceTypes';
import { z } from 'zod';
import { apiService, ApiError } from './apiService';

const schema = z.object({
  schoolId: z.string(),
  today: z.string(),
  time: z.string(),
  teaching: z.boolean(),
  active: z.boolean(),
  attendanceClosed: z.boolean().optional(),
  attendanceSource: z.enum(['ars', 'admin']).optional(),
  attendanceStatus: z.string().optional(),
  late: z.boolean().optional(),
  lateMinutes: z.number().optional(),
  missedPunches: z
    .array(
      z.object({
        id: z.string(),
        date: z.string(),
        status: z.string().optional(),
        punchIn: z.string().optional(),
      }),
    )
    .optional(),
  attendanceRequests: z.array(attendanceRequestSchema).optional(),
  timezone: z.string(),
  serverNow: z.string().datetime(),
  schedule: z.object({ start: z.string(), end: z.string() }),
  locationPolicy: z.object({
    maxAccuracy: z.number(),
    locations: z.array(
      z.object({
        name: z.string(),
        latitude: z.number(),
        longitude: z.number(),
        radius: z.number(),
      }),
    ),
  }),
  punchIn: z.string().nullable(),
  punchOut: z.string().nullable(),
  state: z.object({
    allowed: z.boolean(),
    code: z.string().nullable(),
    reason: z.string(),
    nextKind: z.enum(['in', 'out']),
  }),
});
export type TeacherPunchStatus = z.infer<typeof schema>;
export async function loadTeacherPunch(schoolId: string, fresh = false, signal?: AbortSignal) {
  const result = schema.safeParse(
    await apiService.request(`/schools/${schoolId}/hr/punch-status`, { fresh, signal }),
  );
  if (!result.success || result.data.schoolId !== schoolId)
    throw new ApiError(0, 'INVALID_RESPONSE', 'Unable to read your punch status.');
  return result.data;
}
export function currentPosition(): Promise<GeolocationPosition> {
  if (!navigator.geolocation)
    return Promise.reject(
      new Error(
        'Location is unavailable. Use an HTTPS connection and a device with location access.',
      ),
    );
  return new Promise((resolve, reject) =>
    navigator.geolocation.getCurrentPosition(
      resolve,
      (error) =>
        reject(
          new Error(
            error.code === 1
              ? 'Location permission is blocked. Allow location for this site in your browser settings, then try again.'
              : error.code === 3
                ? 'Your device could not locate you in time. Move near a window or try your phone, then check again.'
                : 'Your device could not determine its location. Turn on location services and try again.',
          ),
        ),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 },
    ),
  );
}
export function announcePunch(schoolId: string) {
  window.dispatchEvent(new CustomEvent('schoolwell:punch-change', { detail: schoolId }));
}
