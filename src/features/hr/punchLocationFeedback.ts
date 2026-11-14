import type { TeacherPunchStatus } from '../../services/teacherPunchService';
export type LocationReading = {
  latitude: number;
  longitude: number;
  accuracy: number;
  capturedAt: number;
};
export function punchLocationFeedback(
  reading: LocationReading,
  policy: TeacherPunchStatus['locationPolicy'],
  now = Date.now(),
) {
  if (
    ![reading.latitude, reading.longitude, reading.accuracy, reading.capturedAt].every(
      Number.isFinite,
    ) ||
    Math.abs(reading.latitude) > 90 ||
    Math.abs(reading.longitude) > 180
  )
    return {
      ok: false,
      state: 'unavailable' as const,
      campus: undefined,
      accuracy: reading.accuracy,
      title: 'Location unavailable',
      message: 'The device returned an invalid location. Check again.',
    };
  const radians = (value: number) => (value * Math.PI) / 180;
  const candidates = policy.locations.map((location) => {
    const a =
      Math.sin(radians(location.latitude - reading.latitude) / 2) ** 2 +
      Math.cos(radians(reading.latitude)) *
        Math.cos(radians(location.latitude)) *
        Math.sin(radians(location.longitude - reading.longitude) / 2) ** 2;
    const distance = 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
    return { ...location, distance, margin: location.radius - distance - reading.accuracy };
  });
  // Prefer a valid campus, even when a smaller, nearer campus does not contain the reading.
  const campus =
    candidates.find((c) => c.margin >= 0) ?? candidates.sort((a, b) => a.distance - b.distance)[0];
  const result = { campus, accuracy: reading.accuracy };
  if (!campus)
    return {
      ...result,
      ok: false,
      state: 'unavailable' as const,
      title: 'School location is not set',
      message:
        'Ask your school administrator to save a campus location in General → School Location.',
    };
  if (Math.abs(now - reading.capturedAt) > 30000)
    return {
      ...result,
      ok: false,
      state: 'expired' as const,
      title: 'Location reading has expired',
      message: 'Check your location again. Each punch uses a fresh reading.',
    };
  if (reading.accuracy <= 0 || reading.accuracy > policy.maxAccuracy)
    return {
      ...result,
      ok: false,
      state: 'inaccurate' as const,
      title: 'Accuracy too low',
      message: `Your device reports ±${Math.round(reading.accuracy)} m accuracy. School requires ±${policy.maxAccuracy} m or better. We cannot confirm whether you are inside the campus. Enable precise location and try a GPS-enabled phone near a window. If it still fails, ask the school administrator to record attendance.`,
    };
  if (campus.distance - reading.accuracy > campus.radius)
    return {
      ...result,
      ok: false,
      state: 'outside' as const,
      title: 'Outside school area',
      message: `You are approximately ${Math.round(campus.distance)} m from ${campus.name}; the allowed radius is ${campus.radius} m. If you are at school, ask your administrator to check the saved map pin.`,
    };
  if (campus.margin < 0)
    return {
      ...result,
      ok: false,
      state: 'boundary' as const,
      title: 'School boundary cannot be confirmed',
      message:
        'Your location uncertainty crosses the school boundary. Move closer to the campus centre or get a more accurate reading.',
    };
  return {
    ...result,
    ok: true,
    state: 'inside' as const,
    title: 'Within school area',
    message:
      'The server will verify a fresh reading when you punch. Your location is checked only when you request it.',
  };
}
