import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { loadAcademicFixture, savedAcademics } from './academicFixture';

test('class subject selections persist and drive marks, samples and saved-mark protection', async ({
  page,
}, info) => {
  await loadAcademicFixture(page);
  await page.goto('/academics?class=class-8');
  await page.getByRole('button', { name: 'Add Test / Exam', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel('Test type', { exact: true })).toHaveCount(0);
  await dialog.getByLabel('Test name', { exact: true }).fill('Subject selection check');
  await dialog.getByLabel('Grade 8 Section A', { exact: true }).check();
  await dialog.getByLabel('All subjects for Grade 8', { exact: true }).uncheck();
  await dialog.getByRole('button', { name: 'Create Test', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('at least one valid subject');
  await dialog.getByLabel('Grade 8 subject Hindi', { exact: true }).check();
  await dialog.getByLabel('Select Grade 9', { exact: true }).check();
  await dialog.getByLabel('Grade 9 Section B', { exact: true }).check();
  await dialog.getByLabel('All subjects for Grade 9', { exact: true }).uncheck();
  await dialog.getByLabel('Grade 9 subject Mathematics', { exact: true }).check();
  await page.screenshot({ path: info.outputPath('test-subject-form.png') });
  expect((await new AxeBuilder({ page }).include('[role="dialog"]').analyze()).violations).toEqual(
    [],
  );
  await dialog.getByRole('button', { name: 'Create Test', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  const card = page.locator('.academic-test-card').filter({ hasText: 'Subject selection check' });
  await card
    .getByRole('button', { name: 'Add/Edit Marks for Subject selection check', exact: true })
    .click();
  await expect(dialog.getByLabel('Hindi maximum marks', { exact: true })).toBeVisible();
  await expect(dialog.getByLabel('Mathematics maximum marks', { exact: true })).toHaveCount(0);
  await dialog.getByLabel('Hindi maximum marks', { exact: true }).fill('20');
  await dialog.locator('tbody tr').first().locator('input').fill('17');
  await dialog.locator('summary').click();
  const downloading = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'CSV (.csv)', exact: true }).click();
  const download = await downloading;
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  const csv = Buffer.concat(chunks).toString('utf8');
  expect(csv.split('\n')[0]).toContain('Hindi');
  expect(csv.split('\n')[0]).not.toContain('Mathematics');
  await dialog.getByLabel('Marks class').selectOption('class-9');
  await expect(dialog.getByLabel('Hindi maximum marks', { exact: true })).toHaveCount(0);
  await expect(dialog.getByLabel('Mathematics maximum marks', { exact: true })).toBeVisible();
  await dialog.getByLabel('Mathematics maximum marks', { exact: true }).fill('100');
  await dialog.locator('tbody tr').first().locator('input').fill('82');
  await dialog.getByRole('button', { name: 'Save Marks', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page.reload();
  const before = await savedAcademics(page);
  const exam = before.exams.find((e) => e.name === 'Subject selection check')!;
  expect(exam.kind).toBe('');
  expect(exam.subjectSelections).toHaveLength(2);
  await card.getByLabel('More options for Subject selection check').click();
  await page.getByRole('button', { name: 'Edit Test', exact: true }).click();
  await expect(dialog.getByLabel('Grade 8 subject Hindi', { exact: true })).toBeChecked();
  await expect(dialog.getByLabel('Grade 8 subject English', { exact: true })).not.toBeChecked();
  await expect(dialog.getByLabel('Grade 9 subject Mathematics', { exact: true })).toBeChecked();
  await dialog.getByLabel('Grade 8 subject Hindi', { exact: true }).uncheck();
  await dialog.getByLabel('Grade 8 subject English', { exact: true }).check();
  await dialog.getByRole('button', { name: 'Save test', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('saved marks');
  expect((await savedAcademics(page)).results).toEqual(before.results);
  await dialog.getByLabel('Grade 8 subject Hindi', { exact: true }).check();
  await dialog.getByRole('button', { name: 'Save test', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await card
    .getByRole('button', { name: 'Add/Edit Marks for Subject selection check', exact: true })
    .click();
  await expect(dialog.getByLabel('English maximum marks', { exact: true })).toBeVisible();
  await expect(dialog.locator('tbody tr').first().locator('input').first()).toHaveValue('17');
  await page.screenshot({ path: info.outputPath('selected-subject-marks.png') });
});

test('subject choices fit a narrow screen', async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await loadAcademicFixture(page);
  await page.goto('/academics?class=class-8');
  await page.getByRole('button', { name: 'Add Test / Exam', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Grade 8 subject Hindi', { exact: true }).scrollIntoViewIfNeeded();
  expect(await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
  await page.screenshot({ path: info.outputPath('test-subject-mobile.png') });
  expect((await new AxeBuilder({ page }).include('[role="dialog"]').analyze()).violations).toEqual(
    [],
  );
});
