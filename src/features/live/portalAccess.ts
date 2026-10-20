/** Only connected live areas are navigable. API authorization remains authoritative. */
export function portalAccess(
  permissions: readonly string[],
  context: { selfLinked?: boolean } = {},
) {
  const can = (key: string) => permissions.includes(key);
  const own = (key: string) => context.selfLinked !== false && can(key);
  const allowed = (path: string) => {
    if (path === '/' || path === '/overview') return can('overview.view') || own('teaching.self');
    if (path === '/classes') return can('classes.view') || own('teaching.self');
    if (path === '/academics') return can('academics.view') || own('academics.assigned.view');
    if (path === '/attendance') return can('student-attendance.view') || own('teaching.self');
    if (path === '/staff/self') return own('attendance.self');
    if (path.startsWith('/students')) return can('students.view');
    if (path.startsWith('/teachers') || path === '/staff') return can('staff.view');
    if (path === '/fees') return can('payroll.view');
    if (path === '/attendance/staff') return can('attendance.manage');
    return path === '/settings';
  };
  const home =
    can('overview.view') || own('teaching.self')
      ? '/'
      : can('school.profile.view')
        ? '/settings'
        : own('attendance.self')
          ? '/staff/self'
          : can('students.view')
            ? '/students'
            : can('staff.view')
              ? '/staff'
              : can('payroll.view')
                ? '/fees'
                : can('attendance.manage')
                  ? '/attendance/staff'
                  : '/settings';
  return { allowed, home };
}
