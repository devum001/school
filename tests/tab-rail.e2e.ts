import { test, expect, type Locator } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { createSeed } from '../src/mocks/seed';
import { encodeSchoolStorage } from '../src/lib/schoolStorage';
import { STORAGE_KEY } from '../src/lib/config';

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-18T06:30:00Z'));
  await page.addInitScript(({ key, value }) => localStorage.setItem(key, value), {
    key: STORAGE_KEY,
    value: encodeSchoolStorage(createSeed('2026-10-18')),
  });
});

async function oneRow(tabs: Locator) {
  await expect(tabs).toBeVisible();
  await expect(tabs.getByRole('tab').first()).toBeVisible();
  const positions = await tabs
    .getByRole('tab')
    .evaluateAll((items) => items.map((item) => Math.round(item.getBoundingClientRect().top)));
  expect(new Set(positions).size).toBe(1);
}
async function fullyVisible(tabs: Locator, name: string) {
  await expect
    .poll(async () =>
      tabs.getByRole('tab', { name, exact: true }).evaluate((item) => {
        const parent = item.parentElement!.getBoundingClientRect();
        const bounds = item.getBoundingClientRect();
        return bounds.left >= parent.left - 1 && bounds.right <= parent.right + 1;
      }),
    )
    .toBe(true);
}

test('settings arrows reveal hidden tabs without selecting, and keyboard and reload keep selection visible', async ({
  page,
}, info) => {
  await page.goto('/settings');
  const tabs = page.getByRole('tablist', { name: 'Settings', exact: true });
  const right = page.getByRole('button', { name: 'Scroll Settings tabs right', exact: true });
  const left = page.getByRole('button', { name: 'Scroll Settings tabs left', exact: true });
  await oneRow(tabs);
  await expect(right).toBeVisible();
  await expect(left).toBeHidden();
  await right.click();
  await expect(left).toBeVisible();
  await fullyVisible(tabs, 'Preferences');
  await expect(right).toBeHidden();
  await expect(left).toBeVisible();
  await expect(tabs.getByRole('tab', { name: 'General', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(left).toBeEnabled();
  await left.click();
  await expect.poll(() => tabs.evaluate((element) => element.scrollLeft)).toBeLessThanOrEqual(1);
  await expect(left).toBeHidden();
  await expect(right).toBeVisible();
  await right.click();
  await fullyVisible(tabs, 'Preferences');
  await expect(right).toBeHidden();
  await tabs.getByRole('tab', { name: 'Preferences', exact: true }).click();
  await expect(page).toHaveURL(/tab=Preferences/);
  await page.reload();
  await fullyVisible(tabs, 'Preferences');
  await tabs.getByRole('tab', { name: 'Preferences', exact: true }).press('Home');
  await fullyVisible(tabs, 'General');
  await expect(tabs.getByRole('tab', { name: 'General', exact: true })).toBeFocused();
  const bounds = await tabs.boundingBox();
  if (!bounds) throw new Error('Missing tab viewport');
  await page.mouse.move(bounds.x + bounds.width - 15, bounds.y + 20);
  await page.mouse.down();
  const before = await tabs.evaluate((element) => element.scrollLeft);
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + 20, { steps: 8 });
  await page.mouse.up();
  expect(await tabs.evaluate((element) => element.scrollLeft)).toBe(before);
  await page.mouse.wheel(300, 0);
  expect(await tabs.evaluate((element) => element.scrollLeft)).toBe(before);
  await page.mouse.move(800, 150);
  await tabs.getByRole('tab', { name: 'General', exact: true }).press('Home');
  await fullyVisible(tabs, 'General');
  await page.screenshot({
    path: info.outputPath('settings-single-row-desktop.png'),
    fullPage: false,
  });
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations,
  ).toEqual([]);
});

test('mobile primary and secondary rails stay on one row and selected tabs remain reachable', async ({
  page,
}, info) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/settings?tab=Preferences');
  const settings = page.getByRole('tablist', { name: 'Settings', exact: true });
  await fullyVisible(settings, 'Preferences');
  await oneRow(settings);
  const offset = await settings.evaluate((element) => element.scrollLeft);
  await page.getByRole('button', { name: 'Scroll Settings tabs left', exact: true }).click();
  await expect.poll(() => settings.evaluate((element) => element.scrollLeft)).toBeLessThanOrEqual(1);
  expect(offset).toBeGreaterThan(1);
  await expect(page.getByRole('button', { name: 'Scroll Settings tabs left', exact: true })).toBeHidden();
  await settings.getByRole('tab', { name: 'Preferences', exact: true }).press('Home');
  await fullyVisible(settings, 'General');
  const schoolFeatures = page.getByRole('tablist', { name: 'General settings features', exact: true });
  await oneRow(schoolFeatures);
  await expect(
    page.getByRole('button', { name: 'Scroll General settings features tabs right', exact: true }),
  ).toBeHidden();
  for (const [url, label] of [
    ['/fees', 'Finance'],
    ['/academics', 'Test and Result'],
    ['/staff', 'Staff & HR'],
    ['/students/stu-001', 'Student profile tabs'],
    ['/attendance', 'Attendance registers'],
    ['/notifications', 'Notifications'],
  ]) {
    await page.goto(url);
    const tabs = page.getByRole('tablist', { name: label, exact: true });
    await expect(tabs).toBeVisible();
    await oneRow(tabs);
    const first = tabs.getByRole('tab').first();
    await expect(first).toHaveAttribute('aria-selected', 'true');
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      .toBe(true);
  }
  await page.goto('/fees');
  const secondary = page.getByRole('tablist', { name: 'Finance overview views', exact: true });
  await oneRow(secondary);
  const next = page.getByRole('button', {
    name: 'Scroll Finance overview views tabs right',
    exact: true,
  });
  await expect(next).toBeVisible();
  await next.click();
  await fullyVisible(secondary, 'Recent Transactions');
  await secondary.getByRole('tab', { name: 'Recent Transactions', exact: true }).click();
  await expect(page).toHaveURL(/financeView=recent/);
  await page.goto('/settings?tab=Preferences');
  await fullyVisible(page.getByRole('tablist', { name: 'Settings', exact: true }), 'Preferences');
  await page.setViewportSize({ width: 430, height: 900 });
  await fullyVisible(page.getByRole('tablist', { name: 'Settings', exact: true }), 'Preferences');
  await page.setViewportSize({ width: 390, height: 844 });
  await fullyVisible(page.getByRole('tablist', { name: 'Settings', exact: true }), 'Preferences');
  await page.screenshot({
    path: info.outputPath('settings-single-row-mobile.png'),
    fullPage: false,
  });
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations,
  ).toEqual([]);
});

test('redundant page introductions and demo banners are removed while upload requirements remain', async ({
  page,
}) => {
  for (const url of ['/settings', '/students', '/fees', '/academics', '/staff', '/notifications']) {
    await page.goto(url);
    await expect(page.locator('.page-heading h1')).toBeVisible();
    await expect(page.locator('.page-heading p, .page-heading .eyebrow')).toHaveCount(0);
  }
  await page.goto('/settings?tab=Templates');
  await expect(page.getByText('Sample artwork is ready to preview.', { exact: false })).toHaveCount(
    0,
  );
  await expect(page.getByText('Header', { exact: true })).toBeVisible();
  await expect(page.locator('input[type=file]')).not.toHaveCount(0);
  await page.goto('/settings?tab=Communication');
  await expect(page.getByText(/Demo connected|Active in demo/)).toHaveCount(0);
  await page.goto('/settings?tab=Data+%26+Security&section=security');
  await expect(page.locator('.admin-preview-note')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Change Password', exact: true })).toBeVisible();
});
