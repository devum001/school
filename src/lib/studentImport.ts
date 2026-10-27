import { rollValue, validRoll } from './studentIdentifiers';
import { parseCalendarDate } from './displayFormat';
import { classNameKey } from './classNames';
import { z } from 'zod';
import type { DemoState } from '../types/domain';
import { saveStudent, type StudentInput } from './management';
import { excelBirthDate, type ExcelCell } from './xlsx';

export { STUDENT_IMPORT_HEADERS } from './studentTemplate';
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
  const headerAliases: Record<string, string> = {
    'admission no': 'admission number',
    'admission no.': 'admission number',
    admission_no: 'admission number',
    admission_number: 'admission number',
    'scholar no': 'admission number',
    'std name': 'student name',
    student_name: 'student name',
    'full name': 'student name',
    'std roll': 'roll number',
    'roll no': 'roll number',
    'roll no.': 'roll number',
    roll_number: 'roll number',
    roll: 'roll number',
    dob: 'birth date',
    'date of birth': 'birth date',
    birth_date: 'birth date',
    'father name': 'guardian name',
    'parent name': 'guardian name',
    guardian_name: 'guardian name',
    guardian: 'guardian name',
    'guardian phone': 'parent mobile',
    guardian_phone: 'parent mobile',
    parent_mobile: 'parent mobile',
    'mobile number': 'parent mobile',
    mobile: 'parent mobile',
    contact: 'parent mobile',
    grade: 'class',
    standard: 'class',
  };
  const normalizeHeader = (value: ExcelCell) => {
    const clean = String(value).trim().replace(/\s+/g, ' ').toLowerCase();
    return headerAliases[clean] ?? clean;
  };
  if (!schoolClass && !(grid[0] ?? []).some((h) => normalizeHeader(h) === 'class'))
    throw new Error('Choose a class from this school or include the Class column.');
  if (grid.length > 1001) throw new Error('Import up to 1,000 students per file.');

  const headers = (grid[0] ?? []).map(normalizeHeader);
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
    const classMatches = text('Class')
      ? state.classes.filter(
          (c) =>
            c.schoolId === state.school.id && classNameKey(c.name) === classNameKey(text('Class')),
        )
      : [];
    const targetClass = headers.includes('class')
      ? classMatches.length === 1
        ? classMatches[0]
        : undefined
      : schoolClass;
    const sections = state.sections.filter(
      (s) => s.schoolId === state.school.id && s.classId === targetClass?.id,
    );
    const matches = sections.filter((s) => sectionKey(s.name) === sectionKey(text('Section')));
    const section = text('Section')
      ? matches.length === 1
        ? matches[0]
        : undefined
      : !headers.includes('class')
        ? legacySection
        : undefined;
    const roll = text('Roll Number');
    let birthDate = text('Birth Date'),
      dateError = '';
    try {
      if (typeof value('Birth Date') === 'number')
        birthDate = excelBirthDate(Number(value('Birth Date')));
    } catch {
      dateError = 'Use a real birth date in DD-MM-YYYY format.';
    }
    birthDate = parseCalendarDate(birthDate) ?? birthDate;
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
      classId: targetClass?.id ?? '',
      sectionId: section?.id ?? '',
      rollNumber: rollValue(roll),
    };
    let error: string | undefined;
    try {
      if (!targetClass)
        throw new Error(
          'Class must match exactly one configured class. Fill the Class column; unknown or ambiguous classes are not created automatically.',
        );
      if (!section && (text('Section') || sections.length))
        throw new Error(
          `Section must match a configured section of ${targetClass.name}: ${sections.map((s) => s.name).join(', ')}.`,
        );
      if (dateError || !z.iso.date().safeParse(birthDate).success)
        throw new Error(
          dateError || 'Birth Date must be a valid DD-MM-YYYY date or Excel date cell.',
        );
      if (!validRoll(roll))
        throw new Error(
          'Enter a valid Roll Number using letters, numbers, hyphens, slashes or underscores.',
        );
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
