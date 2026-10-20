import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile } from 'node:fs/promises';
import { academicFixture, loadAcademicFixture } from './academicFixture';
import { saveMarksSheet, sheetDraft } from '../src/lib/academicSheets';
import { parseMarksCsv } from '../src/lib/marksImport';

test('combined result shows every included subject, preserves absence/pending and exports matching cells', async ({
  page,
}, info) => {
  let state = academicFixture();
  const draft = sheetDraft(state, state.exams[0], 'class-8-a');
  draft.columns[0].maximum = '20';
  draft.columns[2].maximum = '50';
  draft.rows[0].cells[0] = '18';
  draft.rows[0].cells[2] = '45';
  draft.rows[1].cells[0] = 'A';
  draft.rows[1].cells[2] = '40';
  draft.rows[2].cells[0] = '12';
  state = saveMarksSheet(state, state.exams[0].id, 'class-8-a', draft.columns, draft.rows);
  await loadAcademicFixture(page, state);
  await page.goto('/academics?view=results&resultsView=recent&class=class-8&section=class-8-a');
  await expect(page.getByRole('heading', { name: 'Recent Results', exact: true })).toHaveCount(0);
  const context = page.locator('.academic-results-context');
  await expect(context.getByLabel('Results month', { exact: true })).toBeVisible();
  const [classBox, sectionBox, monthBox] = await Promise.all(
    ['Academic class', 'Recent results section', 'Results month'].map((name) =>
      context.getByLabel(name, { exact: true }).boundingBox(),
    ),
  );
  expect(
    classBox &&
      sectionBox &&
      monthBox &&
      Math.abs(classBox.y - monthBox.y) < 2 &&
      Math.abs(sectionBox.y - monthBox.y) < 2,
  ).toBe(true);
  await page.screenshot({ path: info.outputPath('recent-results-desktop.png') });
  await page.getByRole('button', { name: 'View Result', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('tablist')).toHaveCount(0);
  await expect(dialog.getByRole('columnheader', { name: /Mathematics/ })).toContainText('Max 20');
  await expect(dialog.getByRole('columnheader', { name: /English/ })).toContainText('Max 50');
  await expect(dialog.getByRole('columnheader', { name: /Science/ })).toHaveCount(0);
  const first = dialog.locator('tbody tr').filter({ hasText: draft.students[0].student.name });
  await expect(first).toContainText('18/20');
  await expect(first).toContainText('45/50');
  await expect(first).toContainText('63/70');
  await expect(first).toContainText('90.0%');
  await expect(
    dialog.locator('tbody tr').filter({ hasText: draft.students[1].student.name }),
  ).toContainText('Absent');
  const partial = dialog.locator('tbody tr').filter({ hasText: draft.students[2].student.name });
  await expect(partial).toContainText('Pending');
  await expect(partial).toContainText('Partial');
  const pending = dialog.locator('tbody tr').filter({ hasText: draft.students[3].student.name });
  await expect(pending).toContainText('Pending');
  await expect(pending).not.toContainText('0.0%');
  const region = dialog.getByRole('region', { name: 'Class result by subject' });
  const dimensions = await region.evaluate((el) => ({
    client: el.clientWidth,
    scroll: el.scrollWidth,
  }));
  expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.client + 1);
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations,
  ).toEqual([]);
  await page.screenshot({ path: info.outputPath('combined-result-desktop.png') });
  const downloadEvent = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Export class result', exact: true }).click();
  const download = await downloadEvent;
  const csv = parseMarksCsv(await readFile((await download.path())!, 'utf8'));
  expect(csv[0]).toEqual([
    'Roll No.',
    'Student',
    'Class',
    'Section',
    'Mathematics',
    'Mathematics maximum',
    'English',
    'English maximum',
  ]);
  const exported = csv.find((row) => row[1] === draft.students[0].student.name);
  expect(exported?.slice(4)).toEqual(['18', '20', '45', '50']);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await region.focus();
  await region.press('End');
  await page.screenshot({ path: info.outputPath('combined-result-mobile.png') });
  await dialog.getByRole('button', { name: 'Close dialog' }).click();
  await expect(context.getByLabel('Results month', { exact: true })).toBeVisible();
});
