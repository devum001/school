import { afterEach, expect, it, vi } from 'vitest';
import { apiService, ApiError } from './apiService';
import {
  schoolAccessService as api,
  canAssign,
  accessError,
  type SchoolAccess,
} from './schoolAccessService';
const schoolId = 'a'.repeat(24);
const roleId = 'b'.repeat(24);
const memberId = 'c'.repeat(24);
const context: SchoolAccess = {
  schoolId,
  roleId,
  membershipId: memberId,
  owner: false,
  permissions: ['roles.view', 'roles.manage'],
};
afterEach(() => vi.restoreAllMocks());
it('binds create, edit and delete to the selected school and correct methods', async () => {
  const request = vi
    .spyOn(apiService, 'request')
    .mockResolvedValue({ id: roleId, name: 'Reader', permissions: [] });
  await api.saveRole(schoolId, { name: 'Reader', permissions: [] });
  expect(request).toHaveBeenLastCalledWith(`/schools/${schoolId}/roles`, {
    method: 'POST',
    body: { name: 'Reader', permissions: [] },
  });
  await api.saveRole(schoolId, { name: 'Viewer', permissions: [] }, roleId);
  expect(request).toHaveBeenLastCalledWith(`/schools/${schoolId}/roles/${roleId}`, {
    method: 'PATCH',
    body: { name: 'Viewer', permissions: [] },
  });
  request.mockResolvedValue({ deleted: true });
  await api.deleteRole(schoolId, roleId);
  expect(request).toHaveBeenLastCalledWith(`/schools/${schoolId}/roles/${roleId}`, {
    method: 'DELETE',
  });
});
it('loads all role pages for assignment and rejects repeated cursors', async () => {
  const request = vi
    .spyOn(apiService, 'request')
    .mockResolvedValueOnce({
      items: [{ id: roleId, name: 'One', permissions: [] }],
      nextCursor: roleId,
    })
    .mockResolvedValueOnce({
      items: [{ id: memberId, name: 'Two', permissions: [] }],
      nextCursor: null,
    });
  expect(await api.allRoles(schoolId)).toHaveLength(2);
  expect(request.mock.calls[1][0]).toBe(`/schools/${schoolId}/roles?after=${roleId}`);
  request.mockResolvedValue({ items: [], nextCursor: roleId });
  await expect(api.allRoles(schoolId)).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
});
it('rejects foreign-school context and member responses', async () => {
  const request = vi
    .spyOn(apiService, 'request')
    .mockResolvedValue({ ...context, schoolId: roleId });
  await expect(api.context(schoolId)).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  request.mockResolvedValue({
    items: [{ id: memberId, userId: memberId, schoolId: roleId, roleId, status: 'active' }],
    nextCursor: null,
  });
  await expect(api.members(schoolId)).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
});
it('does not imply view permission from manage, delegate stronger roles, or assign owner as a non-owner', () => {
  expect(canAssign(context, { id: roleId, name: 'Viewer', permissions: ['roles.view'] })).toBe(
    true,
  );
  expect(
    canAssign(
      { ...context, permissions: ['roles.manage'] },
      { id: roleId, name: 'Viewer', permissions: ['roles.view'] },
    ),
  ).toBe(false);
  expect(canAssign(context, { id: roleId, name: 'Strong', permissions: ['audit.view'] })).toBe(
    false,
  );
  expect(
    canAssign(context, { id: roleId, name: 'Owner', builtinKey: 'owner', permissions: [] }),
  ).toBe(false);
});
it('uses DELETE for suspension, PATCH for reactivation and keeps server details private', async () => {
  const member = { id: memberId, schoolId, userId: memberId, roleId, status: 'suspended' };
  const request = vi.spyOn(apiService, 'request').mockResolvedValue(member);
  await api.suspendMember(schoolId, memberId);
  expect(request).toHaveBeenLastCalledWith(`/schools/${schoolId}/memberships/${memberId}`, {
    method: 'DELETE',
  });
  await api.updateMember(schoolId, memberId, { status: 'active' });
  expect(request).toHaveBeenLastCalledWith(`/schools/${schoolId}/memberships/${memberId}`, {
    method: 'PATCH',
    body: { status: 'active' },
  });
  expect(accessError(new Error('private-secret'))).not.toContain('private-secret');
  expect(accessError(new ApiError(409, 'CONFLICT', 'private-secret'), 'member')).toContain(
    'last active owner',
  );
});
