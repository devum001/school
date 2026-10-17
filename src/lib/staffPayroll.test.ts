import { describe, it, expect } from 'vitest';
import { createSeed } from '../mocks/seed';
import { restoreSchoolState } from '../mocks/restore';
import { defaultStaffPayroll } from './settings';
import { saveStaffMember } from './staffStructure';
import { payrollCycle, currentPayrollMonth, staffCycleSummary } from './staffPayroll';
import { schoolMonthlyFinance } from './schoolFinance';
import { saveStaffAttendance } from './staffAttendance';

function fixture() {
  const state = saveStaffMember(createSeed(), defaultStaffPayroll, {
    name: 'Payroll Staff',
    designation: 'Driver',
    departmentId: 'department-transport',
    email: '',
    phone: '',
    status: 'active',
    joinedOn: '2026-01-01',
    salary: {
      effectiveFrom: '2026-01',
      basic: 3100000,
      allowance: 200000,
      bonus: 50000,
      deduction: 10000,
    },
  });
  return { state, member: state.staffMembers![0] };
}
describe('payment-day salary cycles and automatic deductions', () => {
  it('uses inclusive payment-day boundaries, year changes and short months', () => {
    expect(payrollCycle('2026-10', 5)).toEqual({
      month: '2026-10',
      start: '2026-10-05',
      end: '2026-11-04',
      days: 31,
    });
    expect(payrollCycle('2026-12', 5).end).toBe('2027-01-04');
    expect(payrollCycle('2026-02', 31)).toEqual({
      month: '2026-02',
      start: '2026-02-28',
      end: '2026-03-30',
      days: 31,
    });
    expect(payrollCycle('2024-02', 31).start).toBe('2024-02-29');
    expect(payrollCycle('2026-01', 31)).toEqual({
      month: '2026-01',
      start: '2026-01-31',
      end: '2026-02-27',
      days: 28,
    });
    expect(currentPayrollMonth('2026-10-04', 5)).toBe('2026-09');
    expect(currentPayrollMonth('2026-10-05', 5)).toBe('2026-10');
    expect(currentPayrollMonth('2026-02-28', 31)).toBe('2026-02');
    expect(() => payrollCycle('2026-13', 5)).toThrow();
  });
  it('automatically counts full and half-day absences and ignores late and manual cycle counts', () => {
    const { state: initial, member } = fixture();
    let state = saveStaffAttendance(initial, defaultStaffPayroll, '2026-10-05', {
      [member.id]: 'absent',
    });
    state = saveStaffAttendance(state, defaultStaffPayroll, '2026-10-06', {
      [member.id]: 'half-day',
    });
    state = saveStaffAttendance(state, defaultStaffPayroll, '2026-10-07', { [member.id]: 'late' });
    state = {
      ...state,
      staffCycleInputs: [
        {
          schoolId: state.school.id,
          staffId: member.id,
          month: '2026-10',
          start: '2026-10-05',
          end: '2026-11-04',
          unpaidDays: 30,
          lateArrivals: 30,
        },
      ],
    };
    const config = {
      ...defaultStaffPayroll,
      payroll: {
        ...defaultStaffPayroll.payroll,
        lateDeduction: 'fixed-amount' as const,
        lateDeductionAmount: 9999999,
      },
    };
    expect(staffCycleSummary(state, config, member, '2026-10')).toMatchObject({
      leaveDays: 1.5,
      gross: 3350000,
      manual: 10000,
      leaveDeduction: 150000,
      net: 3190000,
    });
    expect(schoolMonthlyFinance(state, config, '2026-10-13')).toMatchObject({
      netSalary: 3190000,
      deductions: 160000,
    });
    expect(
      staffCycleSummary(restoreSchoolState(createSeed(), state), config, member, '2026-10')
        .leaveDays,
    ).toBe(1.5);
    state = saveStaffAttendance(state, config, '2026-10-06', { [member.id]: 'present' });
    expect(staffCycleSummary(state, config, member, '2026-10').leaveDays).toBe(1);
    expect(state.staffAttendance).toHaveLength(3);
  });
  it('keeps zero leave counts without entries and honors auto switches and enabled components', () => {
    const { state, member } = fixture();
    expect(staffCycleSummary(state, defaultStaffPayroll, member, '2026-10')).toMatchObject({
      leaveDays: 0,
      leaveDeduction: 0,
      net: 3340000,
    });
    const marked = saveStaffAttendance(state, defaultStaffPayroll, '2026-10-05', {
      [member.id]: 'absent',
    });
    const off = {
      ...defaultStaffPayroll,
      payroll: { ...defaultStaffPayroll.payroll, autoCalculation: false },
    };
    expect(staffCycleSummary(marked, off, member, '2026-10')).toMatchObject({
      leaveDays: 1,
      leaveDeduction: 0,
      net: 3340000,
    });
    const leaveOff = {
      ...defaultStaffPayroll,
      work: { ...defaultStaffPayroll.work, autoLeaveDeduction: false },
    };
    expect(staffCycleSummary(marked, leaveOff, member, '2026-10').leaveDeduction).toBe(0);
    const basicOnly = {
      ...defaultStaffPayroll,
      payroll: { ...defaultStaffPayroll.payroll, components: ['Basic'] as 'Basic'[] },
    };
    expect(staffCycleSummary(marked, basicOnly, member, '2026-10')).toMatchObject({
      gross: 3100000,
      manual: 0,
      leaveDeduction: 0,
      net: 3100000,
    });
  });
  it('scopes attendance by staff, school, cycle, joining date and the selected as-of date', () => {
    const { state: initial, member } = fixture();
    const record = { schoolId: initial.school.id, staffId: member.id, status: 'absent' as const };
    const state = {
      ...initial,
      staffAttendance: [
        { ...record, date: '2026-10-04' },
        { ...record, date: '2026-10-05' },
        { ...record, date: '2026-10-06', status: 'half-day' as const },
        { ...record, date: '2026-10-06', status: 'present' as const },
        { ...record, date: '2026-11-05' },
        { ...record, date: '2026-10-14' },
        { ...record, date: '2026-10-07', schoolId: 'other-school' },
        { ...record, date: '2026-10-07', staffId: 'other-staff' },
      ],
    };
    expect(
      staffCycleSummary(state, defaultStaffPayroll, member, '2026-10', '2026-10-13').leaveDays,
    ).toBe(1);
    expect(
      staffCycleSummary(
        state,
        defaultStaffPayroll,
        { ...member, joinedOn: '2026-10-06' },
        '2026-10',
        '2026-10-13',
      ).leaveDays,
    ).toBe(0);
    expect(
      staffCycleSummary(state, defaultStaffPayroll, member, '2026-10', '2026-10-04').leaveDays,
    ).toBe(0);
    const shifted = {
      ...defaultStaffPayroll,
      payroll: { ...defaultStaffPayroll.payroll, paymentDay: 10 },
    };
    expect(staffCycleSummary(state, shifted, member, '2026-10', '2026-10-13').leaveDays).toBe(0);
  });
  it('rejects invalid attendance saves and caps deductions at gross salary', () => {
    const { state, member } = fixture();
    for (const date of ['2026-02-31', '2026-03-31', '2099-01-01'])
      expect(() =>
        saveStaffAttendance(state, defaultStaffPayroll, date, { [member.id]: 'absent' }),
      ).toThrow();
    expect(() => saveStaffAttendance(state, defaultStaffPayroll, '2026-10-05', {})).toThrow();
    expect(() =>
      saveStaffAttendance(state, defaultStaffPayroll, '2026-10-05', { foreign: 'absent' }),
    ).toThrow();
    const salaryMember = {
      ...member,
      salary: { ...member.salary!, deduction: 3300000 },
      salaryHistory: undefined,
    };
    const marked = saveStaffAttendance(state, defaultStaffPayroll, '2026-10-05', {
      [member.id]: 'absent',
    });
    expect(staffCycleSummary(marked, defaultStaffPayroll, salaryMember, '2026-10')).toMatchObject({
      leaveDays: 1,
      net: 0,
      capped: true,
    });
  });
});
