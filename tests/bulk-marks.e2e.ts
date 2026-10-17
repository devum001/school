import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { academicFixture, loadAcademicFixture, openSheet, savedAcademics } from './academicFixture';
import { sheetDraft } from '../src/lib/academicSheets';
import { sheetTemplate } from '../src/lib/sheetImport';
import { parseMarksCsv } from '../src/lib/marksImport';
import { studentWorkbook, type ExcelCell } from '../src/lib/xlsx';
const csv = (grid: ExcelCell[][]) =>
  grid
    .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(','))
    .join('\r\n');

test('section roster templates and preview import use roll numbers and save no file', async ({
  page,
}) => {
  const state = academicFixture(true);
  await loadAcademicFixture(page, state);
  await openSheet(page);
  const dialog = page.getByRole('dialog');
  const download = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'CSV', exact: true }).click();
  const file = await download;
  const downloaded = parseMarksCsv(await readFile((await file.path())!, 'utf8'));
  expect(downloaded[0].slice(0, 2)).toEqual(['Roll No.', 'Student Name']);
  expect(downloaded[1][0]).toBe('Maximum Marks');
  const d = sheetDraft(state, state.exams[0], 'class-8-a'),
    grid = sheetTemplate(d.columns, d.students);
  grid[2][4] = '19';
  grid[4][4] = '0';
  const before = (await savedAcademics(page)).results;
  await dialog
    .getByLabel('Import marks file')
    .setInputFiles({ name: 'marks.csv', mimeType: 'text/csv', buffer: Buffer.from(csv(grid)) });
  await expect(dialog.getByRole('region', { name: 'Import preview' })).toBeVisible();
  expect((await savedAcademics(page)).results).toEqual(before);
  await dialog.getByRole('button', { name: 'Apply to sheet', exact: true }).click();
  await dialog.getByRole('button', { name: 'Save Marks', exact: true }).click();
  const saved = await savedAcademics(page);
  expect(
    saved.results.find((r) => r.enrollmentId === d.rows[0].enrollmentId)?.subjects[0].marks,
  ).toBe(19);
  expect(
    saved.results.find((r) => r.enrollmentId === d.rows[1].enrollmentId)?.subjects[0].absent,
  ).toBe(true);
  expect(
    saved.results.find((r) => r.enrollmentId === d.rows[2].enrollmentId)?.subjects[0].marks,
  ).toBe(0);
  expect(JSON.stringify(saved)).not.toContain('marks.csv');
});

test('invalid imports are atomic and a corrected Excel file accepts subject absence', async ({
  page,
}) => {
  const state = academicFixture();
  await loadAcademicFixture(page, state);
  await openSheet(page);
  const d = sheetDraft(state, state.exams[0], 'class-8-a');
  d.columns[0].maximum = '20';
  const grid = sheetTemplate(d.columns, d.students);
  grid[2][4] = '=18';
  const dialog = page.getByRole('dialog');
  await dialog
    .getByLabel('Import marks file')
    .setInputFiles({ name: 'invalid.csv', mimeType: 'text/csv', buffer: Buffer.from(csv(grid)) });
  await expect(dialog.getByRole('alert')).toContainText('Formulas');
  expect((await savedAcademics(page)).results).toEqual([]);
  grid[2][4] = 'A';
  grid[3][4] = '18';
  const workbook = studentWorkbook(grid, ['Number, A or blank'], 'Marks');
  await dialog.getByLabel('Import marks file').setInputFiles({
    name: 'corrected.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: Buffer.from(await workbook.arrayBuffer()),
  });
  await expect(dialog.getByRole('region', { name: 'Import preview' })).toBeVisible();
  await dialog.getByRole('button', { name: 'Apply to sheet', exact: true }).click();
  await dialog.getByRole('button', { name: 'Save Marks', exact: true }).click();
  expect(
    (await savedAcademics(page)).results.find((r) => r.enrollmentId === d.rows[0].enrollmentId)
      ?.subjects[0].absent,
  ).toBe(true);
});
