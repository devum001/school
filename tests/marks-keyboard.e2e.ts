import { expect, test } from '@playwright/test';
import { loadAcademicFixture, openSheet, savedAcademics } from './academicFixture';

test('arrow keys move between mark cells without changing scores; Enter and Tab still work', async ({
  page,
}) => {
  await loadAcademicFixture(page);
  await openSheet(page);
  const dialog = page.getByRole('dialog');
  const rows = dialog.locator('.marks-spreadsheet tbody tr');
  const cell = (r: number, c: number) => rows.nth(r).locator('input').nth(c);
  await dialog.getByLabel('Mathematics maximum marks', { exact: true }).fill('20');
  await dialog.getByLabel('Hindi maximum marks', { exact: true }).fill('50');
  await cell(0, 0).fill('18.5');
  await cell(1, 0).fill('A');
  await cell(2, 0).fill('0');
  await cell(0, 1).fill('11');
  await cell(0, 0).focus();
  await page.keyboard.press('ArrowRight');
  await expect(cell(0, 1)).toBeFocused();
  expect(
    await cell(0, 1).evaluate((el: HTMLInputElement) => [el.selectionStart, el.selectionEnd]),
  ).toEqual([0, 2]);
  await page.keyboard.press('0');
  await expect(cell(0, 1)).toHaveValue('0');
  await page.keyboard.press('ArrowDown');
  await expect(cell(1, 1)).toBeFocused();
  await page.keyboard.type('15');
  await page.keyboard.press('ArrowLeft');
  await expect(cell(1, 0)).toBeFocused();
  await page.keyboard.press('ArrowUp');
  await expect(cell(0, 0)).toBeFocused();
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('ArrowLeft');
  await expect(cell(0, 0)).toBeFocused();
  await expect(cell(0, 0)).toHaveValue('18.5');
  await page.keyboard.press('Enter');
  await expect(cell(1, 0)).toBeFocused();
  await page.keyboard.press('Shift+Enter');
  await expect(cell(0, 0)).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(cell(0, 1)).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(cell(0, 0)).toBeFocused();
  await page.keyboard.press('Control+ArrowRight');
  await expect(cell(0, 0)).toBeFocused();
  await page.keyboard.press('Shift+ArrowLeft');
  await expect(cell(0, 0)).toBeFocused();
  await dialog.getByRole('button', { name: 'Save Marks', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  const saved = await savedAcademics(page);
  const results = saved.results.filter((r) => r.examId === 'flow-test');
  expect(results[0].subjects.map((s) => s.marks)).toEqual([18.5, 0]);
  expect(results[1].subjects[0].absent).toBe(true);
  expect(results[1].subjects[1].marks).toBe(15);
  expect(results[2].subjects[0].marks).toBe(0);
  await page.reload();
  await page
    .getByRole('button', { name: 'Add/Edit Marks for Daily Practice', exact: true })
    .click();
  await expect(cell(0, 0)).toHaveValue('18.5');
  await expect(cell(1, 0)).toHaveValue('A');
  await expect(cell(2, 0)).toHaveValue('0');
});

test('vertical navigation uses the filtered visible rows and switches sections safely', async ({
  page,
}) => {
  await loadAcademicFixture(page);
  await openSheet(page);
  const dialog = page.getByRole('dialog');
  const rows = dialog.locator('.marks-spreadsheet tbody tr');
  await dialog.getByPlaceholder('Search name or roll number…').fill('1');
  await expect(rows).toHaveCount(4);
  const first = rows.nth(0).locator('input').first();
  const second = rows.nth(1).locator('input').first();
  await first.fill('12');
  await page.keyboard.press('ArrowDown');
  await expect(second).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(rows.nth(2).locator('input').first()).toBeFocused();
  await page.keyboard.press('Shift+Enter');
  await expect(second).toBeFocused();
  await page.keyboard.press('ArrowUp');
  await expect(first).toBeFocused();
  await expect(first).toHaveValue('12');
  await dialog.getByLabel('Marks section').selectOption('class-8-b');
  await expect(rows).toHaveCount(12);
  await expect(first).toHaveValue('');
  await first.focus();
  await page.keyboard.press('ArrowDown');
  await expect(second).toBeFocused();
  await dialog.getByLabel('Marks section').selectOption('class-8-a');
  await expect(first).toHaveValue('12');
});

test('arrow navigation scrolls the focused cell clear of sticky headers and stops at sheet edges', async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 900, height: 800 });
  await loadAcademicFixture(page);
  await openSheet(page);
  const grid = page.getByRole('region', { name: 'Marks sheet', exact: true });
  const rows = grid.locator('tbody tr');
  const columns = await rows.first().locator('input').count();
  await rows.first().locator('input').first().focus();
  for (let c = 1; c < columns; c++) await page.keyboard.press('ArrowRight');
  for (let r = 1; r < (await rows.count()); r++) await page.keyboard.press('ArrowDown');
  const last = rows.last().locator('input').last();
  await expect(last).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowDown');
  await expect(last).toBeFocused();
  expect(await grid.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);
  expect(await grid.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
  for (let c = 1; c < columns; c++) await page.keyboard.press('ArrowLeft');
  for (let r = 1; r < (await rows.count()); r++) await page.keyboard.press('ArrowUp');
  const first = rows.first().locator('input').first();
  await expect(first).toBeFocused();
  const bounds = await first.boundingBox();
  const heading = await grid.locator('thead th').first().boundingBox();
  const student = await rows.first().locator('th').boundingBox();
  expect(bounds!.y).toBeGreaterThanOrEqual(heading!.y + heading!.height - 1);
  expect(bounds!.x).toBeGreaterThanOrEqual(student!.x + student!.width - 1);
  await page.screenshot({ path: info.outputPath('marks-keyboard-navigation.png') });
});
