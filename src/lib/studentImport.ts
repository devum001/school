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
  'Section',
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
const sectionKey = (name: string) =>
  name
    .trim()
    .replace(/^(?:section\s+)+/i, '')
    .toLowerCase();

/** Validate all class rows, section assignments and identifiers before committing any students. */
export function previewStudentImport(
  state: DemoState,
  scopeId: string,
  grid: ExcelCell[][],
): StudentImportPreview {
  const legacySection = state.sections.find(
    (s) => s.id === scopeId && s.schoolId === state.school.id,
  );
  const schoolClass = state.classes.find(
    (c) => c.schoolId === state.school.id && c.id === (legacySection?.classId ?? scopeId),
  );
  if (!schoolClass) throw new Error('Choose a class from this school.');
  if (grid.length > 1001) throw new Error('Import up to 1,000 students per file.');
  const sections = state.sections.filter(
    (s) => s.schoolId === state.school.id && s.classId === schoolClass.id,
  );
  const headers = (grid[0] ?? []).map((value) => String(value).trim().toLowerCase());
  for (const header of [
    'Student Name',
    'Admission Number',
    'Birth Date',
    'Guardian Name',
    'Roll Number',
    ...(!legacySection ? ['Section'] : []),
  ])
    if (!headers.includes(header.toLowerCase()))
      throw new Error(`Missing column: ${header}. Download the sample Excel file.`);
  if (new Set(headers.filter(Boolean)).size !== headers.filter(Boolean).length)
    throw new Error('Remove duplicate column headers.');
  const rows: StudentImportRow[] = [],
    errors: string[] = [];
  let validationState = state;
  grid.slice(1).forEach((cells, index) => {
    if (!cells.some((value) => String(value).trim() !== '')) return;
    const value = (header: string) => cells[headers.indexOf(header.toLowerCase())] ?? '';
    const text = (header: string) => String(value(header)).trim();
    const matches = sections.filter((s) => sectionKey(s.name) === sectionKey(text('Section')));
    const section = text('Section')
      ? matches.length === 1
        ? matches[0]
        : undefined
      : legacySection;
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
      classId: schoolClass.id,
      sectionId: section?.id ?? '',
      rollNumber: Number(roll),
    };
    let error: string | undefined;
    try {
      if (!section)
        throw new Error(
          `Section must match a configured section of ${schoolClass.name}: ${sections.map((s) => s.name).join(', ')}.`,
        );
      if (dateError || !z.iso.date().safeParse(birthDate).success)
        throw new Error(
          dateError || 'Birth Date must be a valid YYYY-MM-DD date or Excel date cell.',
        );
      if (!/^\d+$/.test(roll) || Number(roll) <= 0)
        throw new Error('Enter Roll Number as a positive whole number.');
      if (!input.admissionNumber) throw new Error('Admission Number is required.');
      validationState = saveStudent(validationState, input);
    } catch (cause) {
      error = cause instanceof Error ? cause.message : 'Check the student details.';
      errors.push(`Row ${index + 2}: ${error}`);
    }
    rows.push({ row: index + 2, input, error });
  });
  if (!rows.length)
    throw new Error('The Students sheet has no student rows. Fill the sample below its header.');
  return { rows, errors };
}
export function importStudents(state: DemoState, scopeId: string, grid: ExcelCell[][]): DemoState {
  const preview = previewStudentImport(state, scopeId, grid);
  if (preview.errors.length) throw new Error(preview.errors[0]);
  return preview.rows.reduce((next, row) => saveStudent(next, row.input), state);
}
