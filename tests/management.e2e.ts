import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-11T06:30:00Z'));
});

test('student records can be added, edited and deleted without returning after reload', async ({
  page,
}) => {
  await page.goto('/students');
  await page.getByRole('button', { name: 'Add student', exact: true }).click();
  await page.getByLabel('Student name', { exact: true }).fill('Aditi Verma');
  const admission = await page.getByLabel('Admission number', { exact: true }).inputValue();
  await page.getByLabel('Date of birth', { exact: true }).fill('2015-03-15');
  await page.getByLabel('Guardian name', { exact: true }).fill('Sunita Verma');
  await page.getByLabel('Parent mobile (optional)', { exact: true }).fill('9876543210');
  await page.getByLabel('Total Fee', { exact: true }).fill('1000');
  await page.getByLabel('Fee due date').fill('2026-10-20');
  await page.getByRole('button', { name: 'Save student', exact: true }).click();
  await page.getByPlaceholder('Search name or admission number…').fill(admission);
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await page.reload();
  await page.getByPlaceholder('Search name or admission number…').fill(admission);
  await page.getByRole('button', { name: 'Edit Aditi Verma', exact: true }).click();
  await page.getByLabel('Student name', { exact: true }).fill('Aditi V. Verma');
  await page.getByRole('button', { name: 'Save student', exact: true }).click();
  await page.getByRole('link', { name: 'Open Aditi V. Verma', exact: true }).click();
  await page.getByRole('tab', { name: 'Academics', exact: true }).click();
  await expect(page.getByText('Marks pending', { exact: true })).toBeVisible();
  await page.goto('/students');
  await page.getByPlaceholder('Search name or admission number…').fill(admission);
  await page.getByRole('button', { name: 'Delete Aditi V. Verma', exact: true }).click();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await page.getByRole('button', { name: 'Delete Aditi V. Verma', exact: true }).click();
  await page.getByRole('button', { name: 'Delete permanently', exact: true }).click();
  await page.reload();
  await page.getByPlaceholder('Search name or admission number…').fill(admission);
  await expect(page.locator('tbody tr')).toHaveCount(0);
});

test('teaching staff opens a simple profile and shared edits persist', async ({ page }) => {
  await page.goto('/teachers');
  await page.getByRole('link', { name: 'Add teaching staff', exact: true }).click();
  await page.getByLabel('Staff name', { exact: true }).fill('Kavya Mehra');
  await page.getByLabel('Designation', { exact: true }).fill('Teacher');
  await page.getByLabel('Basic Salary (₹)', { exact: true }).fill('30000');
  await page.getByRole('button', { name: 'Save staff', exact: true }).click();
  await page.goto('/teachers');
  await page.getByPlaceholder('Search teacher name or designation…').fill('Kavya Mehra');
  await page.getByRole('link', { name: /Kavya Mehra/ }).click();
  await expect(page.getByRole('tab')).toHaveText(['Overview', 'Documents']);
  await expect(page.getByText('Assigned Classes', { exact: true })).toHaveCount(0);
  await page.getByRole('link', { name: 'View in Staff & HR →', exact: true }).click();
  await page.getByRole('button', { name: 'Edit staff Kavya Mehra', exact: true }).click();
  await page.getByLabel('Staff status').selectOption('inactive');
  await page.getByRole('button', { name: 'Save staff', exact: true }).click();
  await page.goto('/teachers');
  await page.getByPlaceholder('Search teacher name or designation…').fill('Kavya Mehra');
  await expect(page.locator('tbody')).toContainText('Inactive');
  await page.reload();
  await page.getByPlaceholder('Search teacher name or designation…').fill('Kavya Mehra');
  await expect(page.locator('tbody')).toContainText('Inactive');
});
test('editing maximum marks updates results and deleting a test removes its history', async ({
  page,
}) => {
  await page.goto('/academics');
  await page
    .getByRole('button', { name: 'Edit Mathematics · Daily practice', exact: true })
    .click();
  await expect(page.getByLabel('Test class', { exact: true })).toBeDisabled();
  await page.getByLabel('Test name', { exact: true }).fill('Mathematics revision');
  await page.getByLabel('Maximum marks 1', { exact: true }).fill('40');
  await page.getByRole('button', { name: 'Save test', exact: true }).click();
  await page.reload();
  await page
    .getByRole('button', { name: 'View results for Mathematics revision', exact: true })
    .click();
  await expect(
    page.locator('.academic-results').getByRole('row').filter({ hasText: 'Aarav Sharma' }),
  ).toContainText('/ 40');
  await page.getByRole('button', { name: 'Delete test', exact: true }).click();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('button', { name: 'Delete test', exact: true }).click();
  await page.getByRole('button', { name: 'Delete permanently', exact: true }).click();
  await page.reload();
  await expect(page.locator('.tests-history-table')).not.toContainText('Mathematics revision');
  await page.goto('/students/stu-001?tab=academics');
  await expect(page.locator('.student-history-panel')).not.toContainText('Mathematics revision');
});

test('management pages and forms are accessible and fit mobile', async ({ page }) => {
  const audit = async () =>
    expect(
      (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
        .violations,
    ).toEqual([]);
  await page.goto('/teachers');
  await expect(page.getByRole('heading', { name: 'Teachers', exact: true })).toBeVisible();
  await audit();
  await page.screenshot({ path: '/tmp/schoolwell-teachers.png', fullPage: true });
  await page.getByRole('link', { name: 'Add teaching staff', exact: true }).click();
  await audit();
  await page.setViewportSize({ width: 390, height: 844 });
  await audit();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: '/tmp/schoolwell-teacher-form-mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.goto('/students');
  await page.getByRole('button', { name: 'Add student', exact: true }).click();
  await audit();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});
