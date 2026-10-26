import { expect, it } from 'vitest';
import { createSeed } from '../mocks/seed';
import { applyClassSetup } from './classSetup';
import { importStudents, previewStudentImport } from './studentImport';
import { STUDENT_IMPORT_HEADERS } from './studentTemplate';
import { ordinalClass } from './classNames';
import { roster } from './selectors';
const student = (name: string, schoolClass: string, section = '') => [
  name,
  name,
  '2015-01-01',
  'Parent',
  'Parent',
  '',
  '',
  name === 'C' ? 51 : 1,
  section,
  schoolClass,
];
it('imports across classes with optional sections and allows the same roll in different classes', () => {
  const state = applyClassSetup(createSeed(), [
    { name: 'Class 12', sections: [] },
    { name: 'Class 11', sections: [] },
  ]);
  const next = importStudents(state, '', [
    STUDENT_IMPORT_HEADERS,
    student('A', '12th'),
    student('B', 'class 11'),
    student('C', 'Grade 10', 'A'),
  ]);
  expect(next.enrollments.slice(-3).map((e) => e.sectionId)).toEqual(['', '', 'class-10-a']);
  const ids = next.classes.slice(-2).map((c) => c.id);
  expect(roster(next, true).filter((r) => ids.includes(r.enrollment.classId))).toHaveLength(2);
  expect(ordinalClass('Class 12')).toEqual({ level: 12, suffix: 'th' });
  expect(ordinalClass('Class 11')).toEqual({ level: 11, suffix: 'th' });
  expect(ordinalClass('Class 2')).toEqual({ level: 2, suffix: 'nd' });
  expect(ordinalClass('Nursery')).toBeNull();
});
it('rejects missing, unknown or ambiguous classes and sections without partial writes', () => {
  const state = applyClassSetup(createSeed(), [{ name: 'Class 12', sections: [] }]);
  for (const row of [
    student('B', ''),
    student('B', 'Class 99'),
    student('B', 'Class 10'),
    student('B', 'Class 12', 'A'),
  ]) {
    const grid = [STUDENT_IMPORT_HEADERS, student('A', '12th'), row];
    expect(previewStudentImport(state, '', grid).errors).toHaveLength(1);
    expect(() => importStudents(state, '', grid)).toThrow();
  }
  const ambiguous = applyClassSetup(state, [{ name: '12th', sections: [] }]);
  expect(
    previewStudentImport(ambiguous, '', [STUDENT_IMPORT_HEADERS, student('A', 'Class 12')])
      .errors[0],
  ).toMatch(/exactly one/);
  expect(state.students.some((s) => s.name === 'A')).toBe(false);
});
it('enforces roll uniqueness within a sectionless class', () => {
  const state = applyClassSetup(createSeed(), [{ name: 'Class 12', sections: [] }]);
  expect(() =>
    importStudents(state, '', [
      STUDENT_IMPORT_HEADERS,
      student('A', 'Class 12'),
      student('B', '12th'),
    ]),
  ).toThrow(/roll number/);
});
