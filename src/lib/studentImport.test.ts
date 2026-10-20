import { describe, expect, it } from 'vitest';
import { createSeed } from '../mocks/seed';
import {
  STUDENT_IMPORT_HEADERS as CURRENT_HEADERS,
  previewStudentImport,
  importStudents,
} from './studentImport';
import { saveSchoolClass, saveSchoolSection } from './classStructure';
import { excelBirthDate, studentWorkbook } from './xlsx';
import { orderedClasses, sectionLabel } from './schoolLabels';
import type { ExcelCell } from './xlsx';
const STUDENT_IMPORT_HEADERS = CURRENT_HEADERS.slice(0, -1); // Legacy class-scoped workbook compatibility.
function emptySection() {
  let state = saveSchoolClass(createSeed(), { name: 'New class' });
  state = saveSchoolSection(state, { classId: state.classes.at(-1)!.id, name: 'A', teacherId: '' });
  return state;
}
const grid: ExcelCell[][] = [
  STUDENT_IMPORT_HEADERS,
  ['Asha Singh', 'NEW-001', '2016-05-21', 'Ravi Singh', 'Parent', '', '', '01'],
  ['Zoya Khan', 'NEW-002', '2016-07-12', 'Sana Khan', '', '', '', '02'],
];
describe('Excel student import', () => {
  it('imports a validated batch atomically with the manual roll numbers provided', () => {
    const state = emptySection(),
      sectionId = state.sections.at(-1)!.id;
    const preview = previewStudentImport(state, sectionId, grid);
    expect(preview.errors).toEqual([]);
    expect(preview.rows.map((r) => r.input.rollNumber)).toEqual([1, 2]);
    const next = importStudents(state, sectionId, grid);
    expect(next.students).toHaveLength(state.students.length + 2);
    expect(next.enrollments.slice(-2).map((e) => e.rollNumber)).toEqual([1, 2]);
    expect(state.students.some((s) => s.admissionNumber === 'NEW-001')).toBe(false);
    expect(
      previewStudentImport(next, sectionId, [
        STUDENT_IMPORT_HEADERS,
        ['Next Student', 'NEW-003', '2016-05-21', 'Parent Name', '', '', '', '17'],
      ]).rows[0].input.rollNumber,
    ).toBe(17);
  });
  it('reports duplicates, invalid dates, phones and rolls without saving valid preceding rows', () => {
    const state = emptySection(),
      id = state.sections.at(-1)!.id;
    for (const cells of [
      ['Duplicate', 'NEW-001', '2016-05-21', 'Parent Name', '', '', '', ''],
      ['Invalid date', 'NEW-009', '2016-02-31', 'Parent Name', '', '', '', ''],
      ['Invalid phone', 'NEW-009', '2016-05-21', 'Parent Name', '', '123', '', ''],
      ['Invalid roll', 'NEW-009', '2016-05-21', 'Parent Name', '', '', '', '1a'],
    ]) {
      const invalid = [STUDENT_IMPORT_HEADERS, grid[1], cells];
      expect(previewStudentImport(state, id, invalid).errors[0]).toMatch(/^Row 3:/);
      expect(() => importStudents(state, id, invalid)).toThrow();
    }
    expect(() => previewStudentImport(state, id, [['Name'], ['Student']])).toThrow(
      /Missing column/,
    );
    expect(() => previewStudentImport(state, id, [STUDENT_IMPORT_HEADERS])).toThrow(
      /no student rows/,
    );
    expect(() => previewStudentImport(state, 'foreign', grid)).toThrow(/this school/);
  });
  it('accepts day-first dates and repeated person/guardian names while preserving identifiers', () => {
    const state = emptySection(),
      sectionId = state.sections.at(-1)!.id;
    const batch = [
      STUDENT_IMPORT_HEADERS,
      ['rahul kumar', '0001-a', '21-05-2016', 'Raj Kumar', 'Father', '', '', '11'],
      ['rahul kumar', '0002-a', '12-07-2016', 'Raj Kumar', 'Father', '', '', '12'],
    ];
    const next = importStudents(state, sectionId, batch);
    expect(next.students.slice(-2).map((s) => s.birthDate)).toEqual(['2016-05-21', '2016-07-12']);
    expect(next.students.slice(-2).map((s) => s.admissionNumber)).toEqual(['0001-a', '0002-a']);
  });
  it('allows the same roll in different sections but rejects repeats within a section', () => {
    const state = createSeed();
    const batch = [
      STUDENT_IMPORT_HEADERS,
      ['Class A Student', 'CLASS-A-01', '2016-05-21', 'Parent', '', '', '', 51, 'A'],
      ['Class B Student', 'CLASS-B-02', '2016-05-21', 'Parent', '', '', '', 51, 'Section B'],
    ];
    const next = importStudents(state, 'class-5', batch);
    expect(next.enrollments.slice(-2).map((entry) => [entry.sectionId, entry.rollNumber])).toEqual([
      ['class-5-a', 51],
      ['class-5-b', 51],
    ]);
    expect(next.enrollments.slice(0, -2)).toEqual(state.enrollments);
    for (const [column, value] of [
      [8, 'Z'],
      [7, ''],
      [1, ''],
      [7, '1.5'],
    ] as const) {
      const invalid = batch.map((row) => [...row]);
      invalid[2][column] = value;
      expect(previewStudentImport(state, 'class-5', invalid).errors.length).toBeGreaterThan(0);
      expect(() => importStudents(state, 'class-5', invalid)).toThrow();
      expect(state.students.some((student) => student.admissionNumber === 'CLASS-A-01')).toBe(
        false,
      );
    }
    const duplicateRoll = batch.map((row) => [...row]);
    duplicateRoll[2][8] = 'Section A';
    expect(previewStudentImport(state, 'class-5', duplicateRoll).errors[0]).toMatch(/roll number/);
  });
  it('handles true Excel birth dates, creates a genuine XLSX, and orders numbers naturally', async () => {
    expect(excelBirthDate(42511)).toBe('2016-05-21');
    expect(excelBirthDate(41049, true)).toBe('2016-05-21');
    expect(() => excelBirthDate(60)).toThrow();
    const bytes = new Uint8Array(await studentWorkbook([STUDENT_IMPORT_HEADERS]).arrayBuffer());
    expect(Array.from(bytes.slice(0, 4))).toEqual([80, 75, 3, 4]);
    const classes = [11, 2, 1, 3].map((n) => ({
      id: String(n),
      schoolId: 'school',
      name: `Class ${n}`,
    }));
    expect(orderedClasses(classes).map((c) => c.name)).toEqual([
      'Class 1',
      'Class 2',
      'Class 3',
      'Class 11',
    ]);
    expect(sectionLabel('Section Section A')).toBe('Section A');
  });
});
