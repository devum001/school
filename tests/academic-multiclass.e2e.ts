import { expect, test } from '@playwright/test';
import { academicFixture, loadAcademicFixture, savedAcademics } from './academicFixture';
import { sheetDraft } from '../src/lib/academicSheets';
import { sheetTemplate } from '../src/lib/sheetImport';
import type { ExcelCell } from '../src/lib/xlsx';

test('one test covers multiple classes and sections, with scoped dropdowns and independent marks', async ({
  page,
}, info) => {
  test.setTimeout(120000);
  await loadAcademicFixture(page);
  await page.goto('/academics?class=class-8');
  await page.getByRole('button', { name: 'Add Test / Exam', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Test name', { exact: true }).fill('Combined Weekly Practice');
  await dialog.getByLabel('Test type', { exact: true }).fill('Weekly Practice');
  await dialog.getByLabel('Grade 8 Section A', { exact: true }).check();
  await dialog.getByLabel('Grade 8 Section B', { exact: true }).check();
  await dialog.getByLabel('Select Grade 9', { exact: true }).check();
  await dialog.getByRole('button', { name: 'Create Test', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('Grade 9');
  await dialog.getByLabel('Grade 9 Section B', { exact: true }).check();
  await page.screenshot({ path: info.outputPath('multiple-class-test-form.png') });
  await dialog.getByRole('button', { name: 'Create Test', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  const card = page.locator('.academic-test-card').filter({ hasText: 'Combined Weekly Practice' });
  await expect(card.locator('.academic-test-scope')).toContainText('Grade 8 · Sections A, B');
  await expect(card.locator('.academic-test-scope')).toContainText('Grade 9 · Section B');
  await card.getByRole('button', { name: 'Add/Edit Marks for Combined Weekly Practice' }).click();
  await expect(dialog.getByLabel('Marks class').locator('option')).toHaveCount(2);
  await expect(dialog.getByLabel('Marks section').locator('option')).toHaveCount(2);
  await dialog.getByLabel('Mathematics maximum marks', { exact: true }).fill('20');
  await dialog.locator('tbody tr').first().locator('input').first().fill('18');
  await dialog.getByLabel('Marks class').selectOption('class-9');
  await expect(dialog.getByLabel('Marks section')).toHaveValue('class-9-b');
  await expect(dialog.getByLabel('Marks section').locator('option')).toHaveCount(1);
  await expect(dialog.getByLabel('Mathematics maximum marks', { exact: true })).toHaveValue('');
  await dialog.getByLabel('Mathematics maximum marks', { exact: true }).fill('100');
  await dialog.locator('tbody tr').first().locator('input').first().fill('82');
  await dialog.getByLabel('Marks class').selectOption('class-8');
  await expect(dialog.getByLabel('Mathematics maximum marks', { exact: true })).toHaveValue('20');
  await expect(dialog.locator('tbody tr').first().locator('input').first()).toHaveValue('18');
  await dialog.getByLabel('Marks section').selectOption('class-8-b');
  await expect(dialog.locator('tbody tr').first().locator('input').first()).toHaveValue('');
  await dialog.getByLabel('Mathematics maximum marks', { exact: true }).fill('30');
  await dialog.locator('tbody tr').first().locator('input').first().fill('15');
  await page.screenshot({ path: info.outputPath('multiple-class-marks-dropdowns.png') });
  await dialog.getByRole('button', { name: 'Save Marks', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  const saved = await savedAcademics(page),
    exam = saved.exams.find((e) => e.name === 'Combined Weekly Practice')!;
  expect(exam.classIds).toEqual(['class-8', 'class-9']);
  expect(exam.sectionIds).toEqual(['class-8-a', 'class-8-b', 'class-9-b']);
  expect(exam.sheets).toHaveLength(3);
  await page.reload();
  await card.getByRole('button', { name: 'Add/Edit Marks for Combined Weekly Practice' }).click();
  await dialog.getByLabel('Marks class').selectOption('class-9');
  await expect(dialog.locator('tbody tr').first().locator('input').first()).toHaveValue('82');
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('tab', { name: 'Results', exact: true }).click();
  await page.getByRole('tab', { name: 'Recent Results', exact: true }).click();
  await page.getByLabel('Academic class').selectOption('class-9');
  await page.getByLabel('Recent results section').selectOption('class-9-b');
  const result = page
    .locator('.academic-result-card')
    .filter({ hasText: 'Combined Weekly Practice' });
  await expect(result).toContainText('82.0%');
  await result.getByRole('button', { name: 'View Result', exact: true }).click();
  await expect(dialog).toContainText('82/100');
});

test('import preview stays with its selected class and rejects files for a different class', async ({
  page,
}) => {
  const state = academicFixture();
  state.exams[0] = {
    ...state.exams[0],
    classId: '',
    classIds: ['class-8', 'class-9'],
    sectionIds: ['class-8-a', 'class-9-b'],
  };
  const draft = sheetDraft(state, state.exams[0], 'class-8-a');
  draft.columns[0].maximum = '20';
  const grid = sheetTemplate(draft.columns, draft.students);
  grid[2][4] = '18';
  const csv = (rows: ExcelCell[][]) =>
    rows
      .map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(','))
      .join('\r\n');
  await loadAcademicFixture(page, state);
  await page.goto('/academics?class=class-8');
  await page
    .getByRole('button', { name: 'Add/Edit Marks for Daily Practice', exact: true })
    .click();
  const dialog = page.getByRole('dialog');
  await dialog
    .getByLabel('Import marks file')
    .setInputFiles({ name: 'grade8.csv', mimeType: 'text/csv', buffer: Buffer.from(csv(grid)) });
  await expect(dialog.getByRole('region', { name: 'Import preview' })).toBeVisible();
  await dialog.getByLabel('Marks class').selectOption('class-9');
  await expect(dialog.getByLabel('Marks class')).toHaveValue('class-8');
  await dialog.getByRole('button', { name: 'Cancel import', exact: true }).click();
  await dialog.getByLabel('Marks class').selectOption('class-9');
  await dialog.getByLabel('Import marks file').setInputFiles({
    name: 'wrong-class.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(csv(grid)),
  });
  await expect(dialog.getByRole('alert')).toContainText('different class or section');
  expect((await savedAcademics(page)).results).toEqual([]);
});

test('editing a shared test shows its assignments and protects saved students', async ({
  page,
}) => {
  const state = academicFixture(true);
  state.exams[0] = {
    ...state.exams[0],
    classId: '',
    classIds: ['class-8', 'class-9'],
    sectionIds: ['class-8-a', 'class-8-b', 'class-9-b'],
  };
  await loadAcademicFixture(page, state);
  await page.goto('/academics?class=class-8');
  await page.getByLabel('More options for Daily Practice').click();
  await page.getByRole('button', { name: 'Edit Test', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel('Select Grade 8', { exact: true })).toBeChecked();
  await expect(dialog.getByLabel('Select Grade 9', { exact: true })).toBeChecked();
  await expect(dialog.getByLabel('Grade 9 Section A', { exact: true })).not.toBeChecked();
  await expect(dialog.getByLabel('Grade 9 Section B', { exact: true })).toBeChecked();
  await dialog.getByLabel('Select Grade 8', { exact: true }).uncheck();
  await dialog.getByRole('button', { name: 'Save test', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('saved marks');
  expect((await savedAcademics(page)).exams[0].classIds).toEqual(['class-8', 'class-9']);
});
