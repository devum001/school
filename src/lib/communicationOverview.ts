import type { CommunicationRecord } from '../types/communication';
import type { DemoState } from '../types/domain';
import { communicationFor } from './communication';

// Card and bell links use fresh filters so a previous History view cannot hide alerts.
export function notificationReviewUrl(event: string, date: string, records: CommunicationRecord[]) {
  const pending = records.some(
    (r) => r.event === event && r.date === date && r.status === 'Pending',
  );
  const history = records.some(
    (r) => r.event === event && r.date === date && !['Pending', 'Cancelled'].includes(r.status),
  );
  const params =
    pending || !history
      ? new URLSearchParams({ tab: 'Overview', event, date, focus: 'pending' })
      : new URLSearchParams({ tab: 'History', historyType: event });
  return `/notifications?${params}`;
}

export function notificationAttention(state: DemoState) {
  const records = communicationFor(state).records.filter((r) => r.schoolId === state.school.id);
  const groups = new Map<string, { event: string; date: string; recipients: Set<string> }>();
  for (const record of records.filter((r) => r.status === 'Pending')) {
    const key = `${record.date}:${record.event}`;
    const group = groups.get(key) ?? {
      event: record.event,
      date: record.date,
      recipients: new Set<string>(),
    };
    group.recipients.add(record.recipient.enrollmentId ?? record.recipient.id);
    groups.set(key, group);
  }
  const pending = [...groups.values()].sort(
    (a, b) => b.date.localeCompare(a.date) || a.event.localeCompare(b.event),
  );
  const failed = records.filter((r) => r.status === 'Failed').length;
  return {
    records,
    pending,
    failed,
    count: pending.reduce((sum, group) => sum + group.recipients.size, 0) + failed,
  };
}
