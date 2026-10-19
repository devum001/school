import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { academicFixture, loadAcademicFixture } from './academicFixture';
import { createSeed } from '../src/mocks/seed';

test('recent tests include every class and open the correct marks sheet despite an old class URL', async ({
  page,
}) => {
  const state = academicFixture();
  state.exams.push({
    ...state.exams[0],
    id: 'class-nine-only',
    name: 'Class 9 Only',
    classId: 'class-9',
    sectionIds: ['class-9-b'],
  });
  await loadAcademicFixture(page, state);
  await page.goto('/academics?class=class-8');
  await expect(page.getByLabel('Academic class', { exact: true })).toHaveCount(0);
  await expect(page.locator('.academic-test-card')).toHaveCount(2);
  await page.getByRole('textbox', { name: 'Search test or exam…' }).fill('Class 9 Only');
  await expect(page.locator('.academic-test-card')).toHaveCount(1);
  await page.getByRole('button', { name: 'Add/Edit Marks for Class 9 Only' }).click();
  const sheet = page.getByRole('dialog');
  await expect(sheet.getByLabel('Marks class')).toHaveValue('class-9');
  await expect(sheet.getByLabel('Marks section')).toHaveValue('class-9-b');
  await expect(page).toHaveURL(/class=class-9/);
  await sheet.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.reload();
  await expect(page.locator('.academic-test-card')).toHaveCount(2);
});

test('results keep adjacent class and section controls, compact awards and the existing section rules', async ({
  page,
}, info) => {
  await loadAcademicFixture(page, createSeed('2026-10-15'));
  await page.goto('/academics?view=results&class=class-5');
  const filters = page.locator('.academic-results-context');
  const classBox = filters.getByLabel('Academic class', { exact: true });
  const section = filters.getByLabel('Leaderboard section scope', { exact: true });
  await expect(section).toHaveValue('');
  const bounds = await classBox.boundingBox(),
    other = await section.boundingBox();
  expect(bounds && other && Math.abs(bounds.y - other.y) < 2).toBe(true);
  expect(bounds && other && other.x > bounds.x).toBe(true);
  await expect(page.locator('main')).not.toContainText('2026 – 2027');
  await expect(page.locator('.academic-award')).toHaveCount(3);
  await expect(page.locator('.academic-award .avatar')).toHaveCount(0);
  for (const award of await page.locator('.academic-award').all()) {
    expect((await award.boundingBox())!.height).toBeLessThan(280);
    await expect(award.locator('.award-rank')).toBeVisible();
  }
  const podium = await page.locator('.academic-podium').textContent();
  await section.selectOption('class-5-b');
  await expect(page.locator('.academic-award .award-section')).toHaveCount(0);
  await page.getByRole('button', { name: 'View All Students' }).click();
  await expect(
    page.getByRole('dialog').getByRole('columnheader', { name: 'Section', exact: true }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await section.selectOption('');
  await expect(page.locator('.academic-podium')).toHaveText(podium!);
  await page.getByRole('tab', { name: 'Recent Results', exact: true }).click();
  const recentSection = filters.getByLabel('Recent results section', { exact: true });
  await expect(recentSection.locator('option')).toHaveCount(2);
  await recentSection.selectOption('class-5-b');
  await expect(page.getByLabel('Results month', { exact: true })).toBeVisible();
  await classBox.selectOption('class-8');
  await expect(recentSection).toHaveValue('class-8-a');
  await page.getByRole('tab', { name: 'Overall Leaderboard', exact: true }).click();
  await classBox.selectOption('class-5');
  await page.mouse.move(1100, 100);
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations,
  ).toEqual([]);
  await page.screenshot({ path: info.outputPath('compact-leaderboard-desktop.png') });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    .toBe(true);
  await expect(section).toBeVisible();
  await page.screenshot({ path: info.outputPath('compact-leaderboard-mobile.png') });
});
