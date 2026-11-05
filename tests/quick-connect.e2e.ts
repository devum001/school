import { createSeed } from '../src/mocks/seed';
import { encodeSchoolStorage } from '../src/lib/schoolStorage';
import { STORAGE_KEY } from '../src/lib/config';
import { test, expect } from '@playwright/test';
test('demo contact directory uses local records and guardian dialer links on mobile', async ({
  page,
}) => {
  const calls: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/api/v1')) calls.push(request.url());
  });
  const seed = createSeed();
  seed.students[0].guardian.contact = '9876543210';
  await page.addInitScript(
    ({ key, value }) => {
      if (!localStorage.getItem(key)) localStorage.setItem(key, value);
    },
    { key: STORAGE_KEY, value: encodeSchoolStorage(seed) },
  );
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Teacher attendance', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'Staff attendance', exact: true })).toHaveCount(0);
  await page.goto('/contacts');
  await expect(page.getByRole('heading', { name: 'Quick Connect' })).toBeVisible();
  const first = page.locator('.contact-row').first();
  await expect(first).toBeVisible();
  await expect(first.locator('a[href^="tel:"]')).toHaveCount(1);
  await first.locator('.person a').click();
  await expect(page).toHaveURL(/students\//);
  await expect(page.getByRole('heading', { name: 'Family connection' })).toBeVisible();
  await expect(page.locator('.guardian-card a[href^="tel:"]')).toHaveCount(1);
  await page.goto('/contacts');
  await page.getByRole('tab', { name: 'Teachers', exact: true }).click();
  await expect(page.locator('.contact-row').first()).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(calls).toEqual([]);
});
