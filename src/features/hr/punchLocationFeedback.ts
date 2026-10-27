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
      title: 'School location is not set',
      message: 'Ask your school administrator to save a campus location in Work & Leave rules.',
    };
  if (Math.abs(now - reading.capturedAt) > 30000)
    return {
      ...result,
      ok: false,
      title: 'Location reading has expired',
      message: 'Check your location again. Each punch uses a fresh reading.',
    };
  if (reading.accuracy <= 0 || reading.accuracy > policy.maxAccuracy)
    return {
      ...result,
      ok: false,
      title: 'Your location is not accurate enough',
      message: `Your device reports ±${Math.round(reading.accuracy)} m accuracy. School requires ±${policy.maxAccuracy} m or better. Try your phone with precise location enabled, or move near a window.`,
    };
  if (campus.distance > campus.radius)
    return {
      ...result,
      ok: false,
      title: 'You appear outside the school area',
      message: `You are approximately ${Math.round(campus.distance)} m from ${campus.name}; the allowed radius is ${campus.radius} m. If you are at school, ask your administrator to check the saved map pin.`,
    };
  if (campus.margin < 0)
    return {
      ...result,
      ok: false,
      title: 'Move further inside the school area',
      message:
        'Your location uncertainty crosses the school boundary. Move closer to the campus centre or get a more accurate reading.',
    };
  return {
    ...result,
    ok: true,
    title: 'Location is within the school area',
    message:
      'The server will verify a fresh reading when you punch. Your location is checked only when you request it.',
  };
}
