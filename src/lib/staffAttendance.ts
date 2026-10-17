import { z } from 'zod';
import type { AttendanceStatus, DemoState, StaffPayrollConfig } from '../types/domain';
import { getSchoolDate } from './dates';
import { attendanceStatusSchema } from './operations';
import { staffDirectory } from './staffStructure';

export const staffAttendanceSchema = z.object({
  schoolId: z.string(),
  staffId: z.string(),
  date: z.iso.date(),
  status: attendanceStatusSchema,
});
export function staffStatusFor(state: DemoState, staffId: string, date: string): AttendanceStatus {
  return (
    state.staffAttendance
      ?.filter(
        (record) =>
          record.schoolId === state.school.id && record.staffId === staffId && record.date === date,
      )
      .at(-1)?.status ?? 'unmarked'
  );
}
export function saveStaffAttendance(
  state: DemoState,
  config: StaffPayrollConfig,
  date: string,
  changes: Record<string, AttendanceStatus>,
): DemoState {
  z.iso.date().parse(date);
  if (date > getSchoolDate() || date < state.academicYear.start)
    throw new Error('Choose a date in the academic year, up to today.');
  const members = staffDirectory(state, config);
  if (!Object.keys(changes).length) throw new Error('Mark staff attendance before saving.');
  const records = Object.entries(changes).map(([staffId, status]) => {
    const member = members.find((person) => person.id === staffId);
    if (!member || member.joinedOn > date)
      throw new Error('Staff member was not enrolled on this date.');
    return staffAttendanceSchema.parse({ schoolId: state.school.id, staffId, date, status });
  });
  return {
    ...state,
    staffAttendance: [
      ...(state.staffAttendance ?? []).filter(
        (record) =>
          !(
            record.schoolId === state.school.id &&
            record.date === date &&
            Object.hasOwn(changes, record.staffId)
          ),
      ),
      ...records,
    ],
  };
}
