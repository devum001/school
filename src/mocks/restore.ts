import { recordDocumentData } from '../lib/recordedDocuments';
import { removeLegacyFeeAdjustments } from '../lib/feePlans';
import type { AttendanceRecord, DemoState } from '../types/domain';

export type SavedSchoolState = Pick<
  DemoState,
  'version' | 'attendance' | 'payments' | 'notifications' | 'activities'
> &
  Partial<
    Pick<
      DemoState,
      | 'exams'
      | 'preferences'
      | 'security'
      | 'auditLog'
      | 'communication'
      | 'staffAccess'
      | 'feePlans'
      | 'salaryPayments'
      | 'documents'
      | 'documentTemplates'
      | 'results'
      | 'students'
      | 'studentAdmissionSequences'
      | 'enrollments'
      | 'teachers'
      | 'sections'
      | 'classes'
      | 'obligations'
      | 'school'
      | 'attendancePolicy'
      | 'staffPayroll'
      | 'staffMembers'
      | 'staffCycleInputs'
      | 'staffAttendance'
      | 'studentTimings'
      | 'schoolHours'
      | 'classTimetables'
    >
  >;

/** Add missing presentation records; a saved status (including unmarked) always wins. */
export function mergeAttendance(
  fresh: AttendanceRecord[],
  saved: AttendanceRecord[],
): AttendanceRecord[] {
  const records = new Map<string, AttendanceRecord>();
  for (const record of [...fresh, ...saved]) {
    records.set(`${record.schoolId}:${record.enrollmentId}:${record.date}`, record);
  }
  return [...records.values()];
}

export function restoreSchoolState(fresh: DemoState, saved: SavedSchoolState): DemoState {
  const enrollments = saved.enrollments ?? fresh.enrollments;
  const ids = new Set(enrollments.map((e) => e.id));
  return removeLegacyFeeAdjustments({
    ...fresh,
    ...saved,
    school: { ...fresh.school, ...saved.school },
    students: saved.students ?? fresh.students,
    payments: saved.payments.map((payment) =>
      payment.document ? { ...payment, document: recordDocumentData(payment.document) } : payment,
    ),
    salaryPayments: (saved.salaryPayments ?? fresh.salaryPayments)?.map((payment) => ({
      ...payment,
      document: recordDocumentData(payment.document),
    })),
    enrollments,
    teachers: saved.teachers ?? fresh.teachers,
    sections: saved.sections ?? fresh.sections,
    classes: saved.classes ?? fresh.classes,
    obligations: saved.obligations ?? fresh.obligations,
    exams: saved.exams ?? fresh.exams,
    results: saved.results ?? fresh.results,
    attendance: mergeAttendance(fresh.attendance, saved.attendance).filter((r) =>
      ids.has(r.enrollmentId),
    ),
    activities: saved.activities.map(
      (activity) => fresh.activities.find((a) => a.id === activity.id) ?? activity,
    ),
  });
}
