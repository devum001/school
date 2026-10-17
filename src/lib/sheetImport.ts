import type { ExcelCell } from './xlsx';
import type { SheetColumn, SheetRow } from './academicSheets';
import type { RosterEntry } from '../types/domain';

export function sheetTemplate(columns: SheetColumn[], students: RosterEntry[]): ExcelCell[][] {
  return [
    ['Roll No.', 'Student Name', 'Class', 'Section', ...columns.map((c) => c.name)],
    ['Maximum Marks', '', '', '', ...columns.map((c) => c.maximum)],
    ...students.map((s) => [
      s.enrollment.rollNumber,
      s.student.name,
      s.className,
      s.sectionName,
      ...columns.map(() => ''),
    ]),
  ];
}
export function previewSheetImport(
  columns: SheetColumn[],
  rows: SheetRow[],
  students: RosterEntry[],
  grid: ExcelCell[][],
) {
  const str = (value: ExcelCell | undefined) => String(value ?? '').trim();
  const expected = ['Roll No.', 'Student Name', 'Class', 'Section', ...columns.map((c) => c.name)];
  if (JSON.stringify((grid[0] ?? []).map(str)) !== JSON.stringify(expected))
    throw new Error(
      'Use this section’s current template. Download a fresh template and keep its class, section, roll number, student name and subject headers unchanged.',
    );
  if (grid.length > 1002) throw new Error('Import up to 1,000 student rows.');
  if (str(grid[1]?.[0]) !== 'Maximum Marks')
    throw new Error('Keep the Maximum Marks row immediately below the headers.');
  const nextColumns = columns.map((c, i) => ({
    ...c,
    maximum: str(grid[1]?.[i + 4]) || c.maximum,
  }));
  const changes: { name: string; roll: number; cells: string[] }[] = [];
  const changed = new Map<string, SheetRow>(),
    used = new Set<number>();
  for (let index = 2; index < grid.length; index++) {
    const values = grid[index].map(str);
    if (!values.some(Boolean)) continue;
    const roll = Number(values[0]);
    const student = students.find((s) => s.enrollment.rollNumber === roll);
    if (!Number.isInteger(roll) || !student || used.has(roll))
      throw new Error(
        `Row ${index + 1}: unknown or duplicate roll number. Download a fresh section template.`,
      );
    used.add(roll);
    if (values[2] !== student.className || values[3] !== student.sectionName)
      throw new Error(
        `Row ${index + 1}: this file belongs to a different class or section. Choose the matching class and section, or download a fresh template.`,
      );
    if (values[1]?.toLocaleLowerCase() !== student.student.name.toLocaleLowerCase())
      throw new Error(`Row ${index + 1}: name does not match Roll ${roll}.`);
    if (values.slice(expected.length).some(Boolean))
      throw new Error(`Row ${index + 1}: extra cells do not match the subject columns.`);
    const cells = columns.map((_, i) => (values[i + 4] ?? '').toUpperCase());
    if (!cells.some(Boolean)) continue;
    cells.forEach((value, i) => {
      if (
        value &&
        value !== 'A' &&
        (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(value) || !Number.isFinite(Number(value)))
      )
        throw new Error(
          `Roll ${roll} · ${columns[i].name}: enter a number, A, or blank. Formulas are not supported.`,
        );
      if (
        value &&
        (!Number.isFinite(Number(nextColumns[i].maximum)) ||
          Number(nextColumns[i].maximum) <= 0 ||
          Number(nextColumns[i].maximum) > 10000)
      )
        throw new Error(
          `Enter valid maximum marks for ${columns[i].name} in the Maximum Marks row.`,
        );
      if (value && value !== 'A' && Number(value) > Number(nextColumns[i].maximum))
        throw new Error(`Roll ${roll} · ${columns[i].name}: marks exceed the maximum.`);
    });
    changed.set(student.enrollment.id, { enrollmentId: student.enrollment.id, cells });
    changes.push({ name: student.student.name, roll, cells });
  }
  if (!changes.length)
    throw new Error('No populated student marks found. Blank rows keep existing marks.');
  return { columns: nextColumns, rows: rows.map((r) => changed.get(r.enrollmentId) ?? r), changes };
}
