import { feeProgress } from './feeProgress';
import type { DemoState, Payment } from '../types/domain';
import type {
  DocumentKind,
  DocumentTemplates,
  GeneratedDocument,
  RecordedDocumentData,
  SalaryPayment,
  TemplateId,
  TemplateChoice,
} from '../types/ledger';
import { documentTemplatesSchema } from './ledgerSchemas';
import { displayDate, money } from './config';
import { normalizeInstallmentText } from './feeLabels';
import { roster, installments, allocatedPayments } from './selectors';
import { staffDirectory, staffDesignation } from './staffStructure';
import { demoArtwork } from './demoArtwork';
import { schoolLogoFor } from './schoolBranding';
import { defaultStaffPayroll } from './settings';

export const DEFAULT_DOCUMENT_TEMPLATES: DocumentTemplates = {
  feeReceipt: { templateId: 'classic', accent: '#19494d' },
  salarySlip: { templateId: 'ledger', accent: '#19494d' },
};
const FEE_COLORS: Record<TemplateId, string> = {
  classic: '#19494d',
  ribbon: '#9a431f',
  ledger: '#234c7c',
  minimal: '#4a5f49',
  frame: '#705520',
  sidebar: '#64486f',
};
const SALARY_COLORS: Record<TemplateId, string> = {
  classic: '#365572',
  ribbon: '#5e4378',
  ledger: '#19494d',
  minimal: '#3e6272',
  frame: '#715d38',
  sidebar: '#80453e',
};
export const documentTemplatesFor = (state: DemoState): DocumentTemplates => {
  const saved = state.documentTemplates ?? DEFAULT_DOCUMENT_TEMPLATES;
  const normalize = (
    choice: TemplateChoice,
    defaults: Record<TemplateId, string>,
  ): TemplateChoice => ({
    ...choice,
    colors: { ...defaults, ...choice.colors, [choice.templateId]: choice.accent },
  });
  return {
    feeReceipt: normalize(saved.feeReceipt, FEE_COLORS),
    salarySlip: normalize(saved.salarySlip, SALARY_COLORS),
    branding: { ...demoArtwork, ...saved.branding, logo: schoolLogoFor(state) ?? null },
  };
};
export function designChoice(choice: TemplateChoice, id: TemplateId): TemplateChoice {
  return {
    templateId: id,
    accent: choice.colors?.[id] ?? (choice.templateId === id ? choice.accent : '#19494d'),
  };
}
export function documentWithBranding(
  state: DemoState,
  data: RecordedDocumentData,
): GeneratedDocument {
  const settings = documentTemplatesFor(state);
  return {
    ...data,
    schoolName: state.school.name,
    schoolLogo: schoolLogoFor(state),
    branding: { ...settings.branding },
    template: { ...(data.kind === 'Fee Receipt' ? settings.feeReceipt : settings.salarySlip) },
  };
}
export function saveDocumentTemplates(state: DemoState, input: DocumentTemplates): DemoState {
  const settings = documentTemplatesSchema.parse(input);
  for (const choice of [settings.feeReceipt, settings.salarySlip]) {
    choice.colors = { ...choice.colors, [choice.templateId]: choice.accent };
  }
  const logo = settings.branding?.logo;
  return {
    ...state,
    school: logo !== undefined ? { ...state.school, logoDataUrl: logo } : state.school,
    documentTemplates: settings,
  };
}
export function nextDocumentNumber(state: DemoState, kind: DocumentKind, date: string) {
  const prefix = `${(state.school.code ?? 'SCHOOL').replace(/[^A-Za-z0-9-]/g, '').slice(0, 24) || 'SCHOOL'}/${kind === 'Fee Receipt' ? 'FR' : 'SS'}/${date.slice(0, 4)}/`;
  const used =
    kind === 'Fee Receipt'
      ? state.payments
          .filter((item) => item.schoolId === state.school.id)
          .map((item) => item.receiptNumber ?? '')
      : (state.salaryPayments ?? [])
          .filter((item) => item.schoolId === state.school.id)
          .map((item) => item.slipNumber);
  const max = used.reduce(
    (largest, value) =>
      Math.max(largest, value.startsWith(prefix) ? Number(value.slice(prefix.length)) || 0 : 0),
    0,
  );
  return `${prefix}${String(max + 1).padStart(6, '0')}`;
}
export function feeReceiptFor(state: DemoState, payment: Payment): GeneratedDocument {
  if (payment.schoolId !== state.school.id)
    throw new Error('Payment does not belong to this school.');
  const row = roster(state, true).find((item) => item.enrollment.id === payment.enrollmentId);
  if (!row) throw new Error('Student payment not found in this school.');
  if (payment.document) {
    const identity: Record<string, string> = {
      Student: row.student.name,
      'Class / Section': `${row.className} · ${row.sectionName}`,
      'Admission number': row.student.admissionNumber,
      'Payment date': displayDate(payment.date),
    };
    const fields = payment.document.fields.map((field) => ({
      ...field,
      value:
        identity[field.label] ??
        (field.label === 'Fee / Installment' ? normalizeInstallmentText(field.value) : field.value),
    }));
    return documentWithBranding(state, {
      ...payment.document,
      recipientName: row.student.name,
      fields,
    });
  }
  // Capture the post-payment balance only for a new transaction. Previously issued
  // receipts keep their historical snapshot, even after later payments or plan edits.
  const progress = !state.payments.some((p) => p.id === payment.id)
    ? feeProgress({ ...state, payments: [...state.payments, payment] }, payment.enrollmentId)
    : undefined;
  const schedule = installments(state, payment.enrollmentId);
  const allocations =
    payment.allocations ??
    allocatedPayments(state, payment.enrollmentId).find((item) => item.id === payment.id)
      ?.allocations ??
    [];
  const labels = [
    ...new Set(
      allocations
        .map((item) => schedule.find((obligation) => obligation.id === item.obligationId)?.label)
        .filter(Boolean),
    ),
  ];
  return {
    kind: 'Fee Receipt',
    number: payment.receiptNumber ?? `LEGACY-FR-${payment.id}`,
    schoolName: state.school.name,
    schoolLogo: schoolLogoFor(state),
    branding: { ...documentTemplatesFor(state).branding },
    recipientName: row.student.name,
    date: payment.date,
    createdAt: payment.createdAt ?? `${payment.date}T00:00:00.000Z`,
    template: { ...documentTemplatesFor(state).feeReceipt },
    fields: [
      { label: 'Student', value: row.student.name },
      { label: 'Class / Section', value: `${row.className} · ${row.sectionName}` },
      { label: 'Admission number', value: row.student.admissionNumber },
      { label: 'Fee / Installment', value: labels.join(', ') || 'School fees' },
      {
        label: 'Payment mode',
        value: payment.method === 'Bank transfer' ? 'Bank' : payment.method,
      },
      { label: 'Payment date', value: displayDate(payment.date) },
      { label: 'Reference', value: payment.reference || '—' },
      { label: 'Received by', value: payment.receivedBy || 'Not recorded' },
      ...(progress
        ? [
            { label: 'Total fee', value: money(progress.total) },
            { label: 'Total paid after this payment', value: money(progress.paid) },
            { label: 'Remaining amount', value: money(progress.outstanding) },
            {
              label: progress.kind === 'One Time' ? 'Fee plan' : 'Installment progress',
              value:
                progress.kind === 'One Time'
                  ? 'One Time'
                  : `${progress.count} total · ${progress.completed} paid · ${progress.remaining} remaining${progress.partial ? ` (${progress.partial} part paid)` : ''}`,
            },
          ]
        : []),
    ],
    amount: payment.amount,
    amountLabel: 'Amount received',
  };
}
export function salarySlipFor(
  state: DemoState,
  payment: Omit<SalaryPayment, 'document'> & { document?: RecordedDocumentData },
): GeneratedDocument {
  const config = state.staffPayroll ?? defaultStaffPayroll,
    member = staffDirectory(state, config).find((item) => item.id === payment.staffId);
  if (!member) {
    if (payment.document) return documentWithBranding(state, payment.document);
    throw new Error('Staff record not found.');
  }
  return {
    kind: 'Salary Slip',
    number: payment.slipNumber,
    schoolName: state.school.name,
    schoolLogo: schoolLogoFor(state),
    branding: { ...documentTemplatesFor(state).branding },
    recipientName: member.name,
    date: payment.date,
    createdAt: payment.createdAt,
    template: { ...documentTemplatesFor(state).salarySlip },
    fields: [
      { label: 'Staff', value: member.name },
      {
        label: 'Department',
        value:
          config.setup.departments.find((department) => department.id === member.departmentId)
            ?.name ?? '—',
      },
      { label: 'Designation', value: staffDesignation(member, config) || '—' },
      { label: 'Salary month', value: payment.month },
      {
        label: 'Salary cycle',
        value: `${displayDate(payment.cycleStart)} – ${displayDate(payment.cycleEnd)}`,
      },
      { label: 'Salary', value: money(payment.gross) },
      { label: 'Leave deduction', value: money(payment.leaveDeduction) },
      { label: 'Other deduction', value: money(payment.manualDeduction) },
      { label: 'Leave count', value: `${payment.leaveDays} leaves` },
      { label: 'Payment mode', value: payment.method },
      { label: 'Payment date', value: displayDate(payment.date) },
      { label: 'Reference', value: payment.reference || '—' },
    ],
    amount: payment.net,
    amountLabel: 'Net salary paid',
  };
}
