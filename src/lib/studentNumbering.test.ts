import { describe, expect, it } from 'vitest';
import { createSeed } from '../mocks/seed';
import { restoreSchoolState } from '../mocks/restore';
import { saveStudent, deleteStudent, type StudentInput } from './management';
import { feeSummary, roster } from './selectors';
import { removeLegacyFeeAdjustments, saveFeePlan, currentFeePlan } from './feePlans';

const input: StudentInput = {
  name: 'Aaa New Student',
  admissionNumber: 'MANUAL-001',
  rollNumber: 99,
  status: 'active',
  birthDate: '2015-01-01',
  address: 'New address',
  guardian: { name: 'Guardian', relation: 'Parent', contact: null },
  classId: 'class-5',
  sectionId: 'class-5-a',
};
describe('manual student identifiers', () => {
  it('requires a manual admission and positive whole roll, including duplicate protection', () => {
    const state = createSeed();
    expect(() => saveStudent(state, { ...input, admissionNumber: '' })).toThrow(/admission number/);
    for (const rollNumber of [0, -1, 1.5, NaN, Number.MAX_SAFE_INTEGER + 1])
      expect(() => saveStudent(state, { ...input, rollNumber })).toThrow(/roll number/);
    const next = saveStudent(state, input);
    expect(next.students.at(-1)?.admissionNumber).toBe('MANUAL-001');
    expect(next.enrollments.at(-1)?.rollNumber).toBe(99);
    expect(() =>
      saveStudent(next, { ...input, admissionNumber: 'manual-001', rollNumber: 100 }),
    ).toThrow(/admission number/);
    expect(() => saveStudent(next, { ...input, admissionNumber: 'OTHER' })).toThrow(/roll number/);
    expect(() =>
      saveStudent(next, { ...input, admissionNumber: 'OTHER', sectionId: 'class-5-b' }),
    ).not.toThrow();
    expect(() =>
      saveStudent(next, {
        ...input,
        admissionNumber: 'OTHER',
        classId: 'class-6',
        sectionId: 'class-6-a',
      }),
    ).not.toThrow();
    expect(() =>
      saveStudent(next, { ...input, admissionNumber: 'OTHER', rollNumber: 100 }),
    ).not.toThrow();
  });
  it('keeps other rolls and all linked records unchanged on rename, edit, deactivate, delete and restore', () => {
    const original = createSeed();
    let state = saveStudent(original, input);
    const student = state.students.at(-1)!;
    const enrollment = state.enrollments.at(-1)!;
    state = saveStudent(
      state,
      { ...input, name: 'Zzz Renamed', admissionNumber: 'OFFICE-009', rollNumber: 51 },
      student.id,
    );
    expect(state.students.at(-1)?.admissionNumber).toBe('OFFICE-009');
    expect(state.enrollments.at(-1)).toMatchObject({ id: enrollment.id, rollNumber: 51 });
    state = saveStudent(state, { ...input, status: 'inactive' }, student.id);
    expect(state.enrollments.slice(0, -1)).toEqual(original.enrollments);
    expect(restoreSchoolState(createSeed(), state).enrollments).toEqual(state.enrollments);
    state = deleteStudent(state, student.id);
    expect(state.enrollments).toEqual(original.enrollments);
    expect(state.attendance).toEqual(original.attendance);
    expect(state.payments).toEqual(original.payments);
  });
  it('retains nonalphabetic legacy rolls when restoring saved data', () => {
    const seed = createSeed();
    const saved = {
      ...seed,
      enrollments: seed.enrollments.map((entry, i) => ({ ...entry, rollNumber: i + 100 })),
    };
    expect(restoreSchoolState(seed, saved).enrollments).toEqual(saved.enrollments);
    expect(roster(saved)[0].enrollment.rollNumber).toBeGreaterThanOrEqual(100);
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
