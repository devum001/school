import type { DemoState } from '../types/domain';
import { notificationMessage } from './operations';

/** Refresh legacy display copy without resetting saved attendance or balances. */
export function refreshPresentationCopy(state: DemoState): DemoState {
  return {
    ...state,
    payments: state.payments.map((payment) => ({
      ...payment,
      reference: payment.reference.replace(/^DEMO-/, 'WBA-'),
    })),
    notifications: state.notifications.map((record) => {
      const enrollment = state.enrollments.find((e) => e.id === record.enrollmentId);
      const student = state.students.find((s) => s.id === enrollment?.studentId);
      return student && record.message.startsWith('Dear parent,')
        ? {
            ...record,
            message: notificationMessage(state.school.name, student.name, record.attendanceDate),
          }
        : record;
    }),
    activities: state.activities.map((item) => ({
      ...item,
      text: item.text
        .replace('Demo payment recorded', 'Payment recorded')
        .replace('Parent notification simulation completed', 'Parent notifications prepared'),
      detail: item.detail
        .replace('Demo records', 'Payment records')
        .replace(/^DEMO-/, 'WBA-')
        .replace('attempted · No messages sent', 'recipient records'),
    })),
  };
}
