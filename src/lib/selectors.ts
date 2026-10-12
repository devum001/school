import type { AttendanceStatus, DemoState, ExamResult, RosterEntry } from '../types/domain';
import { SCHOOL_ID } from './config';
const studentNameOrder = new Intl.Collator('en-IN', { sensitivity: 'base', numeric: true });
export function roster(state: DemoState, includeInactive = false): RosterEntry[] {
  return state.enrollments
    .filter((e) => e.schoolId === SCHOOL_ID && e.academicYearId === state.academicYear.id)
    .flatMap((enrollment) => {
      const student = state.students.find(
        (s) => s.id === enrollment.studentId && s.schoolId === enrollment.schoolId,
      );
      if (!student || (!includeInactive && student.status !== 'active')) return [];
      return [
        {
          student,
          enrollment,
          className: state.classes.find((c) => c.id === enrollment.classId)?.name ?? '',
          sectionName: state.sections.find((s) => s.id === enrollment.sectionId)?.name ?? '',
        },
      ];
    })
    .sort(
      (a, b) =>
        studentNameOrder.compare(a.student.name.trim(), b.student.name.trim()) ||
        studentNameOrder.compare(a.student.admissionNumber, b.student.admissionNumber),
    );
}
export function statusFor(state: DemoState, enrollmentId: string, date: string): AttendanceStatus {
  return (
    state.attendance.find(
      (r) => r.schoolId === SCHOOL_ID && r.enrollmentId === enrollmentId && r.date === date,
    )?.status ?? 'unmarked'
  );
}
export function attendanceSummary(statuses: AttendanceStatus[]) {
  const counts = { present: 0, absent: 0, late: 0, 'half-day': 0, unmarked: 0 };
  statuses.forEach((s) => counts[s]++);
  const marked = statuses.length - counts.unmarked;
  const attended = counts.present + counts.late + counts['half-day'];
  return {
    ...counts,
    total: statuses.length,
    marked,
    attended,
    percentage: marked ? Math.round((attended / marked) * 1000) / 10 : 0,
  };
}
export function feeSummary(state: DemoState, enrollmentId?: string) {
  const obligations = state.obligations.filter(
    (o) => o.schoolId === SCHOOL_ID && (!enrollmentId || o.enrollmentId === enrollmentId),
  );
  const payments = state.payments.filter(
    (p) => p.schoolId === SCHOOL_ID && (!enrollmentId || p.enrollmentId === enrollmentId),
  );
  const total = obligations.reduce((n, o) => n + o.amount + o.adjustment, 0);
  const paid = payments.reduce((n, p) => n + p.amount, 0);
  return { total, paid, outstanding: Math.max(0, total - paid), obligations, payments };
}
export function installments(state: DemoState, enrollmentId: string) {
  const summary = feeSummary(state, enrollmentId);
  let available = summary.paid;
  return [...summary.obligations]
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .map((o) => {
      const amount = o.amount + o.adjustment;
      const paid = Math.min(available, amount);
      available -= paid;
      return { ...o, net: amount, paid, outstanding: amount - paid };
    });
}
export function resultSummary(result: ExamResult) {
  const marks = result.subjects.reduce((a, s) => a + s.marks, 0);
  const maximum = result.subjects.reduce((a, s) => a + s.maxMarks, 0);
  const percentage = maximum ? Math.round((marks / maximum) * 1000) / 10 : 0;
  return {
    marks,
    maximum,
    percentage,
    grade:
      percentage >= 90
        ? 'A+'
        : percentage >= 80
          ? 'A'
          : percentage >= 70
            ? 'B+'
            : percentage >= 60
              ? 'B'
              : percentage >= 50
                ? 'C'
                : 'D',
  };
}
export function eligibleRecipients(state: DemoState, ids: string[], date: string) {
  return roster(state).filter(
    (r) =>
      ids.includes(r.enrollment.id) &&
      statusFor(state, r.enrollment.id, date) === 'absent' &&
      r.student.guardian.contact !== null,
  );
}
