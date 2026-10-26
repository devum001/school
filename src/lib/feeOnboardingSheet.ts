import type { ExcelCell } from './xlsx';
import { identifierKey } from './studentIdentifiers';
import type { FeeDraftValues } from '../services/feeOnboardingService';
export const FEE_SHEET_HEADERS = [
  'Admission Number',
  'Student Name',
  'Class',
  'Section',
  'Base Fee',
  'Concession',
  'Scholarship',
  'Already Paid',
  'Old Dues',
  'Installments',
  'Interval Months',
  'First Due Date',
  'Note',
];
const amountColumns = {
  'Base Fee': 'baseFee',
  Concession: 'concession',
  Scholarship: 'scholarship',
  'Already Paid': 'openingPaid',
  'Old Dues': 'oldDues',
} as const;
export function parseFeeSheet(sheet: ExcelCell[][]) {
  const headers = (sheet[0] || []).map((v) => String(v).trim());
  if (!headers.includes('Admission Number') || headers.some((h) => !FEE_SHEET_HEADERS.includes(h)))
    throw new Error('Use the downloaded fee worksheet headers, including Admission Number.');
  if (new Set(headers).size !== headers.length) throw new Error('Remove repeated column headers.');
  const filled = sheet.slice(1).filter((r) => r.some((v) => String(v).trim()));
  if (!filled.length || filled.length > 10000)
    throw new Error('Include between 1 and 10,000 student rows.');
  const seen = new Set<string>();
  return filled.map((cells, index) => {
    const read = (header: string) => String(cells[headers.indexOf(header)] ?? '').trim();
    const admissionNumber = read('Admission Number'),
      key = identifierKey(admissionNumber);
    const fail = (message: string): never => {
      throw new Error(`Row ${index + 2}: ${message}`);
    };
    if (!admissionNumber || seen.has(key))
      fail('Admission Number is missing or duplicated. Names are not used for matching.');
    seen.add(key);
    const values: FeeDraftValues = {};
    for (const [header, field] of Object.entries(amountColumns)) {
      const value = read(header);
      if (!value) continue; // Blank preserves the draft, zero is an explicit value.
      if (
        !/^\d+(?:\.\d{1,2})?$/.test(value.replaceAll(',', '')) ||
        Number(value.replaceAll(',', '')) > 10000000
      )
        fail(`${header} must be a non-negative amount with up to two decimal places.`);
      values[field as (typeof amountColumns)[keyof typeof amountColumns]] = Math.round(
        Number(value.replaceAll(',', '')) * 100,
      );
    }
    for (const [header, field] of [
      ['Installments', 'count'],
      ['Interval Months', 'interval'],
    ] as const) {
      const value = read(header);
      if (!value) continue;
      const number = Number(value);
      if (
        !Number.isInteger(number) ||
        (field === 'count' ? number < 1 || number > 60 : ![1, 3, 6, 12].includes(number))
      )
        fail(`${header} is invalid.`);
      values[field] = number;
    }
    const date = read('First Due Date');
    if (date) {
      const parts = /^(\d{2})-(\d{2})-(\d{4})$/.exec(date);
      const iso = parts ? `${parts[3]}-${parts[2]}-${parts[1]}` : date;
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(iso) ||
        Number.isNaN(Date.parse(iso)) ||
        new Date(iso).toISOString().slice(0, 10) !== iso
      )
        fail('First Due Date must be a real DD-MM-YYYY date.');
      values.dueDate = iso;
    }
    if (read('Note')) {
      if (read('Note').length > 300) fail('Note must be at most 300 characters.');
      values.reason = read('Note');
    }
    return { admissionNumber, values };
  });
}
export function pastedFeeSheet(text: string): ExcelCell[][] {
  return text
    .replaceAll('\r', '')
    .trim()
    .split('\n')
    .map((line) => line.split('\t'));
}
