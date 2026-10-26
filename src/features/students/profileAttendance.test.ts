import { expect, it } from 'vitest';
import { recordedAttendanceSummary } from '../../lib/selectors';
it('profile attendance counts unmarked days separately and uses the recorded-day denominator', () => {
  expect(recordedAttendanceSummary(['late', 'absent', 'unmarked', 'unmarked'])).toMatchObject({
    marked: 2,
    unmarked: 2,
    attended: 1,
    absent: 1,
    percentage: 50,
  });
  expect(recordedAttendanceSummary(['unmarked']).percentage).toBe(0);
});
