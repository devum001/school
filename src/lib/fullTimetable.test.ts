import { describe, expect, it } from 'vitest';
import { createSeed } from '../mocks/seed';
import { saveClassTimetable, saveStudentTiming, timetableSlotSchema } from './studentTimings';
import type { TimetableSlot } from '../types/domain';

const fullDay: TimetableSlot[] = [
  { id: 'entry', kind: 'entry', name: 'School entry', start: '08:00', end: '08:00' },
  { id: 'prayer', kind: 'prayer', name: 'Morning prayer', start: '08:00', end: '08:15' },
  { id: 'math', kind: 'period', name: 'Mathematics', start: '08:15', end: '09:00' },
  { id: 'transition', kind: 'transition', name: 'Change classrooms', start: '09:00', end: '09:05' },
  { id: 'science', kind: 'period', name: 'Science', start: '09:05', end: '10:00' },
  { id: 'lunch', kind: 'lunch', name: 'Lunch', start: '12:00', end: '12:40' },
  { id: 'dismissal', kind: 'dismissal', name: 'Dismissal', start: '15:00', end: '15:00' },
];
function setup() {
  return saveStudentTiming(createSeed(), {
    name: 'Weekdays',
    start: '08:00',
    end: '15:00',
    days: ['Monday', 'Tuesday'],
    sectionIds: ['class-5-a', 'class-5-b'],
  });
}
describe('complete school-day timetables', () => {
  it('saves entry and dismissal as milestones alongside flexible prayer, periods, transitions and lunch', () => {
    const state = setup();
    const next = saveClassTimetable(
      state,
      'class-5-a',
      state.studentTimings![0].id,
      'Monday',
      fullDay,
    );
    expect(next.classTimetables![0].slots).toEqual(fullDay);
    expect(timetableSlotSchema.safeParse({ ...fullDay[1], end: '08:00' }).success).toBe(false);
    expect(() =>
      saveClassTimetable(state, 'class-5-a', state.studentTimings![0].id, 'Monday', [
        { ...fullDay[0], start: '08:01', end: '08:01' },
      ]),
    ).toThrow(/School entry/);
    expect(() =>
      saveClassTimetable(state, 'class-5-a', state.studentTimings![0].id, 'Monday', [
        { ...fullDay[6], start: '14:59', end: '14:59' },
      ]),
    ).toThrow(/Dismissal/);
  });
  it('rejects overlapping teacher lessons across sections while allowing consecutive lessons and different days', () => {
    let state = setup();
    const timingId = state.studentTimings![0].id;
    const teacherId = state.teachers[0].id;
    const lesson = { ...fullDay[2], teacherId };
    state = saveClassTimetable(state, 'class-5-a', timingId, 'Monday', [lesson]);
    expect(() => saveClassTimetable(state, 'class-5-b', timingId, 'Monday', [lesson])).toThrow(
      /another class/,
    );
    expect(() =>
      saveClassTimetable(state, 'class-5-b', timingId, 'Monday', [
        { ...lesson, start: '09:00', end: '09:45' },
      ]),
    ).not.toThrow();
    expect(() =>
      saveClassTimetable(state, 'class-5-b', timingId, 'Tuesday', [lesson]),
    ).not.toThrow();
    expect(() =>
      saveClassTimetable(state, 'class-5-a', timingId, 'Monday', [
        { ...lesson, teacherId: 'foreign' },
      ]),
    ).toThrow(/this school/);
    expect(() =>
      saveClassTimetable(state, 'class-5-a', timingId, 'Monday', [{ ...fullDay[1], teacherId }]),
    ).toThrow(/periods only/);
  });
});
