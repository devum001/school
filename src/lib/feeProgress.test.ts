import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createSeed } from '../mocks/seed';
import { saveFeePlan } from './feePlans';
import { roster } from './selectors';
import { recordStudentPayment } from './financeTransactions';
import { feeProgress } from './feeProgress';
import { feeReceiptFor } from './documentData';
import { money } from './config';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-15T06:30:00Z'));
});
afterEach(() => vi.useRealTimers());
function fixture() {
  const seed = createSeed('2026-10-15'),
    row = roster(seed)[0];
  const state = saveFeePlan({ ...seed, payments: [] }, row.enrollment.id, {
    kind: 'Installments',
    totalFee: 2400000,
    installments: [
      { amount: 600000, dueDate: '2026-04-10' },
      { amount: 800000, dueDate: '2026-07-10' },
      { amount: 1000000, dueDate: '2026-10-10' },
    ],
  });
  return { state, row };
}
describe('installment completion and post-payment receipt balances', () => {
  it('counts only fully settled installments as paid and keeps part payments in remaining', () => {
    const { state: initial, row } = fixture();
    let state = initial;
    expect(feeProgress(state, row.enrollment.id)).toMatchObject({
      count: 3,
      completed: 0,
      partial: 0,
      remaining: 3,
      outstanding: 2400000,
    });
    state = recordStudentPayment(state, {
      enrollmentId: row.enrollment.id,
      amount: 900000,
      date: '2026-10-15',
      method: 'Cash',
      reference: '',
    });
    const progress = feeProgress(state, row.enrollment.id);
    expect(progress).toMatchObject({
      count: 3,
      completed: 1,
      remaining: 2,
      partial: 1,
      paid: 900000,
      outstanding: 1500000,
    });
    expect(progress.next).toMatchObject({ paid: 300000, outstanding: 500000 });
    state = recordStudentPayment(state, {
      enrollmentId: row.enrollment.id,
      amount: 1500000,
      date: '2026-10-15',
      method: 'Cash',
      reference: '',
    });
    expect(feeProgress(state, row.enrollment.id)).toMatchObject({
      completed: 3,
      remaining: 0,
      partial: 0,
      outstanding: 0,
      next: undefined,
    });
  });
  it('freezes the balance after the receipted payment even after later payments', () => {
    const { state: initial, row } = fixture();
    let state = initial;
    state = recordStudentPayment(state, {
      enrollmentId: row.enrollment.id,
      amount: 900000,
      date: '2026-10-15',
      method: 'UPI',
      reference: '',
    });
    const receipt = state.payments.at(-1)!;
    const fields = Object.fromEntries(receipt.document!.fields.map((f) => [f.label, f.value]));
    expect(fields['Total fee']).toBe(money(2400000));
    expect(fields['Total paid after this payment']).toBe(money(900000));
    expect(fields['Remaining amount']).toBe(money(1500000));
    expect(fields['Installment progress']).toBe('3 total · 1 paid · 2 remaining (1 part paid)');
    state = recordStudentPayment(state, {
      enrollmentId: row.enrollment.id,
      amount: 500000,
      date: '2026-10-15',
      method: 'Cash',
      reference: '',
    });
    expect(feeReceiptFor(state, receipt).fields).toEqual(receipt.document!.fields);
    expect(Object.fromEntries(receipt.document!.fields.map((f) => [f.label, f.value]))).toEqual(
      fields,
    );
    expect(feeProgress(state, row.enrollment.id).outstanding).toBe(1000000);
  });
  it('identifies one-time plans and keeps selected out-of-order payments allocated correctly', () => {
    const { state: initial, row } = fixture();
    let state = initial;
    const third = feeProgress(state, row.enrollment.id).schedule[2];
    state = recordStudentPayment(state, {
      enrollmentId: row.enrollment.id,
      installmentId: third.id,
      amount: 1000000,
      date: '2026-10-15',
      method: 'Bank',
      reference: '',
    });
    expect(feeProgress(state, row.enrollment.id)).toMatchObject({
      completed: 1,
      remaining: 2,
      partial: 0,
    });
    expect(feeProgress(state, row.enrollment.id).next?.dueDate).toBe('2026-04-10');
    const seed = createSeed('2026-10-15');
    const single = saveFeePlan({ ...seed, payments: [] }, row.enrollment.id, {
      kind: 'One Time',
      totalFee: 100000,
      installments: [{ amount: 100000, dueDate: '2026-10-15' }],
    });
    expect(feeProgress(single, row.enrollment.id)).toMatchObject({
      kind: 'One Time',
      count: 1,
      completed: 0,
      remaining: 1,
    });
  });
});
