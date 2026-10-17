import { describe, expect, it } from 'vitest';
import { createSeed } from '../mocks/seed';
import { restoreSchoolState } from '../mocks/restore';
import { defaultStaffPayroll, staffPayrollSchema, saveStaffPayroll } from './settings';
import {
  saveStaffDepartment,
  saveStaffDesignation,
  deleteStaffDepartment,
  deleteStaffDesignation,
  staffDirectory,
  saveStaffMember,
  type StaffInput,
} from './staffStructure';

const input: StaffInput = {
  name: 'Ravi Kumar',
  staffId: 'NEW-STAFF-1',
  departmentId: 'department-transport',
  designationId: 'transport-driver',
  employmentType: 'Contract',
  status: 'active',
  email: '',
  phone: '',
  joinedOn: '2026-01-01',
};
describe('department and designation hierarchy', () => {
  it('uses department-specific roles and migrates legacy flat lists without losing custom names', () => {
    expect(defaultStaffPayroll.setup.departments.map((d) => d.designations.length)).toEqual([
      5, 2, 3, 2, 3,
    ]);
    const migrated = staffPayrollSchema.parse({
      ...defaultStaffPayroll,
      setup: {
        departments: ['Academics', 'Library'],
        designations: ['Teacher', 'Librarian'],
        staffTypes: ['Full Time'],
      },
    });
    expect(migrated.setup.departments.map((d) => d.name)).toEqual(['Academics', 'Library']);
    expect(migrated.setup.departments.flatMap((d) => d.designations.map((r) => r.name))).toEqual(
      expect.arrayContaining(['Teacher', 'Librarian']),
    );
    expect('staffTypes' in migrated.setup).toBe(false);
    expect(
      staffPayrollSchema.parse({
        ...defaultStaffPayroll,
        setup: {
          departments: ['Academics', 'Accounts', 'Administration', 'Transport', 'Support'],
          designations: ['Teacher', 'Principal', 'Accountant', 'Receptionist', 'Driver'],
          staffTypes: ['Full Time'],
        },
      }).setup.departments[0].designations,
    ).toHaveLength(5);
  });
  it('counts actual teachers and added staff, preserves staff assignments when names change', () => {
    const fresh = createSeed();
    expect(staffDirectory(fresh, defaultStaffPayroll)).toHaveLength(fresh.teachers.length);
    let state = saveStaffMember(fresh, defaultStaffPayroll, input);
    expect(
      staffDirectory(state, defaultStaffPayroll).filter(
        (m) => m.departmentId === input.departmentId,
      ),
    ).toHaveLength(1);
    const member = state.staffMembers![0];
    state = saveStaffDepartment(state, defaultStaffPayroll, 'School Transport', input.departmentId);
    const config = state.staffPayroll!;
    state = saveStaffDesignation(
      state,
      config,
      input.departmentId,
      'Bus Driver',
      input.designationId,
    );
    expect(state.staffMembers![0].id).toBe(member.id);
    expect(state.staffMembers![0].designationId).toBe(input.designationId);
    expect(restoreSchoolState(fresh, state).staffMembers).toEqual(state.staffMembers);
    const renamed = saveStaffDepartment(
      fresh,
      defaultStaffPayroll,
      'Teaching team',
      'department-academics',
    );
    expect(
      staffDirectory(renamed, renamed.staffPayroll!).filter(
        (m) => m.departmentId === 'department-academics',
      ),
    ).toHaveLength(fresh.teachers.length);
  });
  it('rejects duplicate names, foreign role selection, duplicate staff IDs and deletion of assigned roles', () => {
    const state = saveStaffMember(createSeed(), defaultStaffPayroll, input);
    expect(() =>
      saveStaffMember(state, defaultStaffPayroll, {
        ...input,
        staffId: 'SECOND',
        designationId: 'academics-principal',
      }),
    ).toThrow(/selected department/);
    expect(() => saveStaffMember(state, defaultStaffPayroll, input)).toThrow(/already in use/);
    expect(() =>
      saveStaffMember(state, defaultStaffPayroll, { ...input, staffId: state.teachers[0].staffId }),
    ).toThrow(/already in use/);
    expect(() => saveStaffDepartment(state, defaultStaffPayroll, ' academics ')).toThrow(
      /already exists/,
    );
    expect(() =>
      saveStaffDesignation(state, defaultStaffPayroll, input.departmentId, ' driver '),
    ).toThrow(/already exists/);
    expect(() => deleteStaffDepartment(state, defaultStaffPayroll, input.departmentId)).toThrow(
      /Reassign/,
    );
    expect(() =>
      deleteStaffDesignation(state, defaultStaffPayroll, input.departmentId, input.designationId!),
    ).toThrow(/Reassign/);
    expect(() =>
      saveStaffPayroll(state, { ...defaultStaffPayroll, setup: { departments: [] } }),
    ).toThrow(/Reassign/);
    const removed = deleteStaffDesignation(
      createSeed(),
      defaultStaffPayroll,
      'department-accounts',
      'accounts-cashier',
    );
    expect(
      removed.staffPayroll!.setup.departments.find((d) => d.id === 'department-accounts')!
        .designations,
    ).toHaveLength(1);
  });
  it('saves teacher employment metadata without duplicating or changing teacher profiles', () => {
    const state = createSeed(),
      teacher = staffDirectory(state, defaultStaffPayroll)[0];
    const next = saveStaffMember(
      state,
      defaultStaffPayroll,
      {
        ...teacher,
        departmentId: 'department-academics',
        designationId: 'academics-pgt-teacher',
        employmentType: 'Part Time',
      },
      teacher.id,
    );
    expect(next.teachers).toEqual(state.teachers);
    expect(staffDirectory(next, defaultStaffPayroll)).toHaveLength(state.teachers.length);
    expect(
      staffDirectory(next, defaultStaffPayroll).find((s) => s.teacherId === teacher.teacherId)
        ?.employmentType,
    ).toBe('Part Time');
    expect(next.staffMembers![0].teacherId).toBe(teacher.teacherId);
  });
});
