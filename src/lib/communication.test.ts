import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import type { DemoState } from '../types/domain';
import { createSeed } from '../mocks/seed';
import { roster } from './selectors';
import { staffDirectory } from './staffStructure';
import { defaultStaffPayroll } from './settings';
import { saveAttendance } from './operations';
import { createTest } from './academics';
import {
  communicationFor,
  createNotice,
  dispatchCommunication,
  initializeCommunication,
  previewNotice,
  publishCommunication,
  reconcileCommunication,
  saveCommunicationSettings,
  cancelScheduledNotice,
} from './communication';
import { communicationSettingsSchema, defaultCommunicationSettings } from './communicationConfig';
import type { NoticeInput } from '../types/communication';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-13T06:30:00Z'));
});
afterEach(() => vi.useRealTimers());
function fixture(): DemoState {
  const seed = createSeed('2026-10-13');
  seed.students[0].guardian.contact = '+91 98765 01000';
  return {
    ...seed,
    communication: {
      settings: structuredClone(defaultCommunicationSettings),
      records: [],
      publishedTests: [],
      publishedResults: [],
    },
  };
}
const manual: NoticeInput = {
  event: 'Holiday',
  title: 'Diwali Holiday Notice',
  audience: { kind: 'All School', classIds: [], sectionIds: [], studentIds: [] },
  recipients: ['Student'],
  channels: ['WhatsApp'],
  message: 'प्रिय अभिभावक, कल स्कूल में छुट्टी रहेगी।',
};
describe('communication rules, queues and demo delivery', () => {
  it('initializes coherent demo history without publishing draft tests or changing existing school data', () => {
    const seed = createSeed('2026-10-13'),
      state = initializeCommunication(seed);
    expect(communicationFor(state).records.filter((r) => r.status === 'Failed')).toHaveLength(3);
    expect(
      communicationFor(state).records.filter((r) => r.event === 'Test Scheduled'),
    ).toHaveLength(0);
    expect(communicationFor(state).publishedTests).toEqual([]);
    expect(state.students).toBe(seed.students);
    expect(initializeCommunication(state)).toBe(state);
  });
  it('queues saved absences once, refreshes templates and cancels alerts after attendance corrections', () => {
    const seed = fixture(),
      row = roster(seed)[0];
    let state = reconcileCommunication(
      saveAttendance(seed, '2026-10-13', row.enrollment.sectionId, {
        [row.enrollment.id]: 'absent',
      }),
    );
    const relevant = () =>
      communicationFor(state).records.filter(
        (r) => r.event === 'Student Absent' && r.recipient.enrollmentId === row.enrollment.id,
      );
    expect(relevant()).toHaveLength(1);
    expect(relevant().every((r) => r.status === 'Pending')).toBe(true);
    state = reconcileCommunication(state);
    expect(relevant()).toHaveLength(1);
    const settings = structuredClone(communicationFor(state).settings);
    settings.templates['Student Absent'] =
      'आपका बच्चा आज अनुपस्थित है। कृपया स्कूल से संपर्क करें।';
    state = saveCommunicationSettings(state, settings);
    expect(relevant()[0].message).toBe(settings.templates['Student Absent']);
    const ids = relevant().map((r) => r.id);
    state = reconcileCommunication(
      saveAttendance(state, '2026-10-13', row.enrollment.sectionId, {
        [row.enrollment.id]: 'present',
      }),
    );
    expect(relevant().every((r) => r.status === 'Cancelled')).toBe(true);
    expect(() => dispatchCommunication(state, ids)).toThrow();
  });
  it('always queues for review even when saved legacy rules enabled automatic delivery', () => {
    const state = fixture(),
      row = roster(state)[0];
    state.communication!.settings.rules.find((rule) => rule.event === 'Student Absent')!.automatic =
      true;
    state.communication!.settings.rules.find((rule) => rule.event === 'Student Absent')!.enabled =
      false;
    const queued = reconcileCommunication(
      saveAttendance(state, '2026-10-13', row.enrollment.sectionId, {
        [row.enrollment.id]: 'absent',
      }),
    );
    const records = communicationFor(queued).records.filter(
      (r) => r.event === 'Student Absent' && r.recipient.enrollmentId === row.enrollment.id,
    );
    expect(records).toHaveLength(1);
    expect(records.every((r) => r.status === 'Pending' && r.attempts === 0)).toBe(true);
    const paused = structuredClone(queued);
    paused.communication!.settings.channels.find((c) => c.name === 'WhatsApp')!.enabled = false;
    const sent = dispatchCommunication(paused, [records.find((r) => r.channel === 'WhatsApp')!.id]);
    expect(
      communicationFor(sent).records.find(
        (r) => r.id === records.find((r) => r.channel === 'WhatsApp')!.id,
      )?.status,
    ).toBe('Failed');
  });
  it('filters fee reminders from outstanding obligations and suppresses cleared pending balances', () => {
    let state = fixture();
    const row = roster(state)[0],
      obligation = {
        ...state.obligations[0],
        id: 'fee-test',
        enrollmentId: row.enrollment.id,
        dueDate: '2026-10-12',
        amount: 100000,
        adjustment: 0,
      };
    state = { ...state, obligations: [obligation], payments: [] };
    const queued = reconcileCommunication(state);
    expect(
      communicationFor(queued).records.some(
        (r) =>
          r.event === 'Fee Installment Overdue' &&
          r.recipient.enrollmentId === row.enrollment.id &&
          r.status === 'Pending',
      ),
    ).toBe(true);
    const paid = reconcileCommunication({
      ...queued,
      payments: [
        {
          id: 'fee-paid',
          schoolId: state.school.id,
          enrollmentId: row.enrollment.id,
          amount: 100000,
          date: '2026-10-13',
          method: 'Cash',
          reference: 'paid',
        },
      ],
    });
    expect(
      communicationFor(paid)
        .records.filter((r) => r.event === 'Fee Installment Overdue')
        .every((r) => r.status === 'Cancelled'),
    ).toBe(true);
  });
  it('keeps retired test notifications out of the current queue after legacy publication', () => {
    const seed = fixture();
    let state = createTest(seed, {
      name: 'Upcoming test',
      date: '2026-10-13',
      kind: 'Daily test',
      classId: seed.classes[0].id,
      sectionId: '',
      subjects: [{ name: 'English', maxMarks: 10 }],
    });
    const id = state.exams.at(-1)!.id;
    expect(
      communicationFor(reconcileCommunication(state)).records.some(
        (r) => r.event === 'Test Scheduled',
      ),
    ).toBe(false);
    state = publishCommunication(state, id, false);
    const count = communicationFor(state).records.filter(
      (r) => r.event === 'Test Scheduled',
    ).length;
    expect(count).toBe(0);
    vi.setSystemTime(new Date('2026-10-14T06:30:00Z'));
    expect(
      communicationFor(reconcileCommunication(state)).records.filter(
        (r) => r.event === 'Test Scheduled',
      ),
    ).toHaveLength(count);
    expect(() => publishCommunication(state, id, true)).toThrow(/Record results/);
  });
  it('scopes manual audiences, preserves plain language and rejects invalid or inactive channels', () => {
    const state = fixture(),
      row = roster(state)[0];
    const notice = {
      ...manual,
      audience: {
        ...manual.audience,
        kind: 'Selected Students' as const,
        studentIds: [row.enrollment.id],
      },
    };
    expect(previewNotice(state, notice).recipients).toHaveLength(1);
    const sent = createNotice(state, notice);
    expect(communicationFor(sent).records[0]).toMatchObject({ status: 'Delivered', attempts: 1 });
    expect(communicationFor(sent).records[0].message).toBe(manual.message);
    expect(communicationFor(sent).records[0].recipient).toMatchObject({
      role: 'Student',
      name: row.student.name,
      phone: row.student.guardian.contact,
    });
    expect(() => previewNotice(state, { ...notice, channels: ['SMS'] })).toThrow(/active channels/);
    expect(() =>
      previewNotice(state, {
        ...notice,
        audience: { ...notice.audience, studentIds: ['foreign'] },
      }),
    ).toThrow(/school/);
    expect(previewNotice(state, { ...notice, message: 'Class {A}: tomorrow' }).message).toBe(
      'Class {A}: tomorrow',
    );
    expect(
      previewNotice(state, {
        ...manual,
        audience: { ...manual.audience, kind: 'Teachers' },
        recipients: ['Teacher'],
      }).recipients,
    ).toHaveLength(state.teachers.filter((t) => t.status === 'active').length);
  });
  it('handles future scheduling, cancellation and processing once at the selected local time', () => {
    const state = fixture(),
      row = roster(state)[0],
      notice = {
        ...manual,
        audience: {
          ...manual.audience,
          kind: 'Selected Students' as const,
          studentIds: [row.enrollment.id],
        },
        scheduledAt: '2026-10-13T10:00:00+05:30',
      };
    expect(() => createNotice(state, notice)).toThrow(/future/);
    notice.scheduledAt = '2026-10-13T13:00:00+05:30';
    const scheduled = createNotice(state, notice),
      id = communicationFor(scheduled).records[0].id;
    expect(communicationFor(reconcileCommunication(scheduled)).records[0].status).toBe('Scheduled');
    expect(communicationFor(cancelScheduledNotice(scheduled, id)).records[0].status).toBe(
      'Cancelled',
    );
    vi.setSystemTime(new Date('2026-10-13T07:31:00Z'));
    const sent = reconcileCommunication(scheduled);
    expect(communicationFor(sent).records[0]).toMatchObject({ status: 'Delivered', attempts: 1 });
    expect(communicationFor(reconcileCommunication(sent)).records[0].attempts).toBe(1);
  });
  it('retries failed delivery but never re-sends delivered messages or loses legacy history', () => {
    const seed = initializeCommunication(createSeed('2026-10-13')),
      record = communicationFor(seed).records.find(
        (r) => r.status === 'Failed' && r.recipient.phone,
      )!;
    const sent = dispatchCommunication(seed, [record.id]);
    expect(communicationFor(sent).records.find((r) => r.id === record.id)?.status).toBe(
      'Delivered',
    );
    expect(() => dispatchCommunication(sent, [record.id])).toThrow();
    const legacy = {
      ...fixture(),
      notifications: [
        {
          id: 'old',
          schoolId: seed.school.id,
          enrollmentId: 'deleted-student',
          date: '2026-10-01',
          attendanceDate: '2026-10-01',
          message: 'Historical notice',
          status: 'simulated-success' as const,
        },
      ],
    };
    expect(
      communicationFor(reconcileCommunication(legacy)).records.some(
        (r) => r.message === 'Historical notice',
      ),
    ).toBe(true);
  });
  it('selects all or selected teachers and staff and rejects inactive or foreign selections', () => {
    const state = fixture(),
      members = staffDirectory(state, state.staffPayroll ?? defaultStaffPayroll).filter(
        (m) => m.status === 'active',
      );
    for (const kind of ['Teachers', 'Staff'] as const) {
      const eligible = members.filter((m) => kind !== 'Teachers' || !!m.teacherId);
      const notice: NoticeInput = {
        ...manual,
        audience: {
          ...manual.audience,
          kind,
          memberSelection: 'Selected',
          memberIds: [eligible[0].id],
        },
        recipients: [kind === 'Teachers' ? 'Teacher' : 'Staff'],
      };
      expect(previewNotice(state, notice).recipients.map((r) => r.name)).toEqual([
        eligible[0].name,
      ]);
      expect(() =>
        previewNotice(state, { ...notice, audience: { ...notice.audience, memberIds: [] } }),
      ).toThrow(/active members/);
      expect(() =>
        previewNotice(state, {
          ...notice,
          audience: { ...notice.audience, memberIds: ['other-school'] },
        }),
      ).toThrow(/active members/);
      expect(
        previewNotice(state, {
          ...notice,
          audience: { ...notice.audience, memberSelection: 'All' },
        }).recipients,
      ).toHaveLength(eligible.length);
    }
  });
  it('merges old parent and student targets into one guardian contact and preserves old history', () => {
    const state = fixture(),
      row = roster(state)[0];
    const preview = previewNotice(state, {
      ...manual,
      audience: { ...manual.audience, kind: 'Selected Students', studentIds: [row.enrollment.id] },
      recipients: ['Parent', 'Student'],
      channels: ['WhatsApp'],
    });
    expect(preview.recipients).toHaveLength(1);
    expect(preview.recipients[0].phone).toBe(row.student.guardian.contact);
    const sent = createNotice(state, preview.input);
    expect(communicationFor(sent).records[0].status).toBe(
      row.student.guardian.contact ? 'Delivered' : 'Failed',
    );
  });
  it('migrates old placeholders once and leaves new plain text untouched', () => {
    const state = fixture();
    delete state.communication!.settings.plainTemplates;
    state.communication!.settings.templates.Holiday = 'School holiday on {date} for {class}.';
    const converted = communicationFor(state).settings;
    expect(converted.templates.Holiday).toBe(
      'School holiday on the announced date for their class.',
    );
    const next = saveCommunicationSettings(state, {
      ...converted,
      templates: { ...converted.templates, Holiday: 'मेरी भाषा {date}' },
    });
    expect(communicationFor(next).settings.templates.Holiday).toBe('मेरी भाषा {date}');
  });
  it('keeps In-app for staff only and routes student notices to guardian contacts', () => {
    const state = fixture(),
      row = roster(state)[0];
    const studentNotice: NoticeInput = {
      ...manual,
      audience: { ...manual.audience, kind: 'Selected Students', studentIds: [row.enrollment.id] },
    };
    expect(() => previewNotice(state, { ...studentNotice, channels: ['In-app'] })).toThrow(
      /staff only/,
    );
    const mixed = createNotice(state, {
      ...manual,
      recipients: ['Student', 'Teacher', 'Staff'],
      channels: ['In-app', 'WhatsApp'],
    });
    expect(
      communicationFor(mixed)
        .records.filter((record) => record.channel === 'In-app')
        .every((record) => ['Teacher', 'Staff'].includes(record.recipient.role)),
    ).toBe(true);
    expect(
      communicationFor(mixed).records.some(
        (record) =>
          record.recipient.enrollmentId === row.enrollment.id &&
          record.channel === 'WhatsApp' &&
          record.recipient.phone === row.student.guardian.contact,
      ),
    ).toBe(true);
    const queued = reconcileCommunication(
      saveAttendance(state, '2026-10-13', row.enrollment.sectionId, {
        [row.enrollment.id]: 'absent',
      }),
    );
    expect(
      communicationFor(queued)
        .records.filter((record) => record.origin === 'system')
        .every((record) => record.channel !== 'In-app'),
    ).toBe(true);
  });
  it('requires admin confirmation rules and supported templates', () => {
    const settings = structuredClone(defaultCommunicationSettings);
    settings.rules.find((r) => r.event === 'Event / Announcement')!.automatic = true;
    expect(() => communicationSettingsSchema.parse(settings)).toThrow(/confirmation/);
  });
});
