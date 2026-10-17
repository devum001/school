import { z } from 'zod';
import type { DemoState } from '../types/domain';
import type { AuditEntry, WorkspacePreferences, WorkspaceSecurity } from '../types/admin';
export const preferencesSchema = z.object({
  language: z.enum(['English', 'Hindi']),
  dateFormat: z.enum(['DD/MM/YYYY', 'DD MMM YYYY']),
  timeFormat: z.enum(['12-hour', '24-hour']),
  academicYearId: z.string(),
  weekStartsOn: z.enum(['Monday', 'Sunday']),
  landingPage: z.enum(['Dashboard', 'Students', 'Attendance']),
});
export const securitySchema = z.object({
  automaticBackup: z.boolean(),
  backupFrequency: z.enum(['Daily', 'Weekly']),
  lastBackup: z.iso.datetime().optional(),
  backupStatus: z.enum(['Not created', 'Preview successful']),
  sessionTimeout: z.union([z.literal(0), z.literal(15), z.literal(30), z.literal(60)]),
  sensitivePassword: z.boolean(),
  otherSessionActive: z.boolean(),
  currentSessionActive: z.boolean().optional(),
});
export const auditSchema = z.object({
  id: z.string(),
  schoolId: z.string(),
  actor: z.string(),
  action: z.string(),
  module: z.enum([
    'Students',
    'Staff',
    'Attendance',
    'Finance',
    'Academics',
    'Notifications',
    'School Settings',
  ]),
  detail: z.string(),
  createdAt: z.iso.datetime(),
});
export const securityFor = (state: DemoState): WorkspaceSecurity =>
  state.security ?? {
    automaticBackup: false,
    backupFrequency: 'Daily',
    backupStatus: 'Not created',
    sessionTimeout: 30,
    sensitivePassword: true,
    otherSessionActive: true,
  };
export const preferencesFor = (state: DemoState): WorkspacePreferences =>
  state.preferences ?? {
    language: 'English',
    dateFormat: 'DD MMM YYYY',
    timeFormat: '12-hour',
    academicYearId: state.academicYear.id,
    weekStartsOn: 'Monday',
    landingPage: 'Dashboard',
  };
export function savePreferences(state: DemoState, input: WorkspacePreferences): DemoState {
  const preferences = preferencesSchema.parse(input);
  if (preferences.academicYearId !== state.academicYear.id)
    throw new Error('Choose an academic year available in this school.');
  return { ...state, preferences };
}
export function saveSecurity(state: DemoState, input: WorkspaceSecurity): DemoState {
  return { ...state, security: securitySchema.parse(input) };
}
function changed(a: unknown, b: unknown) {
  return a !== b && JSON.stringify(a) !== JSON.stringify(b);
}
export function withAudit(previous: DemoState, next: DemoState): DemoState {
  let event: Pick<AuditEntry, 'action' | 'module' | 'detail'> | undefined;
  const payment = next.payments.find(
    (p) => p.schoolId === next.school.id && !previous.payments.some((old) => old.id === p.id),
  );
  const salary = next.salaryPayments?.find(
    (p) =>
      p.schoolId === next.school.id && !previous.salaryPayments?.some((old) => old.id === p.id),
  );
  if (payment)
    event = {
      action: 'Recorded fee payment',
      module: 'Finance',
      detail: `${next.students.find((s) => next.enrollments.find((e) => e.id === payment.enrollmentId)?.studentId === s.id)?.name ?? 'Student'} · INR ${(payment.amount / 100).toLocaleString('en-IN')} · ${payment.receiptNumber ?? payment.id}`,
    };
  else if (salary)
    event = {
      action: 'Recorded salary payment',
      module: 'Finance',
      detail: `${salary.document.recipientName} · ${salary.month} · INR ${(salary.amountPaid / 100).toLocaleString('en-IN')}`,
    };
  else if (changed(previous.attendance, next.attendance))
    event = {
      action: 'Updated student attendance',
      module: 'Attendance',
      detail: `Student attendance · ${next.attendance.filter((r) => !previous.attendance.some((old) => old.enrollmentId === r.enrollmentId && old.date === r.date && old.status === r.status)).at(-1)?.date ?? ''}`,
    };
  else if (changed(previous.staffAttendance, next.staffAttendance))
    event = {
      action: 'Updated staff attendance',
      module: 'Attendance',
      detail: `Staff attendance · ${next.staffAttendance?.filter((r) => !previous.staffAttendance?.some((old) => old.staffId === r.staffId && old.date === r.date && old.status === r.status)).at(-1)?.date ?? ''}`,
    };
  else if (
    changed(previous.students, next.students) ||
    changed(previous.enrollments, next.enrollments)
  )
    event = {
      action: 'Updated student records',
      module: 'Students',
      detail:
        next.students.find((student) =>
          changed(
            previous.students.find((old) => old.id === student.id),
            student,
          ),
        )?.name ??
        previous.students.find(
          (student) => !next.students.some((current) => current.id === student.id),
        )?.name ??
        'Student enrollment saved',
    };
  else if (
    changed(previous.staffMembers, next.staffMembers) ||
    changed(previous.teachers, next.teachers)
  )
    event = {
      action: 'Updated staff records',
      module: 'Staff',
      detail:
        next.staffMembers?.find((member) =>
          changed(
            previous.staffMembers?.find((old) => old.id === member.id),
            member,
          ),
        )?.name ??
        next.teachers.find((member) =>
          changed(
            previous.teachers.find((old) => old.id === member.id),
            member,
          ),
        )?.name ??
        'Staff profile saved',
    };
  else if (changed(previous.exams, next.exams) || changed(previous.results, next.results))
    event = { action: 'Updated academics', module: 'Academics', detail: 'Test or marks saved' };
  else {
    const sent = next.communication?.records.filter(
      (r) =>
        (r.status === 'Delivered' || r.status === 'Failed') &&
        previous.communication?.records.find((old) => old.id === r.id)?.attempts !== r.attempts,
    );
    if (sent?.length)
      event = {
        action: 'Sent notifications',
        module: 'Notifications',
        detail: `${sent.length} message attempts recorded`,
      };
    else if (
      changed(previous.feePlans, next.feePlans) ||
      changed(previous.obligations, next.obligations)
    )
      event = { action: 'Updated fee plan', module: 'Finance', detail: 'Student fee plan saved' };
    else if (
      [
        'school',
        'preferences',
        'security',
        'documentTemplates',
        'attendancePolicy',
        'staffPayroll',
        'schoolHours',
        'staffAccess',
      ].some((key) => changed(previous[key as keyof DemoState], next[key as keyof DemoState]))
    )
      event = {
        action: 'Updated school settings',
        module: 'School Settings',
        detail: 'School configuration saved',
      };
    else if (changed(previous.communication?.settings, next.communication?.settings))
      event = {
        action: 'Updated communication settings',
        module: 'School Settings',
        detail: 'Channels or message templates saved',
      };
  }
  if (!event) return next;
  const entry: AuditEntry = {
    ...event,
    id: crypto.randomUUID(),
    schoolId: next.school.id,
    actor: next.school.principal || 'School Admin',
    createdAt: new Date().toISOString(),
  };
  return { ...next, auditLog: [...(previous.auditLog ?? []), entry].slice(-2000) };
}
