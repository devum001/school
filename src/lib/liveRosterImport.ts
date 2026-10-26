import type { RosterKind } from '../services/onboardingService';
import { readStudentWorkbook, downloadStudentWorkbook } from './xlsx';
export const rosterColumns: Record<RosterKind, string[]> = {
  staff: [
    'Staff Code',
    'Staff Name',
    'Teaching',
    'Department',
    'Designation',
    'Email',
    'Phone',
    'Joined On',
    'Qualification',
  ],
  students: [
    'Admission Number',
    'Student Name',
    'Class',
    'Section',
    'Roll Number',
    'Birth Date',
    'Guardian Name',
    'Guardian Phone',
    'Address',
  ],
};
export const rosterInstructions = [
  'Keep the column headings. Delete example rows before importing real records.',
  'Up to 1,000 rows per file. Keep identifiers and phone numbers as text to preserve leading zeros.',
  'Admission Number / Staff Code is a permanent, school-local identifier. Shared guardian contacts are allowed.',
  'Dates must be DD-MM-YYYY. Optional cells may be blank. Teaching must be Yes or No.',
  'Students: Class and Section must exactly match active records in the selected academic year (case and whitespace ignored).',
  'Create mode skips identical records and rejects conflicting details. Update mode replaces profile fields, including clearing blank optional fields.',
  'Imports do not create login accounts, transfer existing enrollments or change an existing roll number.',
];
export function csvValue(value: string): string {
  const safe = /^[\s]*[-=+@]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}
export function downloadText(filename: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' })),
    anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function downloadRosterTemplate(kind: RosterKind, format: 'csv' | 'xlsx') {
  const rows = [rosterColumns[kind]];
  if (format === 'xlsx')
    downloadStudentWorkbook(
      `${kind}-template.xlsx`,
      rows,
      rosterInstructions,
      kind === 'staff' ? 'Staff' : 'Students',
    );
  else
    downloadText(
      `${kind}-template.csv`,
      rows.map((row) => row.map(csvValue).join(',')).join('\r\n'),
    );
}
export function parseRosterCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [],
    cell = '',
    quoted = false,
    closed = false;
  const source = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (quoted) {
      if (char === '"') {
        if (source[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
          closed = true;
        }
      } else cell += char;
    } else if (char === ',' || char === '\n' || char === '\r') {
      row.push(cell);
      cell = '';
      closed = false;
      if (char !== ',') {
        rows.push(row);
        row = [];
        if (char === '\r' && source[i + 1] === '\n') i++;
      }
    } else if (char === '"' && !cell && !closed) quoted = true;
    else if (closed || char === '"')
      throw new Error('Malformed CSV quoting. Save the file as UTF-8 CSV and try again.');
    else cell += char;
    if (rows.length > 1001 || row.length > 12 || cell.length > 300)
      throw new Error('Use up to 1,000 rows and 300 characters per cell.');
  }
  if (quoted) throw new Error('The CSV has an unclosed quoted cell.');
  if (row.length || cell || closed) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}
export async function readRosterFile(
  file: File,
  kind: RosterKind,
  columns = rosterColumns[kind],
): Promise<string[][]> {
  if (file.size > 1024 * 1024)
    throw new Error('Choose a file no larger than 1 MiB. Split larger rosters into smaller files.');
  const extension = file.name.split('.').pop()?.toLowerCase();
  const grid =
    extension === 'csv'
      ? parseRosterCsv(await file.text())
      : extension === 'xlsx'
        ? (await readStudentWorkbook(file)).map((row) =>
            Array.from({ length: row.length }, (_, index) => String(row[index] ?? '')),
          )
        : null;
  if (!grid) throw new Error('Choose a .csv or .xlsx file.');
  if (grid.length < 2 || grid.length > 1001)
    throw new Error('Include a header and between 1 and 1,000 data rows.');
  const normalize = (value: string) =>
    value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
  const headers = grid[0].map(normalize),
    expected = columns.map(normalize);
  if (
    headers.length !== expected.length ||
    new Set(headers).size !== expected.length ||
    expected.some((name) => !headers.includes(name))
  )
    throw new Error(
      'The columns do not match this template. Download the template and keep every heading.',
    );
  if (
    new TextEncoder().encode(JSON.stringify(grid)).length > 1024 * 1024 ||
    grid.some(
      (row) =>
        row.length > expected.length ||
        row.some((cell) => cell.length > 300 || cell.includes('\0')),
    )
  )
    throw new Error(
      'The file contains too much data or an invalid cell. Limit each cell to 300 characters.',
    );
  return grid;
}
