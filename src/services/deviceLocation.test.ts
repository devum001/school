import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { currentPosition } from './deviceLocation';
let success: PositionCallback;
let failure: PositionErrorCallback;
const clearWatch = vi.fn();
const watchPosition = vi.fn((ok: PositionCallback, fail: PositionErrorCallback) => {
  success = ok;
  failure = fail;
  return 7;
});
function position(accuracy: number, timestamp = Date.now()): GeolocationPosition {
  return {
    timestamp,
    coords: { latitude: 27.9871488, longitude: 73.3216768, accuracy },
  } as GeolocationPosition;
}
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-14T06:00:00Z'));
  vi.stubGlobal('navigator', { geolocation: { watchPosition, clearWatch } });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});
it('waits for a precise fix rather than accepting the first coarse location', async () => {
  const progress = vi.fn();
  const pending = currentPosition({ onProgress: progress });
  success(position(3333));
  expect(clearWatch).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(2000);
  success(position(21));
  expect((await pending).coords.accuracy).toBe(21);
  expect(watchPosition.mock.calls[0]).toHaveLength(3);
  expect(progress).toHaveBeenCalledTimes(2);
  expect(clearWatch).toHaveBeenCalledWith(7);
  expect(vi.getTimerCount()).toBe(0);
});
it('returns the best actual reading at the deadline without inventing precision', async () => {
  const pending = currentPosition();
  success(position(3333));
  success(position(1000));
  success(position(2000));
  await vi.advanceTimersByTimeAsync(20000);
  expect((await pending).coords.accuracy).toBe(1000);
  expect(clearWatch).toHaveBeenCalledWith(7);
});
it('rejects stale or malformed readings', async () => {
  const pending = currentPosition();
  const rejected = expect(pending).rejects.toThrow('No fresh location');
  success(position(5, Date.now() - 60000));
  success(position(NaN));
  success({ ...position(5), coords: { ...position(5).coords, latitude: 91 } });
  await vi.advanceTimersByTimeAsync(20000);
  await rejected;
  expect(clearWatch).toHaveBeenCalledWith(7);
});
it('keeps listening after a temporary provider error', async () => {
  const pending = currentPosition();
  failure({ code: 2 } as GeolocationPositionError);
  success(position(10));
  expect((await pending).coords.accuracy).toBe(10);
});
it('permission denial stops the watch and provides a specific recovery message', async () => {
  const pending = currentPosition();
  failure({ code: 1 } as GeolocationPositionError);
  await expect(pending).rejects.toThrow('Location permission is blocked');
  expect(clearWatch).toHaveBeenCalledWith(7);
  expect(vi.getTimerCount()).toBe(0);
});
it('cancels the watch when the screen closes', async () => {
  const controller = new AbortController();
  const pending = currentPosition({ signal: controller.signal });
  controller.abort();
  await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  expect(clearWatch).toHaveBeenCalledWith(7);
  expect(vi.getTimerCount()).toBe(0);
});
it('does not start a watch for an already cancelled request', async () => {
  const controller = new AbortController();
  controller.abort();
  await expect(currentPosition({ signal: controller.signal })).rejects.toMatchObject({
    name: 'AbortError',
  });
  expect(watchPosition).not.toHaveBeenCalled();
});
it('explains unavailable location access', async () => {
  vi.stubGlobal('navigator', {});
  await expect(currentPosition()).rejects.toThrow('HTTPS');
});
it('returns the first fresh map-preview reading immediately without pretending it is accurate', async () => {
  const pending = currentPosition({ waitForAccuracy: false, timeoutMs: 5000 });
  success(position(3333));
  expect((await pending).coords.accuracy).toBe(3333);
  expect(clearWatch).toHaveBeenCalledWith(7);
  expect(vi.getTimerCount()).toBe(0);
});
it('bounds a map preview to five seconds if the device supplies no location', async () => {
  const pending = currentPosition({ waitForAccuracy: false, timeoutMs: 5000 });
  const rejected = expect(pending).rejects.toThrow('No fresh location');
  await vi.advanceTimersByTimeAsync(5000);
  await rejected;
  expect(clearWatch).toHaveBeenCalledWith(7);
});
