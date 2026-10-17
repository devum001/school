import type { FeePlanInput } from '../types/ledger';
export interface FeePlanDraft {
  kind: FeePlanInput['kind'];
  totalFee: string;
  installments: { id?: string; amount: string; dueDate: string }[];
}
export function feePlanDraft(plan?: FeePlanInput): FeePlanDraft {
  return plan
    ? {
        kind: plan.kind,
        totalFee: String(plan.totalFee / 100),
        installments: plan.installments.map((item) => ({
          ...item,
          amount: String(item.amount / 100),
        })),
      }
    : { kind: 'One Time', totalFee: '', installments: [{ amount: '', dueDate: '' }] };
}
export function feePlanInput(draft: FeePlanDraft): FeePlanInput {
  return {
    kind: draft.kind,
    totalFee: Math.round(Number(draft.totalFee) * 100),
    installments: draft.installments.map((item) => ({
      id: item.id,
      amount: Math.round(Number(draft.kind === 'One Time' ? draft.totalFee : item.amount) * 100),
      dueDate: item.dueDate,
    })),
  };
}
