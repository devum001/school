import type { FeePlanInput } from '../types/ledger';
import {
  accountBalance,
  makeInstallments,
  rebalanceInstallments,
  type FeeAccount,
  type FeeAgreement,
  type FeeStudent,
} from '../services/feeService';

export interface FeePlanDraft {
  kind: FeePlanInput['kind'];
  /** Net payable current-year fee in rupees (tuition + transport + hostel - concession - scholarship) */
  totalFee: string;
  /** Tuition / Academic base fee in rupees */
  tuitionFee?: string;
  /** Bus / Transport service */
  transportActive?: boolean;
  transportAnnualFee?: string;
  transportMonths?: number;
  transportFee?: string;
  transportRoute?: string;
  /** Hostel service */
  hostelActive?: boolean;
  hostelAnnualFee?: string;
  hostelMonths?: number;
  hostelFee?: string;
  hostelRoom?: string;
  /** Concession / Discount in rupees */
  discountAmount?: string;
  /** Scholarship in rupees */
  scholarshipAmount?: string;
  discountNote?: string;
  /** Already collected before setup in rupees */
  openingPaid?: string;
  /** Previous year pending balance in rupees */
  previousDueAmount?: string;
  previousDueYearName?: string;
  /** Whether previous year due already exists on backend */
  hasExistingPreviousDue?: boolean;
  /** Current year account revision (-1 when new) */
  revision?: number;
  asOf?: string;
  installments: {
    id?: string;
    amount: string;
    dueDate: string;
    paid?: number;
    openingPaid?: number;
  }[];
}

export function computeNetRupees(draft: Partial<FeePlanDraft>, fallbackTotal = ''): string {
  const hasBreakdown =
    draft.tuitionFee !== undefined ||
    Boolean(draft.transportActive) ||
    Boolean(draft.hostelActive) ||
    Number(draft.discountAmount || 0) > 0 ||
    Number(draft.scholarshipAmount || 0) > 0;
  if (!hasBreakdown) return fallbackTotal;
  const tuition = Math.max(0, Number(draft.tuitionFee || 0));
  const bus = draft.transportActive ? Math.max(0, Number(draft.transportFee || 0)) : 0;
  const hostel = draft.hostelActive ? Math.max(0, Number(draft.hostelFee || 0)) : 0;
  const discount = Math.max(0, Number(draft.discountAmount || 0));
  const scholarship = Math.max(0, Number(draft.scholarshipAmount || 0));
  const gross = tuition + bus + hostel;
  if (gross === 0 && !draft.tuitionFee && !draft.transportFee && !draft.hostelFee) {
    return '';
  }
  const net = Math.max(0, Math.round((gross - discount - scholarship) * 100) / 100);
  return String(net);
}

export function feePlanDraft(plan?: FeePlanInput, defaultDueDate = ''): FeePlanDraft {
  return plan
    ? {
        kind: plan.kind,
        totalFee: String(plan.totalFee / 100),
        tuitionFee: String(plan.totalFee / 100),
        transportActive: false,
        transportAnnualFee: '',
        transportMonths: 12,
        transportFee: '',
        transportRoute: '',
        hostelActive: false,
        hostelAnnualFee: '',
        hostelMonths: 12,
        hostelFee: '',
        hostelRoom: '',
        discountAmount: '',
        scholarshipAmount: '',
        discountNote: '',
        openingPaid: '',
        previousDueAmount: '',
        previousDueYearName: 'Previous Academic Year',
        revision: -1,
        asOf: '',
        installments: plan.installments.map((item) => ({
          ...item,
          amount: String(item.amount / 100),
        })),
      }
    : {
        kind: 'One Time',
        totalFee: '',
        tuitionFee: '',
        transportActive: false,
        transportAnnualFee: '',
        transportMonths: 12,
        transportFee: '',
        transportRoute: '',
        hostelActive: false,
        hostelAnnualFee: '',
        hostelMonths: 12,
        hostelFee: '',
        hostelRoom: '',
        discountAmount: '',
        scholarshipAmount: '',
        discountNote: '',
        openingPaid: '',
        previousDueAmount: '',
        previousDueYearName: 'Previous Academic Year',
        revision: -1,
        asOf: '',
        installments: [{ amount: '', dueDate: defaultDueDate }],
      };
}

export function feePlanDraftFromAccount(
  acc: FeeAccount | undefined,
  previousAccounts: FeeAccount[],
  defaultDueDate: string,
): FeePlanDraft {
  const prevTotal = previousAccounts.reduce((sum, p) => sum + accountBalance(p), 0);
  if (!acc) {
    return {
      ...feePlanDraft(undefined, defaultDueDate),
      previousDueAmount: prevTotal > 0 ? String(prevTotal / 100) : '',
      hasExistingPreviousDue: previousAccounts.length > 0,
      revision: -1,
    };
  }
  const transportFeePaise = acc.transportFee ?? 0;
  const hostelFeePaise = acc.hostelFee ?? 0;
  const tuitionFeePaise =
    acc.tuitionFee !== undefined && acc.tuitionFee > 0
      ? acc.tuitionFee
      : Math.max(0, acc.baseFee - transportFeePaise - hostelFeePaise);
  const transportMonths = acc.transportMonths ?? 12;
  const hostelMonths = acc.hostelMonths ?? 12;
  const netFeePaise = Math.max(0, acc.baseFee - acc.concession - acc.scholarship);
  const openingPaidPaise = acc.installments.reduce((s, i) => s + i.openingPaid, 0);

  return {
    kind: acc.installments.length > 1 ? 'Installments' : 'One Time',
    totalFee: String(netFeePaise / 100),
    tuitionFee: String(tuitionFeePaise / 100),
    transportActive: Boolean(acc.transportActive || transportFeePaise > 0),
    transportAnnualFee:
      transportFeePaise > 0 && transportMonths > 0
        ? String(Math.round((transportFeePaise / 100) * (12 / transportMonths)))
        : '',
    transportMonths: transportMonths || 12,
    transportFee: transportFeePaise > 0 ? String(transportFeePaise / 100) : '',
    transportRoute: acc.transportRoute ?? '',
    hostelActive: Boolean(acc.hostelActive || hostelFeePaise > 0),
    hostelAnnualFee:
      hostelFeePaise > 0 && hostelMonths > 0
        ? String(Math.round((hostelFeePaise / 100) * (12 / hostelMonths)))
        : '',
    hostelMonths: hostelMonths || 12,
    hostelFee: hostelFeePaise > 0 ? String(hostelFeePaise / 100) : '',
    hostelRoom: acc.hostelRoom ?? '',
    discountAmount: acc.concession > 0 ? String(acc.concession / 100) : '',
    scholarshipAmount: acc.scholarship > 0 ? String(acc.scholarship / 100) : '',
    discountNote: acc.reason ?? '',
    openingPaid: openingPaidPaise > 0 ? String(openingPaidPaise / 100) : '',
    previousDueAmount: prevTotal > 0 ? String(prevTotal / 100) : '',
    hasExistingPreviousDue: previousAccounts.length > 0,
    revision: acc.revision,
    asOf: acc.asOf ?? '',
    installments:
      acc.installments.length > 0
        ? acc.installments.map((inst) => ({
            id: inst.id,
            amount: String(inst.amount / 100),
            dueDate: inst.dueDate,
            paid: inst.paid,
            openingPaid: inst.openingPaid,
          }))
        : [{ id: 'installment-1', amount: String(netFeePaise / 100), dueDate: defaultDueDate }],
  };
}

export function feePlanDraftFromLedger(
  ledger: FeeStudent,
  yearId: string,
  defaultDueDate: string,
): FeePlanDraft {
  const current = ledger.accounts.find((a) => a.academicYearId === yearId && !a.historical);
  const previous = ledger.accounts.filter((a) => a.academicYearId !== yearId || a.historical);
  return feePlanDraftFromAccount(current, previous, defaultDueDate);
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

export function feeAgreementFromDraft(
  studentId: string,
  draft: FeePlanDraft,
  defaultDueDate: string,
): FeeAgreement | null {
  const tuitionPaise = Math.max(
    0,
    Math.round(Number(draft.tuitionFee ?? draft.totalFee ?? 0) * 100),
  );
  const transportPaise = draft.transportActive
    ? Math.max(0, Math.round(Number(draft.transportFee || 0) * 100))
    : 0;
  const hostelPaise = draft.hostelActive
    ? Math.max(0, Math.round(Number(draft.hostelFee || 0) * 100))
    : 0;
  const hasFacilities = Boolean(
    draft.transportActive ||
      draft.hostelActive ||
      draft.discountAmount ||
      draft.scholarshipAmount,
  );
  const grossPaise = hasFacilities
    ? tuitionPaise + transportPaise + hostelPaise
    : Math.max(0, Math.round(Number(draft.totalFee || 0) * 100));
  if (grossPaise <= 0) return null;

  const concessionPaise = Math.min(
    grossPaise,
    Math.max(0, Math.round(Number(draft.discountAmount || 0) * 100)),
  );
  const scholarshipPaise = Math.min(
    Math.max(0, grossPaise - concessionPaise),
    Math.max(0, Math.round(Number(draft.scholarshipAmount || 0) * 100)),
  );
  const netPaise = Math.max(0, grossPaise - concessionPaise - scholarshipPaise);
  const openingPaidPaise = Math.min(
    netPaise,
    Math.max(0, Math.round(Number(draft.openingPaid || 0) * 100)),
  );

  let installments: { id: string; amount: number; dueDate: string }[];
  if (draft.kind === 'One Time') {
    const first = draft.installments[0];
    installments = [
      {
        id: first?.id || 'installment-1',
        amount: netPaise,
        dueDate: first?.dueDate || defaultDueDate,
      },
    ];
  } else {
    const rawRows = draft.installments.map((inst, idx) => ({
      id: inst.id || `installment-${idx + 1}`,
      amount: Math.max(0, Math.round(Number(inst.amount || 0) * 100)),
      dueDate: inst.dueDate || defaultDueDate,
      paid: inst.paid ?? 0,
      openingPaid: inst.openingPaid ?? 0,
    }));
    const rawSum = rawRows.reduce((s, r) => s + r.amount, 0);
    if (rawSum === netPaise && rawRows.every((r) => r.amount >= r.paid + r.openingPaid)) {
      installments = rawRows.map(({ id, amount, dueDate }) => ({ id, amount, dueDate }));
    } else {
      installments = rebalanceInstallments(
        netPaise,
        rawRows.length > 0
          ? rawRows.map(({ id, amount, dueDate }) => ({ id, amount, dueDate }))
          : makeInstallments(netPaise, 3, defaultDueDate, 1),
        rawRows,
        defaultDueDate,
      );
    }
  }

  return {
    studentId,
    revision: draft.revision ?? -1,
    baseFee: grossPaise,
    tuitionFee: hasFacilities ? tuitionPaise : grossPaise,
    transportActive: Boolean(draft.transportActive && transportPaise > 0),
    transportFee: transportPaise,
    transportRoute: draft.transportActive ? (draft.transportRoute ?? '').trim() : '',
    transportMonths: draft.transportActive ? (draft.transportMonths ?? 12) : 0,
    hostelActive: Boolean(draft.hostelActive && hostelPaise > 0),
    hostelFee: hostelPaise,
    hostelRoom: draft.hostelActive ? (draft.hostelRoom ?? '').trim() : '',
    hostelMonths: draft.hostelActive ? (draft.hostelMonths ?? 12) : 0,
    concession: concessionPaise,
    scholarship: scholarshipPaise,
    reason: (draft.discountNote ?? '').trim(),
    openingPaid: openingPaidPaise,
    asOf: openingPaidPaise > 0 ? draft.asOf || defaultDueDate : draft.asOf || '',
    installments,
  };
}

export function previousYearOpeningRow(
  studentId: string,
  amountPaise: number,
  yearStart: string,
  today: string,
  customYearName?: string,
) {
  const refDate = yearStart <= today ? yearStart : today;
  const d = new Date(`${refDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  const end = d.toISOString().slice(0, 10);
  const s = new Date(d.getTime());
  s.setUTCFullYear(s.getUTCFullYear() - 1);
  s.setUTCDate(s.getUTCDate() + 1);
  const start = s.toISOString().slice(0, 10);
  const asOf = today >= end ? today : end;
  const startYr = start.slice(0, 4);
  const endYr = end.slice(2, 4);
  return {
    studentId,
    yearName: customYearName?.trim() || `${startYr}-${endYr} Pending Dues`,
    start,
    end,
    asOf,
    amount: amountPaise,
  };
}
