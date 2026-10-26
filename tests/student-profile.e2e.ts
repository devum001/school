import { expect, test } from '@playwright/test';
import { createSeed } from '../src/mocks/seed';
import { STORAGE_KEY } from '../src/lib/config';
import { roster } from '../src/lib/selectors';

test('demo student profile keeps local documents, original tabs and matching attendance totals', async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date('2026-10-26T06:30:00Z'));
  const state = createSeed();
  const student = roster(state)[0];
  await page.addInitScript(
    ({ key, state }) => {
      if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(state));
    },
    { key: STORAGE_KEY, state },
  );
  const apiCalls: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/api/v1/')) apiCalls.push(request.url());
  });
  await page.goto(`/students/${student.student.id}`);
  await expect(page.getByRole('tab')).toHaveText([
    'Overview',
    'Attendance',
    'Fees',
    'Progress Report',
    'Documents',
  ]);
  const overviewRate = await page
    .locator('.stat-card')
    .filter({ hasText: 'October attendance' })
    .locator('.stat-value')
    .innerText();
  await page.getByRole('tab', { name: 'Attendance', exact: true }).click();
  await expect(page.locator('.calendar-day.late').first()).toBeVisible();
  await expect(
    page.locator('.stat-card').filter({ hasText: 'Attendance rate' }).locator('.stat-value'),
  ).toHaveText(overviewRate);
  await page.getByRole('tab', { name: 'Documents', exact: true }).click();
  await page.getByLabel('Upload document', { exact: true }).setInputFiles({
    name: 'demo-proof.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4\nLocal proof\n%%EOF'),
  });
  await expect(page.getByRole('button', { name: 'demo-proof.pdf', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'demo-proof.pdf', exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('tab', { name: 'Attendance', exact: true }).click();
  await expect(page.locator('.calendar-day.late').first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
    true,
  );
  expect(apiCalls).toEqual([]);
});
