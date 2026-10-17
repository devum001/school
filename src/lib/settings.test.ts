import { describe, expect, it } from 'vitest';
import { createSeed } from '../mocks/seed';
import { restoreSchoolState } from '../mocks/restore';
import {
  defaultAttendancePolicy,
  defaultStaffPayroll,
  saveAttendancePolicy,
  saveSchoolProfile,
  saveStaffPayroll,
} from './settings';

describe('school settings', () => {
  it('stores staff rules without changing employee records and restores the saved preferences', () => {
    const state = createSeed();
    const config = {
      ...defaultStaffPayroll,
      payroll: { ...defaultStaffPayroll.payroll, paymentDay: 7 },
    };
    const next = saveStaffPayroll(state, config);
    expect(next.teachers).toBe(state.teachers);
    expect(state.staffPayroll).toBeUndefined();
    expect(restoreSchoolState(state, next).staffPayroll?.payroll.paymentDay).toBe(7);
  });
  it('rejects duplicate staff structure names and inconsistent work and payroll rules', () => {
    const state = createSeed();
    expect(() =>
      saveStaffPayroll(state, {
        ...defaultStaffPayroll,
        setup: {
          departments: [
            defaultStaffPayroll.setup.departments[0],
            { ...defaultStaffPayroll.setup.departments[0], id: 'other', name: 'academics' },
          ],
        },
      }),
    ).toThrow();
    expect(() =>
      saveStaffPayroll(state, {
        ...defaultStaffPayroll,
        work: { ...defaultStaffPayroll.work, lateAfter: '16:00' },
      }),
    ).toThrow();
    expect(() =>
      saveStaffPayroll(state, {
        ...defaultStaffPayroll,
        work: { ...defaultStaffPayroll.work, halfDayMinutes: 600 },
      }),
    ).toThrow();
    expect(() =>
      saveStaffPayroll(state, {
        ...defaultStaffPayroll,
        payroll: { ...defaultStaffPayroll.payroll, components: ['Bonus'] },
      }),
    ).toThrow();
    expect(() =>
      saveStaffPayroll(state, {
        ...defaultStaffPayroll,
        payroll: { ...defaultStaffPayroll.payroll, paymentDay: 32 },
      }),
    ).toThrow();
    expect(() =>
      saveStaffPayroll(state, {
        ...defaultStaffPayroll,
        payroll: {
          ...defaultStaffPayroll.payroll,
          lateDeduction: 'fixed-amount',
          lateDeductionAmount: 0,
        },
      }),
    ).toThrow();
  });
  it('updates the school profile while preserving school identity and related records', () => {
    const state = createSeed();
    const next = saveSchoolProfile(state, { ...state.school, name: 'Updated School' });
    expect(next.school.name).toBe('Updated School');
    expect(next.school.id).toBe(state.school.id);
    expect(state.school.name).toBe('Vidya Niketan Public School');
    expect(next.enrollments).toBe(state.enrollments);
  });
  it('rejects invalid shifts and inconsistent warning thresholds', () => {
    const state = createSeed();
    expect(() =>
      saveAttendancePolicy(state, { ...defaultAttendancePolicy, absenceTime: '25:00' }),
    ).toThrow();
    expect(() =>
      saveAttendancePolicy(state, { ...defaultAttendancePolicy, warningAttendance: 70 }),
    ).toThrow();
    expect(() =>
      saveAttendancePolicy(state, { ...defaultAttendancePolicy, minimumCampusMinutes: 721 }),
    ).toThrow();
  });
  it('restores saved settings and supplies defaults for older school profiles', () => {
    const fresh = createSeed();
    const saved = saveAttendancePolicy(
      saveSchoolProfile(fresh, { ...fresh.school, name: 'Saved School' }),
      { ...defaultAttendancePolicy, lateSms: false },
    );
    expect(restoreSchoolState(fresh, saved).school.name).toBe('Saved School');
    expect(restoreSchoolState(fresh, saved).attendancePolicy?.lateSms).toBe(false);
    const legacy = {
      ...saved,
      school: {
        id: fresh.school.id,
        name: 'Legacy School',
        city: fresh.school.city,
        motto: fresh.school.motto,
      },
    };
    expect(restoreSchoolState(fresh, legacy).school.code).toBe(fresh.school.code);
  });
});
