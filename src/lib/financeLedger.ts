import type { DemoState } from '../types/domain';
import type { GeneratedDocument } from '../types/ledger';
import { feeReceiptFor, salarySlipFor } from './documentData';
import { roster } from './selectors';
export interface FinanceEntry {
  id: string;
  type: 'Fee Payment' | 'Salary Payment';
  name: string;
  date: string;
  method: string;
  reference: string;
  number: string;
  income: number;
  expense: number;
  document: GeneratedDocument;
}
export function financeEntries(
  state: DemoState,
  start: string,
  end: string,
  asOf: string,
): FinanceEntry[] {
  const students = roster(state, true),
    enrollments = new Set(students.map((row) => row.enrollment.id));
  const rows: FinanceEntry[] = [];
  for (const payment of state.payments.filter(
    (p) =>
      p.schoolId === state.school.id &&
      enrollments.has(p.enrollmentId) &&
      p.date >= start &&
      p.date <= end &&
      p.date <= asOf,
  )) {
    const document = feeReceiptFor(state, payment);
    rows.push({
      id: payment.id,
      type: 'Fee Payment',
      name: document.recipientName,
      date: payment.date,
      method: payment.method === 'Bank transfer' ? 'Bank' : payment.method,
      reference: payment.reference,
      number: document.number,
      income: payment.amount,
      expense: 0,
      document,
    });
  }
  for (const payment of (state.salaryPayments ?? []).filter(
    (p) => p.schoolId === state.school.id && p.date >= start && p.date <= end && p.date <= asOf,
  ))
    rows.push({
      id: payment.id,
      type: 'Salary Payment',
      name: salarySlipFor(state, payment).recipientName,
      date: payment.date,
      method: payment.method,
      reference: payment.reference,
      number: payment.slipNumber,
      income: 0,
      expense: payment.amountPaid,
      document: salarySlipFor(state, payment),
    });
  return rows.sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
}
