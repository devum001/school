import { describe, it, expect } from 'vitest';
import { createSeed } from '../mocks/seed';
import { communicationFor, reconcileCommunication } from './communication';
import { notificationAttention, notificationReviewUrl } from './communicationOverview';
import { saveSecurity, securityFor } from './adminSettings';

describe('notification cards and header attention', () => {
  it('opens pending alerts for review and previously sent alerts in unfiltered matching history', () => {
    const state = reconcileCommunication(createSeed('2026-10-14'), '2026-10-14');
    const records = communicationFor(state).records;
    const low = records.filter((r) => r.event === 'Low Attendance' && r.date === '2026-10-14');
    expect(low.length).toBeGreaterThan(0);
    expect(notificationReviewUrl('Low Attendance', '2026-10-14', records)).toContain(
      'focus=pending',
    );
    const sent = records.map((r) =>
      r.event === 'Low Attendance' ? { ...r, status: 'Delivered' as const } : r,
    );
    const params = new URLSearchParams(
      notificationReviewUrl('Low Attendance', '2026-10-14', sent).split('?')[1],
    );
    expect(Object.fromEntries(params)).toEqual({ tab: 'History', historyType: 'Low Attendance' });
    expect(notificationReviewUrl('Low Attendance', '2026-10-12', records)).toContain(
      'focus=pending',
    );
  });
  it('counts only this school pending alerts and failed messages, deduplicating pending channels', () => {
    const state = reconcileCommunication(createSeed('2026-10-14'), '2026-10-14');
    const initial = notificationAttention(state);
    const pending = initial.records.find((r) => r.status === 'Pending')!;
    state.communication = {
      ...communicationFor(state),
      records: [
        pending,
        { ...pending, id: 'same-alert-email', channel: 'Email' },
        { ...pending, id: 'delivered', status: 'Delivered' },
        { ...pending, id: 'cancelled', status: 'Cancelled' },
        { ...pending, id: 'failed', status: 'Failed' },
        { ...pending, id: 'foreign', schoolId: 'another-school' },
      ],
    };
    expect(notificationAttention(state).count).toBe(2);
    expect(notificationAttention(state).pending[0].recipients.size).toBe(1);
    state.communication.records = state.communication.records.map((r) => ({
      ...r,
      status: 'Delivered',
    }));
    expect(notificationAttention(state).count).toBe(0);
  });
  it('persists Off for inactivity without accepting arbitrary timeout values', () => {
    const state = createSeed('2026-10-14');
    expect(
      saveSecurity(state, { ...securityFor(state), sessionTimeout: 0 }).security?.sessionTimeout,
    ).toBe(0);
    expect(() =>
      saveSecurity(state, { ...securityFor(state), sessionTimeout: 45 as 30 }),
    ).toThrow();
  });
});
