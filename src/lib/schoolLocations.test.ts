import { expect, it } from 'vitest';
import { parseCoordinatePair, schoolLocationsSchema } from './schoolLocations';
import { saveSchoolLocations, saveSchoolProfile } from './settings';
import { createSeed } from '../mocks/seed';
import { restoreSchoolState } from '../mocks/restore';
const policy = {
  revision: 0,
  maxAccuracy: 50,
  locations: [{ name: 'Campus', latitude: 27.9871488, longitude: 73.3216768, radius: 100 }],
};
it('accepts decimal coordinates copied from a phone, including zero and negative coordinates', () => {
  expect(parseCoordinatePair(' 27.9871488, 73.3216768 ')).toEqual({
    latitude: 27.9871488,
    longitude: 73.3216768,
  });
  expect(parseCoordinatePair('-33.8688, +151.2093')).toEqual({
    latitude: -33.8688,
    longitude: 151.2093,
  });
  expect(parseCoordinatePair('0, 0')).toEqual({ latitude: 0, longitude: 0 });
});
it('rejects invalid coordinates and unsafe location policy', () => {
  for (const text of ['', '91, 0', '0, -181', 'NaN, 10', '27, 73, 10', 'maps.app.goo.gl/example'])
    expect(() => parseCoordinatePair(text)).toThrow();
  for (const patch of [{ latitude: NaN }, { longitude: 181 }, { radius: 24 }, { name: '' }])
    expect(
      schoolLocationsSchema.safeParse({
        ...policy,
        locations: [{ ...policy.locations[0], ...patch }],
      }).success,
    ).toBe(false);
  expect(schoolLocationsSchema.safeParse({ ...policy, maxAccuracy: 3333 }).success).toBe(false);
});
it('demo saves independently, restores local data and rejects stale revisions', () => {
  const state = createSeed();
  const next = saveSchoolLocations(state, policy);
  expect(state.school.locationPolicy).toBeUndefined();
  expect(next.staffPayroll).toBe(state.staffPayroll);
  expect(next.teachers).toBe(state.teachers);
  expect(next.school.locationPolicy).toEqual({ ...policy, revision: 1 });
  expect(
    restoreSchoolState(createSeed(), JSON.parse(JSON.stringify(next))).school.locationPolicy,
  ).toEqual(next.school.locationPolicy);
  expect(() => saveSchoolLocations(next, policy)).toThrow('Reload');
  const edited = saveSchoolProfile(next, { ...state.school, name: 'Updated name' });
  expect(edited.school.locationPolicy).toBe(next.school.locationPolicy);
});
