import { expect, it } from 'vitest';
import { schoolNavigation } from './schoolNavigation';
it('shows only granted settings groups and falls back to an accessible group', () => {
  const result = schoolNavigation(['roles.view'], 'Classes');
  expect(result.available.map((section) => section.name)).toEqual([
    'Roles & Permissions',
    'Data & Security',
  ]);
  expect(result.active).toBe('Roles & Permissions');
  expect(result.redirect).toBe(true);
});
it('keeps account settings available without grants and rejects unknown tabs', () => {
  expect(schoolNavigation([], 'General')).toMatchObject({
    active: 'Data & Security',
    redirect: true,
  });
  expect(schoolNavigation([], 'Data & Security')).toMatchObject({
    active: 'Data & Security',
    redirect: false,
  });
  expect(schoolNavigation(['roles.manage'], null).active).toBe('Data & Security');
  expect(schoolNavigation(['school.profile.view'], 'Unknown').active).toBe('General');
});
it('maps previous deep links into the familiar settings groups without granting access', () => {
  const permissions = ['school.profile.view', 'roles.view', 'memberships.view', 'audit.view'];
  expect(schoolNavigation(permissions).active).toBe('General');
  expect(schoolNavigation(permissions, 'Activity')).toMatchObject({
    active: 'Data & Security',
    redirect: true,
  });
  expect(schoolNavigation(permissions, 'Members').active).toBe('Roles & Permissions');
  expect(schoolNavigation(permissions).available).toHaveLength(3);
  expect(schoolNavigation(['students.view'], 'Classes').active).toBe('Data & Security');
});
