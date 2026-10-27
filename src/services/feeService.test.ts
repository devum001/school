import { beforeEach, expect, it, vi } from 'vitest';
import {
  accountBalance,
  feeApi,
  makeInstallments,
  rebalanceInstallments,
  allocateToEarliest,
} from './feeService';
import { feeAgreementFromDraft, feePlanDraft } from '../lib/feePlanDraft';
import { apiService, ApiError } from './apiService';

beforeEach(() => vi.restoreAllMocks());

it('distributes every paisa and clamps month ends without skipping February', () => {
  const rows = makeInstallments(10001, 3, '2026-01-31', 1);
  expect(rows.map((r) => r.amount)).toEqual([3334, 3334, 3333]);
  expect(rows.map((r) => r.dueDate)).toEqual(['2026-01-31', '2026-02-28', '2026-03-31']);
  expect(makeInstallments(10, 0, '2026-01-01', 1)).toEqual([]);
});

it('opening paid and later collections both reduce outstanding without double counting', () => {
  expect(
    accountBalance({
      installments: [
        { id: '1', amount: 2500000, dueDate: '2026-01-01', openingPaid: 700000, paid: 200000 },
      ],
    } as Parameters<typeof accountBalance>[0]),
  ).toBe(1600000);
});

it('reuses the payment request key after an uncertain network response', async () => {
  const request = vi
    .spyOn(apiService, 'request')
    .mockRejectedValueOnce(new ApiError(0, 'TIMEOUT', 'Interrupted'))
    .mockRejectedValueOnce(new ApiError(404, 'HTTP_404', 'Not yet committed'))
    .mockResolvedValue({ ids: ['saved'] });
  const input = {
    studentId: 'student',
    amount: 10000,
    date: '2026-01-01',
    method: 'Cash',
    reference: 'test',
    allocations: [{ accountId: 'account', installmentId: '1', amount: 10000 }],
  };
  await expect(feeApi.collect('school', input)).rejects.toThrow('Interrupted');
  await expect(feeApi.collect('school', input)).resolves.toEqual({ ids: ['saved'] });
  expect((request.mock.calls[0][1]?.body as { requestKey: string }).requestKey).toBe(
    (request.mock.calls[2][1]?.body as { requestKey: string }).requestKey,
  );
});

it('rejects a fee response from a different school', async () => {
  vi.spyOn(apiService, 'request').mockResolvedValue({
    schoolId: 'aaaaaaaaaaaaaaaaaaaaaaaa',
    items: [],
    nextCursor: null,
  });
  await expect(feeApi.payments('bbbbbbbbbbbbbbbbbbbbbbbb')).rejects.toThrow(
    'could not be verified',
  );
});

it('recovers a committed payment after its response is lost, without posting twice', async () => {
  const request = vi
    .spyOn(apiService, 'request')
    .mockRejectedValueOnce(new ApiError(0, 'NETWORK', 'Interrupted'))
    .mockResolvedValueOnce({ ids: ['receipt'] });
  const input = {
    studentId: 'student',
    amount: 10000,
    date: '2026-01-01',
    method: 'Cash',
    reference: 'reconcile',
    allocations: [{ accountId: 'account', installmentId: '1', amount: 10000 }],
  };
  await expect(feeApi.collect('school', input)).resolves.toEqual({ ids: ['receipt'] });
  expect(request.mock.calls.filter((call) => call[1]?.method === 'POST')).toHaveLength(1);
  expect(request.mock.calls[1][0]).toContain('/operations/');
});

it('an early payment covers the next unpaid installment and spills into the following one', () => {
  const pending = [
    { id: 'nov', dueDate: '2026-11-30', balance: 500000 },
    { id: 'oct', dueDate: '2026-10-30', balance: 300000 },
  ];
  expect(allocateToEarliest(pending, 400000).map((i) => [i.id, i.amount])).toEqual([
    ['oct', 300000],
    ['nov', 100000],
  ]);
  expect(allocateToEarliest(pending, 100000).map((i) => i.amount)).toEqual([100000, 0]);
});

it('rebalances unpaid installments while locking already-paid installments when bus service stops mid-year', () => {
  const existing = [
    { id: 'inst-1', amount: 1000000, dueDate: '2026-04-10', paid: 1000000, openingPaid: 0 },
    { id: 'inst-2', amount: 1000000, dueDate: '2026-08-10', paid: 0, openingPaid: 0 },
    { id: 'inst-3', amount: 1000000, dueDate: '2026-12-10', paid: 0, openingPaid: 0 },
  ];
  const rebalanced = rebalanceInstallments(
    2400000,
    existing.map(({ id, amount, dueDate }) => ({ id, amount, dueDate })),
    existing,
    '2026-04-10',
  );
  expect(rebalanced).toEqual([
    { id: 'inst-1', amount: 1000000, dueDate: '2026-04-10' },
    { id: 'inst-2', amount: 700000, dueDate: '2026-08-10' },
    { id: 'inst-3', amount: 700000, dueDate: '2026-12-10' },
  ]);
});

it('builds a complete fee agreement with tuition, bus, hostel, and concession from FeePlanDraft', () => {
  const draft = {
    ...feePlanDraft(undefined, '2026-04-01'),
    kind: 'Installments' as const,
    tuitionFee: '20000',
    transportActive: true,
    transportFee: '5000',
    transportMonths: 10,
    transportRoute: 'Route 4',
    hostelActive: true,
    hostelFee: '15000',
    hostelMonths: 12,
    hostelRoom: 'Block B',
    discountAmount: '4000',
    discountNote: 'Merit scholarship',
    totalFee: '36000',
    installments: [
      { id: 'inst-1', amount: '18000', dueDate: '2026-04-01' },
      { id: 'inst-2', amount: '18000', dueDate: '2026-10-01' },
    ],
  };
  const agreement = feeAgreementFromDraft('stu-1', draft, '2026-04-01');
  expect(agreement).toEqual({
    studentId: 'stu-1',
    revision: -1,
    baseFee: 4000000,
    tuitionFee: 2000000,
    transportActive: true,
    transportFee: 500000,
    transportRoute: 'Route 4',
    transportMonths: 10,
    hostelActive: true,
    hostelFee: 1500000,
    hostelRoom: 'Block B',
    hostelMonths: 12,
    concession: 400000,
    scholarship: 0,
    reason: 'Merit scholarship',
    openingPaid: 0,
    asOf: '',
    installments: [
      { id: 'inst-1', amount: 1800000, dueDate: '2026-04-01' },
      { id: 'inst-2', amount: 1800000, dueDate: '2026-10-01' },
    ],
  });
});
