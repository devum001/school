import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
const baseline = JSON.parse(
  readFileSync(new URL('../docs/phase1-ui-baseline.json', import.meta.url), 'utf8'),
) as { workspaceNavigation: string[]; settings: Record<string, string[]> };
test('demo retains the recorded shell and every original settings section', async ({ page }) => {
  const apiCalls: string[] = [];
  page.on('request', (r) => {
    if (r.url().includes('/api/v1/')) apiCalls.push(r.url());
  });
  await page.goto('/settings');
  await expect(
    page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link'),
  ).toHaveText(baseline.workspaceNavigation);
  await expect(
    page.getByRole('tablist', { name: 'Settings', exact: true }).getByRole('tab'),
  ).toHaveText(
    Object.keys(baseline.settings).map((t) =>
      t === 'Classes, Sections & Grades' ? 'Classes & sections' : t,
    ),
  );
  await page.screenshot({ path: 'test-results/phase1-demo-general.png', fullPage: true });
  for (const [tab, sections] of Object.entries(baseline.settings)) {
    await page
      .getByRole('tablist', { name: 'Settings', exact: true })
      .getByRole('tab', {
        name: tab === 'Classes, Sections & Grades' ? 'Classes & sections' : tab,
        exact: true,
      })
      .click();
    await expect(
      page.locator('#settings-content .section-navigation').first().getByRole('tab'),
    ).toHaveText(sections);
  }
  await page.getByRole('tab', { name: 'Classes & sections', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Set up classes', exact: true })).toBeVisible();
  await page.screenshot({ path: 'test-results/phase1-demo-classes.png', fullPage: true });
  expect(apiCalls).toEqual([]);
});

test('central class setup saves multiple classes and sections; class context stays above tabs', async ({
  page,
}) => {
  await page.goto('/settings?tab=Classes%2C+Sections+%26+Grades');
  await page.getByRole('button', { name: 'Set up classes', exact: true }).click();
  await page.getByText('Add several classes at once', { exact: true }).click();
  await page.getByLabel('Class names, one per line').fill('Nursery\nClass 1');
  await page.getByLabel('Sections for these classes').fill('A, B');
  await page.getByRole('button', { name: 'Add to setup', exact: true }).click();
  await page.getByLabel('Class 2 sections', { exact: true }).fill('Blue, Green, Red');
  await page.getByRole('button', { name: 'Create classes & sections', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByLabel('Setup class').selectOption({ label: 'Class 1' });
  await expect(page.getByRole('button', { name: 'Edit section Blue', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Edit section Red', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'View students in section Blue', exact: true }).click();
  await expect(page.getByLabel('Class students section').locator('option:checked')).toHaveText(
    'Section Blue',
  );
  await expect(page.getByRole('button', { name: 'Add section', exact: true })).toHaveCount(0);
  await expect(page.getByLabel('Setup class')).toHaveCount(1);
  await page.getByRole('button', { name: 'Import Excel (.xlsx)', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page).toHaveURL(/settings\?/);
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('tab', { name: 'Subjects', exact: true }).click();
  await expect(page.getByLabel('Subject 1 name')).toBeVisible();
  await expect(page.getByLabel('Setup class')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Edit class', exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page.getByLabel('Setup class').locator('option:checked')).toHaveText('Class 1');
  await page.setViewportSize({ width: 390, height: 900 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/class-workspace-mobile.png', fullPage: true });
});

test('demo imports mixed classes including a class without sections from the dialog', async ({
  page,
}) => {
  await page.goto('/settings?tab=Classes%2C+Sections+%26+Grades');
  await page.getByRole('button', { name: 'Set up classes', exact: true }).click();
  await page.getByLabel('Class 1 name', { exact: true }).fill('Class 12');
  await page.getByRole('button', { name: 'Create classes & sections', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByLabel('Setup class').selectOption({ label: 'Class 12' });
  await expect(page.locator('.selected-class-name sup')).toHaveText('th');
  await page.getByRole('tab', { name: 'Students', exact: true }).click();
  await page.getByRole('button', { name: 'Import Excel (.xlsx)', exact: true }).click();
  const workbook = await import('../src/lib/xlsx');
  const { STUDENT_IMPORT_HEADERS } = await import('../src/lib/studentTemplate');
  await page.getByLabel('Excel file (.xlsx)').setInputFiles({
    name: 'mixed.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: Buffer.from(
      await workbook
        .studentWorkbook([
          STUDENT_IMPORT_HEADERS,
          ['Senior Demo', 'SEN-01', '2015-01-01', 'Parent', 'Parent', '', '', 51, '', '12th'],
          ['Ten Demo', 'TEN-02', '2015-01-01', 'Parent', 'Parent', '', '', 51, 'A', 'Class 10'],
        ])
        .arrayBuffer(),
    ),
  });
  await page.getByRole('button', { name: 'Next: preview', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Next: submit', exact: true })).toBeEnabled();
  await expect(page.getByRole('table', { name: 'Student import preview' })).toContainText(
    'Class 12',
  );
  await expect(page.getByRole('table', { name: 'Student import preview' })).toContainText(
    'Grade 10',
  );
  await page.getByRole('button', { name: 'Next: submit', exact: true }).click();
  await page.getByRole('button', { name: 'Import 2 students', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText('Senior Demo', { exact: true })).toBeVisible();
  await expect(page.locator('.setup-toolbar').first()).toContainText('0 sections · 1 students');
  await page.reload();
  await expect(page.getByText('Senior Demo', { exact: true })).toBeVisible();
  await page.getByLabel('Setup class').selectOption({ label: 'Grade 10' });
  await expect(page.getByText('Ten Demo', { exact: true })).toBeVisible();
});
