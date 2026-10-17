import type { DemoState } from '../types/domain';
import { shiftCalendarDate } from './dates';
import { schoolWeekday } from './studentTimings';
import { configuredSchoolHours } from './schoolHours';
import { roster, statusFor } from './selectors';
import { staffDirectory } from './staffStructure';
import { staffStatusFor } from './staffAttendance';
import { defaultStaffPayroll } from './settings';
export function consecutiveAbsence(
  asOf: string,
  start: string,
  isWorking: (date: string) => boolean,
  isAbsent: (date: string) => boolean,
) {
  let count = 0,
    first = asOf;
  for (let day = asOf; day >= start; day = shiftCalendarDate(day, -1)) {
    if (!isWorking(day)) continue;
    if (!isAbsent(day)) break;
    count++;
    first = day;
  }
  return { count, first };
}
export function prolongedAbsences(state: DemoState, date: string) {
  const hours = configuredSchoolHours(state),
    config = state.staffPayroll ?? defaultStaffPayroll;
  const students = roster(state)
    .map((row) => ({
      row,
      ...consecutiveAbsence(
        date,
        state.academicYear.start,
        (d) => (hours ? hours.days.includes(schoolWeekday(d)) : schoolWeekday(d) !== 'Sunday'),
        (d) => statusFor(state, row.enrollment.id, d) === 'absent',
      ),
    }))
    .filter((item) => item.count > 3);
  const teachers = staffDirectory(state, config)
    .filter((member) => member.status === 'active' && (member.isTeachingStaff || member.teacherId))
    .map((member) => ({
      member,
      ...consecutiveAbsence(
        date,
        member.joinedOn > state.academicYear.start ? member.joinedOn : state.academicYear.start,
        (d) => schoolWeekday(d) !== config.work.weeklyOff,
        (d) => staffStatusFor(state, member.id, d) === 'absent',
      ),
    }))
    .filter((item) => item.count > 3);
  return { students, teachers };
}
