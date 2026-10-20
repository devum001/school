import type { ExcelCell } from './xlsx';
import type { SheetColumn, SheetRow } from './academicSheets';
import type { RosterEntry } from '../types/domain';
import { identifierKey, rollKey } from './studentIdentifiers';

export interface MarksImportScope {
  schoolId: string;
  academicYearId: string;
  examId: string;
  classId: string;
}
const referenceHeader = 'Assessment Reference (do not edit)';
const assessmentReference = (scope: MarksImportScope) =>
  [scope.schoolId, scope.academicYearId, scope.examId, scope.classId].join(':');
export function sheetTemplate(
  columns: SheetColumn[],
  students: RosterEntry[],
  scope?: MarksImportScope,
): ExcelCell[][] {
  return [
    [
      'Roll No.',
      'Student Name',
      'Class',
      'Section',
      'Admission Number',
      ...columns.map((c) => c.name),
      ...(scope ? [referenceHeader] : []),
    ],
    ['Maximum Marks', '', '', '', '', ...columns.map((c) => c.maximum), ...(scope ? [''] : [])],
    ...students.map((s) => [
      s.enrollment.rollNumber,
      s.student.name,
      s.className,
      s.sectionName,
      s.student.admissionNumber,
      ...columns.map(() => ''),
      ...(scope ? [assessmentReference(scope)] : []),
    ]),
  ];
}
export function previewSheetImport(
  columns: SheetColumn[],
  rows: SheetRow[],
  students: RosterEntry[],
  grid: ExcelCell[][],
  scope?: MarksImportScope,
) {
  const str = (value: ExcelCell | undefined) => String(value ?? '').trim();
  // Existing four-identifier files remain supported, with unambiguous class/section/roll matching.
  const offset = str(grid[0]?.[4]) === 'Admission Number' ? 5 : 4;
  const assessmentVerified = str(grid[0]?.at(-1)) === referenceHeader;
  if (assessmentVerified && !scope)
    throw new Error('Select the assessment before importing its referenced template.');
  const expected = [
    'Roll No.',
    'Student Name',
    'Class',
    'Section',
    ...(offset === 5 ? ['Admission Number'] : []),
    ...columns.map((c) => c.name),
    ...(assessmentVerified ? [referenceHeader] : []),
  ];
  if (JSON.stringify((grid[0] ?? []).map(str)) !== JSON.stringify(expected))
    throw new Error(
      'Use the current marks template. Keep its identifier and subject headers unchanged.',
    );
  if (grid.length > 1002) throw new Error('Import up to 1,000 student rows.');
  if (str(grid[1]?.[0]) !== 'Maximum Marks')
    throw new Error('Keep the Maximum Marks row immediately below the headers.');
  const nextColumns = columns.map((c, i) => ({
    ...c,
    maximum: str(grid[1]?.[i + offset]) || c.maximum,
  }));
  const issues: { row: number; message: string }[] = [];
  const changes: { enrollmentId: string; name: string; roll: string | number; cells: string[] }[] =
    [];
  const changed = new Map<string, SheetRow>(),
    used = new Set<string>();
  let overwritten = 0;
  for (let index = 2; index < grid.length; index++) {
    const values = grid[index].map(str);
    if (!values.some(Boolean)) continue;
    try {
      if (assessmentVerified && values.at(-1) !== assessmentReference(scope!))
        throw new Error(
          'This row belongs to another assessment, school, academic year or class. Download the template from the selected assessment.',
        );
      const matches = students.filter(
        (s) =>
          s.className === values[2] &&
          s.sectionName === (values[3] || '') &&
          rollKey(s.enrollment.rollNumber) === rollKey(values[0] || '') &&
          (offset === 4 ||
            identifierKey(s.student.admissionNumber) === identifierKey(values[4] || '')),
      );
      if (matches.length !== 1)
        throw new Error(
          'Unknown or ambiguous student identifiers. Keep the admission number, class, section and roll from a fresh template.',
        );
      const student = matches[0],
        id = student.enrollment.id;
      if (used.has(id)) throw new Error('Duplicate student row. Keep one row per student.');
      used.add(id);
      if (values[1]?.toLocaleLowerCase() !== student.student.name.toLocaleLowerCase())
        throw new Error('Student name does not match the identifiers. Download a fresh template.');
      if (values.slice(expected.length).some(Boolean))
        throw new Error('Extra cells do not match the subject columns.');
      const cells = columns.map((_, i) => (values[i + offset] ?? '').toUpperCase());
      if (!cells.some(Boolean)) continue;
      cells.forEach((value, i) => {
        if (!value) return;
        if (
          !/^\d+(?:\.\d+)?$/.test(nextColumns[i].maximum) ||
          Number(nextColumns[i].maximum) <= 0 ||
          Number(nextColumns[i].maximum) > 10000
        )
          throw new Error(
            `${columns[i].name}: enter valid maximum marks in the Maximum Marks row.`,
          );
        if (columns[i].maximum && Number(columns[i].maximum) !== Number(nextColumns[i].maximum))
          throw new Error(
            `${columns[i].name}: maximum marks changed. Use Edit Test to change the maximum across all sections.`,
          );
        if (
          value !== 'A' &&
          (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(value) || !Number.isFinite(Number(value)))
        )
          throw new Error(
            `${columns[i].name}: enter a number, A for absent, or blank. Formulas are not supported.`,
          );
        if (value !== 'A' && Number(value) > Number(nextColumns[i].maximum))
          throw new Error(`${columns[i].name}: marks exceed the maximum.`);
      });
      const original = rows.find((r) => r.enrollmentId === id);
      if (original?.cells.some(Boolean) && JSON.stringify(original.cells) !== JSON.stringify(cells))
        overwritten++;
      changed.set(id, { enrollmentId: id, cells });
      changes.push({
        enrollmentId: id,
        name: student.student.name,
        roll: student.enrollment.rollNumber,
        cells,
      });
    } catch (cause) {
      issues.push({
        row: index + 1,
        message: cause instanceof Error ? cause.message : 'Invalid row.',
      });
    }
  }
  if (!changes.length && !issues.length)
    throw new Error('No populated student marks found. Blank rows keep existing marks.');
  return {
    columns: nextColumns,
    assessmentVerified,
    rows: rows.map((r) => changed.get(r.enrollmentId) ?? r),
    changes,
    issues,
    overwritten,
    skipped: grid
      .slice(2)
      .filter((r) => !r.slice(offset, offset + columns.length).some((v) => str(v))).length,
  };
}
