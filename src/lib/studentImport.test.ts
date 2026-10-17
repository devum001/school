import { describe, expect, it } from 'vitest';
import { createSeed } from '../mocks/seed';
import { STUDENT_IMPORT_HEADERS, previewStudentImport, importStudents } from './studentImport';
import { saveSchoolClass, saveSchoolSection } from './classStructure';
import { excelBirthDate, studentWorkbook } from './xlsx';
import { orderedClasses, sectionLabel } from './schoolLabels';
import type { ExcelCell } from './xlsx';
function emptySection() {
  let state = saveSchoolClass(createSeed(), { name: 'New class' });
  state = saveSchoolSection(state, { classId: state.classes.at(-1)!.id, name: 'A', teacherId: '' });
  return state;
}
const grid: ExcelCell[][] = [
  STUDENT_IMPORT_HEADERS,
  ['Asha Singh', 'NEW-001', '2016-05-21', 'Ravi Singh', 'Parent', '', '', '01'],
  ['Zoya Khan', 'NEW-002', '2016-07-12', 'Sana Khan', '', '', '', ''],
];
describe('Excel student import', () => {
  it('imports a validated batch atomically with normalized, consecutive roll numbers', () => {
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
        ['Next Student', 'NEW-003', '2016-05-21', 'Parent Name', '', '', '', ''],
      ]).rows[0].input.rollNumber,
    ).toBe(2);
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
