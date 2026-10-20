import { compareRolls, rollKey, validRoll } from './studentIdentifiers';
import type { Examination, ExamResult, RosterEntry } from '../types/domain';
import type { MarksEntry } from './academics';
import type { ExcelCell } from './xlsx';

const text = (value: ExcelCell | undefined) => String(value ?? '').trim();
const normalized = (value: string) => value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-IN');
const sectionKey = (value: string) => normalized(value).replace(/^section\s+/, '');
const MAX_ROWS = 1000;

export interface MarksImportRow {
  row: number;
  section: string;
  roll: string;
  studentName: string;
  enrollmentId?: string;
  before: string;
  after: string;
  status: 'new' | 'update' | 'unchanged' | 'skip' | 'error';
  errors: string[];
  entry?: MarksEntry;
}
export interface MarksImportPreview {
  rows: MarksImportRow[];
  errors: string[];
  newCount: number;
  updateCount: number;
  unchangedCount: number;
  skippedCount: number;
}

export function marksImportHeaders(exam: Examination): string[] {
  return [
    'Section',
    'Roll No.',
    'Student Name',
    ...exam.subjects.map((subject) => subject.name),
    'Absent',
  ];
}

/** The template contains the current roster; existing marks are deliberately left blank. */
export function marksImportTemplate(exam: Examination, students: RosterEntry[]): ExcelCell[][] {
  const headers = marksImportHeaders(exam);
  if (new Set(headers.map(normalized)).size !== headers.length)
    throw new Error(
      'A subject name conflicts with a template column. Rename that subject before importing marks.',
    );
  return [
    headers,
    ...[...students]
      .sort(
        (a, b) =>
          a.sectionName.localeCompare(b.sectionName, 'en-IN', { numeric: true }) ||
          compareRolls(a.enrollment.rollNumber, b.enrollment.rollNumber),
      )
      .map((student) => [
        student.sectionName,
        student.enrollment.rollNumber,
        student.student.name,
        ...exam.subjects.map(() => ''),
        'No',
      ]),
  ];
}

/** Read quoted commas, escaped quotes, newlines and a UTF-8 BOM without evaluating cells. */
export function parseMarksCsv(content: string): ExcelCell[][] {
  const source = content.replace(/^\uFEFF/, '');
  const rows: ExcelCell[][] = [];
  let row: string[] = [],
    cell = '',
    quoted = false,
    closed = false;
  const finishCell = () => {
    row.push(cell);
    cell = '';
    closed = false;
  };
  const finishRow = () => {
    finishCell();
    rows.push(row);
    row = [];
    if (rows.length > MAX_ROWS + 1) throw new Error('Import up to 1,000 student rows per file.');
  };
  for (let index = 0; index < source.length; index++) {
    const char = source[index];
    if (quoted) {
      if (char === '"') {
        if (source[index + 1] === '"') {
          cell += '"';
          index++;
        } else {
          quoted = false;
          closed = true;
        }
      } else cell += char;
    } else if (char === ',') finishCell();
    else if (char === '\r' || char === '\n') {
      finishRow();
      if (char === '\r' && source[index + 1] === '\n') index++;
    } else if (char === '"') {
      if (cell || closed)
        throw new Error(
          `CSV row ${rows.length + 1}: a quote is misplaced. Save the file again as CSV.`,
        );
      quoted = true;
    } else if (closed) {
      if (!/\s/.test(char))
        throw new Error(`CSV row ${rows.length + 1}: unexpected text after a quoted cell.`);
    } else cell += char;
  }
  if (quoted) throw new Error('The CSV has an unclosed quoted cell. Save the file again as CSV.');
  if (cell || row.length || closed) finishRow();
  return rows;
}

const resultText = (result: ExamResult | undefined) =>
  !result
    ? 'Pending'
    : result.absent
      ? 'Absent'
      : result.subjects
          .map((subject) => `${subject.name}: ${subject.marks}/${subject.maxMarks}`)
          .join(' · ');

export function previewMarksImport(
  exam: Examination,
  students: RosterEntry[],
  results: ExamResult[],
  grid: ExcelCell[][],
): MarksImportPreview {
  const preview: MarksImportPreview = {
    rows: [],
    errors: [],
    newCount: 0,
    updateCount: 0,
    unchangedCount: 0,
    skippedCount: 0,
  };
  const expected = marksImportHeaders(exam);
  const headers = (grid[0] ?? []).map((cell) => text(cell));
  const headerKeys = headers.map(normalized);
  if (grid.length < 1 || !headers.some(Boolean))
    preview.errors.push('The file is empty. Use the marks template with its header row.');
  if (new Set(expected.map(normalized)).size !== expected.length)
    preview.errors.push(
      'A subject name conflicts with a template column. Rename that subject before importing marks.',
    );
  if (new Set(headerKeys).size !== headerKeys.length)
    preview.errors.push('The file contains duplicate column headers.');
  for (const header of expected)
    if (!headerKeys.includes(normalized(header)))
      preview.errors.push(`Missing column: ${header}. Download the template for this test.`);
  for (const header of headers)
    if (!expected.some((item) => normalized(item) === normalized(header)))
      preview.errors.push(
        `Unexpected column: ${header || '(blank)'}. Use only the template columns.`,
      );
  // Subject spelling must remain the same, even though basic column capitalization may differ.
  for (const subject of exam.subjects)
    if (
      headers.some((header) => normalized(header) === normalized(subject.name)) &&
      !headers.includes(subject.name)
    )
      preview.errors.push(`Keep the subject header exactly as "${subject.name}".`);
  if (grid.length - 1 > MAX_ROWS) preview.errors.push('Import up to 1,000 student rows per file.');
  if (preview.errors.length) return preview;
  const column = (name: string) => headerKeys.indexOf(normalized(name));
  const byRoll = new Map<string, RosterEntry[]>();
  for (const student of students) {
    if (
      student.student.status !== 'active' ||
      student.enrollment.schoolId !== exam.schoolId ||
      student.enrollment.academicYearId !== exam.academicYearId ||
      (exam.classId && student.enrollment.classId !== exam.classId) ||
      (exam.sectionId && student.enrollment.sectionId !== exam.sectionId)
    )
      continue;
    const key = `${sectionKey(student.sectionName)}|${rollKey(student.enrollment.rollNumber)}`;
    byRoll.set(key, [...(byRoll.get(key) ?? []), student]);
  }
  const existingResults = new Map(
    results
      .filter((result) => result.examId === exam.id && result.schoolId === exam.schoolId)
      .map((result) => [result.enrollmentId, result]),
  );
  const repeated = new Map<string, MarksImportRow[]>();
  for (let index = 1; index < grid.length; index++) {
    const cells = grid[index] ?? [];
    if (!cells.some((cell) => text(cell) !== '')) continue;
    const section = text(cells[column('Section')]);
    const roll = text(cells[column('Roll No.')]);
    const studentName = text(cells[column('Student Name')]);
    const errors: string[] = [];
    const row: MarksImportRow = {
      row: index + 1,
      section,
      roll,
      studentName,
      before: '—',
      after: '—',
      status: 'error',
      errors,
    };
    preview.rows.push(row);
    if (
      cells.length > headers.length &&
      cells.slice(headers.length).some((cell) => text(cell) !== '')
    )
      errors.push('Extra values do not match the template columns.');
    if (!section) errors.push('Section is required.');
    if (!validRoll(roll)) errors.push('Enter a valid roll number, such as 12 or SH-12.');
    if (!studentName) errors.push('Student Name is required.');
    const key = `${sectionKey(section)}|${rollKey(roll)}`;
    if (section && validRoll(roll)) repeated.set(key, [...(repeated.get(key) ?? []), row]);
    const matches = byRoll.get(key) ?? [];
    if (section && validRoll(roll)) {
      if (!matches.length)
        errors.push('No student matches this section and roll number in the selected class/test.');
      else if (matches.length > 1)
        errors.push(
          'This section and roll number match more than one student. Correct the class roster first.',
        );
    }
    const student = matches.length === 1 ? matches[0] : undefined;
    if (student) {
      row.enrollmentId = student.enrollment.id;
      row.before = resultText(existingResults.get(student.enrollment.id));
      if (normalized(studentName) !== normalized(student.student.name))
        errors.push(
          `Name does not match Roll ${roll}. Expected ${student.student.name}. Download a fresh roster template if roll numbers changed.`,
        );
    }
    const absence = normalized(text(cells[column('Absent')]));
    if (!['', 'yes', 'no'].includes(absence)) errors.push('Absent must be Yes or No.');
    const absent = absence === 'yes';
    const marksText = exam.subjects.map((subject) => text(cells[column(subject.name)]));
    const emptyMarks = marksText.every((mark) => mark === '');
    const marks = marksText.map(Number);
    if (
      absent &&
      !emptyMarks &&
      marksText.some(
        (mark) => mark !== '' && (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(mark) || Number(mark) !== 0),
      )
    )
      errors.push('An absent student cannot also have earned marks. Leave marks blank or zero.');
    if (!absent && !emptyMarks)
      for (const [subjectIndex, subject] of exam.subjects.entries()) {
        const value = marksText[subjectIndex];
        if (!value)
          errors.push(
            `Complete ${subject.name}, or leave all subject marks blank to skip this student.`,
          );
        else if (
          !/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(value) ||
          !Number.isFinite(marks[subjectIndex]) ||
          marks[subjectIndex] < 0 ||
          marks[subjectIndex] > subject.maxMarks
        )
          errors.push(
            `${subject.name} marks must be a plain number from 0 to ${subject.maxMarks}. Formulas are not supported.`,
          );
      }
    if (!errors.length && student) {
      if (emptyMarks && !absent) {
        row.status = 'skip';
        row.after = `${row.before} (kept)`;
      } else {
        const existing = existingResults.get(student.enrollment.id);
        const noChange =
          existing &&
          Boolean(existing.absent) === absent &&
          (absent ||
            existing.subjects.every(
              (subject, subjectIndex) =>
                subject.marks === marks[subjectIndex] &&
                subject.name === exam.subjects[subjectIndex]?.name &&
                subject.maxMarks === exam.subjects[subjectIndex]?.maxMarks,
            )) &&
          existing.subjects.length === exam.subjects.length;
        row.entry = { enrollmentId: student.enrollment.id, marks: absent ? null : marks, absent };
        row.status = noChange ? 'unchanged' : existing ? 'update' : 'new';
        row.after = absent
          ? 'Absent'
          : exam.subjects
              .map(
                (subject, subjectIndex) =>
                  `${subject.name}: ${marks[subjectIndex]}/${subject.maxMarks}`,
              )
              .join(' · ');
      }
    }
  }
  for (const rows of repeated.values())
    if (rows.length > 1)
      for (const row of rows)
        row.errors.push(
          `Duplicate section and roll number in rows ${rows.map((entry) => entry.row).join(', ')}.`,
        );
  for (const row of preview.rows) {
    if (row.errors.length) row.status = 'error';
    preview.errors.push(...row.errors.map((error) => `Row ${row.row}: ${error}`));
    if (row.status === 'new') preview.newCount++;
    if (row.status === 'update') preview.updateCount++;
    if (row.status === 'unchanged') preview.unchangedCount++;
    if (row.status === 'skip') preview.skippedCount++;
  }
  if (!preview.rows.length)
    preview.errors.push('The file has no student rows. Download the roster template first.');
  return preview;
}

/** Call only after a fresh preview; invalid files never produce save entries. */
export function marksImportEntries(preview: MarksImportPreview): MarksEntry[] {
  if (preview.errors.length)
    throw new Error('Correct every import error before saving. No marks have been changed.');
  const entries = preview.rows.flatMap((row) =>
    row.entry && ['new', 'update'].includes(row.status) ? [row.entry] : [],
  );
  if (!entries.length)
    throw new Error(
      'There are no changed marks to import. Blank rows keep existing marks unchanged.',
    );
  return entries;
}
