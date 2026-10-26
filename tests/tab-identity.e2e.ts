import { test, expect, type Locator } from '@playwright/test';
import { createSeed } from '../src/mocks/seed';
import { STORAGE_KEY } from '../src/lib/config';
import { encodeSchoolStorage } from '../src/lib/schoolStorage';
import AxeBuilder from '@axe-core/playwright';

const selectedColor = 'rgb(189, 223, 201)';
async function selected(tab: Locator) {
  await expect(tab).toHaveAttribute('aria-selected', 'true');
  await expect(tab).toHaveCSS('background-color', selectedColor);
  await tab.hover();
  await expect(tab).toHaveCSS('background-color', selectedColor);
}
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-18T06:30:00Z'));
  await page.addInitScript(({ key, value }) => localStorage.setItem(key, value), {
    key: STORAGE_KEY,
    value: encodeSchoolStorage(createSeed('2026-10-18')),
  });
});

test('staff selection remains visible on click, hover, keyboard, refresh and browser back', async ({
  page,
}, info) => {
  await page.goto('/staff');
  const tabs = page.getByRole('tablist', { name: 'Staff & HR', exact: true });
  await selected(tabs.getByRole('tab', { name: 'All Staff', exact: true }));
  await tabs.getByRole('tab', { name: 'Attendance', exact: true }).click();
  await selected(tabs.getByRole('tab', { name: 'Attendance', exact: true }));
  await expect(tabs.getByRole('tab', { name: 'All Staff', exact: true })).toHaveCSS(
    'background-color',
    'rgba(0, 0, 0, 0)',
  );
  await tabs.getByRole('tab', { name: 'Attendance', exact: true }).press('ArrowRight');
  await selected(tabs.getByRole('tab', { name: 'Leave', exact: true }));
  await expect(tabs.getByRole('tab', { name: 'Leave', exact: true })).toBeFocused();
  await page.reload();
  await selected(tabs.getByRole('tab', { name: 'Leave', exact: true }));
  await page.goBack();
  await selected(tabs.getByRole('tab', { name: 'Attendance', exact: true }));
  await page.goto('/staff');
  await selected(tabs.getByRole('tab', { name: 'All Staff', exact: true }));
  await page.mouse.move(800, 300);
  await page.screenshot({ path: info.outputPath('staff-selected-desktop.png'), fullPage: true });
});

test('shared selected style covers every primary navigation shape including route links', async ({
  page,
}) => {
  for (const [url, group, first, next] of [
    ['/fees', 'Finance', 'Overview', 'Student Fees'],
    ['/academics', 'Test and Result', 'Recent Tests / Exams', 'Results'],
    ['/notifications', 'Notifications', 'Overview', 'History'],
    ['/settings', 'Settings', 'General', 'Preferences'],
    ['/students/stu-001', 'Student profile tabs', 'Overview', 'Fees'],
    ['/attendance', 'Attendance registers', 'Student Attendance', 'Staff Attendance'],
  ]) {
    await page.goto(url);
    const tabs = page.getByRole('tablist', { name: group, exact: true });
    await selected(tabs.getByRole('tab', { name: first, exact: true }));
    await tabs.getByRole('tab', { name: next, exact: true }).click();
    await selected(
      page
        .getByRole('tablist', { name: group, exact: true })
        .getByRole('tab', { name: next, exact: true }),
    );
  }
  await page.goto('/teachers');
  await page.locator('main a[href^="/teachers/"]').first().click();
  await selected(
    page
      .getByRole('tablist', { name: 'Teacher detail', exact: true })
      .getByRole('tab', { name: 'Overview', exact: true }),
  );
});

test('identity and decorative icons have no tiles; settings and staff work on mobile', async ({
  page,
}, info) => {
  await page.goto('/');
  for (const selector of ['.sidebar .brand-mark', '.sidebar .school-initial', '.class-icon']) {
    const icons = page.locator(selector);
    await expect(icons.first()).toBeVisible();
    for (const icon of await icons.all()) {
      await expect(icon).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
      await expect(icon).toHaveCSS('border-radius', '0px');
    }
  }
  await expect(page.locator('.dashboard-stats .stat-icon')).toHaveCount(0);
  await expect(page.locator('.sidebar .school-initial img')).toHaveCSS('object-fit', 'contain');
  await page.screenshot({ path: info.outputPath('unboxed-dashboard.png'), fullPage: true });
  await page.goto('/settings');
  await expect(page.locator('.settings-school-mark')).toHaveCSS(
    'background-color',
    'rgba(0, 0, 0, 0)',
  );
  const logo = page.locator('.settings-school-mark img');
  await expect(logo).toHaveCSS('width', '96px');
  await expect(logo).toHaveCSS('object-fit', 'contain');
  await page.screenshot({ path: info.outputPath('unboxed-school-logo.png'), fullPage: true });
  for (const url of ['/staff', '/settings', '/notifications']) {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(url);
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
      .toBe(true);
    const firstSelected = page.locator('main [role="tab"][aria-selected="true"]').first();
    await expect(firstSelected).toHaveCSS('background-color', selectedColor);
    const audit = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(audit.violations).toEqual([]);
  }
  await page.goto('/staff');
  await expect(page.getByRole('tab', { name: 'All Staff', exact: true })).toHaveCSS(
    'background-color',
    selectedColor,
  );
  await page.screenshot({ path: info.outputPath('staff-selected-mobile.png'), fullPage: true });
});
