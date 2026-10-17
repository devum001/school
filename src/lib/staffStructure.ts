import { z } from 'zod';
import type { DemoState, StaffDepartment, StaffMember, StaffPayrollConfig } from '../types/domain';
import { getSchoolDate } from './dates';
import { whatsappPhone } from './reportShare';
import { staffSalarySchema } from './staffSalary';
import { saveTeacher } from './management';
import { imageDataSchema } from './ledgerSchemas';

const name = z.string().trim().min(1, 'Enter a name.').max(80);
const uniqueNames = (entries: { name: string }[]) =>
  new Set(entries.map((entry) => entry.name.toLowerCase())).size === entries.length;
const uniqueIds = (entries: { id: string }[]) =>
  new Set(entries.map((entry) => entry.id)).size === entries.length;
export const staffDepartmentSchema = z.object({
  id: z.string().min(1),
  name,
  designations: z
    .array(z.object({ id: z.string().min(1), name }))
    .max(60)
    .refine(uniqueNames, 'Designation names must be unique within the department.')
    .refine(uniqueIds, 'Designation identifiers must be unique.'),
});
export const departmentSetupSchema = z.object({
  departments: z
    .array(staffDepartmentSchema)
    .max(30)
    .refine(uniqueNames, 'Department names must be unique.')
    .refine(uniqueIds, 'Department identifiers must be unique.'),
});
export const EMPLOYMENT_TYPES = ['Full Time', 'Part Time', 'Contract'] as const;
export const staffMemberSchema = z.object({
  id: z.string(),
  schoolId: z.string(),
  teacherId: z.string().optional(),
  isTeachingStaff: z.boolean().optional(),
  qualification: z.string().max(150).optional(),
  photoDataUrl: imageDataSchema.optional(),
  name,
  staffId: z.string().optional(),
  departmentId: z.string(),
  designationId: z.string().optional(),
  designation: name.optional(),
  employmentType: z.enum(EMPLOYMENT_TYPES).optional(),
  salary: staffSalarySchema.optional(),
  salaryHistory: z
    .array(staffSalarySchema)
    .max(120)
    .refine(
      (versions) => new Set(versions.map((v) => v.effectiveFrom)).size === versions.length,
      'Keep one salary revision per month.',
    )
    .optional(),
  status: z.enum(['active', 'inactive']),
  email: z.string(),
  phone: z.string(),
  joinedOn: z.iso.date(),
});
const defaultNames: Record<string, string[]> = {
  Academics: ['Principal', 'PGT Teacher', 'TGT Teacher', 'PRT Teacher', 'Lab Assistant'],
  Accounts: ['Accountant', 'Cashier'],
  Administration: ['Admin', 'Receptionist', 'Office Assistant'],
  Transport: ['Driver', 'Conductor'],
  Support: ['Peon', 'Guard', 'Helper'],
};
const key = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
export const defaultStaffDepartments: StaffDepartment[] = Object.entries(defaultNames).map(
  ([department, roles]) => ({
    id: `department-${key(department)}`,
    name: department,
    designations: roles.map((role) => ({ id: `${key(department)}-${key(role)}`, name: role })),
  }),
);
export function migrateStaffSetup(legacy: { departments: string[]; designations: string[] }) {
  const departments = legacy.departments.map((department, index) => {
    const known = defaultStaffDepartments.find(
      (d) => d.name.toLowerCase() === department.toLowerCase(),
    );
    return known
      ? structuredClone(known)
      : { id: `department-${index}-${key(department)}`, name: department, designations: [] };
  });
  const oldDefaultRoles = ['Teacher', 'Principal', 'Accountant', 'Receptionist', 'Driver'];
  const wasDefault =
    legacy.designations.length === oldDefaultRoles.length &&
    oldDefaultRoles.every((name) => legacy.designations.includes(name));
  for (const role of legacy.designations) {
    if (wasDefault && role === 'Teacher') continue;
    if (
      departments.some((d) =>
        d.designations.some((r) => r.name.toLowerCase() === role.toLowerCase()),
      )
    )
      continue;
    // Existing generic teachers have no recorded seniority; preserve their role name.
    const target = role.toLowerCase().includes('teach')
      ? departments.find((d) => d.name.toLowerCase() === 'academics')
      : undefined;
    const department = target ?? departments[0];
    if (department)
      department.designations.push({
        id: `${department.id}-${key(role) || 'role'}-${department.designations.length}`,
        name: role,
      });
  }
  return departmentSetupSchema.parse({ departments });
}
export function staffDirectory(state: DemoState, config: StaffPayrollConfig): StaffMember[] {
  const academics =
    config.setup.departments.find((d) => d.id === 'department-academics') ??
    config.setup.departments.find((d) => d.name.toLowerCase() === 'academics');
  const records = (state.staffMembers ?? []).filter(
    (member) => member.schoolId === state.school.id,
  );
  const teachers = state.teachers
    .filter((teacher) => teacher.schoolId === state.school.id)
    .map((teacher) => {
      const assignment = records.find((r) => r.teacherId === teacher.id);
      return {
        id: assignment?.id ?? teacher.id,
        schoolId: state.school.id,
        teacherId: teacher.id,
        isTeachingStaff: true,
        qualification: teacher.qualification,
        photoDataUrl: teacher.photoDataUrl,
        name: teacher.name,
        staffId: teacher.staffId,
        email: teacher.email,
        phone: teacher.phone,
        joinedOn: teacher.joinedOn,
        status: teacher.status,
        departmentId: assignment?.departmentId ?? academics?.id ?? '',
        designationId: assignment?.designationId ?? '',
        designation:
          assignment?.designation ??
          config.setup.departments
            .find((d) => d.id === assignment?.departmentId)
            ?.designations.find((r) => r.id === assignment?.designationId)?.name ??
          teacher.subject,
        employmentType: assignment?.employmentType ?? ('Full Time' as const),
        salary: assignment?.salary,
        salaryHistory: assignment?.salaryHistory,
      };
    });
  return [...teachers, ...records.filter((record) => !record.teacherId)].sort((a, b) =>
    a.name.localeCompare(b.name, 'en-IN', { numeric: true }),
  );
}
export function saveStaffDepartment(
  state: DemoState,
  config: StaffPayrollConfig,
  input: string,
  id?: string,
): DemoState {
  const parsedName = name.parse(input),
    departments = config.setup.departments;
  if (id && !departments.some((d) => d.id === id)) throw new Error('Department not found.');
  if (departments.some((d) => d.id !== id && d.name.toLowerCase() === parsedName.toLowerCase()))
    throw new Error('This department name already exists.');
  const next = id
    ? departments.map((d) => (d.id === id ? { ...d, name: parsedName } : d))
    : [...departments, { id: crypto.randomUUID(), name: parsedName, designations: [] }];
  return {
    ...state,
    staffPayroll: { ...config, setup: departmentSetupSchema.parse({ departments: next }) },
  };
}
export function saveStaffDesignation(
  state: DemoState,
  config: StaffPayrollConfig,
  departmentId: string,
  input: string,
  id?: string,
): DemoState {
  const department = config.setup.departments.find((d) => d.id === departmentId);
  if (!department) throw new Error('Department not found.');
  const parsedName = name.parse(input);
  if (id && !department.designations.some((r) => r.id === id))
    throw new Error('Designation not found in this department.');
  if (
    department.designations.some(
      (r) => r.id !== id && r.name.toLowerCase() === parsedName.toLowerCase(),
    )
  )
    throw new Error('This designation already exists in the department.');
  const roles = id
    ? department.designations.map((r) => (r.id === id ? { ...r, name: parsedName } : r))
    : [...department.designations, { id: crypto.randomUUID(), name: parsedName }];
  return {
    ...state,
    staffPayroll: {
      ...config,
      setup: departmentSetupSchema.parse({
        departments: config.setup.departments.map((d) =>
          d.id === departmentId ? { ...d, designations: roles } : d,
        ),
      }),
    },
  };
}
export function deleteStaffDepartment(
  state: DemoState,
  config: StaffPayrollConfig,
  id: string,
): DemoState {
  if (!config.setup.departments.some((d) => d.id === id)) throw new Error('Department not found.');
  if (staffDirectory(state, config).some((member) => member.departmentId === id))
    throw new Error('Reassign this department’s staff before deleting it.');
  return {
    ...state,
    staffPayroll: {
      ...config,
      setup: { departments: config.setup.departments.filter((d) => d.id !== id) },
    },
  };
}
export function deleteStaffDesignation(
  state: DemoState,
  config: StaffPayrollConfig,
  departmentId: string,
  id: string,
): DemoState {
  const department = config.setup.departments.find((d) => d.id === departmentId);
  if (!department?.designations.some((r) => r.id === id)) throw new Error('Designation not found.');
  if (
    staffDirectory(state, config).some(
      (member) => member.departmentId === departmentId && member.designationId === id,
    )
  )
    throw new Error('Reassign staff with this designation before deleting it.');
  return {
    ...state,
    staffPayroll: {
      ...config,
      setup: {
        departments: config.setup.departments.map((d) =>
          d.id === departmentId
            ? { ...d, designations: d.designations.filter((r) => r.id !== id) }
            : d,
        ),
      },
    },
  };
}
export type StaffInput = Omit<StaffMember, 'id' | 'schoolId' | 'teacherId'>;
export function saveStaffMember(
  state: DemoState,
  config: StaffPayrollConfig,
  input: StaffInput,
  id?: string,
): DemoState {
  const existing = id ? staffDirectory(state, config).find((s) => s.id === id) : undefined;
  if (id && !existing) throw new Error('Staff member not found.');
  const department = config.setup.departments.find((d) => d.id === input.departmentId);
  if (!department) throw new Error('Choose a department from this school.');
  if (!input.designation && !department.designations.some((r) => r.id === input.designationId))
    throw new Error('Enter a designation for the selected department.');
  if (!existing && input.designation && !input.salary)
    throw new Error('Enter the monthly salary details.');
  const history = [
    ...(existing?.salaryHistory ?? []),
    ...(existing?.salary &&
    !existing.salaryHistory?.some((v) => v.effectiveFrom === existing.salary!.effectiveFrom)
      ? [existing.salary]
      : []),
  ];
  if (input.salary) {
    const salary = staffSalarySchema.parse(input.salary);
    const index = history.findIndex((v) => v.effectiveFrom === salary.effectiveFrom);
    if (index >= 0) history[index] = salary;
    else history.push(salary);
  }
  history.sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));
  const record = staffMemberSchema.parse({
    ...existing,
    ...input,
    salary: history[history.length - 1],
    salaryHistory: history.length ? history : undefined,
    id: existing?.id ?? crypto.randomUUID(),
    teacherId: existing?.teacherId,
    schoolId: state.school.id,
  });
  if (record.joinedOn > getSchoolDate()) throw new Error('Joining date cannot be in the future.');
  if (record.email && !z.email().safeParse(record.email).success)
    throw new Error('Enter a valid email address or leave it blank.');
  if (record.phone && !whatsappPhone(record.phone))
    throw new Error('Enter a valid mobile number or leave it blank.');
  if (
    staffDirectory(state, config).some(
      (member) =>
        member.id !== record.id &&
        !!record.staffId &&
        member.staffId?.toLowerCase() === record.staffId.toLowerCase(),
    )
  )
    throw new Error('This staff ID is already in use.');
  const records = state.staffMembers ?? [];
  const teacher = state.teachers.find(
    (t) => t.id === existing?.teacherId && t.schoolId === state.school.id,
  );
  const updated = teacher
    ? saveTeacher(
        state,
        {
          ...teacher,
          name: record.name,
          email: record.email,
          phone: record.phone,
          joinedOn: record.joinedOn,
          status: record.status,
          qualification: record.qualification ?? teacher.qualification,
          photoDataUrl: record.photoDataUrl,
          sectionIds:
            record.status === 'active'
              ? state.sections
                  .filter((s) => s.schoolId === state.school.id && s.teacherId === teacher.id)
                  .map((s) => s.id)
              : [],
        },
        teacher.id,
      )
    : record.isTeachingStaff
      ? saveTeacher(state, {
          name: record.name,
          subject: '',
          staffId: record.staffId || `ST-${record.id.slice(0, 8)}`,
          status: record.status,
          email: record.email,
          phone: record.phone,
          qualification: record.qualification ?? '',
          joinedOn: record.joinedOn,
          photoDataUrl: record.photoDataUrl,
          sectionIds: [],
        })
      : state;
  if (record.isTeachingStaff && !teacher) record.teacherId = updated.teachers.at(-1)?.id;
  return {
    ...updated,
    staffMembers: records.some((r) => r.id === record.id && r.schoolId === state.school.id)
      ? records.map((r) => (r.id === record.id && r.schoolId === state.school.id ? record : r))
      : [...records, record],
  };
}
export function staffDesignation(member: StaffMember, config: StaffPayrollConfig): string {
  return (
    member.designation ??
    config.setup.departments
      .find((d) => d.id === member.departmentId)
      ?.designations.find((r) => r.id === member.designationId)?.name ??
    ''
  );
}
export function staffLabel(member: StaffMember, config: StaffPayrollConfig): string {
  const designation = staffDesignation(member, config);
  return designation ? `${member.name} (${designation})` : member.name;
}
