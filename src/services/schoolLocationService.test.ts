import { afterEach, expect, it, vi } from 'vitest';
import { apiService } from './apiService';
import { liveSchoolLocations } from './schoolLocationService';
afterEach(() => vi.restoreAllMocks());
const policy = {
  revision: 2,
  maxAccuracy: 50,
  locations: [{ name: 'Campus', latitude: 27.98, longitude: 73.32, radius: 100 }],
};
it('loads the current school policy and refuses foreign or unavailable data without a demo fallback', async () => {
  const request = vi
    .spyOn(apiService, 'request')
    .mockResolvedValue({ ...policy, schoolId: 'school' });
  const adapter = liveSchoolLocations('school');
  const signal = new AbortController().signal;
  expect(await adapter.load(signal)).toEqual(policy);
  expect(request).toHaveBeenCalledWith('/schools/school/hr/locations', { signal, fresh: true });
  request.mockResolvedValue({ ...policy, schoolId: 'other' });
  await expect(adapter.load(signal)).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  request.mockRejectedValue(new Error('Unavailable'));
  await expect(adapter.load(signal)).rejects.toThrow('Unavailable');
});
it('saves only the location policy and retains revision checks', async () => {
  const request = vi
    .spyOn(apiService, 'request')
    .mockResolvedValue({ ...policy, revision: 3, schoolId: 'school' });
  const adapter = liveSchoolLocations('school');
  expect(
    (await adapter.save({ ...policy, holidays: ['2026-11-14'] } as typeof policy)).revision,
  ).toBe(3);
  expect(request).toHaveBeenCalledWith('/schools/school/hr/locations', {
    method: 'PUT',
    body: policy,
  });
  request.mockClear();
  await expect(adapter.save({ ...policy, maxAccuracy: 3333 })).rejects.toThrow();
  expect(request).not.toHaveBeenCalled();
});
