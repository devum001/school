const sections = [
  { name: 'General', permissions: ['school.profile.view'] },
  { name: 'Classes, Sections & Grades', permissions: ['classes.view'] },
  { name: 'Academic years', permissions: ['academic-years.view'] },
  { name: 'Staff & Payroll', permissions: ['staff.view'] },
  { name: 'Roles & Permissions', permissions: ['roles.view', 'memberships.view'] },
  { name: 'Data & Security', permissions: [] },
] as const;
const aliases: Record<string, string> = {
  Setup: 'General',
  Classes: 'Classes, Sections & Grades',
  Years: 'Academic years',
  Staff: 'Staff & Payroll',
  Roles: 'Roles & Permissions',
  Members: 'Roles & Permissions',
  Activity: 'Data & Security',
  Account: 'Data & Security',
  Overview: 'General',
};
export function schoolNavigation(permissions: readonly string[], requested?: string | null) {
  const available = sections.filter(
    (s) => !s.permissions.length || s.permissions.some((p) => permissions.includes(p)),
  );
  const canonical = requested ? (aliases[requested] ?? requested) : undefined;
  const active = available.find((s) => s.name === canonical) ?? available[0];
  return {
    available,
    active: active.name,
    redirect: Boolean(requested && requested !== active.name),
  };
}
