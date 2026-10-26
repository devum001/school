import { z } from 'zod';
import { apiService, ApiError } from './apiService';
const id = z.string().regex(/^[a-f\d]{24}$/i);
const installment = z.object({
  id: z.string(),
  dueDate: z.string(),
  amount: z.number(),
  openingPaid: z.number(),
  paid: z.number(),
});
const account = z.object({
  id: id.optional(),
  _id: id.optional(),
  studentId: id,
  academicYearId: id.optional(),
  yearName: z.string(),
  start: z.string(),
  end: z.string(),
  historical: z.boolean(),
  revision: z.number(),
  baseFee: z.number(),
  concession: z.number(),
  scholarship: z.number(),
  reason: z.string(),
  asOf: z.string(),
  installments: z.array(installment),
});
const summary = z.object({
  net: z.number(),
  outstanding: z.number(),
  overdue: z.number(),
  pending: z.number(),
  collected: z.number(),
  concessions: z.number(),
  count: z.number(),
});
const row = z.object({
  id,
  name: z.string(),
  code: z.string(),
  enrollment: z.object({ classId: id, sectionId: id.optional(), status: z.string() }).optional(),
  configured: z.boolean(),
  net: z.number(),
  outstanding: z.number(),
  overdue: z.number(),
  pending: z.number(),
  paid: z.number(),
  oldDues: z.number(),
  nextDue: z.string().nullable(),
  account: account.optional(),
});
const payment = z.object({
  id,
  schoolId: id,
  studentId: id,
  studentName: z.string(),
  admissionNumber: z.string(),
  receipt: z.string(),
  amount: z.number(),
  date: z.string(),
  method: z.string(),
  reference: z.string(),
  reversalReason: z.string(),
  createdAt: z.string(),
  reversedAt: z.string().optional(),
  allocations: z.array(
    z.object({
      accountId: id,
      installmentId: z.string(),
      yearName: z.string(),
      amount: z.number(),
    }),
  ),
});
const context = z.object({
  schoolId: id,
  schoolName: z.string(),
  today: z.string(),
  yearId: z.string(),
  years: z.array(
    z.object({ id, name: z.string(), start: z.string(), end: z.string(), status: z.string() }),
  ),
  classes: z.array(z.object({ id, name: z.string() })),
  sections: z.array(z.object({ id, classId: id, name: z.string() })),
});
const directory = z.object({
  schoolId: id,
  yearId: id,
  today: z.string(),
  page: z.number(),
  pageSize: z.number(),
  total: z.number(),
  summary,
  classes: z.array(summary.extend({ _id: id.nullable() })),
  items: z.array(row),
});
const detail = z.object({
  schoolId: id,
  student: z.object({ id, name: z.string(), code: z.string() }),
  accounts: z.array(account),
  changes: z.array(
    z.object({ id, kind: z.string(), createdAt: z.string(), actorUserId: id, changes: z.string() }),
  ),
});
export type FeeAccount = z.infer<typeof account>;
export type FeeStudentRow = z.infer<typeof row>;
export type FeeContext = z.infer<typeof context>;
export type FeeDirectory = z.infer<typeof directory>;
export type FeeStudent = z.infer<typeof detail>;
export type FeePayment = z.infer<typeof payment>;
export type FeeFilters = {
  yearId: string;
  classId?: string;
  sectionId?: string;
  search?: string;
  status?: string;
  page?: number;
};
export type FeeAgreement = {
  studentId: string;
  revision: number;
  baseFee: number;
  concession: number;
  scholarship: number;
  reason: string;
  openingPaid: number;
  asOf: string;
  installments: { id: string; amount: number; dueDate: string }[];
};
const root = (school: string) => `/schools/${encodeURIComponent(school)}/fees`;
function query(values: object) {
  return new URLSearchParams(
    Object.entries(values)
      .filter(([, v]) => v !== undefined && v !== '')
      .map(([k, v]) => [k, String(v)]),
  ).toString();
}
function parse<T>(schema: z.ZodType<T>, data: unknown, school: string): T {
  const result = schema.safeParse(data);
  if (!result.success || (result.data as { schoolId: string }).schoolId !== school)
    throw new ApiError(
      0,
      'INVALID_RESPONSE',
      'The fee response could not be verified. Reload this workspace.',
    );
  return result.data;
}
// Persist only a random key and payload digest, never names, amounts or credentials.
// An uncertain response can be safely retried, including after reloading the page.
const pending = new Map<string, string>();
async function save(school: string, path: string, body: object) {
  const digest = Array.from(
    new Uint8Array(
      await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(JSON.stringify([school, path, body])),
      ),
    ),
  )
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  const storageKey = `schoolwell:fee-save:${digest}`;
  let key = pending.get(storageKey);
  try {
    key ??= sessionStorage.getItem(storageKey) ?? undefined;
  } catch {
    /* memory fallback */
  }
  key ??= crypto.randomUUID();
  pending.set(storageKey, key);
  try {
    sessionStorage.setItem(storageKey, key);
  } catch {
    /* memory fallback */
  }
  try {
    const result = await apiService.request<{ ids: string[] }>(`${root(school)}${path}`, {
      method: 'POST',
      body: { ...body, requestKey: key },
    });
    pending.delete(storageKey);
    try {
      sessionStorage.removeItem(storageKey);
    } catch {
      /* memory fallback */
    }
    return result;
  } catch (error) {
    // A response can be lost after MongoDB committed. Reconcile before displaying failure.
    if (error instanceof ApiError && (error.status === 0 || error.status >= 500)) {
      try {
        const committed = await apiService.request<{ ids: string[] }>(
          `${root(school)}/operations/${key}`,
          { fresh: true },
        );
        apiService.invalidateReads();
        pending.delete(storageKey);
        try {
          sessionStorage.removeItem(storageKey);
        } catch {
          /* memory fallback */
        }
        return committed;
      } catch {
        /* Not yet committed or status unavailable: retain the exact retry key. */
      }
    }
    // Keep uncertain operations resumable; validation errors did not commit.
    if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
      pending.delete(storageKey);
      try {
        sessionStorage.removeItem(storageKey);
      } catch {
        /* memory fallback */
      }
    }
    throw error;
  }
}
export const feeApi = {
  async context(school: string, yearId: string, signal?: AbortSignal) {
    return parse(
      context,
      await apiService.request(`${root(school)}/context?${query({ yearId })}`, { signal }),
      school,
    );
  },
  async directory(school: string, filters: FeeFilters, signal?: AbortSignal) {
    return parse(
      directory,
      await apiService.request(`${root(school)}?${query(filters)}`, { signal }),
      school,
    );
  },
  async student(school: string, studentId: string, signal?: AbortSignal) {
    return parse(
      detail,
      await apiService.request(`${root(school)}/students/${studentId}`, { signal }),
      school,
    );
  },
  async payments(school: string, studentId = '', after = '', signal?: AbortSignal, yearId = '') {
    return parse(
      z.object({ schoolId: id, items: z.array(payment), nextCursor: id.nullable() }),
      await apiService.request(`${root(school)}/payments?${query({ studentId, after, yearId })}`, {
        signal,
      }),
      school,
    );
  },
  agreements: (school: string, yearId: string, rows: FeeAgreement[]) =>
    save(school, '/agreements', { yearId, rows }),
  opening: (
    school: string,
    yearId: string,
    rows: {
      studentId: string;
      yearName: string;
      start: string;
      end: string;
      asOf: string;
      amount: number;
    }[],
  ) => save(school, '/opening', { yearId, rows }),
  collect: (
    school: string,
    body: {
      studentId: string;
      amount: number;
      date: string;
      method: string;
      reference: string;
      allocations: { accountId: string; installmentId: string; amount: number }[];
    },
  ) => save(school, '/payments', body),
  correctOpening: (
    school: string,
    accountId: string,
    body: { revision: number; amount: number; reason: string },
  ) => save(school, `/accounts/${accountId}/correct-opening`, body),
  reverse: (school: string, paymentId: string, reason: string) =>
    save(school, `/payments/${paymentId}/reverse`, { reason }),
};
export const installmentBalance = (i: FeeAccount['installments'][number]) =>
  i.amount - i.openingPaid - i.paid;
export const accountBalance = (a: FeeAccount) =>
  a.installments.reduce((s, i) => s + installmentBalance(i), 0);
export function makeInstallments(total: number, count: number, date: string, interval: number) {
  const first = new Date(`${date}T12:00:00Z`);
  if (!Number.isFinite(first.getTime()) || count < 1 || count > 60 || total < 0) return [];
  return Array.from({ length: count }, (_, i) => {
    const next = new Date(
      Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + interval * i + 1, 0),
    );
    next.setUTCDate(Math.min(first.getUTCDate(), next.getUTCDate()));
    return {
      id: `installment-${i + 1}`,
      amount: Math.floor(total / count) + (i < total % count ? 1 : 0),
      dueDate: next.toISOString().slice(0, 10),
    };
  });
}

/** Due dates determine order, never whether an early payment may be allocated. */
export function allocateToEarliest<T extends { dueDate: string; balance: number }>(
  pending: readonly T[],
  amount: number,
) {
  let remaining = Math.max(0, amount);
  return [...pending]
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .map((item) => {
      const allocated = Math.min(remaining, item.balance);
      remaining -= allocated;
      return { ...item, amount: allocated };
    });
}
