import { z } from 'zod';
import type { DemoState } from '../types/domain';
import type {
  AccessModule,
  StaffAccessSettings,
  StaffLoginAccess,
  StaffRole,
} from '../types/staffAccess';
import { staffDirectory } from './staffStructure';
import { defaultStaffPayroll } from './settings';
import { roster } from './selectors';

export const ACCESS_MODULES = [
  'Students',
  'Attendance',
  'Fee Management',
  'Academics',
  'Staff',
  'Salary',
  'Notifications',
  'School Settings',
] as const;
export const PERMISSION_LEVELS = ['No Access', 'View', 'Manage'] as const;
const unique = (ids: string[]) => new Set(ids).size === ids.length;
export const staffRoleSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().trim().min(2).max(60),
    kind: z.enum(['owner', 'admin', 'teacher', 'accountant', 'office', 'custom']),
    scope: z.enum(['school', 'assigned']),
    permissions: z.record(z.enum(ACCESS_MODULES), z.enum(PERMISSION_LEVELS)),
  })
  .refine(
    (role) =>
      !/\b(students?|parents?|guardians?|pupils?)\b|विद्यार्थी|छात्र|अभिभावक/i.test(role.name),
    'Roles are for school staff only.',
  )
  .refine(
    (role) => role.kind !== 'teacher' || role.scope === 'assigned',
    'Teachers can access assigned classes / sections only.',
  )
  .refine(
    (role) =>
      role.kind !== 'owner' ||
      (role.scope === 'school' &&
        ACCESS_MODULES.every((module) => role.permissions[module] === 'Manage')),
    'Principal / Owner must retain full management access.',
  );
export const staffLoginAccessSchema = z.object({
  staffId: z.string().min(1),
  roleId: z.string().min(1),
  loginAllowed: z.boolean(),
  sectionIds: z.array(z.string()).refine(unique),
});
export const staffAccessSettingsSchema = z.object({
  schoolId: z.string(),
  roles: z
    .array(staffRoleSchema)
    .min(5)
    .refine((roles) => unique(roles.map((role) => role.id))),
  staff: z
    .array(staffLoginAccessSchema)
    .refine((staff) => unique(staff.map((member) => member.staffId))),
});
const permissions = (levels: readonly (typeof PERMISSION_LEVELS)[number][]) =>
  Object.fromEntries(
    ACCESS_MODULES.map((module, index) => [module, levels[index]]),
  ) as StaffRole['permissions'];
export const defaultStaffRoles: StaffRole[] = [
  {
    id: 'owner',
    name: 'Principal / Owner',
    kind: 'owner',
    scope: 'school',
    permissions: permissions(ACCESS_MODULES.map(() => 'Manage')),
  },
  {
    id: 'admin',
    name: 'Admin',
    kind: 'admin',
    scope: 'school',
    permissions: permissions(ACCESS_MODULES.map(() => 'Manage')),
  },
  {
    id: 'teacher',
    name: 'Teacher',
    kind: 'teacher',
    scope: 'assigned',
    permissions: permissions([
      'View',
      'Manage',
      'No Access',
      'Manage',
      'View',
      'No Access',
      'Manage',
      'No Access',
    ]),
  },
  {
    id: 'accountant',
    name: 'Accountant',
    kind: 'accountant',
    scope: 'school',
    permissions: permissions([
      'View',
      'View',
      'Manage',
      'No Access',
      'View',
      'Manage',
      'View',
      'No Access',
    ]),
  },
  {
    id: 'office',
    name: 'Office Staff',
    kind: 'office',
    scope: 'school',
    permissions: permissions([
      'Manage',
      'Manage',
      'View',
      'View',
      'View',
      'No Access',
      'Manage',
      'No Access',
    ]),
  },
];
export const ownerAccessId = (state: DemoState) => `owner:${state.school.id}`;
export function accessStaff(state: DemoState) {
  return staffDirectory(state, state.staffPayroll ?? defaultStaffPayroll).filter(
    (member) => member.schoolId === state.school.id,
  );
}
export function staffAccessFor(state: DemoState): StaffAccessSettings {
  const saved = state.staffAccess?.schoolId === state.school.id ? state.staffAccess : undefined;
  const roles = saved?.roles ?? structuredClone(defaultStaffRoles);
  const staff = accessStaff(state).map((member): StaffLoginAccess => {
    const existing = saved?.staff.find((access) => access.staffId === member.id);
    if (existing) {
      const role = roles.find((item) => item.id === existing.roleId);
      const sectionIds = existing.sectionIds.filter((id) =>
        state.sections.some((section) => section.id === id && section.schoolId === state.school.id),
      );
      return {
        ...existing,
        sectionIds,
        loginAllowed:
          existing.loginAllowed &&
          member.status === 'active' &&
          !!role &&
          (role.scope !== 'assigned' || sectionIds.length > 0),
      };
    }
    return {
      staffId: member.id,
      roleId: member.teacherId ? 'teacher' : 'office',
      loginAllowed: false,
      sectionIds: state.sections
        .filter(
          (section) =>
            section.schoolId === state.school.id &&
            !!member.teacherId &&
            section.teacherId === member.teacherId,
        )
        .map((section) => section.id),
    };
  });
  return { schoolId: state.school.id, roles, staff };
}
export function saveStaffRole(state: DemoState, input: StaffRole): DemoState {
  const role = staffRoleSchema.parse(input),
    access = staffAccessFor(state);
  const previous = access.roles.find((item) => item.id === role.id);
  if (
    previous &&
    (previous.kind !== role.kind || (previous.kind !== 'custom' && previous.name !== role.name))
  )
    throw new Error('Built-in roles cannot be renamed or replaced.');
  if (!previous && role.kind !== 'custom') throw new Error('Create a custom staff role.');
  if (
    access.roles.some(
      (item) => item.id !== role.id && item.name.toLowerCase() === role.name.toLowerCase(),
    )
  )
    throw new Error('A role with this name already exists.');
  return {
    ...state,
    staffAccess: {
      ...access,
      roles: previous
        ? access.roles.map((item) => (item.id === role.id ? role : item))
        : [...access.roles, role],
    },
  };
}
export function deleteStaffRole(state: DemoState, id: string): DemoState {
  const access = staffAccessFor(state),
    role = access.roles.find((item) => item.id === id);
  if (!role || role.kind !== 'custom') throw new Error('Only custom roles can be deleted.');
  if (access.staff.some((member) => member.roleId === id))
    throw new Error('Assign another role to its staff before deleting this role.');
  return {
    ...state,
    staffAccess: { ...access, roles: access.roles.filter((item) => item.id !== id) },
  };
}
export function saveStaffLoginAccess(state: DemoState, input: StaffLoginAccess): DemoState {
  const parsed = staffLoginAccessSchema.parse(input),
    access = staffAccessFor(state);
  const member = accessStaff(state).find((item) => item.id === parsed.staffId);
  if (!member)
    throw new Error(
      'Choose a staff member from this school. Students and guardians cannot have login access.',
    );
  const role = access.roles.find((item) => item.id === parsed.roleId);
  if (!role) throw new Error('Choose an existing staff role.');
  if (member.status !== 'active' && parsed.loginAllowed)
    throw new Error('Inactive staff cannot be allowed to log in.');
  if (
    parsed.sectionIds.some(
      (id) =>
        !state.sections.some(
          (section) => section.id === id && section.schoolId === state.school.id,
        ),
    )
  )
    throw new Error('Choose sections belonging to this school.');
  if (role.scope === 'assigned' && parsed.loginAllowed && !parsed.sectionIds.length)
    throw new Error('Assign at least one class / section before allowing login.');
  const entry = { ...parsed, sectionIds: role.scope === 'assigned' ? parsed.sectionIds : [] };
  return {
    ...state,
    staffAccess: {
      ...access,
      staff: access.staff.map((item) => (item.staffId === entry.staffId ? entry : item)),
    },
  };
}
/** Frontend access policy and preview; a real backend must enforce the same scope. */
export function staffPermission(state: DemoState, staffId: string, module: AccessModule) {
  if (staffId === ownerAccessId(state)) return 'Manage' as const;
  const access = staffAccessFor(state),
    member = accessStaff(state).find((item) => item.id === staffId);
  const entry = access.staff.find((item) => item.staffId === staffId);
  if (!member || member.status !== 'active' || !entry?.loginAllowed) return 'No Access' as const;
  return access.roles.find((role) => role.id === entry.roleId)?.permissions[module] ?? 'No Access';
}
export function scopedStaffStudents(
  state: DemoState,
  staffId: string,
  module: AccessModule = 'Students',
) {
  if (
    !['Students', 'Attendance', 'Fee Management', 'Academics', 'Notifications'].includes(module) ||
    staffPermission(state, staffId, module) === 'No Access'
  )
    return [];
  if (staffId === ownerAccessId(state)) return roster(state);
  const access = staffAccessFor(state),
    entry = access.staff.find((item) => item.staffId === staffId)!;
  const role = access.roles.find((item) => item.id === entry.roleId)!;
  return roster(state).filter(
    (row) =>
      row.enrollment.schoolId === state.school.id &&
      (role.scope === 'school' || entry.sectionIds.includes(row.enrollment.sectionId)),
  );
}
export function scopedStaffMembers(state: DemoState, staffId: string) {
  if (staffPermission(state, staffId, 'Staff') === 'No Access') return [];
  const access = staffAccessFor(state),
    roleId = access.staff.find((entry) => entry.staffId === staffId)?.roleId;
  return accessStaff(state).filter(
    (member) =>
      access.roles.find((role) => role.id === roleId)?.kind !== 'teacher' || member.id === staffId,
  );
}
