import type { DemoState, StaffPayrollConfig } from '../types/domain';
import { staffDirectory } from './staffStructure';
import { currentPayrollMonth, payrollCycle, staffCycleSummary } from './staffPayroll';

export function schoolMonthlyFinance(
  state: DemoState,
  config: StaffPayrollConfig,
  asOfDate: string,
  selectedMonth?: string,
) {
  const month = selectedMonth ?? currentPayrollMonth(asOfDate, config.payroll.paymentDay);
  const cycle = payrollCycle(month, config.payroll.paymentDay);
  const members = staffDirectory(state, config).filter((member) => member.status === 'active');
  const configured = members
    .map((member) => staffCycleSummary(state, config, member, month, asOfDate))
    .filter((summary) => summary.salary);
  const grossSalary = configured.reduce((sum, summary) => sum + summary.gross, 0);
  const deductions = configured.reduce(
    (sum, summary) => sum + summary.manual + summary.leaveDeduction,
    0,
  );
  const netSalary = configured.reduce((sum, summary) => sum + summary.net, 0);
  const enrollmentIds = new Set(
    state.enrollments
      .filter((e) => e.schoolId === state.school.id && e.academicYearId === state.academicYear.id)
      .map((e) => e.id),
  );
  const feeIncome = state.payments
    .filter(
      (p) =>
        p.schoolId === state.school.id &&
        enrollmentIds.has(p.enrollmentId) &&
        p.date >= cycle.start &&
        p.date <= cycle.end &&
        p.date <= asOfDate,
    )
    .reduce((sum, p) => sum + p.amount, 0);
  const paidSalary = (state.salaryPayments ?? [])
    .filter(
      (payment) =>
        payment.schoolId === state.school.id &&
        payment.date >= cycle.start &&
        payment.date <= cycle.end &&
        payment.date <= asOfDate,
    )
    .reduce((sum, payment) => sum + payment.amountPaid, 0);
  return {
    month,
    cycle,
    feeIncome,
    grossSalary,
    deductions,
    netSalary,
    balanceAfterSalary: feeIncome - netSalary,
    paidSalary,
    balanceAfterPaidSalary: feeIncome - paidSalary,
    configuredCount: configured.length,
    unconfiguredCount: members.length - configured.length,
  };
}
