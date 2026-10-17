import { test, expect } from '@playwright/test';
import { loadAcademicFixture, openSheet, savedAcademics } from './academicFixture';

test('metadata-only creation uses a manual type and multiple sections; pencil opens marks later', async ({
  page,
}) => {
  await loadAcademicFixture(page);
  await page.goto('/academics?class=class-8');
  await page.getByRole('button', { name: 'Add Test / Exam', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel('Test type', { exact: true })).toHaveJSProperty(
    'tagName',
    'INPUT',
  );
  await expect(dialog.getByText('Subjects & maximum marks')).toHaveCount(0);
  await dialog.getByLabel('Test name', { exact: true }).fill('October Learning Check');
  await dialog.getByLabel('Test type', { exact: true }).fill('Teacher custom practice');
  await dialog.getByLabel('Grade 8 Section A', { exact: true }).check();
  await dialog.getByLabel('Grade 8 Section B', { exact: true }).check();
  await dialog.getByRole('button', { name: 'Create Test', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  const card = page.locator('.academic-test-card').filter({ hasText: 'October Learning Check' });
  await expect(card).toContainText('Marks Not Added');
  await expect(card).toContainText('Sections A, B');
  await card.getByRole('button', { name: 'Add/Edit Marks for October Learning Check' }).click();
  await expect(dialog.getByLabel('Marks section')).toHaveValue('class-8-a');
  await expect(dialog.getByLabel('Marks section').locator('option')).toHaveCount(2);
  await expect(page.getByLabel('Mathematics maximum marks', { exact: true })).toHaveValue('');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  const saved = await savedAcademics(page);
  expect(saved.exams.find((e) => e.name === 'October Learning Check')?.subjects).toEqual([]);
});

test('marks save numbers, A, pending cells and exclude blank subjects with sections isolated', async ({
  page,
}) => {
  await loadAcademicFixture(page);
  await openSheet(page);
  const dialog = page.getByRole('dialog');
  const first = dialog.locator('tbody tr').nth(0),
    second = dialog.locator('tbody tr').nth(1);
  await dialog.getByLabel('Mathematics maximum marks', { exact: true }).fill('20');
  await dialog.getByLabel('English maximum marks', { exact: true }).fill('50');
  await first.locator('input').nth(0).fill('18');
  await second.locator('input').nth(0).fill('A');
  await second.locator('input').nth(2).fill('45');
  await dialog.getByLabel('Marks section').selectOption('class-8-b');
  await expect(dialog.getByLabel('Mathematics maximum marks', { exact: true })).toHaveValue('');
  await dialog.getByLabel('Mathematics maximum marks', { exact: true }).fill('100');
  await dialog.locator('tbody tr').first().locator('input').first().fill('80');
  await dialog.getByRole('button', { name: 'Save Marks', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('.academic-test-card')).toContainText('Marks Added');
  await page.getByRole('tab', { name: 'Results', exact: true }).click();
  await page.getByRole('button', { name: 'View Result', exact: true }).click();
  await expect(dialog.getByRole('tab', { name: 'Mathematics', exact: true })).toBeVisible();
  await expect(dialog.getByRole('tab', { name: 'English', exact: true })).toBeVisible();
  await expect(dialog.getByRole('tab', { name: 'Science', exact: true })).toHaveCount(0);
  await expect(dialog).toContainText('18/20');
  await expect(dialog).toContainText('Absent');
  await dialog.getByRole('tab', { name: 'English', exact: true }).click();
  await expect(dialog).toContainText('45/50');
  await expect(dialog).toContainText('Pending');
  await dialog.getByRole('button', { name: 'Close dialog' }).click();
  await page.reload();
  await expect(page.getByLabel('Recent results section')).toHaveValue('class-8-a');
  const saved = await savedAcademics(page);
  expect(saved.exams[0].sheets).toHaveLength(2);
  expect(saved.exams[0].sheets?.[0].subjects.map((s) => s.name)).toEqual([
    'Mathematics',
    'English',
  ]);
});

test('invalid maximum and overflow block save; draft discard preserves earlier data', async ({
  page,
}) => {
  await loadAcademicFixture(page);
  await openSheet(page);
  const dialog = page.getByRole('dialog');
  await dialog.locator('tbody tr').first().locator('input').first().fill('21');
  await dialog.getByRole('button', { name: 'Save Marks', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('maximum marks');
  await dialog.getByLabel('Mathematics maximum marks', { exact: true }).fill('20');
  await dialog.getByRole('button', { name: 'Save Marks', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('0–20');
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(dialog).toContainText('Discard marks changes?');
  await dialog.getByRole('button', { name: 'Keep editing', exact: true }).click();
  await expect(dialog.locator('tbody tr').first().locator('input').first()).toHaveValue('21');
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await dialog.getByRole('button', { name: 'Discard changes', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect((await savedAcademics(page)).results).toEqual([]);
});
