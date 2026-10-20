import { describe, expect, it } from 'vitest';
import {
  formatCalendarDate,
  formatExportCell,
  parseCalendarDate,
  formatRosterCell,
  titleCase,
  displayTimestamp,
  parseCalendarDateTime,
  formatCalendarDateTime,
} from './displayFormat';
describe('consistent dates and roster presentation', () => {
  it('accepts day-month-year and keeps existing ISO data compatible', () => {
    expect(formatExportCell('Joining Date', '2024-02-29')).toBe('29-02-2024');
    expect(formatExportCell('Admission Number', '2024-02-29')).toBe('2024-02-29');
    expect(parseCalendarDate('29-02-2024')).toBe('2024-02-29');
    expect(parseCalendarDate('2024-02-29')).toBe('2024-02-29');
    expect(parseCalendarDateTime('29-02-2024 14:05')).toBe('2024-02-29T14:05');
    expect(formatCalendarDateTime('2024-02-29T14:05')).toBe('29-02-2024 14:05');
    expect(parseCalendarDateTime('29-02-2024 24:05')).toBeNull();
    for (const invalid of ['29-02-2025', '31-04-2026', '12-13-2026', 'date'])
      expect(parseCalendarDate(invalid)).toBeNull();
    expect(formatCalendarDate('2024-02-29')).toBe('29-02-2024');
    expect(formatRosterCell('Birth Date', '2015-01-12')).toBe('12-01-2015');
    expect(displayTimestamp('2026-10-19T12:00:00Z')).toMatch(/^19-10-2026 /);
  });
  it('capitalizes descriptive text without changing identifiers or contacts', () => {
    expect(formatRosterCell('Class', 'class 12TH')).toBe('Class 12th');
    expect(titleCase('  rAHUL   kumar ')).toBe('Rahul Kumar');
    expect(titleCase("anne-marie o'neil")).toBe("Anne-Marie O'Neil");
    expect(formatRosterCell('Guardian Name', 'RAJ kumar')).toBe('Raj Kumar');
    expect(formatRosterCell('Address', 'new delhi')).toBe('New Delhi');
    for (const column of [
      'Admission Number',
      'Staff Code',
      'Email',
      'Phone',
      'Roll Number',
      'Section',
    ])
      expect(formatRosterCell(column, 'abC-001')).toBe('abC-001');
  });
});
