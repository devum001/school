import { getSchoolDate } from './dates';
import { z } from 'zod';
import type { AttendanceStatus, DemoState, Payment } from '../types/domain';
import { SCHOOL_ID, displayHindiDate } from './config';
import { eligibleRecipients, feeSummary, roster } from './selectors';
export const attendanceStatusSchema = z.enum(['present', 'absent', 'late', 'half-day', 'unmarked']);
const dateSchema = z.iso
  .date()
  .refine(
    (d) => d <= getSchoolDate() && d >= '2026-04-01',
    'Choose a date in the current academic year, up to today.',
  );
const id = () => crypto.randomUUID();
function activity(
  state: DemoState,
  text: string,
  detail: string,
  kind: 'attendance' | 'payment' | 'notification',
): DemoState['activities'] {
  return [{ id: id(), text, detail, date: getSchoolDate(), kind }, ...state.activities].slice(
    0,
    30,
  );
}
export function saveAttendance(
  state: DemoState,
  date: string,
  sectionId: string,
  changes: Record<string, AttendanceStatus>,
): DemoState {
  dateSchema.parse(date);
  const valid = roster(state).filter((r) => r.enrollment.sectionId === sectionId);
  if (
    !valid.length ||
    Object.keys(changes).some((key) => !valid.some((r) => r.enrollment.id === key))
  )
    throw new Error('Invalid attendance roster.');
  Object.values(changes).forEach((s) => attendanceStatusSchema.parse(s));
  const records = Object.entries(changes).map(([enrollmentId, status]) => ({
    schoolId: SCHOOL_ID,
    enrollmentId,
    date,
    status,
  }));
  return {
    ...state,
    attendance: [
      ...state.attendance.filter(
        (r) => !(r.schoolId === SCHOOL_ID && r.date === date && r.enrollmentId in changes),
      ),
      ...records,
    ],
    activities: activity(
      state,
      'Attendance register updated',
      `${valid[0].className} · Section ${valid[0].sectionName} · ${date}`,
      'attendance',
    ),
  };
}
export function recordPayment(
  state: DemoState,
  input: Omit<Payment, 'id' | 'schoolId'>,
): DemoState {
  const payment = z
    .object({
      enrollmentId: z.string(),
      amount: z.number().int().positive(),
      date: dateSchema,
      method: z.enum(['Bank transfer', 'Cash', 'UPI']),
      reference: z.string().trim().min(1).max(80),
    })
    .parse(input);
  if (!roster(state, true).some((r) => r.enrollment.id === payment.enrollmentId))
    throw new Error('Student enrollment not found.');
  if (payment.amount > feeSummary(state, payment.enrollmentId).outstanding)
    throw new Error('Payment exceeds the outstanding balance.');
  if (state.payments.some((p) => p.reference === payment.reference))
    throw new Error('This payment reference already exists.');
  return {
    ...state,
    payments: [...state.payments, { ...payment, id: id(), schoolId: SCHOOL_ID }],
    activities: activity(state, 'Payment recorded', payment.reference, 'payment'),
  };
}
export const notificationMessage = (school: string, name: string, date: string) =>
  `आदरणीय अभिभावक,\n\nआपके बच्चे ${name} की उपस्थिति दिनांक ${displayHindiDate(date)} को ${school} में अनुपस्थित दर्ज की गई है। कृपया अनुपस्थिति का कारण विद्यालय कार्यालय को सूचित करें। यदि यह जानकारी सही नहीं है, तो कृपया कक्षा शिक्षक से संपर्क करें।\n\nधन्यवाद,\n${school}`;
export function dispatchNotifications(state: DemoState, ids: string[], date: string): DemoState {
  dateSchema.parse(date);
  const recipients = eligibleRecipients(state, ids, date);
  if (!recipients.length)
    throw new Error('Select at least one absent student with a parent contact.');
  const records = recipients.map((r, index) => ({
    id: id(),
    schoolId: SCHOOL_ID,
    enrollmentId: r.enrollment.id,
    date: getSchoolDate(),
    attendanceDate: date,
    message: notificationMessage(state.school.name, r.student.name, date),
    status: index % 3 === 2 ? ('simulated-failure' as const) : ('simulated-success' as const),
  }));
  return {
    ...state,
    notifications: [...records, ...state.notifications],
    activities: activity(
      state,
      'Parent notifications prepared',
      `${records.length} recipient records`,
      'notification',
    ),
  };
}
