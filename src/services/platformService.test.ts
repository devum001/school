import { afterEach, expect, it, vi } from 'vitest';
import { apiService, ApiError } from './apiService';
import { parseSession } from './authService';
import { platformService as api, platformError, validateNewPassword } from './platformService';
const id = 'a'.repeat(24);
afterEach(() => vi.restoreAllMocks());
it('treats legacy sessions as ordinary users and rejects unknown platform roles', () => {
  const session = {
    user: { id, email: 'test@example.test', name: 'User' },
    memberships: [],
    expiresAt: '2030-01-01T00:00:00Z',
  };
  expect(parseSession(session).user.platformRole).toBe('user');
  expect(
    parseSession({ ...session, user: { ...session.user, platformRole: 'super_admin' } }).user
      .platformRole,
  ).toBe('super_admin');
  expect(() =>
    parseSession({ ...session, user: { ...session.user, platformRole: 'owner' } }),
  ).toThrow();
});
it('passes only explicit platform actions and safely encodes email filters', async () => {
  const request = vi
    .spyOn(apiService, 'request')
    .mockResolvedValue({ items: [], nextCursor: null });
  await api.users(undefined, id, 'owner+test@example.test');
  expect(request.mock.calls[0][0]).toBe(
    `/platform/users?after=${id}&email=owner%2Btest%40example.test`,
  );
  request.mockResolvedValue({
    id,
    name: 'School',
    slug: 'school',
    code: null,
    email: null,
    phone: null,
    timezone: 'UTC',
    status: 'archived',
  });
  await api.archiveSchool(id);
  expect(request).toHaveBeenLastCalledWith(`/platform/schools/${id}`, { method: 'DELETE' });
  await api.updateSchool(id, { status: 'active' });
  expect(request).toHaveBeenLastCalledWith(`/platform/schools/${id}`, {
    method: 'PATCH',
    body: { status: 'active' },
  });
  request.mockResolvedValue({ reset: true });
  await api.resetPassword(id, 'Test only password 2026!');
  expect(request).toHaveBeenLastCalledWith(`/platform/users/${id}/password`, {
    method: 'POST',
    body: { password: 'Test only password 2026!' },
  });
});
it('rejects malformed platform lists and provides safe conflicts', async () => {
  vi.spyOn(apiService, 'request').mockResolvedValue({
    items: [{ id, passwordHash: 'private' }],
    nextCursor: null,
  });
  await expect(api.users()).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  expect(platformError(new ApiError(409, 'CONFLICT', 'private'))).not.toContain('private');
  expect(platformError(new Error('private'))).not.toContain('private');
});
it('validates password confirmation and UTF-8 length before sending a new credential', () => {
  expect(validateNewPassword('A test passphrase 2026!', 'A test passphrase 2026!')).toBe('');
  expect(validateNewPassword('short', 'short')).not.toBe('');
  expect(validateNewPassword('x'.repeat(7), 'x'.repeat(7))).not.toBe('');
  expect(validateNewPassword('x'.repeat(8), 'x'.repeat(8))).toBe('');
  expect(validateNewPassword('x'.repeat(64), 'x'.repeat(64))).toBe('');
  expect(validateNewPassword('x'.repeat(65), 'x'.repeat(65))).not.toBe('');
  expect(validateNewPassword('abc\0defg', 'abc\0defg')).not.toBe('');
  expect(validateNewPassword('A test passphrase 2026!', 'different')).not.toBe('');
  expect(validateNewPassword('界'.repeat(25), '界'.repeat(25))).not.toBe('');
});
