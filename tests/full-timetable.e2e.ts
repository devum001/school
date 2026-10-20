import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-12T06:30:00Z'));
});
const setupUrl = '/settings?tab=Classes%2C+Sections+%26+Grades';
test('class setup owns flexible grades, sections and student enrollment, and persists', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(setupUrl);
  await page.getByRole('button', { name: 'Set up classes', exact: true }).click();
  await page.getByLabel('Class 1 name', { exact: true }).fill('Nursery');
  await page.getByLabel('Class 1 sections', { exact: true }).fill('Lotus');
  await page.getByRole('button', { name: 'Create classes & sections', exact: true }).click();
  await page.getByLabel('Setup class').selectOption({ label: 'Nursery' });
  await page.getByRole('button', { name: 'Edit class', exact: true }).click();
  await page.getByText('Curriculum level (optional)', { exact: true }).click();
  await page.getByLabel('Level used for subject suggestions', { exact: true }).fill('Pre-primary');
  await page.getByRole('button', { name: 'Save Class', exact: true }).click();
  await page.getByRole('button', { name: 'View students in section Lotus', exact: true }).click();
  await page.getByRole('button', { name: 'Add student', exact: true }).click();
  await expect(
    page.getByLabel('Student section', { exact: true }).locator('option:checked'),
  ).toHaveText('Section Lotus');
  await expect(
    page.getByLabel('Student class', { exact: true }).locator('option:checked'),
  ).toHaveText('Nursery');
  await page.getByLabel('Student name', { exact: true }).fill('Asha Singh');
  const admission = 'NURSERY-001';
  await page.getByLabel('Admission number', { exact: true }).fill(admission);
  await page.getByLabel('Roll number', { exact: true }).fill('1');
  await page.getByLabel('Date of birth', { exact: true }).fill('2022-01-01');
  await page.getByLabel('Guardian name', { exact: true }).fill('Ravi Singh');
  await page.getByLabel('Total Fee', { exact: true }).fill('1000');
  await page.getByLabel('Fee due date').fill('2026-10-20');
  await page.getByRole('button', { name: 'Save student', exact: true }).click();
  await expect(page.locator('.class-students-panel')).toContainText('Asha Singh');
  await page.reload();
  await page.getByLabel('Setup class', { exact: true }).selectOption({ label: 'Nursery' });
  await expect(page.locator('.class-students-panel')).toContainText('Asha Singh');
  await page.getByRole('tab', { name: 'Sections', exact: true }).click();
  await page.getByRole('button', { name: 'Delete section Lotus', exact: true }).click();
  await page.getByRole('button', { name: 'Delete permanently', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('has students');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.goto('/students');
  await page
    .getByRole('textbox', { name: 'Search name or admission number…', exact: true })
    .fill(admission);
  await expect(page.getByRole('link', { name: 'Asha Singh', exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});
