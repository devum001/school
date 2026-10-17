import type { AttendanceStatus, DemoState, ExamResult, RosterEntry } from '../types/domain';
import { installmentName } from './feeLabels';
import type { PaymentAllocation } from '../types/ledger';
const studentNameOrder = new Intl.Collator('en-IN', { sensitivity: 'base', numeric: true });
export function roster(state: DemoState, includeInactive = false): RosterEntry[] {
  return state.enrollments
    .filter((e) => e.schoolId === state.school.id && e.academicYearId === state.academicYear.id)
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
      (r) => r.schoolId === state.school.id && r.enrollmentId === enrollmentId && r.date === date,
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
    (o) => o.schoolId === state.school.id && (!enrollmentId || o.enrollmentId === enrollmentId),
  );
  const payments = state.payments.filter(
    (p) => p.schoolId === state.school.id && (!enrollmentId || p.enrollmentId === enrollmentId),
  );
  const total = obligations.reduce((n, o) => n + o.amount + o.adjustment, 0);
  const paid = payments.reduce((n, p) => n + p.amount, 0);
  return { total, paid, outstanding: Math.max(0, total - paid), obligations, payments };
}
export function allocatedPayments(state: DemoState, enrollmentId: string) {
  const summary = feeSummary(state, enrollmentId);
  const obligations = [...summary.obligations].sort(
    (a, b) => a.dueDate.localeCompare(b.dueDate) || a.id.localeCompare(b.id),
  );
  const remaining = new Map(
    obligations.map((obligation) => [
      obligation.id,
      Math.max(
        0,
        obligation.amount +
          obligation.adjustment -
          summary.payments
            .flatMap((payment) => payment.allocations ?? [])
            .filter((item) => item.obligationId === obligation.id)
            .reduce((sum, item) => sum + item.amount, 0),
      ),
    ]),
  );
  return [...summary.payments]
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) || (a.createdAt ?? '').localeCompare(b.createdAt ?? ''),
    )
    .map((payment) => {
      if (payment.allocations) return payment;
      let available = payment.amount;
      const allocations: PaymentAllocation[] = [];
      for (const obligation of obligations) {
        const amount = Math.min(available, remaining.get(obligation.id) ?? 0);
        if (amount) allocations.push({ obligationId: obligation.id, amount });
        available -= amount;
        remaining.set(obligation.id, (remaining.get(obligation.id) ?? 0) - amount);
      }
      return { ...payment, allocations };
    });
}
export function installments(state: DemoState, enrollmentId: string) {
  const summary = feeSummary(state, enrollmentId),
    payments = allocatedPayments(state, enrollmentId);
  const planKind = state.feePlans?.find(
    (plan) => plan.schoolId === state.school.id && plan.enrollmentId === enrollmentId,
  )?.kind;
  return [...summary.obligations]
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .map((o, index, schedule) => {
      const amount = o.amount + o.adjustment;
      const allocated = payments
        .flatMap((payment) => payment.allocations ?? [])
        .filter((allocation) => allocation.obligationId === o.id)
        .reduce((sum, allocation) => sum + allocation.amount, 0);
      const paid = Math.min(amount, allocated);
      const allocations = payments.map((payment) => ({
        payment,
        amount:
          payment.allocations
            ?.filter((item) => item.obligationId === o.id)
            .reduce((sum, item) => sum + item.amount, 0) ?? 0,
      }));
      const paidDate = !Math.max(0, amount - paid)
        ? allocations
            .filter((item) => item.amount > 0)
            .map((item) => item.payment.date)
            .sort()
            .at(-1)
        : undefined;
      return {
        ...o,
        label: installmentName(
          index + 1,
          (o.feeKind ?? planKind ?? (schedule.length === 1 ? 'One Time' : 'Installments')) ===
            'One Time',
        ),
        net: amount,
        paid,
        outstanding: Math.max(0, amount - paid),
        paidDate,
      };
    });
}
export function resultSummary(result: ExamResult) {
  const marks = result.subjects
    .filter((s) => !s.pending)
    .reduce((a, s) => a + (result.absent || s.absent ? 0 : s.marks), 0);
  const maximum = result.subjects.filter((s) => !s.pending).reduce((a, s) => a + s.maxMarks, 0);
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
