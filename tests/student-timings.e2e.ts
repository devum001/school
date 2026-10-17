import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { resolve } from 'node:path';

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-12T06:30:00Z'));
});
const setupUrl = '/settings?tab=Classes%2C+Sections+%26+Grades';
async function setHours(page: Page, start = '09:00', end = '16:00') {
  await page.goto('/settings');
  await page.getByRole('button', { name: 'Edit Details', exact: true }).click();
  await page.getByLabel('School opening time', { exact: true }).fill(start);
  await page.getByLabel('School closing time', { exact: true }).fill(end);
  for (const day of ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'])
    await page.getByRole('checkbox', { name: day, exact: true }).check();
  await page.getByRole('button', { name: 'Save details', exact: true }).click();
}
async function emptyClass(page: Page) {
  await page.goto(setupUrl);
  await page.getByRole('button', { name: 'Add Class / Grade', exact: true }).click();
  await page.getByLabel('Class / Grade name', { exact: true }).fill('Class 1');
  await page.getByRole('button', { name: 'Save Class / Grade', exact: true }).click();
  await page.getByLabel('Setup class', { exact: true }).selectOption({ label: 'Class 1' });
  await page.getByRole('button', { name: 'Add section', exact: true }).click();
  await page.getByLabel('Section name', { exact: true }).fill('Section A');
  await page.getByRole('button', { name: 'Save section', exact: true }).click();
  await expect(page.locator('.setup-sections h3')).toHaveText('Section A');
  await page.getByRole('button', { name: 'Students in Class 1 Section A', exact: true }).click();
}

test('simple school hours live inside General and drive attendance on selected weekdays', async ({
  page,
}) => {
  await page.goto('/settings?tab=Attendance');
  await expect(page.getByRole('tab', { name: 'Timetable', exact: true })).toHaveCount(0);
  await expect(
    page.getByRole('heading', { name: 'Student Late Arrival Policy', exact: true }),
  ).toHaveCount(0);
  await setHours(page);
  await expect(page.locator('.settings-profile-details')).toContainText('09:00 AM');
  await expect(page.locator('.settings-profile-details')).toContainText('04:00 PM');
  await expect(page.locator('.settings-profile-details')).toContainText('Mon, Tue, Wed, Thu, Fri');
  await expect(page.getByRole('heading', { name: 'Student Timings', exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page.locator('.settings-profile-details')).toContainText('09:00 AM');
  await page.goto('/settings?tab=Attendance');
  await expect(page.getByLabel('Cutoff preview class')).toHaveCount(0);
  await expect(
    page.locator('.attendance-rule-values').filter({ hasText: 'Daily Absence Trigger Time' }),
  ).toContainText('09:15 AM');
  await expect(page.getByLabel('Cutoff preview date')).toHaveCount(0);
  await page.goto('/attendance?class=class-10&section=class-10-b&date=2026-10-12');
  await expect(page.locator('.attendance-school-timing')).toContainText('Late cutoff: 09:15 AM');
  await page.goto('/classes');
  await expect(page.getByRole('button', { name: /Timetable for/ })).toHaveCount(0);
});

test('school timing changes rebase the editable absence notification clock', async ({ page }) => {
  await setHours(page, '08:00', '15:00');
  await setHours(page, '10:00', '13:00');
  await page.goto('/settings?tab=Attendance');
  await expect(
    page.locator('.attendance-rule-values').filter({ hasText: 'Daily Absence Trigger Time' }),
  ).toContainText('10:15 AM');
  await page.getByRole('button', { name: 'Edit Absence Notification Rules', exact: true }).click();
  await page.getByLabel('Daily Absence Trigger Time').fill('09:00');
  await page.getByRole('button', { name: 'Save details', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('within school hours');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
});

test('genuine compressed XLSX validates then imports students with consecutive rolls', async ({
  page,
}, testInfo) => {
  await emptyClass(page);
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download Sample Excel', exact: true }).click();
  const sample = await downloadEvent;
  expect(sample.suggestedFilename()).toBe('student-import-sample.xlsx');
  const samplePath = testInfo.outputPath('student-import-sample.xlsx');
  await sample.saveAs(samplePath);
  await page.getByRole('button', { name: 'Import Excel (.xlsx)', exact: true }).click();
  await page.getByLabel('Excel file (.xlsx)', { exact: true }).setInputFiles(samplePath);
  await expect(page.getByRole('alert')).toContainText('no student rows');
  await page
    .getByLabel('Excel file (.xlsx)', { exact: true })
    .setInputFiles(resolve('tests/student-import-invalid.xlsx'));
  await expect(page.getByRole('alert')).toContainText('Row 3');
  await expect(page.getByRole('alert')).toContainText('admission number');
  await expect(page.getByRole('button', { name: 'Import 2 students', exact: true })).toBeDisabled();
  await page
    .getByLabel('Excel file (.xlsx)', { exact: true })
    .setInputFiles(resolve('tests/student-import-valid.xlsx'));
  await expect(page.locator('.import-summary')).toContainText('Ready to import');
  await expect(page.locator('.import-preview')).toContainText('2016-05-21');
  await page.getByRole('button', { name: 'Import 2 students', exact: true }).click();
  await expect(page.locator('.setup-students > li')).toHaveCount(2);
  await expect(page.locator('.setup-students > li').first()).toContainText('Zoya Khan');
  await expect(page.locator('.setup-students > li').first()).toContainText('Roll 1');
  await expect(page.locator('.student-list-number')).toHaveText(['1', '2']);
  await page.getByRole('button', { name: 'Add student', exact: true }).click();
  await expect(page.getByLabel('Roll number', { exact: true })).toHaveValue('3');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.reload();
  await page.getByLabel('Setup class').selectOption({ label: 'Class 1' });
  await page.getByRole('button', { name: 'Students in Class 1 Section A', exact: true }).click();
  await expect(page.locator('.setup-students')).toContainText('Zoya Khan');
  await page.goto('/students');
  await page
    .getByRole('textbox', { name: 'Search name or admission number…', exact: true })
    .fill('BULK-001');
  await expect(page.getByRole('link', { name: 'Zoya Khan', exact: true })).toBeVisible();
});

test('Excel formulas are rejected and cancelled previews do not create students', async ({
  page,
}) => {
  await emptyClass(page);
  await page.getByRole('button', { name: 'Import Excel (.xlsx)', exact: true }).click();
  await page
    .getByLabel('Excel file (.xlsx)', { exact: true })
    .setInputFiles(resolve('tests/student-import-formula.xlsx'));
  await expect(page.getByRole('alert')).toContainText('replace formulas');
  await page
    .getByLabel('Excel file (.xlsx)', { exact: true })
    .setInputFiles(resolve('tests/student-import-valid.xlsx'));
  await expect(page.locator('.import-summary')).toContainText('Ready to import');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('button', { name: 'Close preview', exact: true }).click();
  await expect(page.getByText('No students in this section', { exact: true })).toBeVisible();
});

test('General timing and bulk import forms fit mobile and remain accessible', async ({
  page,
}, testInfo) => {
  await setHours(page);
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/settings');
    await expect(page.locator('.settings-profile h2')).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath(`general-hours-${width}.png`),
      fullPage: true,
    });
    await page.getByRole('button', { name: 'Edit Details', exact: true }).click();
    const profileAxe = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect(
      profileAxe.violations.map((v) => ({ id: v.id, targets: v.nodes.map((n) => n.target) })),
    ).toEqual([]);
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await page.goto(setupUrl);
    await page.getByRole('button', { name: 'Students in Grade 5 Section A', exact: true }).click();
    await page.screenshot({
      path: testInfo.outputPath(`student-actions-${width}.png`),
      fullPage: true,
    });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await page.getByRole('button', { name: 'Import Excel (.xlsx)', exact: true }).click();
    await page
      .getByLabel('Excel file (.xlsx)', { exact: true })
      .setInputFiles(resolve('tests/student-import-valid.xlsx'));
    await expect(page.locator('.import-summary')).toContainText('1 row needs correction');
    await page.screenshot({
      path: testInfo.outputPath(`import-preview-${width}.png`),
      fullPage: true,
    });
    const importAxe = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect(
      importAxe.violations.map((v) => ({ id: v.id, targets: v.nodes.map((n) => n.target) })),
    ).toEqual([]);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await page.getByRole('button', { name: 'Close preview', exact: true }).click();
  }
});
