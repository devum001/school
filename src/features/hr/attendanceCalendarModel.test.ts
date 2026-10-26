import { expect, it } from 'vitest';
import { attendanceLabel } from './attendanceCalendarModel';
import type { HrWorkspace } from '../../services/hrService';
const settings = {
  workingDays: [1, 2, 3, 4, 5],
  holidays: ['2026-10-20'],
} as HrWorkspace['settings'];
it('does not turn missing records into absences and distinguishes future dates and off days', () => {
  expect(attendanceLabel('2026-10-19', '2026-10-20', undefined, [], settings)).toBe('unmarked');
  expect(attendanceLabel('2026-10-21', '2026-10-20', undefined, [], settings)).toBe('upcoming');
  expect(attendanceLabel('2026-10-18', '2026-10-20', undefined, [], settings)).toBe('off');
  expect(attendanceLabel('2026-10-20', '2026-10-20', undefined, [], settings)).toBe('holiday');
});
it('uses approved leave dates even if the school calendar changes', () => {
  const leave = {
    status: 'approved',
    units: 0.5,
    approvedDates: ['2026-10-20'],
  } as HrWorkspace['leaves'][number];
  expect(attendanceLabel('2026-10-20', '2026-10-20', undefined, [leave], settings)).toBe(
    'half-day-leave',
  );
  expect(
    attendanceLabel(
      '2026-10-20',
      '2026-10-20',
      { status: 'late' } as HrWorkspace['attendance'][number],
      [leave],
      settings,
    ),
  ).toBe('late');
});
