import { expect, it } from 'vitest';
import { portalAccess } from './portalAccess';
import { permissionGroup, togglePermission } from './permissionChoices';
it('personal teacher access excludes staff directory and other salaries', () => {
  const access = portalAccess(['attendance.self']);
  expect(access.home).toBe('/staff/self');
  expect(access.allowed('/staff/self')).toBe(true);
  expect(access.allowed('/staff/punch')).toBe(true);
  for (const route of [
    '/students',
    '/teachers',
    '/staff',
    '/fees',
    '/attendance/staff',
    '/academics',
  ])
    expect(access.allowed(route)).toBe(false);
  expect(access.allowed('/settings')).toBe(true);
});
it('permissions expose connected areas only', () => {
  const access = portalAccess(['students.view', 'payroll.view', 'attendance.manage']);
  expect(access.allowed('/students/123')).toBe(true);
  expect(access.allowed('/fees')).toBe(true);
  expect(access.allowed('/attendance/staff')).toBe(true);
  expect(access.allowed('/notifications')).toBe(false);
});
it('manage choices include reading dependencies and removing view removes dependent writes', () => {
  const all = [
    'payroll.view',
    'payroll.manage',
    'payroll.approve',
    'payroll.pay',
    'attendance.self',
  ];
  expect(permissionGroup('attendance.self')).toBe('view');
  expect(permissionGroup('payroll.approve')).toBe('manage');
  expect(togglePermission([], 'payroll.pay', true, all)).toEqual(['payroll.pay', 'payroll.view']);
  expect(
    togglePermission(
      ['payroll.view', 'payroll.pay', 'attendance.self'],
      'payroll.view',
      false,
      all,
    ),
  ).toEqual(['attendance.self']);
});
it('assigned teacher capabilities expose teaching areas but not school administration', () => {
  const access = portalAccess([
    'teaching.self',
    'student-attendance.assigned',
    'academics.assigned.view',
  ]);
  expect(access.home).toBe('/');
  for (const path of ['/', '/classes', '/attendance', '/academics'])
    expect(access.allowed(path)).toBe(true);
  for (const path of ['/teachers', '/staff', '/students', '/fees', '/attendance/staff'])
    expect(access.allowed(path)).toBe(false);
  const available = ['teaching.self', 'academics.assigned.view', 'academics.assigned.manage'];
  expect(togglePermission([], 'academics.assigned.manage', true, available)).toEqual([
    'academics.assigned.manage',
    'teaching.self',
    'academics.assigned.view',
  ]);
});

it('an unlinked or archived staff account lands in account settings and cannot open self-service', () => {
  const access = portalAccess(['attendance.self', 'teaching.self', 'academics.assigned.view'], {
    selfLinked: false,
  });
  expect(access.home).toBe('/settings');
  for (const path of ['/', '/classes', '/attendance', '/academics', '/staff/self', '/staff/punch'])
    expect(access.allowed(path)).toBe(false);
  expect(access.allowed('/settings')).toBe(true);
});

it('linked teacher navigation hides the staff attendance route even when the role has broad attendance permission', () => {
  const permissions = [
    'overview.view',
    'student-attendance.view',
    'attendance.manage',
    'attendance.self',
  ];
  const teacher = portalAccess(permissions, { selfLinked: true, teacherScoped: true });
  expect(teacher.home).toBe('/staff/punch');
  expect(teacher.allowed('/overview')).toBe(true);
  expect(teacher.allowed('/attendance')).toBe(true);
  expect(teacher.allowed('/attendance/staff')).toBe(false);
  expect(portalAccess(permissions).allowed('/attendance/staff')).toBe(true);
});
