import { z } from 'zod';
import type { CommunicationEvent, CommunicationSettings } from '../types/communication';
export const EVENTS = [
  'Student Absent',
  'Low Attendance',
  'Fee Due',
  'Fee Overdue',
  'Test Scheduled',
  'Result Published',
  'Holiday',
  'Timetable Changed',
  'Class Cancelled',
  'Extra Class',
  'Event / Announcement',
  'General Notice',
  'Fee Installment Due',
  'Fee Installment Overdue',
  'Compose Notice',
] as const;
export const ACTIVE_EVENTS = [
  'Student Absent',
  'Low Attendance',
  'Fee Installment Due',
  'Fee Installment Overdue',
  'Event / Announcement',
  'Compose Notice',
] as const;
export const SYSTEM_EVENTS: readonly CommunicationEvent[] = [
  ...EVENTS.slice(0, 6),
  'Fee Installment Due',
  'Fee Installment Overdue',
];
export const CHANNELS = ['In-app', 'WhatsApp', 'SMS', 'Email'] as const;
export const ROLES = ['Parent', 'Student', 'Teacher', 'Staff'] as const;
const unique = <T>(values: T[]) => new Set(values).size === values.length;
const message = z.string().trim().min(1, 'Enter a message.').max(2000);
export const notificationRuleSchema = z
  .object({
    event: z.enum(EVENTS),
    recipients: z.array(z.enum(ROLES)).min(1).refine(unique),
    channels: z.array(z.enum(CHANNELS)).min(1).refine(unique),
    automatic: z.boolean(),
    enabled: z.boolean(),
    when: z.enum(['Immediately', 'Daily at 09:00', 'After publish', 'Admin confirmation']),
  })
  .refine(
    (rule) => !rule.automatic || SYSTEM_EVENTS.includes(rule.event),
    'Admin events require confirmation.',
  )
  .refine(
    (rule) =>
      !SYSTEM_EVENTS.includes(rule.event) ||
      rule.recipients.every((role) => role === 'Parent' || role === 'Student'),
    'Student events notify parents and students. Use Send Notice for teachers and staff.',
  );
export const communicationSettingsSchema = z.object({
  plainTemplates: z.boolean().optional(),
  channels: z
    .array(z.object({ name: z.enum(CHANNELS), enabled: z.boolean() }))
    .length(4)
    .refine((list) => unique(list.map((c) => c.name))),
  rules: z
    .array(notificationRuleSchema)
    .max(30)
    .refine((rules) => unique(rules.map((r) => r.event))),
  templates: z
    .partialRecord(z.enum(EVENTS), message)
    .transform((templates) => ({ ...defaultCommunicationSettings.templates, ...templates })),
});
const audienceSchema = z.object({
  kind: z.enum([
    'All School',
    'Class',
    'Section',
    'Selected Students',
    'Parents',
    'Teachers',
    'Staff',
  ]),
  classIds: z.array(z.string()),
  sectionIds: z.array(z.string()),
  studentIds: z.array(z.string()),
  memberSelection: z.enum(['All', 'Selected']).optional(),
  memberIds: z.array(z.string()).refine(unique).optional(),
});
export const noticeInputSchema = z.object({
  event: z
    .enum(EVENTS)
    .refine((event) => !SYSTEM_EVENTS.includes(event), 'Choose a manual notice type.'),
  title: z.string().trim().min(2).max(100),
  audience: audienceSchema,
  recipients: z.array(z.enum(ROLES)).min(1).refine(unique),
  channels: z.array(z.enum(CHANNELS)).min(1).refine(unique),
  message,
  scheduledAt: z.iso.datetime({ offset: true }).optional(),
});
export const communicationRecipientSchema = z.object({
  id: z.string(),
  name: z.string(),
  role: z.enum(ROLES),
  studentName: z.string(),
  classId: z.string(),
  sectionId: z.string(),
  className: z.string(),
  sectionName: z.string(),
  enrollmentId: z.string().optional(),
  studentId: z.string().optional(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
});
export const communicationRecordSchema = z.object({
  installment: z
    .object({
      id: z.string(),
      label: z.string(),
      amount: z.number().int().min(0),
      dueDate: z.iso.date(),
      status: z.enum(['Due', 'Overdue']),
    })
    .optional(),
  id: z.string(),
  schoolId: z.string(),
  key: z.string(),
  event: z.enum(EVENTS),
  origin: z.enum(['system', 'admin', 'manual', 'legacy']),
  date: z.iso.date(),
  createdAt: z.iso.datetime(),
  sentAt: z.iso.datetime().optional(),
  scheduledAt: z.iso.datetime({ offset: true }).optional(),
  recipient: communicationRecipientSchema,
  channel: z.enum(CHANNELS),
  title: z.string(),
  message: z.string(),
  status: z.enum(['Pending', 'Scheduled', 'Delivered', 'Failed', 'Cancelled']),
  attempts: z.number().int().min(0),
  reason: z.string().optional(),
});
export const communicationStateSchema = z.object({
  settings: communicationSettingsSchema,
  records: z.array(communicationRecordSchema),
  publishedTests: z.array(z.string()),
  publishedResults: z.array(z.string()),
});
export const defaultCommunicationSettings: CommunicationSettings = {
  plainTemplates: true,
  channels: CHANNELS.map((name) => ({ name, enabled: name !== 'SMS' })),
  rules: ACTIVE_EVENTS.map((event) => ({
    event,
    enabled: true,
    automatic: false,
    recipients: ['Student'],
    channels: ['WhatsApp'],
    when: !SYSTEM_EVENTS.includes(event)
      ? 'Admin confirmation'
      : ['Test Scheduled', 'Result Published'].includes(event)
        ? 'After publish'
        : event === 'Student Absent'
          ? 'Immediately'
          : 'Daily at 09:00',
  })),
  templates: {
    'Student Absent': 'Your child was marked absent. Please contact the school office.',
    'Low Attendance':
      'Your child has low attendance. Please discuss regular attendance with the class teacher.',
    'Fee Due': 'School fees are due. Please check the fee details and make the payment.',
    'Fee Overdue': 'School fees are overdue. Please contact Accounts to clear the balance.',
    'Test Scheduled':
      'A test has been scheduled. Please check with the class teacher for the date and subjects.',
    'Result Published': 'Test results are available. Please contact the class teacher for details.',
    Holiday:
      'School will remain closed for the holiday. Please add the holiday date and reopening details.',
    'Timetable Changed': 'The class timetable has changed. Please check the updated schedule.',
    'Class Cancelled':
      'The class has been cancelled. Please contact the class teacher for details.',
    'Extra Class': 'An extra class has been arranged. Please add the date and timing.',
    'Event / Announcement':
      'You are invited to our school event. Please add the event date, timing and details.',
    'General Notice':
      'Dear school community, please note this announcement from the school office.',
    'Fee Installment Due': 'A school fee installment is due. Please review the details below.',
    'Fee Installment Overdue':
      'A school fee installment is overdue. Please contact Accounts to clear the balance.',
    'Compose Notice':
      'Dear school community, please note this announcement from the school office.',
  },
};
// Convert old saved placeholders once. New text, including braces, is kept literally.
export function plainMessage(template: string) {
  const oldWords: Record<string, string> = {
    student_name: 'your child',
    class: 'their class',
    section: 'their section',
    date: 'the announced date',
    amount: 'the outstanding amount',
    due_date: 'the payment due date',
    test_name: 'the test',
  };
  return template.replace(/\{([^{}]+)\}/g, (match, key: string) => oldWords[key] ?? match);
}
