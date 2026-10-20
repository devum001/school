import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { academicFixture, loadAcademicFixture, savedAcademics } from './academicFixture';
import { saveMarksSheet, sheetDraft } from '../src/lib/academicSheets';
import { parseMarksCsv } from '../src/lib/marksImport';

test('whole-class exam results reconcile sections, sectionless students, maxima and exports', async ({
  page,
}) => {
  let state = academicFixture();
  state.exams[0].sectionlessClassIds = ['class-8'];
  const student = state.enrollments.find((e) => e.classId === 'class-8')!;
  student.sectionId = '';
  for (const [section, max, mark] of [
    ['class-8-a', '20', '18'],
    ['class-8-b', '20', '10'],
    ['', '20', 'A'],
  ]) {
    const draft = sheetDraft(state, state.exams[0], section, 'class-8');
    draft.columns[0].maximum = max;
    draft.rows[0].cells[0] = mark;
    state = saveMarksSheet(state, state.exams[0].id, section, draft.columns, draft.rows, 'class-8');
  }
  await loadAcademicFixture(page, state);
  await page.goto('/academics?view=results&resultsView=recent&class=class-8');
  const filter = page.getByLabel('Recent results section', { exact: true });
  await expect(filter).toHaveValue('');
  const card = page.locator('.academic-result-card');
  const count = (label: string) =>
    card
      .locator('dl div')
      .filter({ has: page.locator('dt', { hasText: new RegExp(`^${label}$`) }) })
      .locator('dd');
  await expect(count('Students')).toHaveText('24');
  await expect(count('Pending')).toHaveText('21');
  await expect(count('Absent')).toHaveText('1');
  await card.getByRole('button', { name: 'View Result', exact: true }).click();
  const dialog = page.locator('.assessment-result-page');
  await dialog.getByLabel('Rows per page').selectOption('50');
  await expect(dialog.locator('tbody tr')).toHaveCount(24);
  await expect(dialog).toContainText('Whole class');
  await expect(dialog).toContainText('Max 20');
  await expect(dialog).toContainText('18/20');
  await expect(dialog).toContainText('10/20');
  const event = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Export class result' }).click();
  const csv = parseMarksCsv(await readFile((await (await event).path())!, 'utf8'));
  expect(csv).toHaveLength(25);
  expect(csv[0]).toEqual([
    'Roll No.',
    'Student',
    'Admission number',
    'Class',
    'Section',
    'Mathematics',
    'Mathematics maximum',
    'Recorded marks',
    'Recorded maximum',
    'Percentage',
    'Rank',
  ]);
  expect(csv.filter((r) => r[4] === 'Without section')).toHaveLength(1);
  expect(csv.some((r) => r[5] === '18' && r[6] === '20')).toBe(true);
  expect(csv.some((r) => r[5] === '10' && r[6] === '20')).toBe(true);
  await dialog.getByRole('button', { name: 'Back to results' }).click();
  for (const [value, students] of [
    ['class-8-a', '11'],
    ['class-8-b', '12'],
    ['unsectioned', '1'],
  ]) {
    await filter.selectOption(value);
    await expect(count('Students')).toHaveText(students);
  }
  await page.getByRole('tab', { name: 'Overall Leaderboard', exact: true }).click();
  await expect(page.getByLabel('Leaderboard section scope')).toHaveValue('unsectioned');
  await page.reload();
  await expect(page.getByLabel('Leaderboard section scope')).toHaveValue('unsectioned');
  await expect(page.locator('.academic-overall')).toContainText('1 students');
});

test('two classes without sections can create, save, import and reopen independent marks', async ({
  page,
}) => {
  test.setTimeout(60000);
  const state = academicFixture();
  const classIds = ['class-9', 'class-10'];
  state.sections = state.sections.filter((s) => !classIds.includes(s.classId));
  for (const classId of classIds) {
    let roll = 0;
    state.enrollments = state.enrollments.map((e) =>
      e.classId === classId ? { ...e, sectionId: '', rollNumber: ++roll } : e,
    );
  }
  await loadAcademicFixture(page, state);
  await page.goto('/academics?class=class-9');
  await page.getByRole('button', { name: 'Add Test / Exam', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Test name', { exact: true }).fill('Sectionless exam');
  await dialog.getByLabel('Default maximum marks').fill('20');
  await dialog.getByLabel('Add assessment class').selectOption('class-10');
  await dialog.getByLabel('Grade 10 Mathematics maximum marks').fill('100');
  await expect(dialog).toContainText('Whole class · no sections needed.');
  await dialog.getByRole('button', { name: 'Create Test', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page
    .getByRole('button', { name: 'Add/Edit Marks for Sectionless exam', exact: true })
    .click();
  await expect(dialog.getByLabel('Marks class')).toHaveValue('class-9');
  await expect(dialog.getByLabel('Marks section').locator('option')).toHaveText([
    'All sections',
    'Without section',
  ]);
  await expect(dialog.getByLabel('Mathematics maximum marks', { exact: true })).toHaveValue('20');
  await dialog.locator('tbody tr').first().locator('input').first().fill('18');
  await dialog.getByLabel('Marks class').selectOption('class-10');
  const name = state.students.find(
    (s) => s.id === state.enrollments.find((e) => e.classId === 'class-10')!.studentId,
  )!.name;
  const csv = `Roll No.,Student Name,Class,Section,Mathematics,Hindi,English,Science,Social Studies,Computer\nMaximum Marks,,,,100,,,,,\n1,${name},Grade 10,,82,,,,,`;
  await dialog
    .getByLabel('Import marks file')
    .setInputFiles({ name: 'marks.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
  await expect(dialog.getByRole('region', { name: 'Import preview' })).toBeVisible();
  for (const checkbox of await dialog
    .getByRole('region', { name: 'Import preview' })
    .getByRole('checkbox')
    .all())
    await checkbox.check();
  await dialog.getByRole('button', { name: 'Apply to sheet', exact: true }).click();
  await dialog.getByRole('button', { name: 'Save Marks', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  const saved = await savedAcademics(page),
    exam = saved.exams.find((e) => e.name === 'Sectionless exam')!;
  expect(exam.sectionIds).toEqual([]);
  expect(exam.sectionlessClassIds).toEqual(classIds);
  expect(exam.sheets?.map((s) => [s.classId, s.sectionId])).toEqual([
    ['class-9', ''],
    ['class-10', ''],
  ]);
  await page.reload();
  await page
    .getByRole('button', { name: 'Add/Edit Marks for Sectionless exam', exact: true })
    .click();
  await expect(dialog.locator('tbody tr').first().locator('input').first()).toHaveValue('18');
  await dialog.getByLabel('Marks class').selectOption('class-10');
  await expect(dialog.locator('tbody tr').first().locator('input').first()).toHaveValue('82');
});
