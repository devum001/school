import { recordDocumentData } from './recordedDocuments';
import { z } from 'zod';
import type { DemoState, Payment } from '../types/domain';
import type { PaymentAllocation, RecordSalaryPaymentInput, SalaryPayment } from '../types/ledger';
import { PAYMENT_METHODS, moneySchema } from './ledgerSchemas';
import { feeSummary, installments, roster } from './selectors';
import { getSchoolDate } from './dates';
import { feeReceiptFor, nextDocumentNumber, salarySlipFor } from './documentData';
import { staffDirectory } from './staffStructure';
import { defaultStaffPayroll } from './settings';
import { currentPayrollMonth, staffCycleSummary } from './staffPayroll';
import { salaryMonthSchema } from './staffSalary';

const referenceSchema = z.string().trim().max(80);
const paymentDateSchema = z.iso
  .date()
  .refine((date) => date <= getSchoolDate(), 'Payment date cannot be in the future.');
export function recordStudentPayment(
  state: DemoState,
  raw: Omit<Payment, 'id' | 'schoolId'>,
): DemoState {
  const input = z
    .object({
      enrollmentId: z.string(),
      amount: moneySchema.positive(),
      date: paymentDateSchema,
      method: z.enum(PAYMENT_METHODS),
      reference: referenceSchema,
      installmentId: z.string().optional(),
    })
    .parse(raw);
  if (input.date < state.academicYear.start)
    throw new Error('Choose a payment date in the current academic year.');
  const row = roster(state, true).find((entry) => entry.enrollment.id === input.enrollmentId);
  if (!row) throw new Error('Student enrollment not found.');
  if (input.amount > feeSummary(state, input.enrollmentId).outstanding)
    throw new Error('Payment exceeds the outstanding balance.');
  if (
    input.reference &&
    state.payments.some(
      (payment) => payment.schoolId === state.school.id && payment.reference === input.reference,
    )
  )
    throw new Error('This payment reference already exists.');
  const pending = installments(state, input.enrollmentId).filter(
    (item) => item.outstanding > 0 && (!input.installmentId || item.id === input.installmentId),
  );
  if (input.installmentId && (!pending.length || pending[0].outstanding < input.amount))
    throw new Error('Payment exceeds the selected installment balance.');
  const allocations: PaymentAllocation[] = [];
  let remaining = input.amount;
  for (const item of pending) {
    const amount = Math.min(remaining, item.outstanding);
    if (amount) allocations.push({ obligationId: item.id, amount });
    remaining -= amount;
  }
  if (remaining) throw new Error('Payment could not be allocated to pending installments.');
  const payment: Payment = {
    ...input,
    studentId: row.student.id,
    id: crypto.randomUUID(),
    schoolId: state.school.id,
    allocations,
    installmentId: allocations.length === 1 ? allocations[0].obligationId : undefined,
    receiptNumber: nextDocumentNumber(state, 'Fee Receipt', input.date),
    receivedBy: state.school.principal || 'School office',
    createdAt: new Date().toISOString(),
  };
  payment.document = recordDocumentData(feeReceiptFor(state, payment));
  return {
    ...state,
    payments: [...state.payments, payment],
    activities: [
      {
        id: crypto.randomUUID(),
        text: 'Payment recorded',
        detail: payment.receiptNumber!,
        date: getSchoolDate(),
        kind: 'payment' as const,
      },
      ...state.activities,
    ].slice(0, 30),
  };
}
export function salaryPaymentFor(state: DemoState, staffId: string, month: string) {
  return state.salaryPayments?.find(
    (payment) =>
      payment.schoolId === state.school.id &&
      payment.staffId === staffId &&
      payment.month === month,
  );
}
export function recordSalaryPayment(state: DemoState, raw: RecordSalaryPaymentInput): DemoState {
  const input = z
    .object({
      staffId: z.string(),
      month: salaryMonthSchema,
      method: z.enum(['Bank', 'UPI', 'Cash']),
      date: paymentDateSchema,
      reference: referenceSchema,
    })
    .parse(raw);
  const config = state.staffPayroll ?? defaultStaffPayroll,
    member = staffDirectory(state, config).find((item) => item.id === input.staffId);
  if (!member || member.status !== 'active')
    throw new Error('Choose active staff from this school.');
  if (salaryPaymentFor(state, member.id, input.month))
    throw new Error('Salary payment is already recorded for this staff member and month.');
  if (input.month > currentPayrollMonth(getSchoolDate(), config.payroll.paymentDay))
    throw new Error('Future salary cycles cannot be marked paid.');
  const summary = staffCycleSummary(state, config, member, input.month);
  if (!summary.salary || summary.cycle.end < member.joinedOn)
    throw new Error('Set the salary for this month before recording payment.');
  if (input.date < summary.cycle.start || input.date < member.joinedOn)
    throw new Error(
      'Payment date must be after the salary cycle starts and the staff joining date.',
    );
  if (
    input.reference &&
    state.salaryPayments?.some(
      (payment) => payment.schoolId === state.school.id && payment.reference === input.reference,
    )
  )
    throw new Error('This salary payment reference already exists.');
  const payment: Omit<SalaryPayment, 'document'> = {
    ...input,
    id: crypto.randomUUID(),
    schoolId: state.school.id,
    cycleStart: summary.cycle.start,
    cycleEnd: summary.cycle.end,
    gross: summary.gross,
    leaveDeduction: summary.leaveDeduction,
    manualDeduction: summary.manual,
    net: summary.net,
    leaveDays: summary.leaveDays,
    amountPaid: summary.net,
    slipNumber: nextDocumentNumber(state, 'Salary Slip', input.date),
    createdAt: new Date().toISOString(),
    recordedBy: state.school.principal || 'School office',
    status: 'Paid',
  };
  return {
    ...state,
    salaryPayments: [
      ...(state.salaryPayments ?? []),
      { ...payment, document: recordDocumentData(salarySlipFor(state, payment)) },
    ],
  };
}
