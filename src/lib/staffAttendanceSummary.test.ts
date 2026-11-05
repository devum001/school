import { describe, expect, it } from 'vitest';
import { matchesStaffAttendance } from './staffAttendanceSummary';

describe('staff Present includes Late and Half Day without double counting people', () => {
  it('includes partial attendance in Present while preserving specific filters', () => {
    const days = ['present', 'late', 'half-day', 'absent', 'unmarked'];
    expect(days.filter((s) => matchesStaffAttendance(s, 'present'))).toEqual([
      'present',
      'late',
      'half-day',
    ]);
    expect(days.filter((s) => matchesStaffAttendance(s, 'half-day'))).toEqual(['half-day']);
    expect(days.filter((s) => matchesStaffAttendance(s, 'late'))).toEqual(['late']);
    expect(days.filter((s) => matchesStaffAttendance(s, 'all'))).toHaveLength(5);
    expect(matchesStaffAttendance(undefined, 'unmarked')).toBe(true);
  });
});
