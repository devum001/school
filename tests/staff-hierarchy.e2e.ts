import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-13T06:30:00Z'));
});
const settings = '/settings?tab=Staff+%26+Payroll';

test('department staff flow syncs salary edits with Staff and Finance', async ({ page }) => {
  await page.goto(settings);
  await expect(
    page.getByRole('heading', { name: 'Departments & Staff', exact: true }),
  ).toBeVisible();
  await expect(page.locator('.staff-department-table thead th')).toHaveText([
    'Department',
    'Staff',
  ]);
  await expect(page.getByRole('button', { name: 'Add Designation', exact: true })).toHaveCount(0);
  const transport = page.locator('.staff-department-table tr').filter({
    has: page.getByRole('button', { name: 'Transport', exact: true }),
  });
  await expect(transport.locator('td')).toHaveText('0');
  await page.getByRole('button', { name: 'Transport', exact: true }).click();
  await page.getByRole('button', { name: 'Add Staff', exact: true }).click();
  await expect(page.getByLabel('Department', { exact: true })).toHaveValue('department-transport');
  await expect(page.getByLabel('Staff ID', { exact: true })).toHaveCount(0);
  await expect(page.getByLabel('Employment Type', { exact: true })).toHaveCount(0);
  await page.getByLabel('Staff name', { exact: true }).fill('Ravi Kumar');
  await page.getByLabel('Designation', { exact: true }).fill('Driver');
  await page.getByLabel('Salary effective from').fill('2026-10');
  await page.getByLabel('Basic Salary (₹)', { exact: true }).fill('38000');
  await page.getByLabel('Allowance (₹)', { exact: true }).fill('2000');
  await page.getByLabel('Bonus (₹)', { exact: true }).fill('500');
  await page.getByLabel('Deduction (₹)', { exact: true }).fill('1267');
  await expect(page.locator('.staff-salary-preview')).toContainText('₹39,233');
  await page.getByRole('button', { name: 'Save staff', exact: true }).click();
  await expect(page.locator('.department-staff-list')).toContainText('Ravi Kumar (Driver)');
  await expect(page.locator('.department-staff-list')).toContainText('₹39,233');
  await page.getByRole('button', { name: 'All departments', exact: true }).click();
  await expect(transport.locator('td')).toHaveText('1');
  await page.goto('/staff?tab=Salary');
  const ravi = page
    .locator('.staff-payroll-table tbody tr')
    .filter({ hasText: 'Ravi Kumar (Driver)' });
  await expect(ravi).toContainText('₹39,233');
  await expect(page.getByRole('button', { name: /^Edit staff/ })).toHaveCount(0);
  await page.goto(settings);
  await page.getByRole('button', { name: 'Transport', exact: true }).click();
  await page.getByRole('button', { name: 'Edit staff Ravi Kumar', exact: true }).click();
  await page.getByLabel('Basic Salary (₹)', { exact: true }).fill('40000');
  await page.getByLabel('Deduction (₹)', { exact: true }).fill('50000');
  await page.getByRole('button', { name: 'Save staff', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Deduction cannot exceed');
  await page.getByLabel('Deduction (₹)', { exact: true }).fill('1267');
  await page.getByRole('button', { name: 'Save staff', exact: true }).click();
  await page.goto('/staff?tab=Salary');
  await page.reload();
  await expect(ravi).toContainText('₹41,233');
  await expect(page.locator('.staff-payroll-table')).not.toContainText('Full Time');
  await page.goto(settings);
  await page.getByRole('button', { name: 'Transport', exact: true }).click();
  await expect(page.locator('.department-staff-list')).toContainText('₹41,233');
  await page.getByRole('button', { name: 'Delete department Transport', exact: true }).click();
  await page.getByRole('button', { name: 'Delete permanently', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Reassign');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.goto('/fees');
  await expect(page.locator('.school-finance-values')).toHaveAttribute('data-month', '2026-10');
  await expect(
    page.locator('.school-finance-values > div').filter({ hasText: 'Net monthly salaries' }),
  ).toContainText('₹41,233');
  await expect(page.locator('.school-finance-note')).toContainText('1 active staff');
});

test('saved toast expires four seconds after the latest save including repeated messages', async ({
  page,
}) => {
  await page.clock.install({ time: new Date('2026-10-13T06:30:00Z') });
  await page.goto('/settings');
  const saveProfile = async () => {
    await page.getByRole('button', { name: 'Edit Details', exact: true }).click();
    await page.getByRole('button', { name: 'Save details', exact: true }).click();
  };
  await saveProfile();
  await expect(page.locator('.toast')).toBeVisible();
  await page.clock.fastForward(3500);
  await expect(page.locator('.toast')).toBeVisible();
  await saveProfile();
  await page.clock.fastForward(1000);
  await expect(page.locator('.toast')).toBeVisible();
  await page.clock.fastForward(3100);
  await expect(page.locator('.toast')).toHaveCount(0);
  await saveProfile();
  await page.getByRole('button', { name: 'Dismiss notification' }).click();
  await expect(page.locator('.toast')).toHaveCount(0);
});

test('department hierarchy, remaining attendance rules and staff form fit mobile and keyboard use', async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(settings);
    await expect(page.getByRole('button', { name: 'Academics', exact: true })).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath(`departments-${width}.png`),
      fullPage: true,
    });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.getByRole('button', { name: 'Academics', exact: true }).click();
    await page.screenshot({
      path: testInfo.outputPath(`department-staff-${width}.png`),
      fullPage: true,
    });
    const settingsAxe = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect(
      settingsAxe.violations.map((v) => ({
        id: v.id,
        targets: v.nodes.map((n) => n.target),
      })),
    ).toEqual([]);
    await page.goto('/settings?tab=Attendance');
    await expect(page.locator('.attendance-rule-section')).toHaveCount(2);
    await expect(page.getByLabel('Cutoff preview date')).toHaveCount(0);
    await page.screenshot({
      path: testInfo.outputPath(`attendance-${width}.png`),
      fullPage: true,
    });
    await page.goto('/staff');
    await page.getByRole('button', { name: 'Add Staff', exact: true }).click();
    await page.screenshot({
      path: testInfo.outputPath(`add-staff-${width}.png`),
      fullPage: true,
    });
    const staffAxe = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect(
      staffAxe.violations.map((v) => ({
        id: v.id,
        targets: v.nodes.map((n) => n.target),
      })),
    ).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  }
  expect(errors).toEqual([]);
});
