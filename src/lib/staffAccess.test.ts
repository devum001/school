import { describe, expect, it } from 'vitest';
import { createSeed } from '../mocks/seed';
import { roster } from './selectors';
import {
  ACCESS_MODULES,
  accessStaff,
  staffAccessFor,
  staffRoleSchema,
  saveStaffRole,
  saveStaffLoginAccess,
  deleteStaffRole,
  staffPermission,
  scopedStaffStudents,
  scopedStaffMembers,
  ownerAccessId,
} from './staffAccess';
import type { StaffRole } from '../types/staffAccess';

describe('staff-only role and access configuration', () => {
  it('has five staff roles with only three permission levels and keeps owner access', () => {
    const state = createSeed(),
      access = staffAccessFor(state);
    expect(access.roles.map((role) => role.name)).toEqual([
      'Principal / Owner',
      'Admin',
      'Teacher',
      'Accountant',
      'Office Staff',
    ]);
    expect(
      access.roles
        .flatMap((role) => Object.values(role.permissions))
        .every((level) => ['No Access', 'View', 'Manage'].includes(level)),
    ).toBe(true);
    expect(access.staff.every((entry) => !entry.loginAllowed)).toBe(true);
    for (const module of ACCESS_MODULES)
      expect(staffPermission(state, ownerAccessId(state), module)).toBe('Manage');
  });
  it('rejects student, guardian and foreign record login assignments', () => {
    const state = createSeed();
    for (const staffId of [state.students[0].id, 'guardian-1', 'other-school-staff'])
      expect(() =>
        saveStaffLoginAccess(state, {
          staffId,
          roleId: 'office',
          loginAllowed: true,
          sectionIds: [],
        }),
      ).toThrow(/staff member/);
    for (const name of ['Student', 'Parents', 'Guardian Portal', 'अभिभावक'])
      expect(() =>
        staffRoleSchema.parse({
          ...staffAccessFor(state).roles[4],
          id: name,
          name,
          kind: 'custom',
        }),
      ).toThrow(/staff only/);
  });
  it('restricts teachers to assigned sections and their own staff record', () => {
    let state = createSeed();
    const teacher = accessStaff(state).find(
      (member) => member.teacherId === state.sections[0].teacherId,
    )!;
    const section = state.sections[0];
    state = saveStaffLoginAccess(state, {
      staffId: teacher.id,
      roleId: 'teacher',
      loginAllowed: true,
      sectionIds: [section.id],
    });
    for (const module of ['Students', 'Attendance', 'Academics', 'Notifications'] as const) {
      const students = scopedStaffStudents(state, teacher.id, module);
      expect(students.length).toBeGreaterThan(0);
      expect(students.every((row) => row.enrollment.sectionId === section.id)).toBe(true);
      expect(students.length).toBeLessThan(roster(state).length);
    }
    expect(scopedStaffMembers(state, teacher.id).map((member) => member.id)).toEqual([teacher.id]);
    for (const module of ['Fee Management', 'Salary', 'School Settings'] as const)
      expect(staffPermission(state, teacher.id, module)).toBe('No Access');
    expect(scopedStaffStudents(state, teacher.id, 'Fee Management')).toEqual([]);
    expect(() =>
      saveStaffRole(state, {
        ...staffAccessFor(state).roles.find((role) => role.id === 'teacher')!,
        scope: 'school',
      }),
    ).toThrow(/assigned/);
  });
  it('denies disabled, inactive and unassigned staff without broadening their scope', () => {
    let state = createSeed();
    const member = accessStaff(state)[0];
    expect(staffPermission(state, member.id, 'Students')).toBe('No Access');
    expect(() =>
      saveStaffLoginAccess(state, {
        staffId: member.id,
        roleId: 'teacher',
        loginAllowed: true,
        sectionIds: [],
      }),
    ).toThrow(/at least one/);
    expect(() =>
      saveStaffLoginAccess(state, {
        staffId: member.id,
        roleId: 'teacher',
        loginAllowed: true,
        sectionIds: ['foreign-section'],
      }),
    ).toThrow(/this school/);
    state = saveStaffLoginAccess(state, {
      staffId: member.id,
      roleId: 'teacher',
      loginAllowed: true,
      sectionIds: [state.sections[0].id],
    });
    state = {
      ...state,
      teachers: state.teachers.map((teacher) =>
        teacher.id === member.teacherId ? { ...teacher, status: 'inactive' } : teacher,
      ),
    };
    expect(staffPermission(state, member.id, 'Attendance')).toBe('No Access');
    expect(scopedStaffStudents(state, member.id)).toEqual([]);
    expect(() =>
      saveStaffLoginAccess(state, {
        staffId: member.id,
        roleId: 'office',
        loginAllowed: true,
        sectionIds: [],
      }),
    ).toThrow(/Inactive/);
  });
  it('supports configurable custom roles, prevents duplicate names and protects assigned roles', () => {
    let state = createSeed();
    const custom: StaffRole = {
      ...structuredClone(staffAccessFor(state).roles[4]),
      id: 'library',
      name: 'Librarian',
      kind: 'custom',
      permissions: {
        ...staffAccessFor(state).roles[4].permissions,
        Students: 'View',
        Attendance: 'No Access',
      },
    };
    state = saveStaffRole(state, custom);
    expect(staffAccessFor(state).roles).toHaveLength(6);
    expect(() => saveStaffRole(state, { ...custom, id: 'duplicate' })).toThrow(/already exists/);
    const member = accessStaff(state)[0];
    state = saveStaffLoginAccess(state, {
      staffId: member.id,
      roleId: 'library',
      loginAllowed: true,
      sectionIds: [],
    });
    expect(staffPermission(state, member.id, 'Students')).toBe('View');
    expect(staffPermission(state, member.id, 'Attendance')).toBe('No Access');
    expect(() => deleteStaffRole(state, 'library')).toThrow(/another role/);
    state = saveStaffLoginAccess(state, {
      staffId: member.id,
      roleId: 'office',
      loginAllowed: false,
      sectionIds: [],
    });
    state = deleteStaffRole(state, 'library');
    expect(staffAccessFor(state).roles).toHaveLength(5);
    expect(() => deleteStaffRole(state, 'teacher')).toThrow(/custom/);
  });
  it('rejects owner demotion and permits only own-school records in scoped lists', () => {
    const state = createSeed(),
      owner = staffAccessFor(state).roles[0];
    expect(() =>
      saveStaffRole(state, {
        ...owner,
        permissions: { ...owner.permissions, 'School Settings': 'No Access' },
      }),
    ).toThrow(/retain/);
    const member = accessStaff(state)[0];
    const allowed = saveStaffLoginAccess(state, {
      staffId: member.id,
      roleId: 'admin',
      loginAllowed: true,
      sectionIds: [],
    });
    expect(
      scopedStaffStudents(allowed, member.id).every(
        (row) => row.enrollment.schoolId === state.school.id,
      ),
    ).toBe(true);
    expect(
      staffAccessFor({ ...allowed, school: { ...state.school, id: 'another-school' } }).staff,
    ).toEqual([]);
  });
  it('revokes effective access when assigned sections are removed or the role becomes scoped', () => {
    let state = createSeed();
    const member = accessStaff(state)[0],
      sectionId = state.sections[0].id;
    state = saveStaffLoginAccess(state, {
      staffId: member.id,
      roleId: 'teacher',
      loginAllowed: true,
      sectionIds: [sectionId],
    });
    const removed = {
      ...state,
      sections: state.sections.filter((section) => section.id !== sectionId),
    };
    expect(staffPermission(removed, member.id, 'Students')).toBe('No Access');
    expect(scopedStaffStudents(removed, member.id)).toEqual([]);
    const custom: StaffRole = {
      ...structuredClone(staffAccessFor(state).roles[4]),
      id: 'custom',
      name: 'Coordinator',
      kind: 'custom',
    };
    state = saveStaffRole(state, custom);
    state = saveStaffLoginAccess(state, {
      staffId: member.id,
      roleId: custom.id,
      loginAllowed: true,
      sectionIds: [],
    });
    state = saveStaffRole(state, { ...custom, scope: 'assigned' });
    expect(staffPermission(state, member.id, 'Students')).toBe('No Access');
  });
});
