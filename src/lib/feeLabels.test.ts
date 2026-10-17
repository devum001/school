import { expect, it } from 'vitest';
import { installmentName, normalizeInstallmentText } from './feeLabels';
import { createSeed } from '../mocks/seed';
import { feeReceiptFor } from './documentData';
import { installments } from './selectors';
import { saveFeePlan } from './feePlans';

it('uses ordinal installment labels, including the 11th–13th exceptions', () => {
  expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 31].map((number) => installmentName(number))).toEqual(
    [
      '1st installment',
      '2nd installment',
      '3rd installment',
      '4th installment',
      '11th installment',
      '12th installment',
      '13th installment',
      '21st installment',
      '22nd installment',
      '23rd installment',
      '31st installment',
    ],
  );
  expect(installmentName(1, true)).toBe('One-time fee');
  expect(normalizeInstallmentText('Term 1 · Tuition, Installment 2/3')).toBe(
    '1st installment · Tuition, 2nd installment',
  );
});

it('recreates legacy receipts on demand and only updates wording in saved receipt presentations', () => {
  const state = createSeed('2026-10-15');
  state.obligations = state.obligations.map((item, index) => ({
    ...item,
    label: `Term ${(index % 3) + 1} · Tuition & activities`,
  }));
  const payment = state.payments[0];
  const before = JSON.stringify(state);
  const first = feeReceiptFor(state, payment);
  const second = feeReceiptFor(state, payment);
  expect(first).toEqual(second);
  expect(first.amount).toBe(payment.amount);
  expect(first.fields.find((field) => field.label === 'Fee / Installment')?.value).toBe(
    '1st installment',
  );
  expect(installments(state, payment.enrollmentId).map((item) => item.label)).toEqual([
    '1st installment',
    '2nd installment',
    '3rd installment',
  ]);
  const saved = {
    ...payment,
    document: {
      ...first,
      fields: first.fields.map((field) =>
        field.label === 'Fee / Installment' ? { ...field, value: 'Term 1 · Tuition' } : field,
      ),
    },
  };
  const rendered = feeReceiptFor(state, saved);
  expect(rendered.fields.find((field) => field.label === 'Fee / Installment')?.value).toBe(
    '1st installment · Tuition',
  );
  expect(rendered.amount).toBe(saved.document.amount);
  expect(saved.document.fields.find((field) => field.label === 'Fee / Installment')?.value).toBe(
    'Term 1 · Tuition',
  );
  expect(JSON.stringify(state)).toBe(before);
  const single = saveFeePlan({ ...state, payments: [] }, payment.enrollmentId, {
    kind: 'Installments',
    totalFee: 100000,
    installments: [{ amount: 100000, dueDate: '2026-12-01' }],
  });
  expect(installments(single, payment.enrollmentId)[0].label).toBe('1st installment');
  const oneTime = saveFeePlan(single, payment.enrollmentId, {
    kind: 'One Time',
    totalFee: 100000,
    installments: [{ amount: 100000, dueDate: '2026-12-01' }],
  });
  expect(installments(oneTime, payment.enrollmentId)[0].label).toBe('One-time fee');
});
