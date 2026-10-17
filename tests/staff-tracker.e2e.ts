import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-13T06:30:00Z'));
});
test('salary rows stay simple and derive full and half leaves from saved staff attendance', async ({
  page,
}) => {
  await page.goto('/settings?tab=Staff+%26+Payroll');
  await page.getByRole('button', { name: 'Academics', exact: true }).click();
  await page.getByRole('button', { name: 'Edit staff Aditya Sethi', exact: true }).click();
  await page.getByLabel('Staff name', { exact: true }).fill('Cycle Staff');
  await page.getByLabel('Designation', { exact: true }).fill('Driver');
  await page.getByLabel('Department', { exact: true }).selectOption('department-transport');
  await page.getByLabel('Salary effective from').fill('2026-01');
  await page.getByLabel('Basic Salary (₹)', { exact: true }).fill('31000');
  await page.getByLabel('Allowance (₹)', { exact: true }).fill('2000');
  await page.getByLabel('Bonus (₹)', { exact: true }).fill('500');
  await page.getByLabel('Deduction (₹)', { exact: true }).fill('100');
  await page.getByRole('button', { name: 'Save staff', exact: true }).click();
  await page.goto('/staff?tab=Salary');
  const row = page
    .locator('.staff-payroll-table tbody tr')
    .filter({ hasText: 'Cycle Staff (Driver)' });
  await expect(
    row
      .locator('td')
      .filter({ hasNot: page.getByRole('button') })
      .filter({ hasNot: page.locator('.badge') }),
  ).toHaveText(['₹33,500', '₹0', '₹33,400', '0 leaves']);
  await expect(
    page.getByRole('button', { name: /Leave details|Edit staff|Leave & late/ }),
  ).toHaveCount(0);
  await expect(page.locator('.staff-payroll-table')).not.toContainText('Estimate');
  await page.goto('/attendance/staff');
  const attendance = page.getByRole('group', { name: 'Cycle Staff attendance', exact: true });
  await page.getByLabel('Staff attendance date').fill('2026-10-05');
  await attendance.getByRole('button', { name: 'Absent', exact: true }).click();
  await page.getByRole('button', { name: 'Save staff attendance', exact: true }).click();
  await page.getByLabel('Staff attendance date').fill('2026-10-06');
  await attendance.getByRole('button', { name: 'Half day', exact: true }).click();
  await page.getByRole('button', { name: 'Save staff attendance', exact: true }).click();
  await page.getByLabel('Staff attendance date').fill('2026-10-07');
  await attendance.getByRole('button', { name: 'Late', exact: true }).click();
  await page.getByRole('button', { name: 'Save staff attendance', exact: true }).click();
  await page.getByRole('link', { name: 'Open Salary', exact: true }).click();
  await expect(
    row
      .locator('td')
      .filter({ hasNot: page.getByRole('button') })
      .filter({ hasNot: page.locator('.badge') }),
  ).toHaveText(['₹33,500', '₹1,500', '₹31,900', '1.5 leaves']);
  await page.reload();
  await expect(row.locator('td').nth(3)).toHaveText('1.5 leaves');
  await page.getByLabel('Salary cycle month').fill('2026-09');
  await expect(row.locator('td').nth(3)).toHaveText('0 leaves');
  await expect(row.locator('td').nth(1)).toHaveText('₹0');
  await page.goto('/fees');
  await expect(
    page.locator('.school-finance-values > div').filter({ hasText: 'Net monthly salaries' }),
  ).toContainText('₹31,900');
  await page.goto('/settings?tab=Staff+%26+Payroll');
  await expect(page.getByText('Late Deduction Rule', { exact: true })).toHaveCount(0);
  await page.getByRole('switch', { name: 'Automatic Leave Deduction', exact: true }).click();
  await page.goto('/staff?tab=Salary');
  await expect(
    row
      .locator('td')
      .filter({ hasNot: page.getByRole('button') })
      .filter({ hasNot: page.locator('.badge') }),
  ).toHaveText(['₹33,500', '₹0', '₹33,400', '1.5 leaves']);
  await page.goto('/attendance/staff?date=2026-10-06');
  await attendance.getByRole('button', { name: 'Present', exact: true }).click();
  await page.getByRole('button', { name: 'Save staff attendance', exact: true }).click();
  await page.goto('/staff?tab=Salary');
  await expect(row.locator('td').nth(3)).toHaveText('1 leave');
});
test('staff attendance guards unsaved changes and fits desktop and mobile', async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/staff?tab=Salary');
    await expect(
      page.locator('.staff-payroll-table tbody tr').first().locator('td').nth(3),
    ).toHaveText('0 leaves');
    await page.screenshot({ path: info.outputPath(`tracker-${width}.png`), fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    expect(
      (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
        .violations,
    ).toEqual([]);
    await page.goto('/attendance/staff');
    await expect(
      page.getByRole('heading', { name: 'Attendance register', exact: true }),
    ).toBeVisible();
    await page.screenshot({
      path: info.outputPath(`staff-attendance-${width}.png`),
      fullPage: true,
    });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    expect(
      (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
        .violations,
    ).toEqual([]);
    await page
      .getByRole('group', { name: 'Aditya Sethi attendance', exact: true })
      .getByRole('button', { name: 'Absent', exact: true })
      .click();
    await page.getByRole('link', { name: 'Open Salary', exact: true }).click();
    await expect(
      page.getByRole('dialog', { name: 'Leave unsaved staff attendance?' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Keep editing', exact: true }).click();
    await expect(page).toHaveURL(/attendance\/staff/);
    await page.getByRole('link', { name: 'Open Salary', exact: true }).click();
    await page.getByRole('button', { name: 'Discard changes', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Finance', exact: true })).toBeVisible();
  }
  expect(errors).toEqual([]);
});
