import { test, expect, type Page } from '@playwright/test';
import { createSeed } from '../src/mocks/seed';
import { encodeSchoolStorage } from '../src/lib/schoolStorage';
import { STORAGE_KEY } from '../src/lib/config';
import AxeBuilder from '@axe-core/playwright';

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-18T06:30:00Z'));
  await page.addInitScript(
    ({ key, value }) => {
      if (!localStorage.getItem(key)) localStorage.setItem(key, value);
    },
    { key: STORAGE_KEY, value: encodeSchoolStorage(createSeed('2026-10-18')) },
  );
});
async function decodedImages(page: Page) {
  return page.locator('img:visible').evaluateAll(async (images) => {
    await Promise.all(
      images.map((image) => {
        (image as HTMLImageElement).loading = 'eager';
        return (image as HTMLImageElement).decode().catch(() => undefined);
      }),
    );
    return images
      .filter((image) => !(image as HTMLImageElement).naturalWidth)
      .map((image) => image.getAttribute('src'));
  });
}

test('overview groups four summaries on one quiet surface and keeps navigation working', async ({
  page,
}, info) => {
  await page.goto('/');
  const cards = page.locator('.dashboard-stats .stat-card');
  await expect(cards).toHaveCount(4);
  await expect(cards.locator('img, .stat-icon')).toHaveCount(0);
  await expect(page.getByRole('group', { name: 'School summary' })).toBeVisible();
  await expect(page.locator('.dashboard-stats')).toHaveCSS(
    'background-color',
    'rgb(226, 234, 232)',
  );
  for (const card of await cards.all()) {
    await expect(card).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    await expect(card).toHaveCSS('background-image', 'none');
    await expect(card).toHaveCSS('box-shadow', 'none');
  }
  await expect(cards.nth(0).locator('.stat-value')).toHaveCSS('color', 'rgb(18, 55, 59)');
  const before = await cards.nth(1).boundingBox();
  await cards.nth(1).hover();
  await expect(cards.nth(1)).toHaveCSS('transform', 'none');
  expect((await cards.nth(1).boundingBox())?.y).toBe(before?.y);
  expect(await decodedImages(page)).toEqual([]);
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations,
  ).toEqual([]);
  await page.mouse.move(900, 180);
  await page.screenshot({ path: info.outputPath('overview-desktop.png'), fullPage: true });
  await cards.nth(0).click();
  await expect(page).toHaveURL(/\/students\?status=active/);
  await page.goto('/');
  await page.locator('.dashboard-stats .stat-card').nth(3).click();
  await expect(page).toHaveURL(/\/attendance\/staff/);
});

test('financial cards use the corrected rupee-wallet asset and gallery cards do not jump', async ({
  page,
}, info) => {
  const missing: string[] = [];
  const scales: string[] = [];
  page.on('response', (response) => {
    if (response.status() === 404 && response.url().includes('/icons/'))
      missing.push(response.url());
  });
  page.on('request', (request) => {
    if (/\/balance\.webp(?:\?|$)/.test(request.url())) scales.push(request.url());
  });
  for (const url of ['/fees', '/fees?tab=Student+Fees', '/students/stu-001?tab=fees']) {
    await page.goto(url);
    const icons = page.locator('main img[src*="finance-balance.webp"]');
    await expect(icons.first()).toBeVisible();
    expect(await decodedImages(page)).toEqual([]);
    expect(
      await icons.first().evaluate((image) => (image as HTMLImageElement).currentSrc),
    ).toContain('finance-balance.webp');
  }
  expect(scales).toEqual([]);
  expect(missing).toEqual([]);
  await page.goto('/settings?tab=Templates');
  await page.getByRole('tab', { name: 'Fee Receipt', exact: true }).click();
  const template = page.locator('.template-option').first();
  await expect(template).toBeVisible();
  await template.hover();
  await expect(template).toHaveCSS('transform', 'none');
  await page.goto('/fees');
  await expect(page.locator('.finance-summary')).toBeVisible();
  const financeSurfaces = await page
    .locator('.finance-summary .stat-card')
    .evaluateAll((cards) => cards.map((card) => getComputedStyle(card).backgroundColor));
  expect(new Set(financeSurfaces).size).toBe(1);
  await page.screenshot({ path: info.outputPath('finance-desktop.png'), fullPage: true });
});

test('shared surfaces stay coherent on feature pages, retain clear selections and fit mobile', async ({
  page,
}, info) => {
  for (const url of [
    '/students',
    '/teachers',
    '/staff',
    '/attendance',
    '/academics',
    '/notifications',
    '/settings',
  ]) {
    await page.goto(url);
    await expect(page.locator('main h1')).toBeVisible();
    expect(await decodedImages(page)).toEqual([]);
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      .toBe(true);
  }
  await page.goto('/settings?tab=Staff+%26+Payroll&section=work');
  await expect(page.locator('.settings-policy-header')).toHaveCSS('background-image', 'none');
  await expect(page.locator('.settings-policy-icon')).toHaveCSS(
    'background-color',
    'rgba(0, 0, 0, 0)',
  );
  await expect(page.locator('.settings-policy-icon')).toHaveCSS('box-shadow', 'none');
  await page.screenshot({ path: info.outputPath('settings-desktop.png'), fullPage: true });
  await page.goto('/students');
  await page.screenshot({ path: info.outputPath('students-desktop.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  for (const url of ['/', '/students', '/fees', '/academics', '/settings', '/notifications']) {
    await page.goto(url);
    await expect(page.locator('main h1')).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      .toBe(true);
  }
  await page.goto('/');
  await expect(page.locator('.dashboard-stats .stat-card')).toHaveCount(4);
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations,
  ).toEqual([]);
  await page.screenshot({ path: info.outputPath('overview-mobile.png'), fullPage: true });
});
