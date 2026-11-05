export const permissionGroup = (permission: string) =>
  permission.endsWith('.view') || ['attendance.self', 'teaching.self'].includes(permission)
    ? 'view'
    : 'manage';
export function permissionDependencies(permission: string, available: readonly string[]) {
  const base = permission.slice(0, permission.lastIndexOf('.'));
  const view = `${base}.view`;
  return [
    ...new Set([
      permission,
      ...([
        'student-attendance.assigned',
        'academics.assigned.view',
        'academics.assigned.manage',
      ].includes(permission) && available.includes('teaching.self')
        ? ['teaching.self']
        : []),
      ...(permissionGroup(permission) === 'manage' && available.includes(view) ? [view] : []),
    ]),
  ];
}
export function togglePermission(
  current: string[],
  permission: string,
  checked: boolean,
  available: readonly string[],
) {
  if (checked) return [...new Set([...current, ...permissionDependencies(permission, available)])];
  return current.filter(
    (p) =>
      p !== permission &&
      !(
        permissionGroup(permission) === 'view' &&
        permissionDependencies(p, available).includes(permission)
      ),
  );
}

export const permissionModule = (permission: string) => {
  const key = permission.split('.')[0];
  return (
    (
      {
        overview: 'Dashboard',
        teaching: 'Assigned teaching',
        students: 'Students',
        staff: 'Staff',
        attendance: 'Staff attendance',
        'student-attendance': 'Student attendance',
        assignments: 'Staff assignments',
        academics: 'Academics & reports',
        leave: 'Leave management',
        payroll: 'Payroll',
        fees: 'Fees',
        contacts: 'Quick Connect',
        memberships: 'School accounts',
        roles: 'Roles & permissions',
        audit: 'Audit reports',
        school: 'School settings',
        'academic-years': 'Academic years',
        classes: 'Classes',
        sections: 'Sections',
        subjects: 'Subjects',
      } as Record<string, string>
    )[key] || key
  );
};
export const roleSuggestions: Record<string, string[]> = {
  'Read-only school overview': [
    'overview.view',
    'students.view',
    'staff.view',
    'attendance.view',
    'classes.view',
    'sections.view',
    'subjects.view',
    'academics.view',
  ],
  Principal: [
    'overview.view',
    'students.view',
    'staff.view',
    'attendance.view',
    'leave.approve',
    'leave.reject',
    'assignments.view',
    'academics.view',
  ],
  Teacher: [
    'teaching.self',
    'attendance.self',
    'student-attendance.assigned',
    'academics.assigned.view',
    'academics.assigned.manage',
  ],
};
