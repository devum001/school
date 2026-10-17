import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createSeed } from '../mocks/seed';
import { restoreSchoolState } from '../mocks/restore';
import { saveFeePlan, currentFeePlan } from './feePlans';
import { deleteStudent } from './management';
import { installments, feeSummary, roster } from './selectors';
import { recordStudentPayment, recordSalaryPayment } from './financeTransactions';
import { saveDocumentTemplates, feeReceiptFor, DEFAULT_DOCUMENT_TEMPLATES } from './documentData';
import { defaultStaffPayroll } from './settings';
import { saveStaffMember, staffDirectory } from './staffStructure';
import { saveStaffAttendance } from './staffAttendance';
import { schoolMonthlyFinance } from './schoolFinance';
import { saveEntityDocument, deleteEntityDocument } from './entityDocuments';
import { communicationFor, reconcileCommunication } from './communication';
import {
  communicationSettingsSchema,
  defaultCommunicationSettings,
  ACTIVE_EVENTS,
} from './communicationConfig';
import { paymentRecordSchema, salaryPaymentSchema } from './ledgerSchemas';
import type { FeePlanInput } from '../types/ledger';
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-14T06:30:00Z'));
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
function feeFixture() {
  const seed = createSeed('2026-10-14');
  const row = roster(seed)[0];
  const state = { ...seed, obligations: [], payments: [] };
  state.students.find((s) => s.id === row.student.id)!.guardian.contact = '9876543210';
  const plan: FeePlanInput = {
    kind: 'Installments',
    totalFee: 2400000,
    installments: [
      { amount: 600000, dueDate: '2026-04-10' },
      { amount: 800000, dueDate: '2026-10-18' },
      { amount: 1000000, dueDate: '2027-01-10' },
    ],
  };
  return { state: saveFeePlan(state, row.enrollment.id, plan), row, plan };
}
function salaryFixture() {
  let state = saveStaffMember(createSeed('2026-10-14'), defaultStaffPayroll, {
    name: 'Neha Test',
    designation: 'Teacher',
    departmentId: 'department-academics',
    email: '',
    phone: '',
    joinedOn: '2026-01-01',
    status: 'active',
    isTeachingStaff: true,
    qualification: 'B.Ed',
    salary: { effectiveFrom: '2026-01', basic: 3800000, allowance: 0, bonus: 0, deduction: 0 },
  });
  const member = state.staffMembers![0];
  for (const [date, status] of [
    ['2026-10-06', 'absent'],
    ['2026-10-07', 'half-day'],
    ['2026-10-08', 'late'],
  ] as const)
    state = saveStaffAttendance(state, defaultStaffPayroll, date, { [member.id]: status });
  return { state, member };
}
describe('connected student fee ledger', () => {
  it('keeps unequal amounts and dates without splitting and rejects mismatched totals', () => {
    const { state, row, plan } = feeFixture();
    expect(currentFeePlan(state, row.enrollment.id)?.installments.map((i) => i.amount)).toEqual([
      600000, 800000, 1000000,
    ]);
    expect(() => saveFeePlan(state, row.enrollment.id, { ...plan, totalFee: 2500000 })).toThrow(
      /total/i,
    );
    expect(() => saveFeePlan(state, 'foreign', plan)).toThrow(/not found/);
    expect(
      saveFeePlan({ ...state, payments: [], obligations: [] }, row.enrollment.id, {
        kind: 'One Time',
        totalFee: 0,
        installments: [{ amount: 0, dueDate: '2026-10-14' }],
      }).obligations[0].amount,
    ).toBe(0);
  });
  it('allocates partial and cross-installment payments, tracks paid dates and has optional references', () => {
    const { state: initial, row } = feeFixture();
    let state = recordStudentPayment(initial, {
      enrollmentId: row.enrollment.id,
      amount: 200000,
      date: '2026-10-14',
      method: 'Cash',
      reference: '',
    });
    expect(installments(state, row.enrollment.id)[0]).toMatchObject({
      paid: 200000,
      outstanding: 400000,
      paidDate: undefined,
    });
    state = recordStudentPayment(state, {
      enrollmentId: row.enrollment.id,
      amount: 700000,
      date: '2026-10-14',
      method: 'Card',
      reference: '',
    });
    expect(state.payments[1].allocations?.map((a) => a.amount)).toEqual([400000, 300000]);
    expect(installments(state, row.enrollment.id)[0].paidDate).toBe('2026-10-14');
    expect(feeSummary(state, row.enrollment.id)).toMatchObject({
      total: 2400000,
      paid: 900000,
      outstanding: 1500000,
    });
    expect(state.payments[1].receiptNumber).not.toBe(state.payments[0].receiptNumber);
    expect(state.payments[1].studentId).toBe(row.student.id);
    expect(paymentRecordSchema.parse(state.payments[1]).allocations).toHaveLength(2);
  });
  it('targets a selected installment and rejects excess, wrong-school, future and duplicate references', () => {
    const { state: initial, row } = feeFixture(),
      target = initial.obligations[2].id;
    const input = {
      enrollmentId: row.enrollment.id,
      amount: 100000,
      date: '2026-10-14',
      method: 'UPI' as const,
      reference: 'UPI-1',
      installmentId: target,
    };
    const state = recordStudentPayment(initial, input);
    expect(installments(state, row.enrollment.id)[0].paid).toBe(0);
    expect(state.payments[0].installmentId).toBe(target);
    expect(() => recordStudentPayment(state, input)).toThrow(/reference/);
    expect(() => recordStudentPayment(state, { ...input, reference: '', amount: 2500000 })).toThrow(
      /exceeds/,
    );
    expect(() =>
      recordStudentPayment(state, { ...input, reference: '', installmentId: 'foreign' }),
    ).toThrow(/balance/);
    expect(() =>
      recordStudentPayment(state, { ...input, reference: '', enrollmentId: 'foreign' }),
    ).toThrow(/not found/);
    expect(() =>
      recordStudentPayment(state, { ...input, reference: '', date: '2026-10-15' }),
    ).toThrow(/future/);
  });
  it('freezes legacy allocations before editing dates and protects paid installments', () => {
    const { state: initial, row } = feeFixture();
    const first = initial.obligations[0].id;
    const legacy = {
      ...initial,
      payments: [
        {
          id: 'legacy',
          schoolId: initial.school.id,
          enrollmentId: row.enrollment.id,
          amount: 500000,
          date: '2026-10-10',
          method: 'Cash' as const,
          reference: '',
        },
      ],
    };
    const plan = currentFeePlan(legacy, row.enrollment.id)!;
    plan.installments[0].dueDate = '2027-02-10';
    const state = saveFeePlan(legacy, row.enrollment.id, plan);
    expect(installments(state, row.enrollment.id).find((i) => i.id === first)?.paid).toBe(500000);
    expect(state.payments[0].allocations).toEqual([{ obligationId: first, amount: 500000 }]);
    expect(() =>
      saveFeePlan(state, row.enrollment.id, {
        kind: 'One Time',
        totalFee: 2400000,
        installments: [{ amount: 2400000, dueDate: '2026-10-14' }],
      }),
    ).toThrow(/Paid installments/);
    const reduced = currentFeePlan(state, row.enrollment.id)!;
    const paid = reduced.installments.find((i) => i.id === first)!;
    reduced.totalFee -= paid.amount - 100;
    paid.amount = 100;
    expect(() => saveFeePlan(state, row.enrollment.id, reduced)).toThrow(/already paid/);
  });
  it('keeps payment facts but regenerates identity and template from current settings and restores facts', () => {
    const { state: initial, row } = feeFixture();
    let state = recordStudentPayment(initial, {
      enrollmentId: row.enrollment.id,
      amount: 100000,
      date: '2026-10-14',
      method: 'Bank',
      reference: '',
    });
    const payment = state.payments[0],
      snapshot = structuredClone(payment.document!);
    state = saveDocumentTemplates(
      {
        ...state,
        school: { ...state.school, name: 'Renamed' },
        students: state.students.map((s) => ({ ...s, name: 'Changed' })),
      },
      { ...DEFAULT_DOCUMENT_TEMPLATES, feeReceipt: { templateId: 'ribbon', accent: '#ff0000' } },
    );
    const rendered = feeReceiptFor(state, payment);
    expect(rendered.amount).toBe(snapshot.amount);
    expect(rendered.number).toBe(snapshot.number);
    expect(rendered.schoolName).toBe('Renamed');
    expect(rendered.recipientName).toBe('Changed');
    expect(rendered.template.templateId).toBe('ribbon');
    expect(() => deleteStudent(state, row.student.id)).toThrow(/receipts/);
    expect(() => feeReceiptFor(state, { ...payment, schoolId: 'foreign' })).toThrow(/school/);
    expect(
      restoreSchoolState(createSeed(), JSON.parse(JSON.stringify(state))).payments[0].document,
    ).toEqual(snapshot);
  });
  it('queues per-installment due and overdue reminders and refreshes partial balances/cancels cleared items', () => {
    const { state: initial, row } = feeFixture();
    let state = reconcileCommunication(initial);
    const records = () =>
      communicationFor(state).records.filter(
        (r) =>
          r.recipient.enrollmentId === row.enrollment.id && r.status === 'Pending' && r.installment,
      );
    expect(
      records()
        .map((r) => r.event)
        .sort(),
    ).toEqual(['Fee Installment Due', 'Fee Installment Overdue']);
    state = reconcileCommunication(
      recordStudentPayment(state, {
        enrollmentId: row.enrollment.id,
        amount: 200000,
        date: '2026-10-14',
        method: 'Cash',
        reference: '',
      }),
    );
    expect(records().find((r) => r.event === 'Fee Installment Overdue')?.installment?.amount).toBe(
      400000,
    );
    state = reconcileCommunication(
      recordStudentPayment(state, {
        enrollmentId: row.enrollment.id,
        amount: 400000,
        date: '2026-10-14',
        method: 'Cash',
        reference: '',
      }),
    );
    expect(records().map((r) => r.event)).toEqual(['Fee Installment Due']);
  });
});
describe('staff salary ledger and stored documents', () => {
  it('shares teaching staff records without academic setup', () => {
    const { state, member } = salaryFixture();
    const teacher = state.teachers.find((t) => t.id === member.teacherId)!;
    expect(teacher.name).toBe(member.name);
    expect(state.sections.some((s) => s.teacherId === teacher.id)).toBe(false);
    expect(
      staffDirectory(state, defaultStaffPayroll).find((m) => m.id === member.id)?.qualification,
    ).toBe('B.Ed');
  });
  it('records 1.5 leaves, ignores late deductions and freezes paid salary/history', () => {
    const { state: initial, member } = salaryFixture();
    const input = {
      staffId: member.id,
      month: '2026-10',
      method: 'Bank' as const,
      date: '2026-10-14',
      reference: '',
    };
    const state = recordSalaryPayment(initial, input),
      payment = state.salaryPayments![0];
    expect(payment).toMatchObject({
      leaveDays: 1.5,
      gross: 3800000,
      leaveDeduction: Math.round((3800000 * 1.5) / 31),
      status: 'Paid',
    });
    expect(payment.net).toBe(3800000 - payment.leaveDeduction);
    expect(salaryPaymentSchema.parse(payment).amountPaid).toBe(payment.net);
    expect(() => recordSalaryPayment(state, input)).toThrow(/already recorded/);
    expect(() => recordSalaryPayment(initial, { ...input, month: '2026-11' })).toThrow(/Future/);
    expect(() => recordSalaryPayment(initial, { ...input, date: '2026-10-04' })).toThrow(/cycle/);
    const changed = saveStaffAttendance(state, defaultStaffPayroll, '2026-10-06', {
      [member.id]: 'present',
    });
    expect(changed.salaryPayments![0]).toEqual(payment);
    const finance = schoolMonthlyFinance(changed, defaultStaffPayroll, '2026-10-14');
    expect(finance.paidSalary).toBe(payment.net);
    expect(finance.balanceAfterPaidSalary).toBe(finance.feeIncome - payment.net);
  });
  it('keeps absence counts but skips monetary deduction when automatic calculation is off', () => {
    const { state: initial, member } = salaryFixture();
    const state = {
      ...initial,
      staffPayroll: {
        ...defaultStaffPayroll,
        payroll: { ...defaultStaffPayroll.payroll, autoCalculation: false },
      },
    };
    const payment = recordSalaryPayment(state, {
      staffId: member.id,
      month: '2026-10',
      method: 'Cash',
      date: '2026-10-14',
      reference: '',
    }).salaryPayments![0];
    expect(payment.leaveDays).toBe(1.5);
    expect(payment.leaveDeduction).toBe(0);
    expect(payment.net).toBe(3800000);
  });
  it('validates document owners, category, headers, bytes and duplicate files', () => {
    const { state: initial, member } = salaryFixture();
    const bytes = '%PDF-1.4\nsmall fixture',
      input = {
        ownerKind: 'staff' as const,
        ownerId: member.id,
        category: 'Degree / marksheets',
        fileName: 'degree.pdf',
        mimeType: 'application/pdf' as const,
        dataUrl: `data:application/pdf;base64,${btoa(bytes)}`,
        size: bytes.length,
      };
    const state = saveEntityDocument(initial, input);
    expect(state.documents![0].uploadedBy).toBe(initial.school.principal);
    expect(() => saveEntityDocument(state, input)).toThrow(/already saved/);
    expect(() => saveEntityDocument(initial, { ...input, ownerId: 'foreign' })).toThrow(/owner/);
    expect(() => saveEntityDocument(initial, { ...input, size: 99 })).toThrow(/valid PDF/);
    expect(() => saveEntityDocument(initial, { ...input, category: 'Salary' })).toThrow(/category/);
    expect(deleteEntityDocument(state, state.documents![0].id).documents).toHaveLength(0);
    expect(() => deleteEntityDocument(state, 'foreign')).toThrow(/not found/);
  });
  it('accepts legacy communication templates and adds current types without resetting saved data', () => {
    const settings = structuredClone(defaultCommunicationSettings);
    const oldTemplates = Object.fromEntries(
      Object.entries(settings.templates).filter(
        ([key]) =>
          !['Fee Installment Due', 'Fee Installment Overdue', 'Compose Notice'].includes(key),
      ),
    );
    const parsed = communicationSettingsSchema.parse({ ...settings, templates: oldTemplates });
    for (const event of ACTIVE_EVENTS) expect(parsed.templates[event]).toBeTruthy();
    expect(
      paymentRecordSchema.parse({
        id: 'old',
        schoolId: 's',
        enrollmentId: 'e',
        amount: 100,
        date: '2026-10-01',
        method: 'Bank transfer',
        reference: 'old',
      }).document,
    ).toBeUndefined();
  });
});

it('retains the current state if browser storage cannot save a transaction', async () => {
  vi.stubGlobal('localStorage', {
    getItem: () => null,
    setItem: () => {
      throw new Error('Quota exceeded');
    },
  });
  vi.resetModules();
  const { repository } = await import('./repository');
  const before = repository.getSnapshot();
  expect(() =>
    repository.saveDocumentTemplates({
      ...DEFAULT_DOCUMENT_TEMPLATES,
      feeReceipt: { templateId: 'frame', accent: '#123456' },
    }),
  ).toThrow(/storage/);
  expect(repository.getSnapshot()).toBe(before);
});
