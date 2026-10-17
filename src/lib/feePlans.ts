import type { DemoState } from '../types/domain';
import type { FeePlanInput } from '../types/ledger';
import { feePlanInputSchema } from './ledgerSchemas';
import { installmentName } from './feeLabels';
import { allocatedPayments, installments } from './selectors';

/** Remove unrequested seeded discounts; preserve explicitly saved custom fee totals. */
export function removeLegacyFeeAdjustments(state: DemoState): DemoState {
  return {
    ...state,
    obligations: state.obligations.map((item) => {
      if (item.schoolId !== state.school.id || !item.adjustment) return item;
      const isSample =
        /^fee-\d+-[0-2]$/.test(item.id) &&
        item.amount === 1800000 &&
        item.adjustment === -100000 &&
        !state.feePlans?.some(
          (plan) => plan.schoolId === state.school.id && plan.enrollmentId === item.enrollmentId,
        );
      return {
        ...item,
        amount: isSample ? item.amount : item.amount + item.adjustment,
        adjustment: 0,
      };
    }),
  };
}

export function currentFeePlan(state: DemoState, enrollmentId: string): FeePlanInput | undefined {
  const items = installments(state, enrollmentId);
  if (!items.length) return undefined;
  const saved = state.feePlans?.find(
    (plan) => plan.schoolId === state.school.id && plan.enrollmentId === enrollmentId,
  );
  return {
    kind: saved?.kind ?? (items.length === 1 ? 'One Time' : 'Installments'),
    totalFee: items.reduce((sum, item) => sum + item.net, 0),
    installments: items.map((item) => ({ id: item.id, amount: item.net, dueDate: item.dueDate })),
  };
}
export function saveFeePlan(state: DemoState, enrollmentId: string, raw: FeePlanInput): DemoState {
  const plan = feePlanInputSchema.parse(raw);
  const enrollment = state.enrollments.find(
    (entry) => entry.schoolId === state.school.id && entry.id === enrollmentId,
  );
  if (!enrollment) throw new Error('Student enrollment not found.');
  const previous = installments(state, enrollmentId);
  const resolvedPayments = new Map(
    allocatedPayments(state, enrollmentId).map((payment) => [payment.id, payment]),
  );
  if (plan.installments.some((item) => item.id && !previous.some((old) => old.id === item.id)))
    throw new Error('Choose installments belonging to this student.');
  for (const old of previous) {
    const revised = plan.installments.find((item) => item.id === old.id);
    if (old.paid && (!revised || revised.amount < old.paid))
      throw new Error(
        'Paid installments must remain, and their amount cannot be less than already paid.',
      );
  }
  const paid = state.payments
    .filter(
      (payment) => payment.schoolId === state.school.id && payment.enrollmentId === enrollmentId,
    )
    .reduce((sum, payment) => sum + payment.amount, 0);
  if (plan.totalFee < paid)
    throw new Error('Total Fee cannot be less than payments already recorded.');
  const obligations = plan.installments.map((item, index) => {
    const old = previous.find((entry) => entry.id === item.id);
    return {
      id: old?.id ?? crypto.randomUUID(),
      schoolId: state.school.id,
      enrollmentId,
      label: installmentName(index + 1, plan.kind === 'One Time'),
      dueDate: item.dueDate,
      amount: item.amount,
      adjustment: 0,
      installmentNumber: index + 1,
      installmentCount: plan.installments.length,
      feeKind: plan.kind,
    };
  });
  return {
    ...state,
    payments: state.payments.map((payment) => resolvedPayments.get(payment.id) ?? payment),
    obligations: [
      ...state.obligations.filter(
        (item) => item.schoolId !== state.school.id || item.enrollmentId !== enrollmentId,
      ),
      ...obligations,
    ],
    feePlans: [
      ...(state.feePlans ?? []).filter(
        (item) => item.schoolId !== state.school.id || item.enrollmentId !== enrollmentId,
      ),
      { schoolId: state.school.id, enrollmentId, kind: plan.kind, totalFee: plan.totalFee },
    ],
  };
}
