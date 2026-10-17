import { z } from 'zod';
import type { DemoState } from '../types/domain';
import { saveStudent, type StudentInput } from './management';
import { excelBirthDate, type ExcelCell } from './xlsx';

export const STUDENT_IMPORT_HEADERS = [
  'Student Name',
  'Admission Number',
  'Birth Date',
  'Guardian Name',
  'Relationship',
  'Parent Mobile',
  'Address',
  'Roll Number',
];
export interface StudentImportRow {
  row: number;
  input: StudentInput;
  error?: string;
}
export interface StudentImportPreview {
  rows: StudentImportRow[];
  errors: string[];
}
export function previewStudentImport(
  state: DemoState,
  sectionId: string,
  grid: ExcelCell[][],
): StudentImportPreview {
  const section = state.sections.find((s) => s.id === sectionId && s.schoolId === state.school.id);
  if (!section) throw new Error('Choose a section from this school.');
  if (grid.length > 1001) throw new Error('Import up to 1,000 students per file.');
  const headers = (grid[0] ?? []).map((value) => String(value).trim().toLowerCase());
  const required = ['Student Name', 'Birth Date', 'Guardian Name'];
  for (const header of required)
    if (!headers.includes(header.toLowerCase()))
      throw new Error(`Missing column: ${header}. Download the sample Excel file.`);
  if (new Set(headers.filter(Boolean)).size !== headers.filter(Boolean).length)
    throw new Error('Remove duplicate column headers.');
  const rows: StudentImportRow[] = [],
    errors: string[] = [];
  let validationState = state;
  let nextRoll =
    Math.max(
      0,
      ...state.enrollments
        .filter(
          (e) =>
            e.schoolId === state.school.id &&
            e.academicYearId === state.academicYear.id &&
            e.sectionId === sectionId,
        )
        .map((e) => e.rollNumber),
    ) + 1;
  grid.slice(1).forEach((cells, index) => {
    if (!cells.some((value) => String(value).trim() !== '')) return;
    const value = (header: string) => cells[headers.indexOf(header.toLowerCase())] ?? '';
    const text = (header: string) => String(value(header)).trim();
    const roll = text('Roll Number');
    let birthDate = text('Birth Date'),
      dateError = '';
    try {
      if (typeof value('Birth Date') === 'number')
        birthDate = excelBirthDate(Number(value('Birth Date')));
    } catch {
      dateError = 'Use a real birth date in YYYY-MM-DD format.';
    }
    const input: StudentInput = {
      name: text('Student Name'),
      admissionNumber: text('Admission Number'),
      birthDate,
      guardian: {
        name: text('Guardian Name'),
        relation: text('Relationship') || 'Parent',
        contact: text('Parent Mobile') || null,
      },
      address: text('Address'),
      status: 'active',
      classId: section.classId,
      sectionId,
      rollNumber: roll === '' ? nextRoll : Number(roll),
    };
    let error: string | undefined;
    try {
      if (dateError || !z.iso.date().safeParse(birthDate).success)
        throw new Error(
          dateError || 'Birth Date must be a valid YYYY-MM-DD date or Excel date cell.',
        );
      if (roll && !/^\d+$/.test(roll))
        throw new Error('Roll Number must be a whole number: 1, 2, 3…');
      validationState = saveStudent(validationState, input);
      input.admissionNumber = validationState.students.at(-1)!.admissionNumber;
      nextRoll = Math.max(nextRoll, input.rollNumber + 1);
    } catch (cause) {
      error = cause instanceof Error ? cause.message : 'Check the student details.';
      errors.push(`Row ${index + 2}: ${error}`);
    }
    rows.push({ row: index + 2, input, error });
  });
  if (!rows.length)
    throw new Error('The Students sheet has no student rows. Fill the sample below its header.');
  for (const row of rows) {
    if (row.error) continue;
    const student = validationState.students.find(
      (entry) =>
        entry.schoolId === state.school.id && entry.admissionNumber === row.input.admissionNumber,
    );
    row.input.rollNumber =
      validationState.enrollments.find(
        (entry) =>
          entry.studentId === student?.id &&
          entry.sectionId === sectionId &&
          entry.academicYearId === state.academicYear.id,
      )?.rollNumber ?? row.input.rollNumber;
  }
  return { rows, errors };
}
export function importStudents(
  state: DemoState,
  sectionId: string,
  grid: ExcelCell[][],
): DemoState {
  const preview = previewStudentImport(state, sectionId, grid);
  if (preview.errors.length) throw new Error(preview.errors[0]);
  return preview.rows.reduce((next, row) => saveStudent(next, row.input), state);
}
