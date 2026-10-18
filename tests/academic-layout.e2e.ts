import { createSeed } from '../src/mocks/seed';
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { academicFixture, loadAcademicFixture } from './academicFixture';

test('class subject setup renames live results and keeps earlier marks', async ({ page }) => {
  await loadAcademicFixture(page, academicFixture(true));
  await page.goto('/settings?tab=Classes%2C+Sections+%26+Grades');
  await page.getByLabel('Setup class').selectOption('class-8');
  await page.getByRole('tab', { name: 'Subjects', exact: true }).click();
  const input = page.getByLabel('Subject 1 name', { exact: true });
  await expect(input).toHaveValue('Mathematics');
  await input.fill('Applied Mathematics');
  await page.getByRole('button', { name: 'Save subjects', exact: true }).click();
  await page.goto('/academics?class=class-8&view=results&resultsView=recent');
  await page.getByRole('button', { name: 'View Result', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'Applied Mathematics', exact: true })).toBeVisible();
  await expect(page.getByRole('dialog')).toContainText('18/20');
  await page.getByRole('dialog').getByRole('button', { name: 'Edit Marks', exact: true }).click();
  await expect(page.getByLabel('Applied Mathematics maximum marks', { exact: true })).toHaveValue(
    '20',
  );
});

test('academics and marks sheet remain accessible on desktop and fit mobile', async ({
  page,
}, info) => {
  test.setTimeout(120000);
  await loadAcademicFixture(page, createSeed('2026-10-15'));
  await page.goto('/academics?class=class-8');
  const audit = async () =>
    expect(
      (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
        .violations,
    ).toEqual([]);
  await audit();
  await page.getByRole('tab', { name: 'Results', exact: true }).click();
  await expect(page.locator('.academic-ranking-table tbody td small').first()).toHaveCSS(
    'display',
    'block',
  );
  await audit();
  await page.screenshot({ path: info.outputPath('academics-results-desktop.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);
  await audit();
  await page.screenshot({ path: info.outputPath('academics-results-mobile.png'), fullPage: true });
  await page.goto('/academics?class=class-8&test=exam-daily&marks=1&section=class-8-a');
  await expect(page.getByRole('region', { name: 'Marks sheet', exact: true })).toBeVisible();
  await audit();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);
  await page.screenshot({ path: info.outputPath('academics-sheet-mobile.png'), fullPage: true });
});

test('subject changes require save or discard before switching class; legacy test names remain editable', async ({
  page,
}) => {
  await loadAcademicFixture(page, createSeed('2026-10-15'));
  await page.goto('/settings?tab=Classes%2C+Sections+%26+Grades');
  await page.getByLabel('Setup class').selectOption('class-8');
  await page.getByRole('tab', { name: 'Subjects', exact: true }).click();
  await page.getByLabel('Subject 1 name', { exact: true }).fill('Unsaved maths');
  await page.getByLabel('Setup class').selectOption('class-7');
  await expect(page.getByRole('dialog')).toContainText('Discard subject changes?');
  await page.getByRole('button', { name: 'Keep editing', exact: true }).click();
  await expect(page.getByLabel('Setup class')).toHaveValue('class-8');
  await page.getByLabel('Setup class').selectOption('class-7');
  await page.getByRole('button', { name: 'Discard changes', exact: true }).click();
  await expect(page.getByLabel('Setup class')).toHaveValue('class-7');
  await page.goto('/academics?class=class-8');
  const card = page
    .locator('.academic-test-card')
    .filter({ hasText: 'Mathematics · Daily practice' });
  await card.locator('summary').click();
  await card.getByRole('button', { name: 'Edit Test', exact: true }).click();
  await page.getByLabel('Test name', { exact: true }).fill('Legacy daily renamed');
  await page.getByRole('button', { name: 'Save test', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(
    page.locator('.academic-test-card').filter({ hasText: 'Legacy daily renamed' }),
  ).toContainText('Marks Added');
});
