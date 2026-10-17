import { ZodError } from 'zod';
import type { DemoState } from '../types/domain';
import type {
  CommunicationEvent,
  CommunicationRecord,
  CommunicationRecipient,
  CommunicationSettings,
  CommunicationState,
  NoticeInput,
} from '../types/communication';
import {
  communicationSettingsSchema,
  defaultCommunicationSettings,
  plainMessage,
  noticeInputSchema,
} from './communicationConfig';
import { noticeRecipients, studentRecipients } from './communicationRecipients';
import { getSchoolDate, shiftCalendarDate } from './dates';
import { attendanceSummary, installments, roster, statusFor } from './selectors';
import { money, displayDate } from './config';
function queuedMessage(
  template: string,
  target: CommunicationRecipient,
  installment?: CommunicationRecord['installment'],
) {
  return installment
    ? `${template}\n\nStudent: ${target.studentName}\nInstallment: ${installment.label}\nAmount: ${money(installment.amount)}\nDue date: ${displayDate(installment.dueDate)}`
    : template;
}

const now = () => new Date().toISOString();
export function communicationError(cause: unknown) {
  return cause instanceof ZodError
    ? (cause.issues[0]?.message ?? 'Check the communication details.')
    : cause instanceof Error
      ? cause.message
      : 'Unable to save communication.';
}
const uniqueKey = (
  event: CommunicationEvent,
  date: string,
  source: string,
  target: CommunicationRecipient,
  channel: string,
) => `${event}:${date}:${source}:${target.id}:${channel}`;
export function communicationFor(state: DemoState): CommunicationState {
  const saved = state.communication ?? {
    settings: structuredClone(defaultCommunicationSettings),
    records: [],
    publishedTests: [],
    publishedResults: [],
  };
  const templates = { ...saved.settings.templates };
  if (!saved.settings.plainTemplates)
    for (const event of Object.keys(templates) as CommunicationEvent[])
      templates[event] = plainMessage(templates[event]);
  return {
    ...saved,
    settings: {
      ...saved.settings,
      plainTemplates: true,
      templates,
      rules: structuredClone(defaultCommunicationSettings.rules),
    },
  };
}
export function initializeCommunication(state: DemoState): DemoState {
  if (state.communication) return state;
  const communication = communicationFor(state);
  const target = studentRecipients(
    state,
    roster(state).map((row) => row.enrollment.id),
    ['Parent'],
  )
    .filter((recipient) => recipient.phone)
    .slice(0, 3);
  communication.records = target.map((recipient, index) => ({
    id: `demo-failed-${index}`,
    schoolId: state.school.id,
    key: `demo-failed-${index}`,
    event: 'Compose Notice',
    origin: 'manual',
    date: getSchoolDate(),
    createdAt: now(),
    sentAt: now(),
    recipient,
    channel: 'WhatsApp',
    title: 'School office update',
    message: 'Please review the school office circular for this week.',
    status: 'Failed',
    attempts: 1,
    reason: 'Demo delivery interrupted. Retry to simulate delivery.',
  }));
  if (target[0])
    communication.records.push({
      id: 'demo-holiday',
      schoolId: state.school.id,
      key: 'demo-holiday',
      event: 'Event / Announcement',
      origin: 'manual',
      date: getSchoolDate(),
      createdAt: now(),
      sentAt: now(),
      recipient: target[0],
      channel: 'WhatsApp',
      title: 'Festival holiday announcement',
      message:
        'School will remain closed for the festival holiday. Regular classes resume on the next working day.',
      status: 'Delivered',
      attempts: 1,
    });
  if (target[1])
    communication.records.push({
      id: 'demo-event',
      schoolId: state.school.id,
      key: 'demo-event',
      event: 'Event / Announcement',
      origin: 'manual',
      date: getSchoolDate(),
      createdAt: now(),
      sentAt: now(),
      recipient: target[1],
      channel: 'WhatsApp',
      title: 'School cultural programme',
      message: 'Parents are invited to the school cultural programme this Friday at 10:00 AM.',
      status: 'Delivered',
      attempts: 1,
    });
  return { ...state, communication };
}
function candidates(state: DemoState, date: string): CommunicationRecord[] {
  const communication = communicationFor(state),
    records: CommunicationRecord[] = [];
  const emit = (
    event: CommunicationEvent,
    source: string,
    ids: string[],
    installment?: CommunicationRecord['installment'],
  ) => {
    const rule = communication.settings.rules.find((r) => r.event === event);
    if (!rule?.enabled) return;
    for (const target of studentRecipients(state, ids, rule.recipients))
      for (const channel of rule.channels) {
        const key = uniqueKey(
          event,
          ['Test Scheduled', 'Result Published'].includes(event) ? 'published' : date,
          source,
          target,
          channel,
        );
        records.push({
          id: key,
          schoolId: state.school.id,
          key,
          event,
          origin: 'system',
          date,
          createdAt: now(),
          recipient: target,
          channel,
          title: event,
          installment,
          message: queuedMessage(communication.settings.templates[event], target, installment),
          status: 'Pending',
          attempts: 0,
        });
      }
  };
  for (const row of roster(state).filter((r) => r.enrollment.schoolId === state.school.id)) {
    const id = row.enrollment.id;
    if (statusFor(state, id, date) === 'absent') emit('Student Absent', id, [id]);
    const statuses = state.attendance
      .filter(
        (a) =>
          a.schoolId === state.school.id &&
          a.enrollmentId === id &&
          a.date <= date &&
          a.date >= state.academicYear.start,
      )
      .map((a) => a.status);
    const summary = attendanceSummary(statuses);
    if (
      summary.marked >= 5 &&
      summary.percentage < (state.attendancePolicy?.minimumAttendance ?? 75)
    )
      emit('Low Attendance', id, [id]);
    const obligations = installments(state, id).filter((item) => item.outstanding > 0);
    for (const item of obligations) {
      const event = item.dueDate < date ? 'Fee Installment Overdue' : 'Fee Installment Due';
      if (
        event === 'Fee Installment Due' &&
        (item.dueDate < getSchoolDate() || item.dueDate > shiftCalendarDate(date, 7))
      )
        continue;
      emit(event, item.id, [id], {
        id: item.id,
        label: item.label,
        amount: item.outstanding,
        dueDate: item.dueDate,
        status: event === 'Fee Installment Overdue' ? 'Overdue' : 'Due',
      });
    }
  }
  return records;
}
function delivered(state: DemoState, record: CommunicationRecord): CommunicationRecord {
  const channel = communicationFor(state).settings.channels.find((c) => c.name === record.channel);
  const target = noticeRecipients(
    state,
    { kind: 'All School', classIds: [], sectionIds: [], studentIds: [] },
    [record.recipient.role],
  ).find(
    (r) =>
      r.id === record.recipient.id ||
      (!!record.recipient.enrollmentId && r.enrollmentId === record.recipient.enrollmentId),
  );
  const missing =
    record.channel === 'Email'
      ? !target?.email
      : ['SMS', 'WhatsApp'].includes(record.channel)
        ? !target?.phone
        : false;
  const guardianInApp =
    record.channel === 'In-app' && ['Parent', 'Student'].includes(record.recipient.role);
  const reason = guardianInApp
    ? 'Student and guardian records have no in-app login. Choose a guardian contact channel.'
    : !target
      ? 'This recipient is no longer active in the school.'
      : !channel?.enabled
        ? 'Channel is disabled.'
        : missing
          ? `No ${record.channel === 'Email' ? 'email address' : 'phone number'} is recorded for this recipient.`
          : undefined;
  return {
    ...record,
    status: reason ? 'Failed' : 'Delivered',
    attempts: record.attempts + 1,
    sentAt: now(),
    reason,
  };
}
function legacyRecords(state: DemoState): CommunicationRecord[] {
  return state.notifications
    .filter((n) => n.schoolId === state.school.id)
    .flatMap((n) => {
      const recipient = studentRecipients(state, [n.enrollmentId], ['Parent'], true)[0] ?? {
        id: `Parent:${n.enrollmentId}`,
        name: 'Archived parent',
        role: 'Parent' as const,
        studentName: 'Archived student',
        classId: '',
        sectionId: '',
        className: '',
        sectionName: '',
        enrollmentId: n.enrollmentId,
        phone: null,
        email: null,
      };
      return [
        {
          id: `legacy:${n.id}`,
          key: uniqueKey('Student Absent', n.attendanceDate, n.enrollmentId, recipient, 'WhatsApp'),
          schoolId: state.school.id,
          event: 'Student Absent' as const,
          origin: 'legacy' as const,
          date: n.date,
          createdAt: `${n.date}T05:02:00.000Z`,
          sentAt: `${n.date}T05:02:00.000Z`,
          recipient,
          channel: 'WhatsApp' as const,
          title: 'Student Absent',
          message: n.message,
          status: n.status === 'simulated-success' ? ('Delivered' as const) : ('Failed' as const),
          attempts: 1,
          reason:
            n.status === 'simulated-failure' ? 'Previous demo delivery needs retry.' : undefined,
        },
      ];
    });
}
export function reconcileCommunication(
  input: DemoState,
  date = getSchoolDate(),
  automatic = true,
): DemoState {
  const state = initializeCommunication(input),
    communication = communicationFor(state);
  const available = candidates(state, date),
    byKey = new Map(communication.records.map((record) => [record.key, record]));
  for (const record of legacyRecords(state))
    if (!byKey.has(record.key) || byKey.get(record.key)?.status === 'Pending')
      byKey.set(record.key, record);
  const sources = new Map(available.map((record) => [record.key, record]));
  const dateSources = new Map<string, Set<string>>([[date, new Set(sources.keys())]]);
  const datedCandidates = new Map<string, Map<string, CommunicationRecord>>([[date, sources]]);
  for (const record of available) {
    const previous = byKey.get(record.key);
    if (!previous || previous.status === 'Cancelled') byKey.set(record.key, record);
    else if (previous.status === 'Pending')
      byKey.set(record.key, {
        ...previous,
        message: record.message,
        recipient: record.recipient,
        installment: record.installment,
      });
  }
  const records = [...byKey.values()].map((record) => {
    if (record.schoolId !== state.school.id) return record;
    if (record.status === 'Pending' && record.origin === 'system') {
      if (!dateSources.has(record.date)) {
        const rows = candidates(state, record.date);
        dateSources.set(record.date, new Set(rows.map((c) => c.key)));
        datedCandidates.set(
          record.date,
          new Map(rows.map((candidate) => [candidate.key, candidate])),
        );
      }
      const valid = dateSources.get(record.date)!.has(record.key);
      if (
        !valid ||
        (record.event === 'Fee Installment Due' &&
          record.installment &&
          record.installment.dueDate < getSchoolDate())
      )
        return {
          ...record,
          status: 'Cancelled' as const,
          reason: 'The source event no longer requires this notification.',
        };
      // System alerts always wait for an explicit review and send.
      return {
        ...record,
        installment:
          datedCandidates.get(record.date)?.get(record.key)?.installment ?? record.installment,
        message: queuedMessage(
          communication.settings.templates[record.event],
          record.recipient,
          datedCandidates.get(record.date)?.get(record.key)?.installment ?? record.installment,
        ),
        recipient:
          studentRecipients(state, [record.recipient.enrollmentId ?? ''], ['Student'])[0] ??
          record.recipient,
      };
    }
    if (
      automatic &&
      record.status === 'Scheduled' &&
      record.scheduledAt &&
      Date.parse(record.scheduledAt) <= Date.now()
    )
      return delivered(state, record);
    return record;
  });
  return { ...state, communication: { ...communication, records } };
}
export function saveCommunicationSettings(
  state: DemoState,
  input: CommunicationSettings,
): DemoState {
  const next = initializeCommunication(state);
  return reconcileCommunication({
    ...next,
    communication: {
      ...communicationFor(next),
      settings: communicationSettingsSchema.parse(input),
    },
  });
}
export function dispatchCommunication(state: DemoState, ids: string[]): DemoState {
  const next = reconcileCommunication(state, getSchoolDate(), false),
    communication = communicationFor(next);
  if (
    !ids.length ||
    ids.some(
      (id) =>
        !communication.records.some(
          (r) =>
            r.schoolId === state.school.id &&
            r.id === id &&
            ['Pending', 'Failed'].includes(r.status),
        ),
    )
  )
    throw new Error('Choose pending or failed notifications that still require delivery.');
  const sourcesByDate = new Map<string, Set<string>>();
  for (const record of communication.records.filter(
    (r) => ids.includes(r.id) && r.origin === 'system',
  )) {
    if (!sourcesByDate.has(record.date))
      sourcesByDate.set(record.date, new Set(candidates(next, record.date).map((r) => r.key)));
    if (!sourcesByDate.get(record.date)!.has(record.key))
      throw new Error('The source event no longer requires this notification.');
  }
  return {
    ...next,
    communication: {
      ...communication,
      records: communication.records.map((record) =>
        ids.includes(record.id) ? delivered(next, record) : record,
      ),
    },
  };
}
export function previewNotice(state: DemoState, raw: NoticeInput) {
  const input = noticeInputSchema.parse(raw),
    communication = communicationFor(state);
  if (
    input.channels.some(
      (channel) => !communication.settings.channels.some((c) => c.name === channel && c.enabled),
    )
  )
    throw new Error('Choose active channels from Communication Settings.');
  if (input.scheduledAt && Date.parse(input.scheduledAt) <= Date.now())
    throw new Error('Choose a future schedule time.');
  const targets = noticeRecipients(state, input.audience, input.recipients);
  const recipients = targets.filter((target) =>
    input.channels.some(
      (channel) => channel !== 'In-app' || ['Teacher', 'Staff'].includes(target.role),
    ),
  );
  if (targets.length && !recipients.length)
    throw new Error(
      'Choose WhatsApp, SMS or Email for student guardian contacts. In-app is for staff only.',
    );
  if (!recipients.length) throw new Error('Choose an audience with matching recipients.');
  return {
    input,
    recipients,
    message: input.message,
  };
}
export function createNotice(state: DemoState, raw: NoticeInput): DemoState {
  const next = initializeCommunication(state),
    { input, recipients } = previewNotice(next, raw),
    batch = crypto.randomUUID();
  const records = recipients.flatMap((recipient) =>
    input.channels
      .filter((channel) => channel !== 'In-app' || ['Teacher', 'Staff'].includes(recipient.role))
      .map((channel): CommunicationRecord => ({
        id: crypto.randomUUID(),
        schoolId: state.school.id,
        key: `${batch}:${recipient.id}:${channel}`,
        event: input.event,
        origin: 'manual',
        date: getSchoolDate(),
        createdAt: now(),
        recipient,
        channel,
        title: input.title,
        message: input.message,
        status: input.scheduledAt ? 'Scheduled' : 'Pending',
        scheduledAt: input.scheduledAt,
        attempts: 0,
      })),
  );
  return {
    ...next,
    communication: {
      ...communicationFor(next),
      records: [
        ...communicationFor(next).records,
        ...records.map((record) => (input.scheduledAt ? record : delivered(next, record))),
      ],
    },
  };
}
export function cancelScheduledNotice(state: DemoState, id: string): DemoState {
  const communication = communicationFor(state),
    record = communication.records.find(
      (r) => r.id === id && r.schoolId === state.school.id && r.status === 'Scheduled',
    );
  if (!record) throw new Error('Scheduled notice not found.');
  return {
    ...state,
    communication: {
      ...communication,
      records: communication.records.map((r) =>
        r.id === id ? { ...r, status: 'Cancelled', reason: 'Cancelled by school office.' } : r,
      ),
    },
  };
}
export function publishCommunication(
  state: DemoState,
  examId: string,
  results: boolean,
): DemoState {
  const exam = state.exams.find(
    (e) =>
      e.id === examId &&
      e.schoolId === state.school.id &&
      e.academicYearId === state.academicYear.id,
  );
  if (!exam) throw new Error('Test not found.');
  if (results && !state.results.some((r) => r.schoolId === state.school.id && r.examId === examId))
    throw new Error('Record results before publishing a result notice.');
  const next = initializeCommunication(state),
    communication = communicationFor(next),
    field = results ? 'publishedResults' : 'publishedTests';
  return reconcileCommunication({
    ...next,
    communication: { ...communication, [field]: [...new Set([...communication[field], examId])] },
  });
}
