import { describe, expect, it } from 'vitest';
import { getSchoolDate } from './dates';

describe('school calendar date', () => {
  it('switches to the next day at midnight in India, before UTC midnight', () => {
    expect(getSchoolDate(new Date('2026-10-10T18:29:59Z'))).toBe('2026-10-10');
    expect(getSchoolDate(new Date('2026-10-10T18:30:00Z'))).toBe('2026-10-11');
  });
  it('handles month and year boundaries', () => {
    expect(getSchoolDate(new Date('2026-10-31T18:30:00Z'))).toBe('2026-11-01');
    expect(getSchoolDate(new Date('2026-12-31T18:30:00Z'))).toBe('2027-01-01');
  });
});
