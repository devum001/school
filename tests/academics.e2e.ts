import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-11T06:30:00Z'));
});

test('principal adds a daily test, saves pending and absent marks, completes rankings and retains edits', async ({
  page,
}) => {
  await page.goto('/academics');
  await page.getByRole('button', { name: 'Add test', exact: true }).click();
  await page.getByLabel('Test name', { exact: true }).fill('Fractions practice');
  await page.getByLabel('Test section', { exact: true }).selectOption('class-5-a');
  await page.getByLabel('Subject 1', { exact: true }).fill('Mathematics');
  await page.getByRole('button', { name: 'Create test', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Fractions practice');
  await page.getByLabel('Aarav Sharma Mathematics marks', { exact: true }).fill('18');
  await page.getByLabel('Ananya Sharma absent', { exact: true }).check();
  await page.getByRole('button', { name: 'Save marks', exact: true }).click();
  await expect(page.getByRole('row').filter({ hasText: 'Aarav Sharma' })).toContainText('18 / 20');
  await expect(
    page
      .locator('.academic-results:not(.test-absence-panel)')
      .getByRole('row')
      .filter({ hasText: 'Ananya Sharma' }),
  ).toContainText('Absent');
  await expect(page.getByRole('row').filter({ hasText: 'Vihaan Sharma' })).toContainText('Pending');
  await page.reload();
  await page.getByLabel('Results section').selectOption('class-5-a');
  await page
    .getByRole('button', { name: 'View results for Fractions practice', exact: true })
    .click();
  await expect(page.getByRole('row').filter({ hasText: 'Aarav Sharma' })).toContainText('90%');
  await page.getByRole('button', { name: 'Enter / edit marks' }).click();
  await expect(page.getByRole('dialog').locator('tbody tr')).toHaveCount(12);
  await page.getByLabel('Aarav Sharma Mathematics marks', { exact: true }).fill('19');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Leave unsaved marks?');
  await page.getByRole('button', { name: 'Keep editing', exact: true }).click();
  const inputs = page.getByRole('dialog').locator('input[type="number"]:enabled');
  for (let i = 0; i < (await inputs.count()); i++)
    if ((await inputs.nth(i).inputValue()) === '') await inputs.nth(i).fill('15');
  await page.getByRole('button', { name: 'Save marks', exact: true }).click();
  await page.getByRole('button', { name: 'All tests', exact: true }).click();
  await expect(page.getByRole('row').filter({ hasText: 'Fractions practice' })).toContainText(
    'Complete',
  );
  await page.getByRole('button', { name: 'Overall rankings', exact: true }).click();
  await expect(
    page.locator('.panel-heading').filter({ hasText: 'Overall class rankings' }),
  ).toContainText('5 completed tests included');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export results' }).click();
  expect((await download).suggestedFilename()).toBe('class-results.csv');
  await page.goto('/students/stu-001?tab=academics');
  await page.getByLabel('Student examination').selectOption({ label: 'Fractions practice' });
  await expect(page.getByRole('row').filter({ hasText: 'Mathematics' })).toContainText('95.0%');
});

test('pre-board supports multiple subjects totaling 200 and rejects partial subject rows', async ({
  page,
}) => {
  await page.goto('/academics');
  await page.getByRole('button', { name: 'Add test', exact: true }).click();
  await page.getByLabel('Test name', { exact: true }).fill('Pre-board II');
  await page.getByLabel('Test type', { exact: true }).selectOption('Pre-board');
  await page.getByLabel('Test class', { exact: true }).selectOption('class-10');
  await page.getByLabel('Test section', { exact: true }).selectOption('class-10-a');
  await page.getByLabel('Subject 1', { exact: true }).fill('Mathematics');
  await page.getByLabel('Maximum marks 1', { exact: true }).fill('100');
  await page.getByRole('button', { name: 'Add subject', exact: true }).click();
  await page.getByLabel('Subject 2', { exact: true }).fill('Science');
  await expect(page.getByRole('dialog')).toContainText('Total: 200 marks');
  await page.getByRole('button', { name: 'Create test', exact: true }).click();
  const first = page.getByRole('dialog').locator('tbody tr').first();
  await first.locator('input[type="number"]').nth(0).fill('90');
  await page.getByRole('button', { name: 'Save marks', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Complete every subject');
  await first.locator('input[type="number"]').nth(1).fill('80');
  await page.getByRole('button', { name: 'Save marks', exact: true }).click();
  await expect(page.getByRole('row').filter({ hasText: '170 / 200' })).toContainText('85%');
  await page.getByRole('button', { name: 'All tests', exact: true }).click();
  await page.getByLabel('Filter test type', { exact: true }).selectOption('Pre-board');
  await expect(page.locator('.tests-history-table')).toContainText('Pre-board II');
  await expect(page.locator('.tests-history-table')).not.toContainText('Daily practice');
});

test('results workspace and entry forms are accessible and fit mobile', async ({ page }) => {
  await page.goto('/academics');
  await expect(page.getByRole('heading', { name: 'Tests & results', exact: true })).toBeVisible();
  const audit = async () =>
    expect(
      (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
        .violations,
    ).toEqual([]);
  await audit();
  await page.screenshot({ path: '/tmp/schoolwell-results.png', fullPage: true });
  await page.getByRole('button', { name: 'Add test', exact: true }).click();
  await audit();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page
    .getByRole('button', { name: 'View results for Mathematics · Daily practice', exact: true })
    .click();
  await page.getByRole('button', { name: 'Enter / edit marks' }).click();
  await expect(page.getByRole('dialog').locator('tbody tr')).toHaveCount(24);
  await audit();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: '/tmp/schoolwell-marks-mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('button', { name: 'All tests', exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: '/tmp/schoolwell-results-mobile.png', fullPage: true });
});
