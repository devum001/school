export type CommunicationEvent =
  | 'Student Absent'
  | 'Low Attendance'
  | 'Fee Due'
  | 'Fee Overdue'
  | 'Test Scheduled'
  | 'Result Published'
  | 'Holiday'
  | 'Timetable Changed'
  | 'Class Cancelled'
  | 'Extra Class'
  | 'Event / Announcement'
  | 'General Notice'
  | 'Fee Installment Due'
  | 'Fee Installment Overdue'
  | 'Compose Notice';
// Historical types above remain readable; these are the current fee / compose events.
export type CurrentCommunicationEvent =
  | 'Student Absent'
  | 'Low Attendance'
  | 'Fee Installment Due'
  | 'Fee Installment Overdue'
  | 'Event / Announcement'
  | 'Compose Notice';
export type CommunicationChannel = 'In-app' | 'WhatsApp' | 'SMS' | 'Email';
export type RecipientRole = 'Parent' | 'Student' | 'Teacher' | 'Staff';
export interface NotificationRule {
  event: CommunicationEvent;
  recipients: RecipientRole[];
  channels: CommunicationChannel[];
  automatic: boolean;
  enabled: boolean;
  when: 'Immediately' | 'Daily at 09:00' | 'After publish' | 'Admin confirmation';
}
export interface CommunicationSettings {
  plainTemplates?: boolean;
  channels: { name: CommunicationChannel; enabled: boolean }[];
  rules: NotificationRule[];
  templates: Record<CommunicationEvent, string>;
}
export interface NoticeAudience {
  kind: 'All School' | 'Class' | 'Section' | 'Selected Students' | 'Parents' | 'Teachers' | 'Staff';
  classIds: string[];
  sectionIds: string[];
  studentIds: string[];
  memberSelection?: 'All' | 'Selected';
  memberIds?: string[];
}
export interface CommunicationRecipient {
  id: string;
  name: string;
  role: RecipientRole;
  studentName: string;
  classId: string;
  sectionId: string;
  className: string;
  sectionName: string;
  enrollmentId?: string;
  studentId?: string;
  phone: string | null;
  email: string | null;
}
export interface CommunicationRecord {
  installment?: {
    id: string;
    label: string;
    amount: number;
    dueDate: string;
    status: 'Due' | 'Overdue';
  };
  id: string;
  schoolId: string;
  key: string;
  event: CommunicationEvent;
  origin: 'system' | 'admin' | 'manual' | 'legacy';
  date: string;
  createdAt: string;
  sentAt?: string;
  scheduledAt?: string;
  recipient: CommunicationRecipient;
  channel: CommunicationChannel;
  title: string;
  message: string;
  status: 'Pending' | 'Scheduled' | 'Delivered' | 'Failed' | 'Cancelled';
  attempts: number;
  reason?: string;
}
export interface CommunicationState {
  settings: CommunicationSettings;
  records: CommunicationRecord[];
  publishedTests: string[];
  publishedResults: string[];
}
export interface NoticeInput {
  event: CommunicationEvent;
  title: string;
  audience: NoticeAudience;
  recipients: RecipientRole[];
  channels: CommunicationChannel[];
  message: string;
  scheduledAt?: string;
}
