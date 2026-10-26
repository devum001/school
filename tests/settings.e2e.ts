import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('staff settings have three configuration sections and preserve setup, work rules, and payroll preferences', async ({
  page,
}) => {
  await page.goto('/settings?tab=Staff+%26+Payroll');
  await expect(page.getByRole('tab', { name: 'Exams & Results', exact: true })).toHaveCount(0);
  await expect(page.locator('.staff-settings-stack > section')).toHaveCount(3);
  for (const title of ['Departments & Staff', 'Work & Leave Rules', 'Payroll Settings'])
    await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Add Department', exact: true }).click();
  await page.getByLabel('Department name', { exact: true }).fill('Academics');
  await page.getByRole('button', { name: 'Save Department', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('already exists');
  await page.getByLabel('Department name', { exact: true }).fill('Library');
  await page.getByRole('button', { name: 'Save Department', exact: true }).click();
  await page.reload();
  await expect(page.locator('.staff-department-table')).toContainText('Library');
  await page.getByRole('button', { name: 'Edit Work & Leave Rules', exact: true }).click();
  await page.getByLabel('Late After', { exact: true }).fill('07:00');
  await page.getByRole('button', { name: 'Save settings', exact: true }).click();
  await expect(page.getByText('Late cutoff must fall within the work timing.')).toBeVisible();
  await page.getByLabel('Late After', { exact: true }).fill('08:20');
  await page.getByLabel('Casual Leave Limit (days)').fill('16');
  await page.getByRole('button', { name: 'Save settings', exact: true }).click();
  await page.getByRole('switch', { name: 'Automatic Leave Deduction', exact: true }).click();
  const payrollSection = page
    .locator('.staff-settings-stack > section')
    .filter({ has: page.getByRole('heading', { name: 'Payroll Settings', exact: true }) });
  await expect(
    payrollSection.locator('.staff-rule-list > div').filter({ hasText: 'Unpaid Leave Deduction' }),
  ).toContainText('Off');
  await page.getByRole('button', { name: 'Edit Payroll Settings', exact: true }).click();
  await page.getByLabel('Salary Payment Date (day of month)').fill('10');
  await expect(page.getByLabel('Late Deduction Rule', { exact: true })).toHaveCount(0);
  await page.getByLabel('Allowance', { exact: true }).uncheck();
  await expect(page.getByLabel('Payslip Template', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Save settings', exact: true }).click();
  await page.getByRole('switch', { name: 'Auto Calculation', exact: true }).click();
  await page.reload();
  await expect(
    page.getByRole('switch', { name: 'Automatic Leave Deduction', exact: true }),
  ).toHaveAttribute('aria-checked', 'false');
  await expect(page.getByRole('switch', { name: 'Auto Calculation', exact: true })).toHaveAttribute(
    'aria-checked',
    'false',
  );
  await expect(payrollSection).toContainText('Day 10 of every month');
  await expect(payrollSection.getByRole('link', { name: 'Ledger', exact: true })).toHaveAttribute(
    'href',
    '/settings?tab=Templates',
  );
  await expect(page.locator('.staff-component-list')).not.toContainText('Allowance');
  await expect(page.locator('.staff-settings-stack')).toContainText('08:20 AM');
  await expect(page.locator('.staff-rule-list > div').filter({ hasText: 'Casual' })).toContainText(
    '16 days',
  );
  await page.getByRole('tab', { name: 'Data & Security', exact: true }).click();
  await page.getByRole('button', { name: 'Create Backup Now', exact: true }).click();
  await page.getByRole('tab', { name: 'Staff & Payroll', exact: true }).click();
  await expect(page.getByRole('switch', { name: 'Auto Calculation', exact: true })).toHaveAttribute(
    'aria-checked',
    'false',
  );
  await expect(page.locator('.staff-settings-stack')).toContainText('Day 10 of every month');
  await expect(page.locator('.staff-settings-stack')).toContainText('Library');
});

test('school profile edit persists across reload and updates the workspace school name', async ({
  page,
}) => {
  await page.goto('/settings');
  await expect(page.getByRole('tab', { name: 'Exams & Results', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Edit Details', exact: true }).click();
  await page.getByLabel('School name', { exact: true }).fill('Vidya Niketan Academy');
  await page.getByLabel('Email', { exact: true }).fill('office@vidyaniketan.edu.in');
  await page.getByRole('button', { name: 'Save details', exact: true }).click();
  await page.reload();
  await expect(page.locator('.settings-profile h2')).toHaveText('Vidya Niketan Academy');
  await expect(page.locator('.settings-profile-details')).toContainText(
    'office@vidyaniketan.edu.in',
  );
  await expect(page.locator('.school-switch')).toContainText('Vidya Niketan Academy');
});

test('attendance retains eligibility and absence controls without removed sections or date preview', async ({
  page,
}) => {
  await page.goto('/settings?tab=Attendance');
  await expect(
    page.getByRole('heading', { name: 'Student Late Arrival Policy', exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('heading', { name: 'Half-Day & Early Exit Rules', exact: true }),
  ).toHaveCount(0);
  await expect(page.getByLabel('Cutoff preview date')).toHaveCount(0);
  await expect(page.locator('.attendance-rule-section')).toHaveCount(2);
  await page
    .getByRole('button', { name: 'Edit Academic Eligibility Criteria', exact: true })
    .click();
  await page.getByLabel('Early warning threshold (%)').fill('60');
  await page.getByRole('button', { name: 'Save details', exact: true }).click();
  await expect(
    page.getByText('Warning threshold must be at least the minimum attendance.'),
  ).toBeVisible();
  await page.getByLabel('Early warning threshold (%)').fill('85');
  await page.getByRole('button', { name: 'Save details', exact: true }).click();
  await page.getByRole('switch', { name: 'Enable Absence Notifications', exact: true }).click();
  await page.reload();
  await expect(
    page.getByRole('switch', { name: 'Enable Absence Notifications', exact: true }),
  ).toHaveAttribute('aria-checked', 'false');
  await expect(
    page.locator('.attendance-rule-values').filter({ hasText: 'Early Warning Threshold' }),
  ).toContainText('85%');
});

test('settings tabs work with keyboard and fit desktop, tablet, and mobile', async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/settings');
  await page.getByRole('tab', { name: 'General', exact: true }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'Classes & sections', exact: true })).toBeFocused();
  for (const width of [1600, 768, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const tab of [
      'General',
      'Classes & sections',
      'Attendance',
      'Staff & Payroll',
      'Communication',
      'Roles & Permissions',
      'Templates',
      'Data & Security',
      'Preferences',
    ]) {
      await page.getByRole('tab', { name: tab, exact: true }).click();
      await expect(page.locator('#settings-content')).toBeVisible();
      if (tab === 'General' || tab === 'Attendance' || tab === 'Staff & Payroll')
        await page.screenshot({ path: testInfo.outputPath(`${tab}-${width}.png`), fullPage: true });
      if (
        width === 1600 &&
        (tab === 'General' || tab === 'Attendance' || tab === 'Staff & Payroll')
      ) {
        const results = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
          .analyze();
        expect(
          results.violations.map((violation) => ({
            rule: violation.id,
            targets: violation.nodes.map((node) => node.target),
          })),
        ).toEqual([]);
      }
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);
    }
  }
  expect(errors).toEqual([]);
});
