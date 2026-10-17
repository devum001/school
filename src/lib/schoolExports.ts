import { subjectName } from './classSubjects';
import type { DemoState } from '../types/domain';
import { roster } from './selectors';
import { staffDirectory, staffDesignation } from './staffStructure';
import { defaultStaffPayroll } from './settings';
import { communicationFor } from './communication';
import { downloadCsv } from './download';
import { downloadStudentWorkbook } from './xlsx';
export const EXPORT_TYPES = [
  'Students',
  'Staff',
  'Attendance',
  'Fees & Payments',
  'Salary',
  'Results / Academics',
  'Notifications History',
] as const;
export type ExportType = (typeof EXPORT_TYPES)[number];
export function schoolExport(state: DemoState, type: ExportType) {
  const students = roster(state, true),
    config = state.staffPayroll ?? defaultStaffPayroll,
    staff = staffDirectory(state, config);
  const ids = new Set(students.map((r) => r.enrollment.id)),
    staffIds = new Set(staff.map((s) => s.id));
  let headers: string[] = [],
    rows: (string | number)[][] = [];
  if (type === 'Students') {
    headers = [
      'Name',
      'Admission Number',
      'Class',
      'Section',
      'Guardian',
      'Guardian Contact',
      'Status',
      'Birth Date',
      'Address',
      'Guardian Relation',
      'Roll Number',
    ];
    rows = students.map((r) => [
      r.student.name,
      r.student.admissionNumber,
      r.className,
      r.sectionName,
      r.student.guardian.name,
      r.student.guardian.contact ?? '',
      r.student.status,
      r.student.birthDate,
      r.student.address,
      r.student.guardian.relation,
      r.enrollment.rollNumber,
    ]);
  }
  if (type === 'Staff') {
    headers = [
      'Name',
      'Department',
      'Designation',
      'Phone',
      'Email',
      'Joining Date',
      'Status',
      'Qualification',
    ];
    rows = staff.map((s) => [
      s.name,
      config.setup.departments.find((d) => d.id === s.departmentId)?.name ?? '',
      staffDesignation(s, config),
      s.phone,
      s.email,
      s.joinedOn,
      s.status,
      s.qualification ?? '',
    ]);
  }
  if (type === 'Attendance') {
    headers = ['Type', 'Name', 'Class / Department', 'Date', 'Status'];
    rows = [
      ...state.attendance
        .filter((r) => r.schoolId === state.school.id && ids.has(r.enrollmentId))
        .map((r) => {
          const student = students.find((s) => s.enrollment.id === r.enrollmentId)!;
          return [
            'Student',
            student.student.name,
            `${student.className} / ${student.sectionName}`,
            r.date,
            r.status,
          ];
        }),
      ...(state.staffAttendance ?? [])
        .filter((r) => r.schoolId === state.school.id && staffIds.has(r.staffId))
        .map((r) => {
          const member = staff.find((s) => s.id === r.staffId)!;
          return [
            'Staff',
            member.name,
            config.setup.departments.find((d) => d.id === member.departmentId)?.name ?? '',
            r.date,
            r.status,
          ];
        }),
    ];
  }
  if (type === 'Fees & Payments') {
    headers = [
      'Record Type',
      'Student',
      'Receipt / Installment',
      'Amount INR',
      'Due / Payment Date',
      'Mode',
      'Reference',
    ];
    rows = [
      ...state.obligations
        .filter((o) => o.schoolId === state.school.id && ids.has(o.enrollmentId))
        .map((o) => [
          'Fee installment',
          students.find((s) => s.enrollment.id === o.enrollmentId)!.student.name,
          o.label,
          (o.amount + o.adjustment) / 100,
          o.dueDate,
          '',
          '',
        ]),
      ...state.payments
        .filter((p) => p.schoolId === state.school.id && ids.has(p.enrollmentId))
        .map((p) => [
          'Payment',
          students.find((s) => s.enrollment.id === p.enrollmentId)!.student.name,
          p.receiptNumber ?? p.id,
          p.amount / 100,
          p.date,
          p.method,
          p.reference,
        ]),
    ];
  }
  if (type === 'Salary') {
    headers = [
      'Staff',
      'Month',
      'Salary INR',
      'Leave Deduction INR',
      'Net Salary INR',
      'Paid Amount INR',
      'Date',
      'Mode',
      'Reference',
      'Slip',
    ];
    rows = (state.salaryPayments ?? [])
      .filter((p) => p.schoolId === state.school.id)
      .map((p) => [
        p.document.recipientName,
        p.month,
        p.gross / 100,
        p.leaveDeduction / 100,
        p.net / 100,
        p.amountPaid / 100,
        p.date,
        p.method,
        p.reference,
        p.slipNumber,
      ]);
  }
  if (type === 'Results / Academics') {
    headers = ['Student', 'Test', 'Date', 'Subject', 'Marks', 'Maximum Marks', 'Absent', 'Status'];
    rows = state.results
      .filter((r) => r.schoolId === state.school.id && ids.has(r.enrollmentId))
      .flatMap((r) => {
        const test = state.exams.find((e) => e.id === r.examId && e.schoolId === state.school.id);
        return r.subjects.map((s) => [
          students.find((student) => student.enrollment.id === r.enrollmentId)!.student.name,
          test?.name ?? '',
          test?.date ?? '',
          subjectName(
            state,
            students.find((student) => student.enrollment.id === r.enrollmentId)!.enrollment
              .classId,
            s,
          ),
          s.pending ? '' : r.absent || s.absent ? 0 : s.marks,
          s.maxMarks,
          r.absent || s.absent ? 'Yes' : 'No',
          s.pending ? 'Pending' : r.absent || s.absent ? 'Absent' : 'Recorded',
        ]);
      });
  }
  if (type === 'Notifications History') {
    headers = ['Type', 'Recipient', 'Channel', 'Status', 'Date', 'Sent At', 'Message'];
    rows = communicationFor(state)
      .records.filter((r) => r.schoolId === state.school.id && r.status !== 'Pending')
      .map((r) => [
        r.event,
        r.recipient.studentName ?? r.recipient.name,
        r.channel,
        r.status,
        r.date,
        r.sentAt ?? '',
        r.message,
      ]);
  }
  return { headers, rows };
}
export function exportSchoolData(state: DemoState, type: ExportType, format: 'Excel' | 'CSV') {
  const data = schoolExport(state, type),
    name = type.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  if (format === 'CSV') downloadCsv(`${name}.csv`, data.headers, data.rows);
  else
    downloadStudentWorkbook(
      `${name}.xlsx`,
      [data.headers, ...data.rows],
      [
        `${state.school.name} — ${type}`,
        'Amounts are in INR.',
        'Exported from this school workspace.',
      ],
      type,
    );
}
