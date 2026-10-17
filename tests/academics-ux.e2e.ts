import { test, expect } from '@playwright/test';
import { academicFixture, loadAcademicFixture, savedAcademics } from './academicFixture';
import { sheetDraft } from '../src/lib/academicSheets';

test('leaderboard scope is independent of recent section/month and full rankings include pending students', async ({
  page,
}) => {
  await loadAcademicFixture(page, academicFixture(true));
  await page.goto('/academics?class=class-8&view=results');
  await expect(page.getByRole('heading', { name: 'Overall Performance — Grade 8' })).toBeVisible();
  const podium = page.locator('.academic-podium');
  await expect(podium).toContainText('90.0');
  const original = await podium.textContent();
  await page.getByLabel('Results month', { exact: true }).fill('2026-09');
  await expect(page.getByRole('heading', { name: 'No results for this month' })).toBeVisible();
  await expect(podium).toHaveText(original!);
  await page.getByLabel('Recent results section').selectOption('class-8-b');
  await expect(podium).toHaveText(original!);
  await page.getByRole('button', { name: 'View All Students' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.locator('tbody tr')).toHaveCount(24);
  await expect(dialog).toContainText('Pending');
  const download = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Export rankings' }).click();
  expect((await download).suggestedFilename()).toContain('Leaderboard');
  await dialog.getByRole('button', { name: 'Close dialog' }).click();
  await page.getByLabel('Leaderboard section scope').selectOption('class-8-a');
  await expect(page.locator('.academic-award .award-section')).toHaveCount(0);
  await page.getByRole('button', { name: 'View All Students' }).click();
  await expect(
    page.getByRole('dialog').getByRole('columnheader', { name: 'Section', exact: true }),
  ).toHaveCount(0);
});

test('student Manage marks targets the same test and returns to updated subject history', async ({
  page,
}) => {
  const state = academicFixture(true);
  const draft = sheetDraft(state, state.exams[0], 'class-8-a');
  const student = draft.students[0];
  await loadAcademicFixture(page, state);
  await page.goto(`/students/${student.student.id}?tab=academics&exam=flow-test`);
  await expect(page.locator('.student-selected-score')).toContainText('90%');
  await page.getByRole('link', { name: 'Manage marks' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  const input = dialog.getByLabel(`${student.student.name} Mathematics marks`, { exact: true });
  await expect(input).toBeFocused();
  await dialog.getByPlaceholder('Search name or roll number…').fill(student.student.name);
  await input.fill('19');
  await dialog.getByRole('button', { name: 'Save Marks', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page.getByRole('link', { name: 'Back to student academics' }).click();
  await expect(page.locator('.student-selected-score')).toContainText('95%');
  const saved = await savedAcademics(page);
  expect(
    saved.results.find((r) => r.enrollmentId === draft.students[1].enrollment.id)?.subjects[0]
      .absent,
  ).toBe(true);
});

test('test menu edits metadata and deletes marks after confirmation', async ({ page }) => {
  await loadAcademicFixture(page, academicFixture(true));
  await page.goto('/academics?class=class-8');
  await page.getByLabel('More options for Daily Practice').click();
  await page.getByRole('button', { name: 'Edit Test', exact: true }).click();
  await page.getByLabel('Test name', { exact: true }).fill('Revised Practice');
  await page.getByLabel('Test type', { exact: true }).fill('Revision');
  await page.getByRole('button', { name: 'Save test', exact: true }).click();
  await expect(page.locator('.academic-test-card')).toContainText('Revised Practice');
  await expect(page.locator('.academic-test-card')).toContainText('Marks Added');
  await page.getByLabel('More options for Revised Practice').click();
  await page.getByRole('button', { name: 'Delete Test', exact: true }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Delete permanently', exact: true })
    .click();
  await expect(page.getByRole('heading', { name: 'No tests yet' })).toBeVisible();
  const saved = await savedAcademics(page);
  expect(saved.exams).toEqual([]);
  expect(saved.results).toEqual([]);
});

test('students with only pending cells have no fabricated score or empty shareable report', async ({
  page,
}) => {
  const state = academicFixture(true);
  const draft = sheetDraft(state, state.exams[0], 'class-8-a');
  await loadAcademicFixture(page, state);
  await page.goto(`/students/${draft.students[2].student.id}?tab=academics&exam=flow-test`);
  await expect(page.locator('.student-selected-score')).toContainText('Pending');
  await expect(page.getByRole('button', { name: 'Report preview', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Share on WhatsApp', exact: true })).toBeDisabled();
});
