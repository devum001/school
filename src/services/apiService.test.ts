import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, ApiService } from './apiService';
import { parseRuntimeConfig } from './runtimeConfig';
const ok = (data: unknown) =>
  new Response(JSON.stringify({ status: 200, data, error: null }), { status: 200 });
const token = () => `nonce.${Date.now() + 3600000}.signature`;
afterEach(() => vi.restoreAllMocks());
describe('API foundation', () => {
  it('uses cookies and coalesces CSRF acquisition before JSON mutations', async () => {
    const csrf = token();
    const transport = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(ok({ csrfToken: csrf }))
      .mockImplementation(async () => ok({ done: true }));
    const api = new ApiService('http://backend.test/api/v1', transport);
    await Promise.all([
      api.request('/one', { method: 'POST' }),
      api.request('/two', { method: 'POST' }),
    ]);
    expect(transport).toHaveBeenCalledTimes(3);
    for (const [, options] of transport.mock.calls) expect(options?.credentials).toBe('include');
    expect(transport.mock.calls[1][1]).toMatchObject({
      method: 'POST',
      body: '{}',
      headers: { 'X-CSRF-Token': csrf, 'Content-Type': 'application/json' },
    });
  });
  it('uses the rotated login token and refreshes expired tokens', async () => {
    const transport = vi
      .fn<typeof fetch>()
      .mockImplementation(async () => ok({ csrfToken: token() }));
    const api = new ApiService('http://backend.test', transport);
    const rotated = token();
    api.setCsrfToken(rotated);
    await api.request('/auth/logout', { method: 'POST' });
    expect(transport.mock.calls[0][1]?.headers).toMatchObject({ 'X-CSRF-Token': rotated });
    api.setCsrfToken('nonce.1000000000000.signature');
    await api.request('/mutation', { method: 'POST' });
    expect(transport.mock.calls[1][0]).toBe('http://backend.test/auth/csrf');
  });
  it.each([400, 401, 403, 404, 429, 503])(
    'sanitizes status %s without echoing server errors',
    async (status) => {
      const transport = vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response('private-server-secret', { status }));
      const api = new ApiService('http://backend.test', transport);
      const listener = vi.fn();
      api.onUnauthorized(listener);
      try {
        await api.request('/protected');
        throw new Error('Expected rejection');
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).status).toBe(status);
        expect((error as Error).message).not.toContain('private-server-secret');
      }
      expect(listener).toHaveBeenCalledTimes(status === 401 ? 1 : 0);
    },
  );
  it('distinguishes cancellation from network failure and rejects malformed envelopes', async () => {
    const controller = new AbortController();
    controller.abort();
    const transport = vi.fn<typeof fetch>().mockRejectedValue(new TypeError('private address'));
    const api = new ApiService('http://backend.test', transport);
    await expect(api.request('/profile', { signal: controller.signal })).rejects.toMatchObject({
      name: 'AbortError',
    });
    expect(transport).not.toHaveBeenCalled();
    await expect(api.request('/profile')).rejects.toMatchObject({ code: 'NETWORK' });
    transport.mockResolvedValue(ok(undefined));
    await expect(api.request('/profile')).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });
  it('does not replay a failed mutation automatically', async () => {
    const transport = vi.fn<typeof fetch>().mockResolvedValue(new Response('', { status: 403 }));
    const api = new ApiService('http://backend.test', transport);
    api.setCsrfToken(token());
    await expect(api.request('/auth/logout', { method: 'POST' })).rejects.toMatchObject({
      status: 403,
    });
    expect(transport).toHaveBeenCalledTimes(1);
  });
  it('requires explicit valid live configuration and never changes live into demo on failure', () => {
    expect(parseRuntimeConfig({}).mode).toBe('demo');
    expect(() => parseRuntimeConfig({ mode: 'invalid' })).toThrow();
    expect(() => parseRuntimeConfig({ mode: 'live' })).toThrow();
    expect(() =>
      parseRuntimeConfig({ mode: 'live', baseUrl: 'https://user:secret@example.test' }),
    ).toThrow();
    expect(
      parseRuntimeConfig({ mode: 'live', baseUrl: 'https://api.example.test/api/v1/' }),
    ).toEqual({ mode: 'live', baseUrl: 'https://api.example.test/api/v1' });
  });
});
it.each(['PATCH', 'DELETE'] as const)(
  'sends CSRF and JSON for %s without retrying',
  async (method) => {
    const csrf = token();
    const transport = vi.fn<typeof fetch>().mockResolvedValue(ok({ done: true }));
    const api = new ApiService('http://backend.test', transport);
    api.setCsrfToken(csrf);
    await api.request('/roles/test', { method });
    expect(transport).toHaveBeenCalledTimes(1);
    expect(transport.mock.calls[0][1]).toMatchObject({
      method,
      body: '{}',
      credentials: 'include',
      headers: { 'X-CSRF-Token': csrf, 'Content-Type': 'application/json' },
    });
  },
);
it('identifies missing auth routes without implying a school was deleted', async () => {
  const api = new ApiService(
    'http://backend.test',
    vi.fn<typeof fetch>().mockResolvedValue(new Response('private-secret', { status: 404 })),
  );
  await expect(api.request('/auth/session')).rejects.toThrow('authentication API is unavailable');
});

const renewalRequired = () =>
  new Response(
    JSON.stringify({
      status: 401,
      data: null,
      error: { code: 'REFRESH_REQUIRED' },
    }),
    { status: 401 },
  );

it('coalesces renewal, keeps JWTs in cookies, and retries rejected requests once', async () => {
  let renewed = false;
  let refreshes = 0;
  const csrf = token();
  const transport = vi.fn<typeof fetch>().mockImplementation(async (url) => {
    const path = String(url);
    if (path.endsWith('/auth/csrf')) return ok({ csrfToken: csrf });
    if (path.endsWith('/auth/refresh')) {
      refreshes++;
      await new Promise((resolve) => setTimeout(resolve, 5));
      renewed = true;
      return ok({ csrfToken: csrf });
    }
    return renewed ? ok({ done: true }) : renewalRequired();
  });
  const api = new ApiService('http://backend.test', transport);
  api.setCsrfToken(csrf);
  const listener = vi.fn();
  api.onUnauthorized(listener);
  const results = await Promise.all([
    api.request('/one'),
    api.request('/two', { method: 'POST', body: { name: 'Example' } }),
  ]);
  expect(results).toEqual([{ done: true }, { done: true }]);
  expect(refreshes).toBe(1);
  expect(listener).not.toHaveBeenCalled();
  for (const [, options] of transport.mock.calls) {
    expect(options?.credentials).toBe('include');
    expect(options?.headers).not.toHaveProperty('Authorization');
  }
  expect(transport.mock.calls.filter(([url]) => String(url).endsWith('/two'))).toHaveLength(2);
});

it('does not retry an ambiguous mutation failure or loop when renewed access is rejected', async () => {
  const transport = vi.fn<typeof fetch>().mockImplementation(async (url) => {
    if (String(url).endsWith('/auth/csrf') || String(url).endsWith('/auth/refresh'))
      return ok({ csrfToken: token() });
    return renewalRequired();
  });
  const api = new ApiService('http://backend.test', transport);
  await expect(api.request('/protected')).rejects.toMatchObject({ status: 401 });
  expect(
    transport.mock.calls.filter(([url]) => String(url).endsWith('/auth/refresh')),
  ).toHaveLength(1);
  const ambiguous = vi.fn<typeof fetch>().mockResolvedValue(new Response('', { status: 401 }));
  const other = new ApiService('http://backend.test', ambiguous);
  other.setCsrfToken(token());
  await expect(other.request('/mutation', { method: 'POST' })).rejects.toMatchObject({
    status: 401,
  });
  expect(ambiguous).toHaveBeenCalledTimes(1);
});

it('does not replay the original request when refresh fails or after logout', async () => {
  const transport = vi.fn<typeof fetch>().mockImplementation(async (url) => {
    if (String(url).endsWith('/auth/csrf')) return ok({ csrfToken: token() });
    if (String(url).endsWith('/auth/refresh')) return new Response('', { status: 401 });
    return renewalRequired();
  });
  const api = new ApiService('http://backend.test', transport);
  const listener = vi.fn();
  api.onUnauthorized(listener);
  await expect(api.request('/protected')).rejects.toMatchObject({ status: 401 });
  expect(listener).toHaveBeenCalledOnce();
  expect(transport.mock.calls.filter(([url]) => String(url).endsWith('/protected'))).toHaveLength(
    1,
  );

  let resolve!: (response: Response) => void;
  const pendingTransport = vi.fn<typeof fetch>().mockImplementation(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  const pendingApi = new ApiService('http://backend.test', pendingTransport);
  const request = pendingApi.request('/protected');
  pendingApi.clearSession();
  resolve(renewalRequired());
  await expect(request).rejects.toMatchObject({ name: 'AbortError' });
  expect(pendingTransport).toHaveBeenCalledOnce();
});

it('shares resource reads, invalidates after mutations, and clears cache on logout', async () => {
  const transport = vi.fn<typeof fetch>().mockImplementation(async () => ok({ items: [] }));
  const api = new ApiService('http://backend.test', transport);
  await Promise.all([api.request('/platform/schools'), api.request('/platform/schools')]);
  await api.request('/platform/schools');
  expect(transport).toHaveBeenCalledTimes(1);
  api.setCsrfToken(token());
  await api.request('/platform/schools', { method: 'POST', body: {} });
  await api.request('/platform/schools');
  expect(transport).toHaveBeenCalledTimes(3);
  api.clearSession();
  await api.request('/platform/schools');
  expect(transport).toHaveBeenCalledTimes(4);
});

it('exposes only recognized student field validation and retains the specific message', async () => {
  const transport = vi
    .fn<typeof fetch>()
    .mockResolvedValue(
      new Response(
        JSON.stringify({
          data: null,
          status: 409,
          error: {
            code: 'STUDENT_FIELDS_INVALID',
            message: 'ignored raw message',
            fields: {
              admissionNumber: 'Admission number already exists.',
              internal: 'private detail',
            },
          },
        }),
        { status: 409 },
      ),
    );
  const api = new ApiService('http://backend.test', transport);
  await expect(api.request('/schools/one/students')).rejects.toMatchObject({
    status: 409,
    fields: { admissionNumber: 'Admission number already exists.' },
    message: 'Admission number already exists.',
  });
  try {
    await api.request('/schools/one/students');
  } catch (error) {
    expect((error as ApiError).fields).not.toHaveProperty('internal');
  }
});
