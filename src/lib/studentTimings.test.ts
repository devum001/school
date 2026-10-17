import { describe, expect, it } from 'vitest';
import { createSeed } from '../mocks/seed';
import { restoreSchoolState } from '../mocks/restore';
import { defaultAttendancePolicy, saveAttendancePolicy } from './settings';
import {
  saveStudentTiming,
  studentTimingFor,
  studentLateCutoff,
  saveClassTimetable,
  clearClassTimetable,
  deleteStudentTiming,
  type StudentTimingInput,
} from './studentTimings';
import type { TimetableSlot } from '../types/domain';

const input: StudentTimingInput = {
  name: 'Primary',
  days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
  start: '09:00',
  end: '15:00',
  sectionIds: ['class-5-a'],
};
const slots: TimetableSlot[] = [
  { id: 'assembly', name: 'Assembly', kind: 'activity', start: '09:00', end: '09:10' },
  { id: 'math', name: 'Mathematics', kind: 'period', start: '09:10', end: '10:00' },
  { id: 'break', name: 'Break', kind: 'break', start: '10:00', end: '10:15' },
];
describe('student timings and class timetables', () => {
  it('does not infer a student start time from old attendance defaults', () => {
    const state = { ...createSeed(), attendancePolicy: defaultAttendancePolicy };
    expect(studentTimingFor(state, 'class-5-a', '2026-10-12')).toBeUndefined();
  });
  it('resolves class and day-specific hours and computes a cutoff from their start', () => {
    let state = saveStudentTiming(createSeed(), input);
    state = saveStudentTiming(state, {
      ...input,
      name: 'Saturday',
      days: ['Saturday'],
      start: '10:00',
      end: '12:00',
    });
    expect(studentLateCutoff(studentTimingFor(state, 'class-5-a', '2026-10-12')!, 15)).toBe(
      '09:15 AM',
    );
    expect(studentLateCutoff(studentTimingFor(state, 'class-5-a', '2026-10-17')!, 15)).toBe(
      '10:15 AM',
    );
    expect(studentTimingFor(state, 'class-5-a', '2026-10-18')).toBeUndefined();
    expect(studentTimingFor(state, 'class-5-b', '2026-10-12')).toBeUndefined();
    expect(studentTimingFor(state, 'class-5-a', '2026-02-31')).toBeUndefined();
  });
  it('rejects ambiguous assignments, invalid hours, foreign sections, and oversized grace', () => {
    const state = saveStudentTiming(createSeed(), input);
    expect(() => saveStudentTiming(state, { ...input, name: 'Conflicting hours' })).toThrow(
      /already assigned/,
    );
    expect(() =>
      saveStudentTiming(state, { ...input, name: 'Invalid', days: ['Sunday'], end: '08:00' }),
    ).toThrow();
    expect(() =>
      saveStudentTiming(state, { ...input, name: 'Other', sectionIds: ['unknown'] }),
    ).toThrow();
    expect(() =>
      saveStudentTiming(state, { ...input, name: 'Very short', days: ['Sunday'], end: '09:10' }),
    ).toThrow(/grace period/);
    const short = saveStudentTiming(createSeed(), { ...input, end: '10:00' });
    expect(() =>
      saveAttendancePolicy(short, { ...defaultAttendancePolicy, graceMinutes: 60 }),
    ).toThrow(/grace period/);
  });
  it('allows different sections to share hours and saves arbitrary rows separately by weekday', () => {
    let state = saveStudentTiming(createSeed(), input);
    state = saveStudentTiming(state, { ...input, name: 'Section B', sectionIds: ['class-5-b'] });
    const timingId = state.studentTimings![0].id;
    state = saveClassTimetable(state, 'class-5-a', timingId, 'Monday', slots);
    state = saveClassTimetable(state, 'class-5-a', timingId, 'Tuesday', [
      { ...slots[1], name: 'Science' },
    ]);
    expect(state.classTimetables).toHaveLength(2);
    expect(state.classTimetables![0].slots).toHaveLength(3);
    expect(state.classTimetables![1].slots[0].name).toBe('Science');
    expect(
      clearClassTimetable(state, 'class-5-a', timingId, 'Monday').classTimetables?.map(
        (table) => table.day,
      ),
    ).toEqual(['Tuesday']);
  });
  it('rejects overlapping, unordered, out-of-hours, empty, and wrong-day timetables', () => {
    const state = saveStudentTiming(createSeed(), input);
    const timingId = state.studentTimings![0].id;
    expect(() =>
      saveClassTimetable(state, 'class-5-a', timingId, 'Monday', [
        slots[0],
        { ...slots[1], start: '09:05' },
      ]),
    ).toThrow(/overlaps/);
    expect(() =>
      saveClassTimetable(state, 'class-5-a', timingId, 'Monday', [{ ...slots[1], end: '16:00' }]),
    ).toThrow(/fit within/);
    expect(() => saveClassTimetable(state, 'class-5-a', timingId, 'Monday', [])).toThrow();
    expect(() => saveClassTimetable(state, 'class-5-a', timingId, 'Sunday', slots)).toThrow(
      /working day/,
    );
  });
  it('protects existing class periods when hours, days, or assignments are edited', () => {
    let state = saveStudentTiming(createSeed(), input);
    const timingId = state.studentTimings![0].id;
    state = saveClassTimetable(state, 'class-5-a', timingId, 'Monday', slots);
    expect(() => saveStudentTiming(state, { ...input, start: '10:00' }, timingId)).toThrow(
      /fit within/,
    );
    expect(() => saveStudentTiming(state, { ...input, days: ['Tuesday'] }, timingId)).toThrow(
      /affected day/,
    );
    expect(() =>
      saveStudentTiming(state, { ...input, sectionIds: ['class-5-b'] }, timingId),
    ).toThrow(/affected section/);
    expect(state.classTimetables![0].slots[0].name).toBe('Assembly');
  });
  it('restores timings and timetables without changing pupil or payment data', () => {
    const fresh = createSeed();
    let state = saveStudentTiming(fresh, input);
    state = saveClassTimetable(state, 'class-5-a', state.studentTimings![0].id, 'Monday', slots);
    const restored = restoreSchoolState(fresh, state);
    expect(restored.studentTimings).toEqual(state.studentTimings);
    expect(restored.classTimetables).toEqual(state.classTimetables);
    const removed = deleteStudentTiming(restored, state.studentTimings![0].id);
    expect(removed.studentTimings).toHaveLength(0);
    expect(removed.classTimetables).toHaveLength(0);
    expect(removed.students).toBe(restored.students);
    expect(removed.payments).toBe(restored.payments);
  });
});
