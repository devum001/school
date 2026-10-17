import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const settings = '/settings?tab=Roles+%26+Permissions';
test('staff-only roles have three levels, custom roles persist, and teacher scope stays assigned', async ({
  page,
}) => {
  await page.goto(settings);
  await expect(page.locator('.staff-access-settings > section')).toHaveCount(2);
  for (const name of ['Roles', 'Staff Access'])
    await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
  await expect(page.getByLabel('Role', { exact: true }).locator('option')).toHaveText([
    'Principal / Owner',
    'Admin',
    'Teacher',
    'Accountant',
    'Office Staff',
  ]);
  await page.getByLabel('Role', { exact: true }).selectOption('teacher');
  const matrix = page.getByRole('region', { name: 'Role permissions', exact: true });
  await expect(matrix).toContainText('Assigned classes / sections');
  await expect(matrix.getByRole('row').filter({ hasText: 'Staff' })).toContainText('Own record');
  await expect(matrix).not.toContainText('All school');
  await page.getByRole('button', { name: 'Edit permissions', exact: true }).click();
  await expect(
    page.getByLabel('Students permission', { exact: true }).locator('option'),
  ).toHaveText(['No Access', 'View', 'Manage']);
  await expect(page.getByLabel('Role name', { exact: true })).toBeDisabled();
  await expect(page.getByLabel('Access scope', { exact: true })).toHaveCount(0);
  await page.getByLabel('Students permission', { exact: true }).selectOption('Manage');
  await page.getByRole('button', { name: 'Save role', exact: true }).click();
  await page.getByRole('button', { name: 'Add Custom Role', exact: true }).click();
  await page.getByLabel('Role name', { exact: true }).fill('Student');
  await page.getByRole('button', { name: 'Save role', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('staff only');
  await page.getByLabel('Role name', { exact: true }).fill('Academic Coordinator');
  await page.getByLabel('Access scope', { exact: true }).selectOption('assigned');
  await page.getByLabel('Students permission', { exact: true }).selectOption('View');
  await page.getByLabel('Attendance permission', { exact: true }).selectOption('Manage');
  await page.getByRole('button', { name: 'Save role', exact: true }).click();
  await page.reload();
  await expect(page.getByLabel('Role', { exact: true }).locator('option')).toContainText([
    'Academic Coordinator',
  ]);
  await page.getByLabel('Role', { exact: true }).selectOption('teacher');
  await expect(matrix.getByRole('row').filter({ hasText: 'Students' })).toContainText('Manage');
});
test('staff login and section assignments persist and preview excludes other classes', async ({
  page,
}) => {
  await page.goto(settings);
  await page.getByRole('button', { name: 'Edit access for Priya Menon', exact: true }).click();
  await expect(page.getByLabel('Staff role', { exact: true })).toHaveValue('teacher');
  await page.getByLabel('Login allowed', { exact: true }).check();
  const preview = page.getByRole('region', { name: 'Staff access preview', exact: true });
  await expect(preview).toContainText('12 accessible student records in assigned sections');
  await expect(preview).toContainText('Aarav Sharma');
  await expect(preview).not.toContainText('Patel');
  await page.getByRole('button', { name: 'Save staff access', exact: true }).click();
  await page.reload();
  const row = page
    .getByRole('region', { name: 'Staff login access', exact: true })
    .getByRole('row')
    .filter({ hasText: 'Priya Menon' });
  await expect(row).toContainText('Allowed');
  await expect(row).toContainText('1 assigned sections');
  await page.getByRole('button', { name: 'Edit access for Priya Menon', exact: true }).click();
  await page
    .getByRole('group', { name: 'Assigned classes / sections only', exact: true })
    .getByRole('checkbox', { checked: true })
    .uncheck();
  await page.getByRole('button', { name: 'Save staff access', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('at least one');
  await page.getByLabel('Login allowed', { exact: true }).uncheck();
  await page.getByRole('button', { name: 'Save staff access', exact: true }).click();
  await expect(row).toContainText('Disabled');
});
test('roles and staff access fit desktop and mobile and have accessible controls', async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(settings);
    await expect(page.getByRole('heading', { name: 'Staff Access', exact: true })).toBeVisible();
    await page.screenshot({ path: info.outputPath(`roles-${width}.png`) });
    for (const editor of ['role', 'staff']) {
      if (editor === 'role')
        await page.getByRole('button', { name: 'Add Custom Role', exact: true }).click();
      else
        await page
          .getByRole('button', { name: 'Edit access for Priya Menon', exact: true })
          .click();
      await page.screenshot({ path: info.outputPath(`${editor}-${width}.png`) });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      const result = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze();
      expect(
        result.violations.map((v) => ({ id: v.id, targets: v.nodes.map((n) => n.target) })),
      ).toEqual([]);
      await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    }
  }
  expect(errors).toEqual([]);
});
