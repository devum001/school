import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { createSeed } from '../mocks/seed';
import { prolongedAbsences, consecutiveAbsence } from './attendanceFollowup';
import { shiftCalendarDate } from './dates';
import { roster } from './selectors';
import { defaultStaffPayroll } from './settings';
import { staffDirectory } from './staffStructure';
import {
  savePreferences,
  preferencesFor,
  saveSecurity,
  securityFor,
  withAudit,
} from './adminSettings';
import { configureDisplay } from './displayPreferences';
import { displayDate } from './config';
import { formatSchoolTime } from './studentTimings';
import { schoolExport, EXPORT_TYPES } from './schoolExports';
import { recordStudentPayment } from './financeTransactions';
import { saveFeePlan } from './feePlans';
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-14T06:30:00Z'));
});
afterEach(() => {
  vi.useRealTimers();
  configureDisplay();
});
describe('prolonged absence follow-up', () => {
  it('counts more than three consecutive working days, skips Sunday, and stops on unmarked/half-day/present', () => {
    const state = createSeed('2026-10-14'),
      row = roster(state)[0],
      teacher = staffDirectory(state, defaultStaffPayroll)[0];
    const days = ['2026-10-09', '2026-10-10', '2026-10-12', '2026-10-13', '2026-10-14'];
    state.attendance = days.map((date) => ({
      schoolId: state.school.id,
      enrollmentId: row.enrollment.id,
      date,
      status: 'absent',
    }));
    state.staffAttendance = days.map((date) => ({
      schoolId: state.school.id,
      staffId: teacher.id,
      date,
      status: 'absent',
    }));
    expect(prolongedAbsences(state, '2026-10-14').students[0].count).toBe(5);
    expect(prolongedAbsences(state, '2026-10-14').teachers[0].count).toBe(5);
    for (const status of ['unmarked', 'half-day', 'present'] as const) {
      state.attendance[2].status = status;
      expect(prolongedAbsences(state, '2026-10-14').students).toHaveLength(0);
    }
    expect(
      consecutiveAbsence(
        '2026-10-14',
        '2026-10-01',
        () => true,
        (date) => date >= '2026-10-12',
      ).count,
    ).toBe(3);
    expect(shiftCalendarDate('2026-03-01', -1)).toBe('2026-02-28');
  });
});
describe('saved admin preferences and local audit', () => {
  it('validates settings, preserves old records and applies display preferences without storing passwords', () => {
    const seed = createSeed(),
      settings = {
        ...preferencesFor(seed),
        dateFormat: 'DD/MM/YYYY' as const,
        timeFormat: '24-hour' as const,
        landingPage: 'Attendance' as const,
      };
    const saved = savePreferences(seed, settings);
    configureDisplay(saved.preferences);
    expect(displayDate('2026-10-14')).toBe('14 Oct 2026');
    expect(formatSchoolTime('15:30')).toBe('15:30');
    expect(saved.students).toBe(seed.students);
    expect(() =>
      savePreferences(seed, { ...settings, academicYearId: 'another-school-year' }),
    ).toThrow();
    expect(
      saveSecurity(seed, { ...securityFor(seed), otherSessionActive: false }).security
        ?.sessionTimeout,
    ).toBe(30);
    expect(Object.keys(saveSecurity(seed, securityFor(seed)).security!)).not.toContain('password');
    const audited = withAudit(seed, saved);
    expect(audited.auditLog?.[0]).toMatchObject({
      module: 'School Settings',
      actor: seed.school.principal,
    });
    expect(withAudit(audited, audited)).toBe(audited);
  });
  it('tracks payments with their actual amount, actor and student, and exports only this school', () => {
    const seed = createSeed(),
      row = roster(seed)[0];
    const state = saveFeePlan({ ...seed, payments: [], obligations: [] }, row.enrollment.id, {
      kind: 'One Time',
      totalFee: 100000,
      installments: [{ amount: 100000, dueDate: '2026-10-14' }],
    });
    const paid = withAudit(
      state,
      recordStudentPayment(state, {
        enrollmentId: row.enrollment.id,
        amount: 50000,
        date: '2026-10-14',
        method: 'Cash',
        reference: '',
      }),
    );
    expect(paid.auditLog?.[0]).toMatchObject({
      action: 'Recorded fee payment',
      module: 'Finance',
      actor: seed.school.principal,
    });
    expect(paid.auditLog?.[0].detail).toContain(row.student.name);
    expect(paid.auditLog?.[0].detail).toContain('500');
    paid.payments.push({ ...paid.payments[0], id: 'foreign-payment', schoolId: 'foreign' });
    const fees = schoolExport(paid, 'Fees & Payments');
    expect(fees.rows).toHaveLength(2);
    expect(fees.rows[1]).toContain(500);
    for (const type of EXPORT_TYPES) {
      const data = schoolExport(paid, type);
      expect(data.headers.length).toBeGreaterThan(0);
      for (const r of data.rows) expect(r.length).toBe(data.headers.length);
    }
  });
});
