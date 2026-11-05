import { expect, it } from 'vitest';
import { attendanceLabel, canRequestArs, pendingLeaveOn } from './attendanceCalendarModel';
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

it('keeps a pending correction invalid until an explicit approved attendance outcome arrives', () => {
  const day = { status: 'invalid', late: true } as HrWorkspace['attendance'][number];
  expect(attendanceLabel('2026-10-19', '2026-10-20', day, [], settings)).toBe('invalid');
  expect(
    attendanceLabel('2026-10-19', '2026-10-20', { ...day, status: 'half-day' }, [], settings),
  ).toBe('half-day');
});

it('keeps half-day attendance separate from a pending request for full-day credit', () => {
  const day = { status: 'half-day', late: true } as HrWorkspace['attendance'][number];
  expect(attendanceLabel('2026-10-19', '2026-10-20', day, [], settings)).toBe('half-day');
});

it('opens ARS only for eligible completed half days, absent days and invalid days without a pending request', () => {
  const day = { date: '2026-10-20', status: 'half-day' } as HrWorkspace['attendance'][number];
  expect(canRequestArs(day, '2026-10-20', [])).toBe(true);
  expect(canRequestArs({ ...day, status: 'absent' }, '2026-10-20', [])).toBe(true);
  expect(canRequestArs({ ...day, status: 'invalid' }, '2026-10-20', [])).toBe(true);
  for (const status of ['present', 'late', 'unmarked', 'leave', 'holiday'])
    expect(canRequestArs({ ...day, status }, '2026-10-20', [])).toBe(false);
  expect(canRequestArs({ ...day, inProgress: true }, '2026-10-20', [])).toBe(false);
  expect(canRequestArs(day, '2026-10-19', [])).toBe(false);
  expect(
    canRequestArs(day, '2026-10-20', [{ date: day.date, status: 'pending' }] as NonNullable<
      HrWorkspace['attendanceRequests']
    >),
  ).toBe(false);
  expect(
    canRequestArs(day, '2026-10-20', [{ date: day.date, status: 'rejected' }] as NonNullable<
      HrWorkspace['attendanceRequests']
    >),
  ).toBe(true);
});
it('weekends follow school working days rather than fixed Saturday and Sunday rules', () => {
  expect(
    attendanceLabel('2026-10-18', '2026-10-20', undefined, [], {
      ...settings,
      workingDays: [0, 1, 2, 3, 4, 5, 6],
    }),
  ).toBe('unmarked');
  expect(attendanceLabel('2026-10-17', '2026-10-20', undefined, [], settings)).toBe('off');
});

it('calendar cancellation selects the pending future request and never an approved or started request', () => {
  const leave = {
    id: 'leave',
    start: '2026-10-29',
    end: '2026-10-30',
    status: 'pending',
  } as HrWorkspace['leaves'][number];
  expect(pendingLeaveOn('2026-10-30', '2026-10-27', [leave])).toBe(leave);
  expect(pendingLeaveOn('2026-10-28', '2026-10-27', [leave])).toBeUndefined();
  expect(pendingLeaveOn('2026-10-30', '2026-10-30', [leave])).toBeUndefined();
  for (const status of ['approved', 'rejected', 'cancelled'])
    expect(pendingLeaveOn('2026-10-30', '2026-10-27', [{ ...leave, status }])).toBeUndefined();
});

it('shows server-derived absence while leave is pending, then the approved leave status', () => {
  const pending = {
    status: 'pending',
    start: '2026-11-04',
    end: '2026-11-04',
    units: 1,
  } as HrWorkspace['leaves'][number];
  const day = { date: '2026-11-04', status: 'absent' } as HrWorkspace['attendance'][number];
  expect(attendanceLabel(day.date, '2026-11-05', day, [pending], settings)).toBe('absent');
  expect(
    attendanceLabel(
      day.date,
      '2026-11-05',
      { ...day, status: 'leave' },
      [{ ...pending, status: 'approved' }],
      settings,
    ),
  ).toBe('leave');
});
