import { z } from 'zod';
import { displayPreferences } from './displayPreferences';
import type {
  ClassTimetable,
  DemoState,
  SchoolWeekday,
  StudentTiming,
  TimetableSlot,
} from '../types/domain';
import { defaultAttendancePolicy } from './settings';

export const SCHOOL_WEEKDAYS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
] as const;
export const studentTimingDateSchema = z.iso.date();
const clockTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Enter a valid time.');
const unique = (values: string[]) => new Set(values).size === values.length;
export const TIMETABLE_KINDS = [
  'entry',
  'prayer',
  'period',
  'transition',
  'break',
  'lunch',
  'activity',
  'dismissal',
] as const;
export const TIMETABLE_LABELS: Record<TimetableSlot['kind'], string> = {
  entry: 'School entry',
  prayer: 'Prayer / assembly',
  period: 'Class period',
  transition: 'Between classes',
  break: 'Short break',
  lunch: 'Lunch',
  activity: 'Activity',
  dismissal: 'Dismissal',
};
export const isTimetableMilestone = (kind: TimetableSlot['kind']) =>
  kind === 'entry' || kind === 'dismissal';
export const studentTimingInputSchema = z
  .object({
    name: z.string().trim().min(1, 'Enter a timing name.').max(80),
    days: z
      .array(z.enum(SCHOOL_WEEKDAYS))
      .min(1, 'Select at least one day.')
      .refine(unique, 'Remove duplicate days.'),
    start: clockTime,
    end: clockTime,
    sectionIds: z
      .array(z.string())
      .min(1, 'Select at least one class or section.')
      .refine(unique, 'Remove duplicate sections.'),
  })
  .refine((input) => input.end > input.start, {
    path: ['end'],
    message: 'End time must be after start time.',
  });
export const studentTimingRecordSchema = studentTimingInputSchema.safeExtend({
  id: z.string(),
  schoolId: z.string(),
});
export const timetableSlotSchema = z
  .object({
    id: z.string(),
    name: z.string().trim().min(1, 'Enter a row name.').max(80),
    kind: z.enum(TIMETABLE_KINDS),
    start: clockTime,
    end: clockTime,
    teacherId: z.string().optional(),
  })
  .refine(
    (slot) => (isTimetableMilestone(slot.kind) ? slot.end === slot.start : slot.end > slot.start),
    {
      path: ['end'],
      message: 'End must be after start. School entry and dismissal use one time.',
    },
  );
export const classTimetableSchema = z.object({
  id: z.string(),
  schoolId: z.string(),
  sectionId: z.string(),
  timingId: z.string(),
  day: z.enum(SCHOOL_WEEKDAYS),
  slots: z.array(timetableSlotSchema),
});
export type StudentTimingInput = Omit<StudentTiming, 'id' | 'schoolId'>;
export function timeMinutes(value: string): number {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}
export function formatSchoolTime(value: string): string {
  if (displayPreferences().timeFormat === '24-hour') return value;
  const [hours, minutes] = value.split(':').map(Number);
  return `${String(hours % 12 || 12).padStart(2, '0')}:${String(minutes).padStart(2, '0')} ${hours >= 12 ? 'PM' : 'AM'}`;
}
export function schoolWeekday(date: string): SchoolWeekday {
  const index = new Date(`${date}T12:00:00Z`).getUTCDay();
  return SCHOOL_WEEKDAYS[(index + 6) % 7];
}
export function studentTimingFor(
  state: DemoState,
  sectionId: string,
  date: string,
): StudentTiming | undefined {
  if (!studentTimingDateSchema.safeParse(date).success) return undefined;
  const day = schoolWeekday(date);
  return state.studentTimings?.find(
    (timing) =>
      timing.schoolId === state.school.id &&
      timing.sectionIds.includes(sectionId) &&
      timing.days.includes(day),
  );
}
export function studentLateCutoff(
  timing: Pick<StudentTiming, 'start'>,
  graceMinutes: number,
): string {
  const cutoff = timeMinutes(timing.start) + graceMinutes;
  return formatSchoolTime(
    `${String(Math.floor(cutoff / 60)).padStart(2, '0')}:${String(cutoff % 60).padStart(2, '0')}`,
  );
}
function validSlots(slots: TimetableSlot[], timing: StudentTiming) {
  const ids = slots.map((slot) => slot.id);
  if (!unique(ids)) throw new Error('Each timetable row must have a unique identifier.');
  slots.forEach((slot, index) => {
    if (slot.kind === 'entry' && (index !== 0 || slot.start !== timing.start))
      throw new Error('School entry must be the first row, at the configured student start time.');
    if (slot.kind === 'dismissal' && (index !== slots.length - 1 || slot.start !== timing.end))
      throw new Error('Dismissal must be the last row, at the configured student end time.');
    if (slot.start < timing.start || slot.end > timing.end)
      throw new Error(
        `Row ${index + 1} must fit within ${formatSchoolTime(timing.start)} – ${formatSchoolTime(timing.end)}.`,
      );
    if (index > 0 && slot.start < slots[index - 1].end)
      throw new Error(`Row ${index + 1} overlaps the previous row. Keep rows in time order.`);
  });
}
export function saveStudentTiming(
  state: DemoState,
  input: StudentTimingInput,
  timingId?: string,
): DemoState {
  const parsed = studentTimingInputSchema.parse(input);
  const timings = state.studentTimings ?? [];
  if (
    timingId &&
    !timings.some((timing) => timing.id === timingId && timing.schoolId === state.school.id)
  )
    throw new Error('Student timing was not found.');
  if (
    parsed.sectionIds.some(
      (id) =>
        !state.sections.some(
          (section) => section.id === id && section.schoolId === state.school.id,
        ),
    )
  )
    throw new Error('Select sections from this school.');
  const grace = (state.attendancePolicy ?? defaultAttendancePolicy).graceMinutes;
  if (timeMinutes(parsed.end) - timeMinutes(parsed.start) <= grace)
    throw new Error(
      `The school day must be longer than the ${grace}-minute attendance grace period.`,
    );
  for (const timing of timings.filter(
    (entry) => entry.schoolId === state.school.id && entry.id !== timingId,
  )) {
    if (timing.name.toLowerCase() === parsed.name.toLowerCase())
      throw new Error('A timing with this name already exists. Use a different name.');
    if (
      timing.days.some((day) => parsed.days.includes(day)) &&
      timing.sectionIds.some((id) => parsed.sectionIds.includes(id))
    )
      throw new Error(
        `These days and sections are already assigned to “${timing.name}”. Choose different days or sections.`,
      );
  }
  const next: StudentTiming = {
    id: timingId ?? crypto.randomUUID(),
    schoolId: state.school.id,
    ...parsed,
    days: SCHOOL_WEEKDAYS.filter((day) => parsed.days.includes(day)),
  };
  for (const timetable of state.classTimetables?.filter(
    (table) => table.schoolId === state.school.id && table.timingId === timingId,
  ) ?? []) {
    if (!next.sectionIds.includes(timetable.sectionId))
      throw new Error(
        'Clear the affected section’s timetable before removing its timing assignment.',
      );
    if (!next.days.includes(timetable.day))
      throw new Error('Clear the affected day’s timetable before removing its working day.');
    validSlots(timetable.slots, next);
  }
  return {
    ...state,
    studentTimings: timingId
      ? timings.map((timing) =>
          timing.id === timingId && timing.schoolId === state.school.id ? next : timing,
        )
      : [...timings, next],
  };
}
export function deleteStudentTiming(state: DemoState, timingId: string): DemoState {
  if (
    !state.studentTimings?.some(
      (timing) => timing.id === timingId && timing.schoolId === state.school.id,
    )
  )
    throw new Error('Student timing was not found.');
  return {
    ...state,
    studentTimings: state.studentTimings.filter(
      (timing) => timing.schoolId !== state.school.id || timing.id !== timingId,
    ),
    classTimetables: state.classTimetables?.filter(
      (table) => table.schoolId !== state.school.id || table.timingId !== timingId,
    ),
  };
}
export function saveClassTimetable(
  state: DemoState,
  sectionId: string,
  timingId: string,
  day: SchoolWeekday,
  input: TimetableSlot[],
): DemoState {
  const timing = state.studentTimings?.find(
    (entry) =>
      entry.schoolId === state.school.id &&
      entry.id === timingId &&
      entry.sectionIds.includes(sectionId),
  );
  if (!timing) throw new Error('Set student timings for this section first.');
  if (
    !state.sections.some(
      (section) => section.schoolId === state.school.id && section.id === sectionId,
    )
  )
    throw new Error('Select a section from this school.');
  if (!timing.days.includes(day)) throw new Error('Select a working day from this student timing.');
  const slots = z.array(timetableSlotSchema).min(1, 'Add at least one timetable row.').parse(input);
  validSlots(slots, timing);
  const tables = state.classTimetables ?? [];
  for (const slot of slots) {
    if (!slot.teacherId) continue;
    if (slot.kind !== 'period') throw new Error('Assign teachers to class periods only.');
    const teacher = state.teachers.find(
      (t) => t.id === slot.teacherId && t.schoolId === state.school.id,
    );
    const alreadyAssigned = tables.some(
      (t) =>
        t.sectionId === sectionId &&
        t.timingId === timingId &&
        t.day === day &&
        t.slots.some((s) => s.teacherId === slot.teacherId),
    );
    if (!teacher || (teacher.status !== 'active' && !alreadyAssigned))
      throw new Error('Choose an active teacher from this school.');
    const conflict = tables.find(
      (table) =>
        table.schoolId === state.school.id &&
        table.day === day &&
        table.sectionId !== sectionId &&
        table.slots.some(
          (other) =>
            other.teacherId === slot.teacherId && slot.start < other.end && other.start < slot.end,
        ),
    );
    if (conflict)
      throw new Error(`${teacher.name} already has another class at this time on ${day}.`);
  }
  const existing = tables.find(
    (table) =>
      table.schoolId === state.school.id &&
      table.sectionId === sectionId &&
      table.timingId === timingId &&
      table.day === day,
  );
  const next: ClassTimetable = {
    id: existing?.id ?? crypto.randomUUID(),
    schoolId: state.school.id,
    sectionId,
    timingId,
    day,
    slots,
  };
  return {
    ...state,
    classTimetables: existing
      ? tables.map((table) =>
          table.id === existing.id && table.schoolId === state.school.id ? next : table,
        )
      : [...tables, next],
  };
}
export function clearClassTimetable(
  state: DemoState,
  sectionId: string,
  timingId: string,
  day: SchoolWeekday,
): DemoState {
  return {
    ...state,
    classTimetables: state.classTimetables?.filter(
      (table) =>
        table.schoolId !== state.school.id ||
        table.sectionId !== sectionId ||
        table.timingId !== timingId ||
        table.day !== day,
    ),
  };
}
