import type { AttendanceRequest } from '../../services/attendanceTypes';
import type { HrWorkspace } from '../../services/hrService';
import { isDateHoliday } from '../../lib/indianHolidays';

type Day = HrWorkspace['attendance'][number];
type Leave = HrWorkspace['leaves'][number];

export function pendingLeaveOn(date: string, today: string, leaves: Leave[]) {
  return leaves.find(
    (leave) =>
      leave.status === 'pending' &&
      leave.start > today &&
      leave.start <= date &&
      leave.end >= date,
  );
}

export function cancellableLeaveOn(date: string, today: string, leaves: Leave[]) {
  return leaves.find(
    (leave) =>
      (leave.status === 'pending' || leave.status === 'approved') &&
      leave.end >= today &&
      leave.start <= date &&
      leave.end >= date,
  );
}

export function attendanceLabel(
  date: string,
  today: string,
  record: Day | undefined,
  leaves: Leave[],
  settings: HrWorkspace['settings'],
) {
  // 1. Explicit actual punch / work attendance takes highest precedence
  if (record && ['present', 'late', 'half-day', 'invalid'].includes(record.status)) {
    return record.status;
  }

  // 2. Explicit approved leave takes precedence
  const leave = leaves.find(
    (l) =>
      l.status === 'approved' &&
      (l.approvedDates
        ? l.approvedDates.includes(date)
        : l.start <= date &&
          l.end >= date &&
          settings.workingDays.includes(new Date(date + 'T12:00:00Z').getUTCDay()) &&
          !settings.holidays.includes(date)),
  );
  if (leave) return leave.units === 0.5 ? 'half-day-leave' : 'leave';

  // 3. School Holiday takes precedence over absence / unmarked
  const holiday = isDateHoliday(date, settings?.holidays);
  if (holiday.isHoliday) {
    return 'holiday';
  }

  // 4. Non-working day (Weekly off) from School Timing / Settings
  const dayOfWeek = new Date(date + 'T12:00:00Z').getUTCDay();
  if (settings?.workingDays && !settings.workingDays.includes(dayOfWeek)) {
    return 'off';
  }

  // 5. Non-holiday recorded attendance on working days (absent, unmarked, etc.)
  if (record) return record.status;

  // 6. Future or unmarked
  return date > today ? 'upcoming' : 'unmarked';
}

export function canRequestArs(
  day: Day | undefined,
  today: string,
  requests: AttendanceRequest[],
  holidays?: string[],
) {
  if (day && isDateHoliday(day.date, holidays).isHoliday) {
    return false;
  }
  return (
    !!day &&
    day.date <= today &&
    ['half-day', 'invalid', 'absent'].includes(day.status) &&
    !day.inProgress &&
    !requests.some((r) => r.date === day.date && r.status === 'pending')
  );
}
