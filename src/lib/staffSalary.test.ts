import { describe, expect, it } from 'vitest';
import { createSeed } from '../mocks/seed';
import { defaultStaffPayroll } from './settings';
import {
  saveStaffMember,
  staffDirectory,
  staffLabel,
  saveStaffDesignation,
  type StaffInput,
} from './staffStructure';
import { salaryForMonth, salaryNet } from './staffSalary';
import { schoolMonthlyFinance } from './schoolFinance';

const input: StaffInput = {
  name: 'Neha Sharma',
  designation: 'Physics Teacher',
  departmentId: 'department-academics',
  status: 'active',
  email: '',
  phone: '',
  joinedOn: '2026-01-01',
  salary: {
    effectiveFrom: '2026-10',
    basic: 3800000,
    allowance: 200000,
    bonus: 50000,
    deduction: 126700,
  },
};
describe('staff salaries and monthly school finance', () => {
  it('adds a person without a code or employment type and displays their designation', () => {
    const seed = createSeed();
    const state = saveStaffMember(seed, defaultStaffPayroll, input);
    const member = state.staffMembers![0];
    expect(staffLabel(member, defaultStaffPayroll)).toBe('Neha Sharma (Physics Teacher)');
    expect(member.staffId).toBeUndefined();
    expect(member.employmentType).toBeUndefined();
    expect(salaryNet(member.salary!)).toBe(3923300);
    expect(staffDirectory(state, defaultStaffPayroll)).toHaveLength(seed.teachers.length + 1);
  });
  it('keeps earlier months intact when salary changes and replaces the same month once', () => {
    let state = saveStaffMember(createSeed(), defaultStaffPayroll, input);
    const id = state.staffMembers![0].id;
    const revision = {
      ...input,
      salary: { ...input.salary!, effectiveFrom: '2026-11', basic: 4000000 },
    };
    state = saveStaffMember(state, defaultStaffPayroll, revision, id);
    state = saveStaffMember(state, defaultStaffPayroll, revision, id);
    const member = state.staffMembers![0];
    expect(salaryNet(salaryForMonth(member, '2026-10')!)).toBe(3923300);
    expect(salaryNet(salaryForMonth(member, '2026-11')!)).toBe(4123300);
    expect(salaryForMonth(member, '2026-09')).toBeUndefined();
    expect(member.salaryHistory).toHaveLength(2);
  });
  it('uses matching school/month fee income and active configured salaries only', () => {
    let state = saveStaffMember(createSeed(), defaultStaffPayroll, input);
    const payment = state.payments[0];
    state = {
      ...state,
      payments: [
        { ...payment, id: 'included', date: '2026-10-12', amount: 10000000 },
        { ...payment, id: 'future', date: '2026-10-20', amount: 9990000 },
        { ...payment, id: 'previous', date: '2026-09-12', amount: 9990000 },
        {
          ...payment,
          id: 'foreign',
          schoolId: 'other-school',
          date: '2026-10-12',
          amount: 9990000,
        },
      ],
    };
    expect(schoolMonthlyFinance(state, defaultStaffPayroll, '2026-10-13')).toMatchObject({
      feeIncome: 10000000,
      grossSalary: 4050000,
      deductions: 126700,
      netSalary: 3923300,
      balanceAfterSalary: 6076700,
      configuredCount: 1,
      unconfiguredCount: state.teachers.filter((teacher) => teacher.status === 'active').length,
    });
    state = saveStaffMember(
      state,
      defaultStaffPayroll,
      { ...input, status: 'inactive' },
      state.staffMembers![0].id,
    );
    expect(schoolMonthlyFinance(state, defaultStaffPayroll, '2026-10-13').netSalary).toBe(0);
  });
  it('rejects invalid salary amounts and updates linked teachers without duplicate people', () => {
    for (const salary of [
      { ...input.salary!, basic: -1 },
      { ...input.salary!, basic: 1.5 },
      { ...input.salary!, deduction: 9999999 },
      { ...input.salary!, effectiveFrom: '2026-13' },
    ])
      expect(() =>
        saveStaffMember(createSeed(), defaultStaffPayroll, { ...input, salary }),
      ).toThrow();
    const seed = createSeed();
    const teacher = staffDirectory(seed, defaultStaffPayroll)[0];
    const state = saveStaffMember(
      seed,
      defaultStaffPayroll,
      { ...input, name: 'Updated Teacher' },
      teacher.id,
    );
    expect(state.teachers.find((t) => t.id === teacher.teacherId)?.name).toBe('Updated Teacher');
    expect(staffDirectory(state, defaultStaffPayroll)).toHaveLength(seed.teachers.length);
  });
  it('preserves legacy designation labels without converting them into staff', () => {
    const seed = createSeed();
    const state = saveStaffDesignation(
      seed,
      defaultStaffPayroll,
      'department-academics',
      'Naveen Sir (Physics)',
    );
    const members = staffDirectory(state, state.staffPayroll!);
    expect(members).toHaveLength(seed.teachers.length);
    expect(members.some((member) => member.name.includes('Naveen Sir'))).toBe(false);
  });
});
