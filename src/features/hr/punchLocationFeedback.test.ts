import { expect, it } from 'vitest';
import { punchLocationFeedback } from './punchLocationFeedback';
const now = 100000;
const reading = { latitude: 26.9, longitude: 75.8, accuracy: 10, capturedAt: now };
const campus = { name: 'Main campus', latitude: 26.9, longitude: 75.8, radius: 100 };
const policy = { maxAccuracy: 50, locations: [campus] };
it('explains accuracy, stale and outside readings independently', () => {
  expect(punchLocationFeedback(reading, policy, now).ok).toBe(true);
  expect(punchLocationFeedback({ ...reading, accuracy: 900 }, policy, now).title).toBe(
    'Accuracy too low',
  );
  expect(punchLocationFeedback(reading, policy, now + 31000).title).toBe(
    'Location reading has expired',
  );
  expect(punchLocationFeedback({ ...reading, latitude: 27.9 }, policy, now).title).toBe(
    'Outside school area',
  );
  expect(punchLocationFeedback(reading, { ...policy, locations: [] }, now).title).toBe(
    'School location is not set',
  );
});
it('requires the uncertainty circle to fit inside a campus and accepts any valid campus', () => {
  const small = { ...campus, radius: 5 };
  expect(punchLocationFeedback(reading, { ...policy, locations: [small] }, now).title).toBe(
    'School boundary cannot be confirmed',
  );
  const result = punchLocationFeedback(reading, { ...policy, locations: [small, campus] }, now);
  expect(result.ok).toBe(true);
  expect(result.campus?.radius).toBe(100);
});

it('does not label coarse readings at the exact saved pin as outside', () => {
  const result = punchLocationFeedback({ ...reading, accuracy: 3333 }, policy, now);
  expect(result.ok).toBe(false);
  expect(result.state).toBe('inaccurate');
});
it('rejects malformed readings and distinguishes uncertain boundary from confirmed outside', () => {
  expect(punchLocationFeedback({ ...reading, latitude: NaN }, policy, now).ok).toBe(false);
  expect(punchLocationFeedback({ ...reading, latitude: 91 }, policy, now).ok).toBe(false);
  expect(
    punchLocationFeedback(
      { ...reading, latitude: reading.latitude + 0.00095, accuracy: 20 },
      policy,
      now,
    ).state,
  ).toBe('boundary');
});
