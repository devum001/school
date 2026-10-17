import { describe, expect, it } from 'vitest';
import { createSeed } from '../mocks/seed';
import { restoreSchoolState } from '../mocks/restore';
import { nextAdmissionNumber, renumberStudentRolls, studentRollPreview } from './studentNumbering';
import { saveStudent, deleteStudent, type StudentInput } from './management';
import { feeSummary, roster } from './selectors';
import { removeLegacyFeeAdjustments, saveFeePlan, currentFeePlan } from './feePlans';

const input: StudentInput = {
  name: 'Aaa New Student',
  admissionNumber: '',
  rollNumber: 99,
  status: 'active',
  birthDate: '2015-01-01',
  address: 'New address',
  guardian: { name: 'Guardian', relation: 'Parent', contact: null },
  classId: 'class-5',
  sectionId: 'class-5-a',
};
function expectAlphabetic(state: ReturnType<typeof createSeed>, section = input.sectionId) {
  const rows = roster(state).filter((row) => row.enrollment.sectionId === section);
  expect(rows.map((row) => row.enrollment.rollNumber)).toEqual(rows.map((_, index) => index + 1));
}

describe('automatic student identifiers', () => {
  it('generates unique admissions on save and preserves them on rename and restoration', () => {
    const original = createSeed();
    const admission = nextAdmissionNumber(original);
    expect(admission).not.toContain('2026-2026');
    const first = saveStudent(original, input);
    const added = first.students.at(-1)!;
    expect(added.admissionNumber).toBe(admission);
    const second = saveStudent(first, { ...input, name: 'Another Student' });
    expect(second.students.at(-1)!.admissionNumber).not.toBe(admission);
    const renamed = saveStudent(
      second,
      { ...input, admissionNumber: 'CHANGED', name: 'Zzz New Student' },
      added.id,
    );
    expect(renamed.students.find((student) => student.id === added.id)?.admissionNumber).toBe(
      admission,
    );
    const restored = restoreSchoolState(createSeed(), renamed);
    expect(restored.students).toEqual(renamed.students);
    expect(original.students.some((student) => student.admissionNumber === admission)).toBe(false);
    expectAlphabetic(restored);
    const removed = deleteStudent(first, added.id);
    expect(nextAdmissionNumber(restoreSchoolState(createSeed(), removed))).not.toBe(admission);
  });
  it('reorders rolls on add, name edit, class move, inactivity and deletion without changing linked IDs', () => {
    const original = createSeed();
    let state = saveStudent(original, input);
    const added = state.students.at(-1)!;
    expectAlphabetic(state);
    expect(
      state.enrollments.find((enrollment) => enrollment.studentId === added.id)?.rollNumber,
    ).toBe(1);
    const preview = studentRollPreview(state, { ...input, id: added.id, name: 'Zzz New Student' });
    state = saveStudent(state, { ...input, name: 'Zzz New Student' }, added.id);
    expect(
      state.enrollments.find((enrollment) => enrollment.studentId === added.id)?.rollNumber,
    ).toBe(preview);
    state = saveStudent(state, { ...input, classId: 'class-6', sectionId: 'class-6-a' }, added.id);
    expectAlphabetic(state);
    expectAlphabetic(state, 'class-6-a');
    state = saveStudent(
      state,
      { ...input, classId: 'class-6', sectionId: 'class-6-a', status: 'inactive' },
      added.id,
    );
    expectAlphabetic(state, 'class-6-a');
    state = deleteStudent(state, added.id);
    expectAlphabetic(state, 'class-6-a');
    expect(state.attendance).toEqual(original.attendance);
    expect(state.payments).toEqual(original.payments);
    expect(renumberStudentRolls(state)).toBe(state);
  });
});

it('removes legacy sample scholarships once while preserving payments, issued documents and custom fee plans', () => {
  const seed = createSeed();
  const legacy = {
    ...seed,
    obligations: seed.obligations.map((item) =>
      item.enrollmentId === 'enr-001' ? { ...item, adjustment: -100000 } : item,
    ),
  };
  const migrated = restoreSchoolState(seed, legacy);
  expect(feeSummary(migrated, 'enr-001')).toMatchObject({
    total: 5400000,
    paid: 1800000,
    outstanding: 3600000,
  });
  expect(migrated.payments).toEqual(legacy.payments);
  expect(migrated.salaryPayments).toEqual(legacy.salaryPayments);
  expect(removeLegacyFeeAdjustments(migrated)).toEqual(migrated);
  const custom = saveFeePlan(legacy, 'enr-001', currentFeePlan(legacy, 'enr-001')!);
  expect(feeSummary(restoreSchoolState(seed, custom), 'enr-001').total).toBe(5100000);
  expect(
    custom.obligations
      .filter((item) => item.enrollmentId === 'enr-001')
      .every((item) => item.adjustment === 0),
  ).toBe(true);
});
