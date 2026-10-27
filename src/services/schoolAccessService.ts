import { z } from 'zod';
import { apiService, ApiError } from './apiService';
const id = z.string().regex(/^[a-f\d]{24}$/i);
const roleSchema = z.object({
  id,
  name: z.string(),
  description: z.string().optional(),
  memberCount: z.number().optional(),
  builtinKey: z.literal('owner').optional(),
  permissions: z.array(z.string()),
});
const memberSchema = z.object({
  id,
  schoolId: id,
  userId: id,
  roleId: id,
  status: z.enum(['active', 'suspended']),
  user: z.object({ name: z.string(), email: z.string() }).nullable().optional(),
  roleName: z.string().nullable().optional(),
});
const eventSchema = z.object({
  id,
  action: z.string(),
  actorType: z.enum(['operator', 'user']),
  actorUserId: id.optional(),
  targetId: id.optional(),
  createdAt: z.string(),
  requestId: z.string(),
});
const contextSchema = z.object({
  schoolId: id,
  membershipId: id,
  roleId: id,
  owner: z.boolean(),
  permissions: z.array(z.string()),
});
const catalogSchema = z.object({
  permissions: z.array(z.string()),
  presets: z.record(
    z.string(),
    z.object({ view: z.array(z.string()), manage: z.array(z.string()) }),
  ),
});
export type Role = z.infer<typeof roleSchema>;
export type Member = z.infer<typeof memberSchema>;
export type AuditEvent = z.infer<typeof eventSchema>;
export type SchoolAccess = z.infer<typeof contextSchema>;
export type PermissionCatalog = z.infer<typeof catalogSchema>;
export type Page<T> = { items: T[]; nextCursor: string | null };
function parse<T>(schema: z.ZodType<T>, raw: unknown): T {
  const result = schema.safeParse(raw);
  if (!result.success)
    throw new ApiError(
      0,
      'INVALID_RESPONSE',
      'The server response could not be read. Please refresh.',
    );
  return result.data;
}
function path(schoolId: string, resource: string, cursor?: string) {
  return `/schools/${encodeURIComponent(schoolId)}/${resource}${cursor ? `?after=${encodeURIComponent(cursor)}` : ''}`;
}
async function list<T>(
  schema: z.ZodType<T>,
  schoolId: string,
  resource: string,
  signal?: AbortSignal,
  cursor?: string,
): Promise<Page<T>> {
  return parse(
    z.object({ items: z.array(schema), nextCursor: id.nullable() }),
    await apiService.request(path(schoolId, resource, cursor), { signal }),
  );
}
export const schoolAccessService = {
  async context(schoolId: string, signal?: AbortSignal) {
    const context = parse(
      contextSchema,
      await apiService.request(path(schoolId, 'memberships/me'), { signal }),
    );
    if (context.schoolId !== schoolId)
      throw new ApiError(0, 'INVALID_RESPONSE', 'The school access response could not be read.');
    return context;
  },
  async catalog(signal?: AbortSignal) {
    return parse(catalogSchema, await apiService.request('/permissions', { signal }));
  },
  roles: (schoolId: string, signal?: AbortSignal, cursor?: string) =>
    list(roleSchema, schoolId, 'roles', signal, cursor),
  async allRoles(schoolId: string, signal?: AbortSignal) {
    const roles: Role[] = [];
    const cursors = new Set<string>();
    let cursor: string | undefined;
    do {
      const page = await schoolAccessService.roles(schoolId, signal, cursor);
      roles.push(...page.items);
      cursor = page.nextCursor ?? undefined;
      if (cursor && cursors.has(cursor))
        throw new ApiError(0, 'INVALID_RESPONSE', 'The role list could not be read.');
      if (cursor) cursors.add(cursor);
    } while (cursor);
    return roles;
  },
  async members(schoolId: string, signal?: AbortSignal, cursor?: string) {
    const result = await list(memberSchema, schoolId, 'memberships', signal, cursor);
    if (result.items.some((member) => member.schoolId !== schoolId))
      throw new ApiError(0, 'INVALID_RESPONSE', 'The member list could not be read.');
    return result;
  },
  audit: (schoolId: string, signal?: AbortSignal, cursor?: string) =>
    list(eventSchema, schoolId, 'audit-events', signal, cursor),
  async saveRole(
    schoolId: string,
    input: { name: string; permissions: string[]; description?: string },
    roleId?: string,
  ) {
    return parse(
      roleSchema,
      await apiService.request(
        path(schoolId, `roles${roleId ? `/${encodeURIComponent(roleId)}` : ''}`),
        { method: roleId ? 'PATCH' : 'POST', body: input },
      ),
    );
  },
  async deleteRole(schoolId: string, roleId: string) {
    return parse(
      z.object({ deleted: z.literal(true) }),
      await apiService.request(path(schoolId, `roles/${encodeURIComponent(roleId)}`), {
        method: 'DELETE',
      }),
    );
  },
  async addMember(schoolId: string, email: string, roleId: string) {
    return parse(
      memberSchema,
      await apiService.request(path(schoolId, 'memberships'), {
        method: 'POST',
        body: { email, roleId },
      }),
    );
  },
  async updateMember(
    schoolId: string,
    membershipId: string,
    input: { roleId?: string; status?: 'active' | 'suspended' },
  ) {
    return parse(
      memberSchema,
      await apiService.request(path(schoolId, `memberships/${encodeURIComponent(membershipId)}`), {
        method: 'PATCH',
        body: input,
      }),
    );
  },
  async suspendMember(schoolId: string, membershipId: string) {
    return parse(
      memberSchema,
      await apiService.request(path(schoolId, `memberships/${encodeURIComponent(membershipId)}`), {
        method: 'DELETE',
      }),
    );
  },
};
export function canAssign(access: SchoolAccess, role: Role) {
  return (
    (!role.builtinKey || access.owner) &&
    role.permissions.every((permission) => access.permissions.includes(permission))
  );
}
export function accessError(error: unknown, action?: 'member' | 'role') {
  if (error instanceof ApiError) {
    if (error.code === 'LAST_USABLE_OWNER') return error.message;
    if (error.status === 409 && action === 'role')
      return 'This role name may already exist, or the role is protected or still assigned to members (including suspended members).';
    if (error.status === 409 && action === 'member')
      return 'This account may already be a member. The last active owner must also remain active with the Owner role.';
    if (error.status === 404 && action === 'member')
      return 'The account, role, or school is unavailable. Adding a member requires an existing active account.';
    return error.message;
  }
  return 'The request could not be completed. Refresh before retrying.';
}
export const permissionLabel = (permission: string) =>
  ({
    'overview.view': 'View school overview',
    'teaching.self': 'View own assigned classes and students',
    'student-attendance.view': 'View school student attendance',
    'student-attendance.manage': 'Manage school student attendance',
    'student-attendance.assigned': 'Mark attendance in assigned classes',
    'academics.view': 'View school tests and results',
    'academics.manage': 'Manage school tests and marks',
    'academics.assigned.view': 'View tests and results for assigned subjects',
    'academics.assigned.manage': 'Manage tests and marks for assigned subjects',
    'staff.view': 'View staff profiles',
    'staff.manage': 'Manage staff and imports',
    'students.view': 'View students and enrollments',
    'students.manage': 'Manage students and imports',
    'assignments.view': 'View teaching assignments',
    'assignments.manage': 'Manage teaching assignments',
    'school.profile.view': 'View school profile',
    'school.profile.manage': 'Manage school profile',
    'academic-years.view': 'View academic years',
    'academic-years.manage': 'Manage academic years',
    'classes.view': 'View classes',
    'classes.manage': 'Manage classes',
    'sections.view': 'View sections',
    'sections.manage': 'Manage sections',
    'subjects.view': 'View subjects',
    'subjects.manage': 'Manage subjects',
    'roles.view': 'View roles',
    'roles.manage': 'Manage roles',
    'attendance.self': 'Own attendance and salary',
    'attendance.manage': 'Review staff attendance and leave',
    'fees.view': 'View student fees and receipts',
    'fees.manage': 'Set up fees, installments and opening balances',
    'fees.approve': 'Approve fee concessions and scholarships',
    'fees.collect': 'Collect student payments and issue receipts',
    'fees.reverse': 'Reverse incorrect fee payments',
    'payroll.view': 'View staff salaries',
    'payroll.manage': 'Manage salary setup and payroll drafts',
    'payroll.approve': 'Approve monthly payroll',
    'payroll.pay': 'Record salary payments and advances',
    'memberships.view': 'View members',
    'memberships.manage': 'Manage members',
    'audit.view': 'View activity',
  })[permission] ?? permission;
