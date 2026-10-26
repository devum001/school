import { describe, expect, it } from 'vitest';
import { parseFeeSheet, pastedFeeSheet } from './feeOnboardingSheet';
describe('school fee worksheet', () => {
  it('keeps blank values unchanged while zero explicitly clears an amount and dates use DD-MM-YYYY', () => {
    expect(
      parseFeeSheet([
        ['Admission Number', 'Base Fee', 'Concession', 'First Due Date'],
        ['SH-12', '', 0, '30-10-2026'],
      ]),
    ).toEqual([{ admissionNumber: 'SH-12', values: { concession: 0, dueDate: '2026-10-30' } }]);
  });
  it('matches numeric admission identities and rejects duplicates regardless of prefix or case', () => {
    expect(() => parseFeeSheet([['Admission Number'], ['SH-012'], ['ab-12']])).toThrow(
      'duplicated',
    );
  });
  it('accepts 10,000 students and rejects invalid money, impossible dates and repeated headers', () => {
    expect(
      parseFeeSheet([
        ['Admission Number', 'Base Fee'],
        ...Array.from({ length: 10000 }, (_, i) => [`ADM-${i}`, '24,000']),
      ]),
    ).toHaveLength(10000);
    expect(() =>
      parseFeeSheet([
        ['Admission Number', 'Base Fee'],
        ['1', '-100'],
      ]),
    ).toThrow('non-negative');
    expect(() =>
      parseFeeSheet([
        ['Admission Number', 'First Due Date'],
        ['1', '31-02-2026'],
      ]),
    ).toThrow('real DD-MM-YYYY');
    expect(() =>
      parseFeeSheet([
        ['Admission Number', 'Admission Number'],
        ['1', '1'],
      ]),
    ).toThrow('repeated');
  });
  it('supports spreadsheet paste without requiring an Excel file', () => {
    expect(
      parseFeeSheet(
        pastedFeeSheet('Admission Number\tBase Fee\tAlready Paid\nSH-1\t24000\t5000'),
      )[0].values,
    ).toEqual({ baseFee: 2400000, openingPaid: 500000 });
  });
});
