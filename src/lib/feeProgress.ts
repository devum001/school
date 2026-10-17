import type { DemoState } from '../types/domain';
import { feeSummary, installments } from './selectors';
export function feeProgress(state: DemoState, enrollmentId: string) {
  const summary = feeSummary(state, enrollmentId),
    schedule = installments(state, enrollmentId);
  const completed = schedule.filter((item) => item.outstanding === 0).length;
  const partial = schedule.filter((item) => item.paid > 0 && item.outstanding > 0).length;
  const kind =
    state.feePlans?.find((p) => p.schoolId === state.school.id && p.enrollmentId === enrollmentId)
      ?.kind ?? (schedule.length === 1 ? 'One Time' : 'Installments');
  return {
    ...summary,
    schedule,
    kind,
    count: schedule.length,
    completed,
    partial,
    remaining: schedule.length - completed,
    next: schedule.find((item) => item.outstanding > 0),
  };
}
