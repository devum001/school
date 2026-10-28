import type { AttendanceRequest } from '../../services/attendanceTypes';
import type { HrWorkspace } from '../../services/hrService';
type Day = HrWorkspace['attendance'][number];
type Leave = HrWorkspace['leaves'][number];
export function pendingLeaveOn(date: string, today: string, leaves: Leave[]) {
  return leaves.find(
    (leave) =>
      leave.status === 'pending' &&
      leave.start >= today &&
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
  if (record) return record.status;
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
  if (settings.holidays.includes(date)) return 'holiday';
  if (!settings.workingDays.includes(new Date(date + 'T12:00:00Z').getUTCDay())) return 'off';
  return date > today ? 'upcoming' : 'unmarked';
}

export function canRequestArs(day: Day | undefined, today: string, requests: AttendanceRequest[]) {
  return (
    !!day &&
    day.date <= today &&
    ['half-day', 'invalid'].includes(day.status) &&
    !day.inProgress &&
    !requests.some((r) => r.date === day.date && r.status === 'pending')
  );
}
