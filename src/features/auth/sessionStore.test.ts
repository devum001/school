import { beforeEach, expect, it, vi } from 'vitest';
import { authService } from '../../services/authService';
import { ApiError } from '../../services/apiService';
import { sessionStore } from './sessionStore';
const events = vi.hoisted(() => ({ unauthorized: undefined as (() => void) | undefined }));
vi.mock('../../services/apiService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/apiService')>();
  return {
    ...actual,
    apiService: {
      onUnauthorized(listener: () => void) {
        events.unauthorized = listener;
        return () => {};
      },
    },
  };
});
vi.mock('../../services/authService', () => ({
  authService: { session: vi.fn(), login: vi.fn(), logout: vi.fn() },
}));
const session = {
  user: { platformRole: 'user' as const, id: 'user', email: 'user@example.test', name: 'User' },
  expiresAt: '2030-01-01T00:00:00Z',
  memberships: [
    {
      id: 'member',
      userId: 'user',
      roleId: 'role',
      schoolId: 'a'.repeat(24),
      status: 'active' as const,
    },
  ],
};
beforeEach(async () => {
  vi.resetAllMocks();
  await sessionStore.logout();
});
it.each([false, true])(
  'opens anonymously without an expiry warning (global event: %s)',
  async (notify) => {
    vi.mocked(authService.session).mockImplementation(async () => {
      if (notify) events.unauthorized!();
      throw new ApiError(401, 'UNAUTHENTICATED', 'Your session has expired. Please sign in again.');
    });
    await sessionStore.restore();
    expect(sessionStore.getSnapshot()).toMatchObject({
      status: 'anonymous',
      session: null,
      schoolId: null,
    });
    expect(sessionStore.getSnapshot().error).toBeUndefined();
  },
);
it.each([false, true])('warns when a known session expires (global event: %s)', async (notify) => {
  vi.mocked(authService.session).mockResolvedValueOnce(session);
  await sessionStore.restore();
  vi.mocked(authService.session).mockImplementation(async () => {
    if (notify) events.unauthorized!();
    throw new ApiError(401, 'UNAUTHENTICATED', 'Unauthorized');
  });
  await sessionStore.restore();
  expect(sessionStore.getSnapshot()).toMatchObject({
    status: 'anonymous',
    session: null,
    schoolId: null,
    error: 'Your session has expired. Please sign in again.',
  });
  await sessionStore.logout();
  await sessionStore.restore();
  expect(sessionStore.getSnapshot().error).toBeUndefined();
});
it('restores a session, chooses a membership, and rejects arbitrary school selection', async () => {
  vi.mocked(authService.session).mockResolvedValue(session);
  await sessionStore.restore();
  expect(sessionStore.getSnapshot()).toMatchObject({
    status: 'authenticated',
    schoolId: 'a'.repeat(24),
  });
  sessionStore.selectSchool('b'.repeat(24));
  expect(sessionStore.getSnapshot().schoolId).toBe('a'.repeat(24));
});
it('login inspects the session only after successful authentication', async () => {
  vi.mocked(authService.session).mockResolvedValue(session);
  await sessionStore.login('user@example.test', 'private password');
  expect(authService.login).toHaveBeenCalled();
  expect(authService.session).toHaveBeenCalled();
  vi.mocked(authService.login).mockRejectedValue(new ApiError(401, 'UNAUTHENTICATED', 'not shown'));
  await expect(sessionStore.login('bad@example.test', 'wrong')).rejects.toThrow(
    'Email or password is incorrect',
  );
});
it('keeps an authenticated session on logout failure and clears it on success', async () => {
  vi.mocked(authService.session).mockResolvedValue(session);
  await sessionStore.restore();
  vi.mocked(authService.logout).mockRejectedValueOnce(
    new ApiError(0, 'NETWORK', 'Network failure'),
  );
  await expect(sessionStore.logout()).rejects.toThrow('Network failure');
  expect(sessionStore.getSnapshot().status).toBe('authenticated');
  await sessionStore.logout();
  expect(sessionStore.getSnapshot()).toMatchObject({
    status: 'anonymous',
    session: null,
    schoolId: null,
  });
});
it('clears school data after expiration and keeps unavailable backend distinct from signed out', async () => {
  vi.mocked(authService.session).mockRejectedValueOnce(
    new ApiError(401, 'UNAUTHENTICATED', 'Expired'),
  );
  await sessionStore.restore();
  expect(sessionStore.getSnapshot()).toMatchObject({ status: 'anonymous', session: null });
  vi.mocked(authService.session).mockRejectedValueOnce(
    new ApiError(503, 'SERVICE_UNAVAILABLE', 'Unavailable'),
  );
  await sessionStore.restore();
  expect(sessionStore.getSnapshot()).toMatchObject({ status: 'error', session: null });
});
it('ignores an old restore response after a later request has signed out', async () => {
  let resolve!: (value: typeof session) => void;
  vi.mocked(authService.session).mockReturnValue(
    new Promise((done) => {
      resolve = done;
    }),
  );
  const restoring = sessionStore.restore();
  await sessionStore.logout();
  resolve(session);
  await restoring;
  expect(sessionStore.getSnapshot().status).toBe('anonymous');
});

it('shares session initialization and does not refetch on application remount', async () => {
  let resolve!: (value: typeof session) => void;
  vi.mocked(authService.session).mockReturnValue(
    new Promise((done) => {
      resolve = done;
    }),
  );
  const first = sessionStore.restore();
  const remount = sessionStore.initialize();
  const concurrent = sessionStore.restore();
  expect(authService.session).toHaveBeenCalledOnce();
  resolve(session);
  await Promise.all([first, remount, concurrent]);
  await sessionStore.initialize();
  expect(authService.session).toHaveBeenCalledOnce();
});
it('keeps the authenticated workspace and school selection during session revalidation', async () => {
  const withSchools = {
    ...session,
    memberships: [...session.memberships, { ...session.memberships[0], schoolId: 'b'.repeat(24) }],
  };
  vi.mocked(authService.session).mockResolvedValueOnce(withSchools);
  await sessionStore.restore();
  sessionStore.selectSchool('b'.repeat(24));
  let resolve!: (value: typeof session) => void;
  vi.mocked(authService.session).mockReturnValue(
    new Promise((done) => {
      resolve = done;
    }),
  );
  const validating = sessionStore.restore();
  expect(sessionStore.getSnapshot()).toMatchObject({
    status: 'authenticated',
    schoolId: 'b'.repeat(24),
  });
  resolve(withSchools);
  await validating;
  expect(sessionStore.getSnapshot().schoolId).toBe('b'.repeat(24));
});
