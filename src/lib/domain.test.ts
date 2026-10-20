import { refreshPresentationCopy } from './presentation';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSeed } from '../mocks/seed';
import {
  attendanceSummary,
  eligibleRecipients,
  feeSummary,
  installments,
  resultSummary,
  roster,
  statusFor,
} from './selectors';
import {
  dispatchNotifications,
  notificationMessage,
  recordPayment,
  saveAttendance,
} from './operations';
const DEMO_DATE = '2026-10-10';
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-10T06:30:00Z'));
});
afterEach(() => vi.useRealTimers());
describe('consistent school model', () => {
  it('uses unique student identities with valid school, year, class and section relationships', () => {
    const s = createSeed();
    expect(new Set(s.students.map((x) => x.id)).size).toBe(s.students.length);
    s.enrollments.forEach((e) => {
      expect(s.students.some((x) => x.id === e.studentId && x.schoolId === e.schoolId)).toBe(true);
      expect(
        s.sections.some(
          (x) => x.id === e.sectionId && x.classId === e.classId && x.schoolId === e.schoolId,
        ),
      ).toBe(true);
      expect(e.academicYearId).toBe(s.academicYear.id);
    });
  });
  it('excludes inactive enrollments from attendance roster, retains their financial history', () => {
    const s = createSeed();
    expect(roster(s)).toHaveLength(143);
    expect(roster(s, true)).toHaveLength(144);
    expect(feeSummary(s, 'enr-144').payments.length).toBeGreaterThan(0);
  });
  it('does not surface another school through roster selectors', () => {
    const s = createSeed();
    s.enrollments[0].schoolId = 'other-school';
    expect(roster(s).some((r) => r.enrollment.id === 'enr-001')).toBe(false);
  });
});
describe('attendance', () => {
  it('keeps unmarked separate from absent and uses marked denominator', () => {
    expect(attendanceSummary(['present', 'absent', 'unmarked', 'late', 'half-day'])).toMatchObject({
      absent: 1,
      unmarked: 1,
      marked: 4,
      attended: 3,
      percentage: 75,
    });
  });
  it('has a defined zero-denominator result', () => {
    expect(attendanceSummary(['unmarked']).percentage).toBe(0);
    expect(attendanceSummary([]).percentage).toBe(0);
  });
  it('uses unmarked for dates without records', () => {
    expect(statusFor(createSeed(), 'enr-001', '2026-10-04')).toBe('unmarked');
  });
  it('upserts without duplicates and changes profile and school summaries together', () => {
    const s = createSeed();
    const before = s.attendance.length;
    const next = saveAttendance(s, DEMO_DATE, 'class-5-a', { 'enr-001': 'absent' });
    expect(statusFor(next, 'enr-001', DEMO_DATE)).toBe('absent');
    expect(next.attendance.length).toBe(before);
    expect(statusFor(s, 'enr-001', DEMO_DATE)).toBe('present');
    const school = attendanceSummary(
      roster(next).map((r) => statusFor(next, r.enrollment.id, DEMO_DATE)),
    );
    expect(school.absent).toBe(
      attendanceSummary(roster(s).map((r) => statusFor(s, r.enrollment.id, DEMO_DATE))).absent + 1,
    );
    const again = saveAttendance(next, DEMO_DATE, 'class-5-a', { 'enr-001': 'late' });
    expect(
      again.attendance.filter((r) => r.date === DEMO_DATE && r.enrollmentId === 'enr-001'),
    ).toHaveLength(1);
  });
  it('rejects students from a different section and invalid dates', () => {
    const s = createSeed();
    expect(() => saveAttendance(s, DEMO_DATE, 'class-5-a', { 'enr-025': 'absent' })).toThrow();
    expect(() => saveAttendance(s, '2026-10-11', 'class-5-a', { 'enr-001': 'present' })).toThrow();
    expect(() => saveAttendance(s, '2026-02-30', 'class-5-a', { 'enr-001': 'present' })).toThrow();
  });
  it('rejects changes for an inactive enrollment', () =>
    expect(() =>
      saveAttendance(createSeed(), DEMO_DATE, 'class-10-b', { 'enr-144': 'absent' }),
    ).toThrow());
});
describe('fee ledger', () => {
  it('derives totals from obligations plus adjustments minus payments', () => {
    const summary = feeSummary(createSeed(), 'enr-001');
    expect(summary.total).toBe(5400000);
    expect(summary.paid).toBe(1800000);
    expect(summary.outstanding).toBe(3600000);
  });
  it('sums individual balances to the dashboard total', () => {
    const s = createSeed();
    const totals = roster(s, true).reduce(
      (sum, r) => sum + feeSummary(s, r.enrollment.id).outstanding,
      0,
    );
    expect(totals).toBe(feeSummary(s).outstanding);
  });
  it('appends payment history and updates school and student balances consistently', () => {
    const s = createSeed();
    const next = recordPayment(s, {
      enrollmentId: 'enr-001',
      amount: 100000,
      date: DEMO_DATE,
      method: 'Cash',
      reference: 'TEST-NEW',
    });
    expect(next.payments.length).toBe(s.payments.length + 1);
    expect(feeSummary(next).outstanding).toBe(feeSummary(s).outstanding - 100000);
    expect(feeSummary(next, 'enr-001').outstanding).toBe(3500000);
  });
  it('rejects zero, negative, fractional-paise, excessive and nonfinite payments', () => {
    const s = createSeed();
    for (const amount of [0, -1, 0.5, 99999999, NaN])
      expect(() =>
        recordPayment(s, {
          enrollmentId: 'enr-001',
          amount,
          date: DEMO_DATE,
          method: 'Cash',
          reference: 'TEST',
        }),
      ).toThrow();
  });
  it('rejects invalid enrollments and duplicate references', () => {
    const s = createSeed();
    expect(() =>
      recordPayment(s, {
        enrollmentId: 'outside-school',
        amount: 1,
        date: DEMO_DATE,
        method: 'Cash',
        reference: 'TEST',
      }),
    ).toThrow();
    expect(() =>
      recordPayment(s, {
        enrollmentId: 'enr-001',
        amount: 1,
        date: DEMO_DATE,
        method: 'Cash',
        reference: 'WBA-APR-1',
      }),
    ).toThrow();
  });
  it('allocates payments chronologically with no negative installment balance', () => {
    const s = createSeed();
    const rows = installments(s, 'enr-001');
    expect(rows[0].outstanding).toBe(0);
    expect(rows[1].paid).toBe(0);
    expect(rows.reduce((sum, r) => sum + r.outstanding, 0)).toBe(
      feeSummary(s, 'enr-001').outstanding,
    );
    rows.forEach((r) => expect(r.outstanding).toBeGreaterThanOrEqual(0));
  });
});
describe('notification simulation', () => {
  it('deduplicates selected IDs and excludes missing contacts and non-absent students', () => {
    let s = createSeed();
    s = saveAttendance(s, DEMO_DATE, 'class-5-a', {
      'enr-001': 'absent',
      'enr-002': 'absent',
      'enr-003': 'present',
    });
    const eligible = eligibleRecipients(s, ['enr-001', 'enr-002', 'enr-002', 'enr-003'], DEMO_DATE);
    expect(eligible.map((r) => r.enrollment.id)).toEqual(['enr-002']);
  });
  it('produces success and failure simulation outcomes without a transport', () => {
    let s = createSeed();
    s = saveAttendance(s, DEMO_DATE, 'class-5-a', {
      'enr-002': 'absent',
      'enr-003': 'absent',
      'enr-004': 'absent',
    });
    const next = dispatchNotifications(s, ['enr-002', 'enr-003', 'enr-004'], DEMO_DATE);
    expect(next.notifications.map((n) => n.status)).toEqual([
      'simulated-success',
      'simulated-success',
      'simulated-failure',
    ]);
    expect(next.notifications[0].message).toContain('Ananya Sharma');
    expect(s.notifications).toHaveLength(0);
  });
  it('requires an eligible recipient', () =>
    expect(() => dispatchNotifications(createSeed(), [], DEMO_DATE)).toThrow());
});
describe('academics', () => {
  it('calculates a weighted percentage and grade from actual maximum marks', () => {
    expect(
      resultSummary({
        schoolId: 's',
        enrollmentId: 'e',
        examId: 'x',
        subjects: [
          { name: 'One', marks: 45, maxMarks: 50 },
          { name: 'Two', marks: 90, maxMarks: 100 },
        ],
      }),
    ).toEqual({ marks: 135, maximum: 150, percentage: 90, grade: 'A+' });
  });
  it('keeps all seeded marks within the allowed range and links results to enrollments', () => {
    const s = createSeed();
    s.results.forEach((r) => {
      expect(s.enrollments.some((e) => e.id === r.enrollmentId)).toBe(true);
      r.subjects.forEach((x) => {
        expect(x.marks).toBeGreaterThanOrEqual(0);
        expect(x.marks).toBeLessThanOrEqual(x.maxMarks);
      });
    });
  });
});

describe('presentation copy', () => {
  it('composes a personalized Hindi parent notice with a Hindi date', () => {
    const message = notificationMessage('Willowbrook Academy', 'Ananya Sharma', DEMO_DATE);
    expect(message).toContain('आदरणीय अभिभावक');
    expect(message).toContain('Ananya Sharma');
    expect(message).toContain('10-10-2026');
    expect(message).toContain('अनुपस्थित');
    expect(message).toContain('Willowbrook Academy');
  });
  it('updates legacy display copy without changing saved financial or attendance data', () => {
    const state = createSeed();
    state.payments[0].reference = 'DEMO-APR-1';
    state.activities[0].text = 'Demo payment recorded';
    const updated = refreshPresentationCopy(state);
    expect(updated.payments[0].reference).toBe('WBA-APR-1');
    expect(updated.activities[0].text).toBe('Payment recorded');
    expect(updated.attendance).toEqual(state.attendance);
    expect(feeSummary(updated)).toMatchObject({
      total: feeSummary(state).total,
      paid: feeSummary(state).paid,
    });
    expect(state.payments[0].reference).toBe('DEMO-APR-1');
  });
});
