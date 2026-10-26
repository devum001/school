import { afterEach, expect, it, vi } from 'vitest';
import { apiService } from './apiService';
import {
  liveHrAdapter,
  payrollPaid,
  payrollStatus,
  type HrPayroll,
  type HrWorkspace,
} from './hrService';
afterEach(() => vi.restoreAllMocks());
const settings = {
  id: 'settings',
  schoolId: 'school',
  revision: 0,
  departments: [],
  start: '08:00',
  end: '14:00',
  lateAfter: '08:15',
  halfDayMinutes: 210,
  workingDays: [1],
  holidays: [],
  paymentDay: 5,
  deductionBasis: 'basic' as const,
  divisor: 'calendar' as const,
  paidLeaveDays: 12,
  maxAccuracy: 50,
  locations: [],
};
const data: HrWorkspace = {
  settings,
  today: '2026-10-19',
  staff: [],
  employment: [],
  attendance: [],
  leaves: [],
  payroll: [],
  payments: [],
  advances: [],
};
const item: HrPayroll = {
  id: 'item',
  schoolId: 'school',
  staffId: 'person',
  revision: 1,
  month: '2026-09',
  name: 'Teacher',
  code: 'T1',
  department: 'Teaching',
  dueDate: '2026-10-05',
  status: 'approved',
  basic: 10000,
  allowance: 0,
  bonus: 0,
  gross: 10000,
  unpaidUnits: 0,
  leaveDeduction: 0,
  manualDeduction: 0,
  adjustment: 0,
  advanceRecovery: 0,
  note: '',
  net: 10000,
  unresolved: [],
};
it('a due date does not imply payment; partial and complete payments use actual records', () => {
  expect(payrollStatus(item, data)).toBe('Unpaid');
  expect(payrollStatus({ ...item, net: 0 }, data)).toBe('No payment due');
  const partial = {
    ...data,
    payments: [
      {
        id: 'p',
        schoolId: 'school',
        staffId: 'person',
        payrollId: 'item',
        amount: 4000,
        date: '2026-10-19',
        method: 'Cash',
        reference: '',
      },
    ],
  };
  expect(payrollPaid(item, partial)).toBe(4000);
  expect(payrollStatus(item, partial)).toBe('Partially paid');
  expect(
    payrollStatus(item, { ...partial, payments: [{ ...partial.payments[0], amount: 10000 }] }),
  ).toBe('Paid');
  expect(payrollStatus({ ...item, status: 'draft' }, partial)).toBe('Draft');
});
it('validates school scope and does not fall back on invalid or failed backend responses', async () => {
  const request = vi.spyOn(apiService, 'request').mockResolvedValue(data);
  const adapter = liveHrAdapter('school');
  expect(await adapter.load('2026-09', false, new AbortController().signal)).toEqual(data);
  request.mockResolvedValue({ ...data, settings: { ...settings, schoolId: 'foreign' } });
  await expect(adapter.load('2026-09', false, new AbortController().signal)).rejects.toMatchObject({
    code: 'INVALID_RESPONSE',
  });
  request.mockRejectedValue(new Error('Unavailable'));
  await expect(adapter.load('2026-09', false, new AbortController().signal)).rejects.toThrow(
    'Unavailable',
  );
});
it('mutations use the authenticated API service and keep retry keys unchanged', async () => {
  const request = vi.spyOn(apiService, 'request').mockResolvedValue({});
  const adapter = liveHrAdapter('school'),
    body = { requestKey: 'stable-request-key', amount: 100 };
  await adapter.save('/payroll/item/payments', body);
  expect(request).toHaveBeenCalledWith('/schools/school/hr/payroll/item/payments', {
    method: 'POST',
    body,
  });
});
