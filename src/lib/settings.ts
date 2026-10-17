import { z } from 'zod';
import { imageDataSchema } from './ledgerSchemas';
import type { AttendancePolicy, DemoState, School, StaffPayrollConfig } from '../types/domain';
import {
  defaultStaffDepartments,
  departmentSetupSchema,
  migrateStaffSetup,
} from './staffStructure';

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Enter a valid time.');
const percent = z.number().min(0).max(100);
export const schoolProfileSchema = z.object({
  logoDataUrl: imageDataSchema.nullable().optional(),
  name: z.string().trim().min(2, 'Enter the school name.'),
  city: z.string().trim().min(2, 'Enter the school location.'),
  motto: z.string().trim().min(1, 'Enter the school motto.'),
  code: z.string().trim().min(1),
  board: z.string().trim().min(1),
  affiliationNumber: z.string().trim().min(1),
  principal: z.string().trim().min(2),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[\d\s()-]{7,20}$/, 'Enter a valid phone number.'),
  email: z.email('Enter a valid email address.'),
  website: z
    .string()
    .trim()
    .refine((value) => {
      try {
        return /^https?:$/.test(
          new URL(value.includes('://') ? value : `https://${value}`).protocol,
        );
      } catch {
        return false;
      }
    }, 'Enter a valid website address.'),
});
export const attendancePolicySchema = z
  .object({
    studentStart: time,
    studentEnd: time,
    facultyStart: time,
    facultyEnd: time,
    officeStart: time,
    officeEnd: time,
    graceMinutes: z.number().int().min(0).max(120),
    lateTrigger: z.number().int().min(1).max(31),
    lateSms: z.boolean(),
    minimumAttendance: percent,
    warningAttendance: percent,
    medicalExemption: percent,
    absenceTime: time,
    consecutiveAbsences: z.number().int().min(1).max(30),
    absenceAlerts: z.boolean(),
    minimumCampusMinutes: z.number().int().min(1).max(720),
    earlyExitStart: time,
    earlyExitEnd: time,
    enforceLate: z.boolean(),
    enforceHalfDay: z.boolean(),
    enforceEligibility: z.boolean(),
  })
  .superRefine((policy, ctx) => {
    for (const [start, end] of [
      ['facultyStart', 'facultyEnd'],
      ['officeStart', 'officeEnd'],
      ['earlyExitStart', 'earlyExitEnd'],
    ] as const) {
      if (policy[start] >= policy[end])
        ctx.addIssue({
          code: 'custom',
          path: [end],
          message: 'End time must be after start time.',
        });
    }
    if (policy.warningAttendance < policy.minimumAttendance)
      ctx.addIssue({
        code: 'custom',
        path: ['warningAttendance'],
        message: 'Warning threshold must be at least the minimum attendance.',
      });
  });
export const defaultAttendancePolicy: AttendancePolicy = {
  studentStart: '08:00',
  studentEnd: '14:30',
  facultyStart: '07:45',
  facultyEnd: '15:30',
  officeStart: '08:30',
  officeEnd: '17:00',
  graceMinutes: 15,
  lateTrigger: 3,
  lateSms: true,
  minimumAttendance: 75,
  warningAttendance: 80,
  medicalExemption: 10,
  absenceTime: '09:15',
  consecutiveAbsences: 3,
  absenceAlerts: true,
  minimumCampusMinutes: 210,
  earlyExitStart: '12:00',
  earlyExitEnd: '14:00',
  enforceLate: true,
  enforceHalfDay: true,
  enforceEligibility: true,
};
export function saveSchoolProfile(state: DemoState, input: Omit<School, 'id'>): DemoState {
  const school = { id: state.school.id, ...schoolProfileSchema.parse(input) };
  return {
    ...state,
    school,
    documentTemplates:
      state.documentTemplates && school.logoDataUrl !== undefined
        ? {
            ...state.documentTemplates,
            branding: { ...state.documentTemplates.branding, logo: school.logoDataUrl },
          }
        : state.documentTemplates,
  };
}
export function saveAttendancePolicy(state: DemoState, input: AttendancePolicy): DemoState {
  const policy = attendancePolicySchema.parse(input);
  const minutes = (value: string) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
  if (
    !state.schoolHours &&
    state.studentTimings?.some(
      (timing) =>
        timing.schoolId === state.school.id &&
        minutes(timing.end) - minutes(timing.start) <= policy.graceMinutes,
    )
  )
    throw new Error('The grace period must be shorter than every configured student school day.');
  const hours =
    state.schoolHours ??
    state.studentTimings?.find((timing) => timing.schoolId === state.school.id);
  if (hours) {
    const duration = minutes(hours.end) - minutes(hours.start);
    if (policy.graceMinutes >= duration)
      throw new Error('The grace period must be shorter than the school day.');
    if (policy.minimumCampusMinutes > duration)
      throw new Error('Minimum in-campus duration cannot exceed the school day.');
    if (policy.earlyExitStart < hours.start || policy.earlyExitEnd > hours.end)
      throw new Error(
        'The departure window must fall within the school opening and closing times.',
      );
    if (policy.absenceTime < hours.start || policy.absenceTime > hours.end)
      throw new Error('The absence trigger must fall within school hours.');
  }
  return { ...state, attendancePolicy: policy };
}

const setupList = z
  .array(z.string().trim().min(1, 'Names cannot be empty.').max(60))
  .min(1, 'Add at least one item.')
  .max(30, 'Keep each list to 30 items or fewer.')
  .refine(
    (items) => new Set(items.map((item) => item.toLowerCase())).size === items.length,
    'Remove duplicate names.',
  );
const leaveLimit = z.number().int().min(0).max(366);
export const staffPayrollSchema = z
  .object({
    setup: z.union([
      departmentSetupSchema,
      z
        .object({ departments: setupList, designations: setupList, staffTypes: setupList })
        .transform(migrateStaffSetup),
    ]),
    work: z.object({
      start: time,
      end: time,
      weeklyOff: z.enum([
        'Monday',
        'Tuesday',
        'Wednesday',
        'Thursday',
        'Friday',
        'Saturday',
        'Sunday',
      ]),
      lateAfter: time,
      halfDayMinutes: z.number().int().min(1).max(720),
      leaveLimits: z.object({
        casual: leaveLimit,
        sick: leaveLimit,
        paid: leaveLimit,
        unpaid: leaveLimit.nullable(),
      }),
      autoLeaveDeduction: z.boolean(),
    }),
    payroll: z.object({
      salaryCycle: z.literal('Monthly'),
      paymentDay: z.number().int().min(1).max(31),
      components: z
        .array(z.enum(['Basic', 'Allowance', 'Bonus', 'Deduction']))
        .min(1)
        .refine((items) => items.includes('Basic'), 'Basic salary must be included.')
        .refine(
          (items) => new Set(items).size === items.length,
          'Remove duplicate salary components.',
        ),
      lateDeduction: z.enum(['none', 'fixed-amount']),
      lateDeductionAmount: z.number().int().min(0).max(10000000),
      autoCalculation: z.boolean(),
      payslipTemplate: z.enum(['Standard', 'Compact']),
    }),
  })
  .superRefine((config, ctx) => {
    const { work, payroll } = config;
    if (work.end <= work.start)
      ctx.addIssue({
        code: 'custom',
        path: ['work', 'end'],
        message: 'End time must be after start time.',
      });
    if (work.lateAfter < work.start || work.lateAfter >= work.end)
      ctx.addIssue({
        code: 'custom',
        path: ['work', 'lateAfter'],
        message: 'Late cutoff must fall within the work timing.',
      });
    const minutes = (value: string) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
    if (work.halfDayMinutes > minutes(work.end) - minutes(work.start))
      ctx.addIssue({
        code: 'custom',
        path: ['work', 'halfDayMinutes'],
        message: 'Half-day duration cannot exceed the work timing.',
      });
    if (payroll.lateDeduction === 'fixed-amount' && payroll.lateDeductionAmount <= 0)
      ctx.addIssue({
        code: 'custom',
        path: ['payroll', 'lateDeductionAmount'],
        message: 'Enter a positive deduction amount.',
      });
  });
export const defaultStaffPayroll: StaffPayrollConfig = {
  setup: {
    departments: defaultStaffDepartments,
  },
  work: {
    start: '08:00',
    end: '15:00',
    weeklyOff: 'Sunday',
    lateAfter: '08:15',
    halfDayMinutes: 210,
    leaveLimits: { casual: 12, sick: 10, paid: 18, unpaid: null },
    autoLeaveDeduction: true,
  },
  payroll: {
    salaryCycle: 'Monthly',
    paymentDay: 5,
    components: ['Basic', 'Allowance', 'Bonus', 'Deduction'],
    lateDeduction: 'none',
    lateDeductionAmount: 0,
    autoCalculation: true,
    payslipTemplate: 'Standard',
  },
};
export function saveStaffPayroll(state: DemoState, input: StaffPayrollConfig): DemoState {
  const config = staffPayrollSchema.parse(input);
  for (const member of state.staffMembers ?? []) {
    if (member.schoolId !== state.school.id) continue;
    const department = config.setup.departments.find((d) => d.id === member.departmentId);
    if (
      !department ||
      (!member.designation && !department.designations.some((r) => r.id === member.designationId))
    )
      throw new Error('Reassign staff before removing their department.');
  }
  return { ...state, staffPayroll: config };
}
