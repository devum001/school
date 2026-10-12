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
  await page.getByLabel('Admission number', { exact: true }).fill('VN-NEW-001');
  await page.getByLabel('Date of birth', { exact: true }).fill('2015-03-15');
  await page.getByLabel('Guardian name', { exact: true }).fill('Sunita Verma');
  await page.getByLabel('Parent mobile (optional)', { exact: true }).fill('9876543210');
  await page.getByRole('button', { name: 'Save student', exact: true }).click();
  await page.getByPlaceholder('Search name or admission number…').fill('VN-NEW-001');
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await page.reload();
  await page.getByPlaceholder('Search name or admission number…').fill('VN-NEW-001');
  await page.getByRole('button', { name: 'Edit Aditi Verma', exact: true }).click();
  await page.getByLabel('Student name', { exact: true }).fill('Aditi V. Verma');
  await page.getByRole('button', { name: 'Save student', exact: true }).click();
  await page.getByRole('link', { name: 'Open Aditi V. Verma', exact: true }).click();
  await page.getByRole('tab', { name: 'Academics', exact: true }).click();
  await expect(page.getByText('Marks pending', { exact: true })).toBeVisible();
  await page.goto('/students');
  await page.getByPlaceholder('Search name or admission number…').fill('VN-NEW-001');
  await page.getByRole('button', { name: 'Delete Aditi V. Verma', exact: true }).click();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await page.getByRole('button', { name: 'Delete Aditi V. Verma', exact: true }).click();
  await page.getByRole('button', { name: 'Delete permanently', exact: true }).click();
  await page.reload();
  await page.getByPlaceholder('Search name or admission number…').fill('VN-NEW-001');
  await expect(page.locator('tbody tr')).toHaveCount(0);
});

test('teacher assignments, inactive status and deletion persist', async ({ page }) => {
  await page.goto('/teachers');
  await page.getByRole('button', { name: 'Add teacher', exact: true }).click();
  await page.getByLabel('Teacher name', { exact: true }).fill('Kavya Mehra');
  await page.getByLabel('Staff ID', { exact: true }).fill('VN-T099');
  await page.getByLabel('Teaching subject', { exact: true }).fill('Mathematics');
  await page.getByLabel('Assign Grade 5 · Section A', { exact: true }).check();
  await expect(page.getByRole('dialog')).toContainText('replace the current class teacher in 1');
  await page.getByRole('button', { name: 'Save teacher', exact: true }).click();
  await page.reload();
  await page.getByPlaceholder('Search teacher, staff ID or subject…').fill('VN-T099');
  await expect(page.locator('tbody tr')).toContainText('Grade 5');
  await page.goto('/classes');
  await expect(page.getByText('Kavya Mehra', { exact: true })).toBeVisible();
  await page.goto('/teachers');
  await page.getByPlaceholder('Search teacher, staff ID or subject…').fill('VN-T099');
  await page.getByRole('button', { name: 'Edit Kavya Mehra', exact: true }).click();
  await page.getByLabel('Teacher status', { exact: true }).selectOption('inactive');
  await expect(page.getByLabel('Assign Grade 5 · Section A', { exact: true })).not.toBeChecked();
  await page.getByRole('button', { name: 'Save teacher', exact: true }).click();
  await expect(page.locator('tbody tr')).toContainText('Inactive');
  await page.goto('/classes');
  await expect(page.getByText('Class teacher not assigned', { exact: true })).toBeVisible();
  await page.goto('/teachers');
  await page.getByPlaceholder('Search teacher, staff ID or subject…').fill('VN-T099');
  await page.getByRole('button', { name: 'Delete Kavya Mehra', exact: true }).click();
  await page.getByRole('button', { name: 'Delete permanently', exact: true }).click();
  await page.reload();
  await page.getByPlaceholder('Search teacher, staff ID or subject…').fill('VN-T099');
  await expect(page.getByText('No teachers found', { exact: true })).toBeVisible();
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
  await page.getByRole('button', { name: 'Add teacher', exact: true }).click();
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
