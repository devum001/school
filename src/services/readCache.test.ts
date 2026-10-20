import { afterEach, expect, it, vi } from 'vitest';
import { ReadCache } from './readCache';
afterEach(() => vi.restoreAllMocks());
it('shares a request across remounts while independently canceling a reader', async () => {
  const cache = new ReadCache();
  let resolve!: (value: string) => void;
  const load = vi.fn(
    () =>
      new Promise<string>((done) => {
        resolve = done;
      }),
  );
  const controller = new AbortController();
  const first = cache.read('/schools/a', load, controller.signal);
  const second = cache.read('/schools/a', load);
  controller.abort();
  await expect(first).rejects.toMatchObject({ name: 'AbortError' });
  resolve('current');
  expect(await second).toBe('current');
  expect(await cache.read('/schools/a', load)).toBe('current');
  expect(load).toHaveBeenCalledOnce();
});
it('expires bounded cached reads and keeps school and pagination keys separate', async () => {
  const clock = vi.spyOn(Date, 'now').mockReturnValue(1000);
  const cache = new ReadCache(30, 2);
  const load = vi.fn(async () => 'record');
  await cache.read('/schools/a', load);
  await cache.read('/schools/b', load);
  await cache.read('/schools/a?after=next', load);
  await cache.read('/schools/a', load);
  expect(load).toHaveBeenCalledTimes(4);
  clock.mockReturnValue(1031);
  await cache.read('/schools/a', load);
  expect(load).toHaveBeenCalledTimes(5);
});
it('does not cache errors and honors an already canceled consumer', async () => {
  const cache = new ReadCache();
  const load = vi.fn().mockRejectedValueOnce(new Error('Unavailable')).mockResolvedValue('ok');
  await expect(cache.read('/schools/a', load)).rejects.toThrow('Unavailable');
  expect(await cache.read('/schools/a', load)).toBe('ok');
  const controller = new AbortController();
  controller.abort();
  await expect(cache.read('/schools/a', load, controller.signal)).rejects.toMatchObject({
    name: 'AbortError',
  });
  expect(load).toHaveBeenCalledTimes(2);
});
it('rejects a late response from a previous account after a scope clear', async () => {
  const cache = new ReadCache();
  let resolve!: (value: string) => void;
  const load = vi.fn(
    () =>
      new Promise<string>((done) => {
        resolve = done;
      }),
  );
  const previous = cache.read('/platform/schools', load);
  await Promise.resolve();
  cache.clear();
  resolve('private previous account data');
  await expect(previous).rejects.toMatchObject({ name: 'AbortError' });
  expect(await cache.read('/platform/schools', async () => 'new account')).toBe('new account');
});
it('revalidates a pending read after mutation instead of serving its old snapshot', async () => {
  const cache = new ReadCache();
  let resolve!: (value: string) => void;
  const load = vi
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise<string>((done) => {
          resolve = done;
        }),
    )
    .mockResolvedValue('new');
  const reading = cache.read('/platform/schools', load);
  await Promise.resolve();
  cache.invalidate();
  resolve('old');
  expect(await reading).toBe('new');
  expect(load).toHaveBeenCalledTimes(2);
});
