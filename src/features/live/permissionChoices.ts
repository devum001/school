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
