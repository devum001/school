import { describe, expect, it } from 'vitest';
import { createSeed } from '../mocks/seed';
import { saveSchoolHours, configuredSchoolHours, schoolHoursForDate } from './schoolHours';
import { saveStudentTiming, studentLateCutoff } from './studentTimings';
import { defaultAttendancePolicy, saveAttendancePolicy } from './settings';

describe('simple school-wide timing', () => {
  it('uses selected weekdays for all sections, with no hidden default', () => {
    expect(configuredSchoolHours(createSeed())).toBeUndefined();
    const state = saveSchoolHours(createSeed(), {
      start: '09:00',
      end: '16:00',
      days: ['Monday', 'Tuesday', 'Saturday'],
    });
    expect(studentLateCutoff(schoolHoursForDate(state, '2026-10-12')!, 15)).toBe('09:15 AM');
    expect(schoolHoursForDate(state, '2026-10-18')).toBeUndefined();
    expect(schoolHoursForDate(state, '2026-02-31')).toBeUndefined();
    expect(state.attendancePolicy?.absenceTime).toBe('09:15');
  });
  it('preserves old schedules while using their first timing as an initial value', () => {
    const previous = saveStudentTiming(createSeed(), {
      name: 'Primary',
      start: '09:00',
      end: '15:00',
      days: ['Monday'],
      sectionIds: ['class-5-a'],
    });
    expect(configuredSchoolHours(previous)?.start).toBe('09:00');
    const updated = saveSchoolHours(previous, {
      start: '10:00',
      end: '16:00',
      days: ['Monday', 'Tuesday'],
    });
    expect(configuredSchoolHours(updated)?.start).toBe('10:00');
    expect(updated.studentTimings).toEqual(previous.studentTimings);
  });
  it('rebases attendance clocks and prevents policies outside the school day', () => {
    let state = saveSchoolHours(createSeed(), { start: '08:00', end: '15:00', days: ['Monday'] });
    state = saveSchoolHours(state, { start: '10:00', end: '13:00', days: ['Monday'] });
    expect(state.attendancePolicy?.absenceTime).toBe('10:15');
    expect(state.attendancePolicy!.earlyExitEnd <= '13:00').toBe(true);
    expect(state.attendancePolicy?.minimumCampusMinutes).toBe(180);
    expect(() =>
      saveAttendancePolicy(state, { ...state.attendancePolicy!, minimumCampusMinutes: 181 }),
    ).toThrow(/school day/);
    expect(() =>
      saveAttendancePolicy(state, { ...state.attendancePolicy!, absenceTime: '09:00' }),
    ).toThrow(/within school hours/);
    expect(() =>
      saveSchoolHours(createSeed(), { start: '10:00', end: '09:00', days: ['Monday'] }),
    ).toThrow();
    expect(() =>
      saveSchoolHours(createSeed(), { start: '08:00', end: '08:10', days: ['Monday'] }),
    ).toThrow(/grace period/);
    expect(() =>
      saveSchoolHours(createSeed(), { start: '08:00', end: '15:00', days: [] }),
    ).toThrow();
    expect(defaultAttendancePolicy.graceMinutes).toBe(15);
  });
});
