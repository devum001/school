import { attendanceRequestSchema } from './attendanceTypes';
import { titleCase } from '../lib/displayFormat';
import { announcePunch } from './teacherPunchService';
import { z } from 'zod';
import { ApiError, apiService } from './apiService';
const id = z.string();
const base = { id, schoolId: id, revision: z.number().default(0) };
export const hrSettingsSchema = z.object({
  ...base,
  departments: z.array(z.string()),
  start: z.string(),
  end: z.string(),
  lateAfter: z.string(),
  halfDayAfter: z.string().optional(),
  halfDayMinutes: z.number(),
  workingDays: z.array(z.number()),
  holidays: z.array(z.string()),
  paymentDay: z.number(),
  deductionBasis: z.enum(['basic', 'gross']),
  divisor: z.enum(['calendar', 'working', '30']),
  paidLeaveDays: z.number(),
  absenceReducesLeave: z.boolean().optional(),
  maxAccuracy: z.number(),
  locations: z.array(
    z.object({ name: z.string(), latitude: z.number(), longitude: z.number(), radius: z.number() }),
  ),
});
const salary = z.object({
  effectiveMonth: z.string(),
  basic: z.number(),
  allowance: z.number(),
  bonus: z.number(),
  deduction: z.number(),
  reason: z.string(),
});
const employment = z.object({
  ...base,
  staffId: id,
  attendanceMode: z.enum(['none', 'manual', 'punch']),
  endedOn: z.string(),
  salaries: z.array(salary),
  policies: z
    .array(
      z.object({ effectiveMonth: z.string(), attendanceMode: z.enum(['none', 'manual', 'punch']) }),
    )
    .optional(),
});
const staff = z.object({
  ...base,
  name: z.string().transform(titleCase),
  code: z.string(),
  department: z.string().transform(titleCase),
  designation: z.string().transform(titleCase),
  teaching: z.boolean(),
  status: z.string(),
  joinedOn: z.string(),
  email: z.string().optional(),
  phone: z.string().optional(),
  qualification: z.string().optional(),
  photoDataUrl: z.string().optional(),
  userId: id.optional(),
});
const day = z.object({
  ...base,
  staffId: id,
  date: z.string(),
  status: z.string(),
  decision: z.string(),
  unpaidUnits: z.number(),
  reason: z.string(),
  late: z.boolean().optional(),
  lateMinutes: z.number().optional(),
  workingMinutes: z.number().nullable().optional(),
  attendanceExplanation: z.string().optional(),
  attendanceSource: z.enum(['ars', 'admin']).optional(),
  actualPunchIn: z.string().optional(),
  actualPunchOut: z.string().optional(),
  inProgress: z.boolean().optional(),
  missedPunchOut: z.boolean().optional(),
  attendanceClosed: z.boolean().optional(),
  punchIn: z.string().optional(),
  punchOut: z.string().optional(),
});
const leave = z.object({
  ...base,
  staffId: id,
  start: z.string(),
  end: z.string(),
  kind: z.string(),
  reason: z.string(),
  units: z.number(),
  status: z.string(),
  paid: z.boolean(),
  reviewNote: z.string(),
  approvedDates: z.array(z.string()).optional(),
});
const payroll = z.object({
  ...base,
  staffId: id,
  month: z.string(),
  name: z.string().transform(titleCase),
  code: z.string(),
  department: z.string().transform(titleCase),
  dueDate: z.string(),
  status: z.string(),
  basic: z.number(),
  allowance: z.number(),
  bonus: z.number(),
  gross: z.number(),
  unpaidUnits: z.number(),
  leaveDeduction: z.number(),
  manualDeduction: z.number(),
  adjustment: z.number(),
  advanceRecovery: z.number(),
  note: z.string(),
  net: z.number(),
  unresolved: z.array(z.string()),
});
const payment = z.object({
  id,
  schoolId: id,
  staffId: id,
  payrollId: id.optional(),
  amount: z.number(),
  date: z.string(),
  method: z.string(),
  reference: z.string(),
});
const workspace = z.object({
  timezone: z.string().optional(),
  punchState: z
    .object({
      allowed: z.boolean(),
      code: z.string().nullable(),
      reason: z.string(),
      nextKind: z.enum(['in', 'out']),
    })
    .optional(),
  settings: hrSettingsSchema,
  today: z.string(),
  schoolTime: z.string().optional(),
  staff: z.array(staff),
  employment: z.array(employment),
  attendance: z.array(day),
  attendanceRequests: z.array(attendanceRequestSchema).optional(),
  leaves: z.array(leave),
  payroll: z.array(payroll),
  payments: z.array(payment),
  advances: z.array(payment),
  leaveUsage: z
    .array(
      z.object({
        staffId: id,
        used: z.number(),
        absenceDays: z.number().optional(),
        approvedLeaveDays: z.number().optional(),
      }),
    )
    .optional(),
  advanceBalances: z
    .array(
      z.object({ staffId: id, issued: z.number(), recovered: z.number(), balance: z.number() }),
    )
    .optional(),
});
export type HrWorkspace = z.infer<typeof workspace>;
export type HrSettings = z.infer<typeof hrSettingsSchema>;
export type HrStaff = HrWorkspace['staff'][number];
export type HrPayroll = HrWorkspace['payroll'][number];
export type HrEmployment = HrWorkspace['employment'][number];
export interface HrAdapter {
  load(month: string, self: boolean, signal: AbortSignal): Promise<HrWorkspace>;
  save(path: string, body: unknown, method?: 'POST' | 'PUT'): Promise<unknown>;
}
export function liveHrAdapter(schoolId: string): HrAdapter {
  const root = `/schools/${encodeURIComponent(schoolId)}/hr`;
  return {
    async load(month, self, signal) {
      const result = workspace.safeParse(
        await apiService.request(
          `${root}/workspace?month=${encodeURIComponent(month)}&self=${self}`,
          { signal },
        ),
      );
      if (!result.success)
        throw new ApiError(0, 'INVALID_RESPONSE', 'Unable to read staff payroll records.');
      const data = result.data;
      for (const rows of [
        data.staff,
        data.employment,
        data.attendance,
        data.leaves,
        data.payroll,
        data.payments,
        data.advances,
      ])
        if (rows.some((row) => row.schoolId !== schoolId))
          throw new ApiError(0, 'INVALID_RESPONSE', 'Wrong school response.');
      if (data.settings.schoolId !== schoolId)
        throw new ApiError(0, 'INVALID_RESPONSE', 'Wrong school response.');
      return data;
    },
    save: async (path, body, method = 'POST') => {
      const result = await apiService.request(root + path, { method, body });
      if (path === '/punch' || path.startsWith('/attendance-requests')) announcePunch(schoolId);
      return result;
    },
  };
}
export const payrollPaid = (item: HrPayroll, data: HrWorkspace) =>
  data.payments.filter((p) => p.payrollId === item.id).reduce((s, p) => s + p.amount, 0);
export function payrollStatus(item: HrPayroll, data: HrWorkspace) {
  const paid = payrollPaid(item, data);
  return item.status === 'draft'
    ? 'Draft'
    : item.net === 0
      ? 'No payment due'
      : paid >= item.net
        ? 'Paid'
        : paid > 0
          ? 'Partially paid'
          : 'Unpaid';
}
export const rupees = (paise: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(paise / 100);

const staffProfileSchema = z.object({
  workspace: workspace.nullable().optional(),
  account: z
    .object({ status: z.string(), role: z.string(), membershipId: z.string() })
    .nullable()
    .optional(),
  staff,
  attendance: workspace
    .pick({
      today: true,
      timezone: true,
      settings: true,
      attendance: true,
      leaves: true,
      attendanceRequests: true,
    })
    .nullable(),
});
export type StaffAttendanceProfile = z.infer<typeof staffProfileSchema>;
export async function loadStaffAttendanceProfile(
  schoolId: string,
  staffId: string,
  month: string,
  signal?: AbortSignal,
) {
  const result = staffProfileSchema.safeParse(
    await apiService.request(
      `/schools/${schoolId}/hr/staff/${encodeURIComponent(staffId)}/attendance-profile?month=${encodeURIComponent(month)}`,
      { signal, fresh: true },
    ),
  );
  if (
    !result.success ||
    result.data.staff.schoolId !== schoolId ||
    result.data.staff.id !== staffId
  )
    throw new ApiError(0, 'INVALID_RESPONSE', 'Unable to read this staff profile.');
  return result.data;
}
