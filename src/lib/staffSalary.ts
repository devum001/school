import { z } from 'zod';
import type { StaffMember, StaffSalary } from '../types/domain';

export const salaryMonthSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Choose a valid salary month.');
const amount = z
  .number()
  .int('Use amounts in whole paise.')
  .min(0, 'Amounts cannot be negative.')
  .max(1000000000, 'Amount is too large.');
export const staffSalarySchema = z
  .object({
    effectiveFrom: salaryMonthSchema,
    basic: amount,
    allowance: amount,
    bonus: amount,
    deduction: amount,
  })
  .refine((salary) => salary.deduction <= salary.basic + salary.allowance + salary.bonus, {
    path: ['deduction'],
    message: 'Deduction cannot exceed basic salary, allowance and bonus combined.',
  });
export function salaryForMonth(member: StaffMember, month: string): StaffSalary | undefined {
  const versions = [...(member.salaryHistory ?? []), ...(member.salary ? [member.salary] : [])];
  return versions
    .filter((salary) => salary.effectiveFrom <= month)
    .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))[0];
}
export const salaryGross = (salary: StaffSalary) => salary.basic + salary.allowance + salary.bonus;
export const salaryNet = (salary: StaffSalary) => salaryGross(salary) - salary.deduction;
