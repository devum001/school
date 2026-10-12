import { describe, expect, it } from 'vitest';
import { createSeed } from './seed';
import { restoreSchoolState } from './restore';
import { attendanceSummary, feeSummary, roster, statusFor } from '../lib/selectors';

describe('presentation data for today', () => {
  it('seeds today and a recent attendance trend with consistent nonzero totals', () => {
    const state = createSeed('2026-10-11');
    const summary = attendanceSummary(
      roster(state).map((r) => statusFor(state, r.enrollment.id, '2026-10-11')),
    );
    expect(summary).toMatchObject({ total: 143, attended: 122, absent: 10, unmarked: 11 });
    expect([...new Set(state.attendance.map((r) => r.date))]).toHaveLength(9);
    expect(state.attendance.every((r) => r.date <= '2026-10-11')).toBe(true);
  });
  it('fills missing dates for existing browser data without resetting saved records', () => {
    const saved = createSeed('2026-10-10');
    saved.attendance.find((r) => r.date === '2026-10-10' && r.enrollmentId === 'enr-001')!.status =
      'absent';
    saved.payments.push({
      id: 'saved-payment',
      schoolId: saved.school.id,
      enrollmentId: 'enr-001',
      amount: 100000,
      date: '2026-10-10',
      method: 'Cash',
      reference: 'SAVED-1',
    });
    const restored = restoreSchoolState(createSeed('2026-10-11'), saved);
    expect(statusFor(restored, 'enr-001', '2026-10-10')).toBe('absent');
    expect(statusFor(restored, 'enr-001', '2026-10-11')).toBe('present');
    expect(restored.payments).toEqual(saved.payments);
    expect(feeSummary(restored).paid).toBe(feeSummary(saved).paid);
    expect(restored.notifications).toEqual(saved.notifications);
    const keys = restored.attendance.map((r) => `${r.schoolId}:${r.enrollmentId}:${r.date}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
  it('preserves an explicitly saved unmarked status today', () => {
    const saved = createSeed('2026-10-11');
    saved.attendance.find((r) => r.date === '2026-10-11' && r.enrollmentId === 'enr-001')!.status =
      'unmarked';
    expect(
      statusFor(restoreSchoolState(createSeed('2026-10-11'), saved), 'enr-001', '2026-10-11'),
    ).toBe('unmarked');
  });
});
