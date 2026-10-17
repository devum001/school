import { z } from 'zod';
import type { DemoState, StaffMember, StaffPayrollConfig } from '../types/domain';
import { getSchoolDate, shiftCalendarDate } from './dates';
import { salaryForMonth, salaryMonthSchema } from './staffSalary';

function adjacentMonth(month: string, offset: number) {
  const date = new Date(`${month}-01T12:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + offset);
  return date.toISOString().slice(0, 7);
}
function paymentDate(month: string, day: number) {
  const last = Number(shiftCalendarDate(`${adjacentMonth(month, 1)}-01`, -1).slice(-2));
  return `${month}-${String(Math.min(day, last)).padStart(2, '0')}`;
}
export function payrollCycle(month: string, paymentDay: number) {
  salaryMonthSchema.parse(month);
  z.number().int().min(1).max(31).parse(paymentDay);
  const start = paymentDate(month, paymentDay);
  const end = shiftCalendarDate(paymentDate(adjacentMonth(month, 1), paymentDay), -1);
  const days =
    Math.round((Date.parse(`${end}T12:00:00Z`) - Date.parse(`${start}T12:00:00Z`)) / 86400000) + 1;
  return { month, start, end, days };
}
export function currentPayrollMonth(today: string, paymentDay: number) {
  const month = today.slice(0, 7);
  return today < paymentDate(month, paymentDay) ? adjacentMonth(month, -1) : month;
}
export const staffCycleInputSchema = z.object({
  schoolId: z.string(),
  staffId: z.string(),
  month: salaryMonthSchema,
  start: z.iso.date(),
  end: z.iso.date(),
  unpaidDays: z.number().min(0).max(31).multipleOf(0.5),
  lateArrivals: z.number().int().min(0).max(31),
});
export function staffCycleSummary(
  state: DemoState,
  config: StaffPayrollConfig,
  member: StaffMember,
  month: string,
  asOfDate = getSchoolDate(),
) {
  const cycle = payrollCycle(month, config.payroll.paymentDay);
  const salary = salaryForMonth(member, month);
  const attendance = new Map(
    (state.staffAttendance ?? [])
      .filter(
        (record) =>
          record.schoolId === state.school.id &&
          record.staffId === member.id &&
          record.date >= cycle.start &&
          record.date <= cycle.end &&
          record.date <= asOfDate &&
          record.date >= member.joinedOn,
      )
      .map((record) => [record.date, record.status]),
  );
  const leaveDays = [...attendance.values()].reduce(
    (count, status) => count + (status === 'absent' ? 1 : status === 'half-day' ? 0.5 : 0),
    0,
  );
  const components = config.payroll.components;
  const gross = salary
    ? salary.basic +
      (components.includes('Allowance') ? salary.allowance : 0) +
      (components.includes('Bonus') ? salary.bonus : 0)
    : 0;
  const enabled = components.includes('Deduction');
  const manual = salary && enabled ? Math.min(salary.deduction, gross) : 0;
  const automatic = enabled && config.payroll.autoCalculation;
  const leaveEnabled = automatic && config.work.autoLeaveDeduction;
  const requestedLeave =
    salary && leaveEnabled ? Math.round((salary.basic * leaveDays) / cycle.days) : 0;
  const leaveDeduction = Math.min(requestedLeave, gross - manual);
  return {
    cycle,
    salary,
    leaveDays,
    gross,
    manual,
    leaveDeduction,
    net: gross - manual - leaveDeduction,
    capped: manual + requestedLeave > gross,
  };
}
