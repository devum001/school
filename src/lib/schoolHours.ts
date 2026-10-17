import { z } from 'zod';
import type { DemoState, SchoolHours } from '../types/domain';
import { defaultAttendancePolicy } from './settings';
import {
  SCHOOL_WEEKDAYS,
  timeMinutes,
  schoolWeekday,
  studentTimingDateSchema,
} from './studentTimings';

const clock = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Enter a valid time.');
export const schoolHoursSchema = z
  .object({
    start: clock,
    end: clock,
    days: z
      .array(z.enum(SCHOOL_WEEKDAYS))
      .min(1, 'Select at least one working day.')
      .refine((days) => new Set(days).size === days.length, 'Remove duplicate days.'),
  })
  .refine((hours) => hours.end > hours.start, {
    path: ['end'],
    message: 'Closing time must be after opening time.',
  });

/** Existing class-specific hours supply an initial school-wide value without deleting old schedules. */
export function configuredSchoolHours(state: DemoState): SchoolHours | undefined {
  if (state.schoolHours) return state.schoolHours;
  const previous = state.studentTimings?.find((t) => t.schoolId === state.school.id);
  return previous ? { start: previous.start, end: previous.end, days: previous.days } : undefined;
}
export function schoolHoursForDate(state: DemoState, date: string): SchoolHours | undefined {
  const hours = configuredSchoolHours(state);
  return hours &&
    studentTimingDateSchema.safeParse(date).success &&
    hours.days.includes(schoolWeekday(date))
    ? hours
    : undefined;
}
const clockFromMinutes = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
export function saveSchoolHours(state: DemoState, input: SchoolHours): DemoState {
  const parsed = schoolHoursSchema.parse(input);
  const previous = configuredSchoolHours(state);
  const policy = state.attendancePolicy ?? defaultAttendancePolicy;
  const start = timeMinutes(parsed.start),
    end = timeMinutes(parsed.end),
    duration = end - start;
  if (duration <= policy.graceMinutes)
    throw new Error('The school day must be longer than the attendance grace period.');
  const absenceOffset = previous
    ? Math.max(0, timeMinutes(policy.absenceTime) - timeMinutes(previous.start))
    : policy.graceMinutes;
  const closingChange = previous ? end - timeMinutes(previous.end) : 0;
  const departureEnd = Math.max(
    start + 1,
    Math.min(end, timeMinutes(policy.earlyExitEnd) + closingChange),
  );
  const departureStart = Math.max(
    start,
    Math.min(departureEnd - 1, timeMinutes(policy.earlyExitStart) + closingChange),
  );
  return {
    ...state,
    schoolHours: { ...parsed, days: SCHOOL_WEEKDAYS.filter((day) => parsed.days.includes(day)) },
    attendancePolicy: {
      ...policy,
      studentStart: parsed.start,
      studentEnd: parsed.end,
      absenceTime: clockFromMinutes(Math.min(end, start + absenceOffset)),
      earlyExitStart: clockFromMinutes(departureStart),
      earlyExitEnd: clockFromMinutes(departureEnd),
      minimumCampusMinutes: Math.min(policy.minimumCampusMinutes, duration),
    },
  };
}
