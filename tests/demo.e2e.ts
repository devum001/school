import { createSeed } from '../src/mocks/seed';
import { STORAGE_KEY } from '../src/lib/config';
import { test, expect } from '@playwright/test';
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-11T06:30:00Z'));
});

test('complete school presentation: attendance, simulation, profile, payments and persistence', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'A good day starts with clarity.' }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Classes & sections', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Grade 5', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Register', exact: true }).first().click();
  const aarav = page.getByRole('group', { name: 'Aarav Sharma attendance' });
  const ananya = page.getByRole('group', { name: 'Ananya Sharma attendance' });
  const vihaan = page.getByRole('group', { name: 'Vihaan Sharma attendance' });
  const diya = page.getByRole('group', { name: 'Diya Sharma attendance' });
  await aarav.getByRole('button', { name: 'Absent', exact: true }).click();
  await ananya.getByRole('button', { name: 'Absent', exact: true }).click();
  await vihaan.getByRole('button', { name: 'Absent', exact: true }).click();
  await diya.getByRole('button', { name: 'Absent', exact: true }).click();
  await expect(page.getByText('Unsaved changes', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Save attendance', exact: true }).click();
  await expect(page.getByText('Register up to date', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Review notifications', exact: true }).click();
  await page.getByRole('button', { name: 'Select all', exact: true }).click();
  await expect(page.getByText(/missing a contact or active channel/)).toBeVisible();
  await page.getByRole('button', { name: 'Review & Send', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Review notifications' })).toBeVisible();
  await expect(page.locator('.communication-message-preview')).toContainText('was marked absent');
  await page.getByRole('button', { name: 'Confirm demo send', exact: true }).click();
  await expect(
    page
      .getByRole('region', { name: 'Notification history', exact: true })
      .getByText('Delivered', { exact: true })
      .first(),
  ).toBeVisible();
  await expect(
    page
      .getByRole('region', { name: 'Notification history', exact: true })
      .getByText('Failed', { exact: true })
      .first(),
  ).toBeVisible();
  await page.getByLabel('Type', { exact: true }).selectOption('Student Absent');
  await page.getByLabel('Class', { exact: true }).selectOption('class-5');
  await page
    .getByRole('link', { name: /Ananya Sharma/ })
    .first()
    .click();
  await page.getByRole('tab', { name: 'Attendance', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Monthly attendance' })).toBeVisible();
  await expect(page.getByRole('row').filter({ hasText: '11 Oct 2026' })).toContainText('Absent');
  await page.getByRole('tab', { name: 'Fees', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Installment schedule' })).toBeVisible();
  await page.getByRole('button', { name: 'Record payment', exact: true }).click();
  await page.getByLabel('Payment amount').fill('1000');
  await page.getByRole('button', { name: 'Confirm payment', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('₹17,000');
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await page.getByRole('tab', { name: 'Academics', exact: true }).click();
  await page.getByRole('button', { name: 'Report preview', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Ananya Sharma');
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('tab', { name: 'Documents', exact: true }).click();
  await expect(page.getByLabel('Upload document')).toBeVisible();
  await page.reload();
  await page.getByRole('tab', { name: 'Fees', exact: true }).click();
  await expect(page.locator('.stat-value').filter({ hasText: '₹17,000' })).toBeVisible();
  await page.getByRole('link', { name: 'Overview', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'A good day starts with clarity.' }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test('unsaved attendance supports cancel and discard across navigation and filters', async ({
  page,
}) => {
  await page.goto('/attendance');
  await page
    .getByRole('group', { name: 'Aarav Sharma attendance' })
    .getByRole('button', { name: 'Absent', exact: true })
    .click();
  await page.getByRole('link', { name: 'Overview', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Leave unsaved attendance?' })).toBeVisible();
  await page.getByRole('button', { name: 'Keep editing' }).click();
  await expect(page.getByText('Unsaved changes', { exact: true })).toBeVisible();
  await page.getByLabel('Section', { exact: true }).selectOption('class-5-b');
  await page.getByRole('button', { name: 'Discard and leave' }).click();
  await expect(page.getByRole('heading', { name: 'Grade 5 · Section B' })).toBeVisible();
  await page.getByLabel('Section', { exact: true }).selectOption('class-5-a');
  await expect(
    page
      .getByRole('group', { name: 'Aarav Sharma attendance' })
      .getByRole('button', { name: 'Present', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
});
test('directory search, class/section/status filters and empty state', async ({ page }) => {
  await page.goto('/students');
  await page
    .getByRole('textbox', { name: 'Search name or admission number…' })
    .fill('WBA-2026-0001');
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await expect(page.locator('tbody')).toContainText('Aarav Sharma');
  await page
    .getByRole('textbox', { name: 'Search name or admission number…' })
    .fill('No matching learner');
  await expect(page.getByRole('heading', { name: 'No records found' })).toBeVisible();
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await page.getByLabel('Student status').selectOption('inactive');
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await page.getByLabel('Class', { exact: true }).selectOption('class-5');
  await expect(page.getByRole('heading', { name: 'No records found' })).toBeVisible();
});
test('unmarked attendance and prior dates have explicit separate summaries', async ({ page }) => {
  await page.goto('/attendance?class=class-10&section=class-10-b');
  await expect(page.locator('.attendance-summary')).toContainText('Not marked11');
  await page.getByRole('button', { name: 'Mark all present' }).click();
  await page.getByRole('button', { name: 'Save attendance', exact: true }).click();
  await expect(page.locator('.attendance-summary')).toContainText('Not marked0');
  await page.getByLabel('Attendance date', { exact: true }).fill('2026-10-09');
  await expect(page.getByText('Register up to date', { exact: true })).toBeVisible();
});
test('backup preview preserves modified attendance records', async ({ page }) => {
  await page.goto('/attendance');
  await page
    .getByRole('group', { name: 'Aarav Sharma attendance' })
    .getByRole('button', { name: 'Absent', exact: true })
    .click();
  await page.getByRole('button', { name: 'Save attendance', exact: true }).click();
  await page.getByRole('link', { name: 'School settings', exact: true }).click();
  await page.getByRole('tab', { name: 'Data & Security', exact: true }).click();
  await page.getByRole('button', { name: 'Create Backup Now', exact: true }).click();
  await expect(page.getByText('Preview successful', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Attendance', exact: true }).click();
  await expect(
    page
      .getByRole('group', { name: 'Aarav Sharma attendance' })
      .getByRole('button', { name: 'Absent', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
});
test('mobile navigation, profiles and tables remain within viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'A good day starts with clarity.' }),
  ).toBeVisible();
  await page.screenshot({ path: '/tmp/schoolwell-mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await page.getByRole('link', { name: 'Students', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Student directory', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.getByRole('link', { name: 'Aarav Sharma', exact: true }).click();
  await page.getByRole('tab', { name: 'Fees', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Installment schedule' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});
test('all routes render and desktop dashboard can be reviewed', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  for (const path of [
    '/',
    '/students',
    '/classes',
    '/attendance',
    '/fees',
    '/academics',
    '/notifications',
    '/settings',
  ]) {
    await page.goto(path);
    await expect(page.locator('main h1')).toBeVisible();
    if (path === '/notifications')
      await expect(page.getByRole('tab')).toHaveText(['Overview', 'Compose Notice', 'History']);
    else
      await expect(page.locator('body')).not.toContainText(
        /\b(demo|fictional|simulated|simulation|prototype)\b/i,
      );
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  }
  await page.goto('/');
  await expect(page.locator('.sidebar')).toHaveCSS('background-color', 'rgb(18, 55, 59)');
  await expect(page.locator('.topbar')).toHaveCSS('background-color', 'rgb(25, 73, 77)');
  await page.waitForTimeout(800);
  await page.screenshot({ path: '/tmp/schoolwell-dashboard.png', fullPage: true });
  expect(errors).toEqual([]);
});

test('current date defaults follow the India calendar and advance on a day change', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByLabel('Dashboard date')).toHaveValue('2026-10-11');
  await page.goto('/attendance');
  await expect(page.getByLabel('Attendance date', { exact: true })).toHaveValue('2026-10-11');
  await page.goto('/notifications?tab=Overview');
  await expect(page.getByLabel('Notification date')).toHaveValue('2026-10-11');
  await page.goto('/settings');
  await expect(page.locator('.detail-list')).toContainText('11 Oct 2026');
  await page.goto('/');
  await expect(page.getByLabel('Dashboard date')).toHaveValue('2026-10-11');
  await page.clock.setFixedTime(new Date('2026-10-11T18:31:00Z'));
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByLabel('Dashboard date')).toHaveValue('2026-10-12');
  await expect(
    page.locator('.stat-card').filter({ hasText: 'Student attending today' }),
  ).toContainText('122');
  await page.getByLabel('Dashboard date').fill('2026-10-09');
  await page.clock.setFixedTime(new Date('2026-10-12T18:31:00Z'));
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByLabel('Dashboard date')).toHaveValue('2026-10-09');
});

test('existing browser data keeps edits while today receives presentation attendance', async ({
  page,
}) => {
  const saved = createSeed('2026-10-10');
  saved.attendance.find((r) => r.enrollmentId === 'enr-001' && r.date === '2026-10-10')!.status =
    'absent';
  await page.addInitScript(
    ({ key, value }) => {
      if (!localStorage.getItem(key)) localStorage.setItem(key, value);
    },
    { key: STORAGE_KEY, value: JSON.stringify(saved) },
  );
  await page.goto('/');
  await expect(page.getByLabel('Dashboard date')).toHaveValue('2026-10-11');
  await expect(
    page.locator('.stat-card').filter({ hasText: 'Student attending today' }),
  ).toContainText('122');
  await page.goto('/attendance?date=2026-10-10');
  await expect(
    page
      .getByRole('group', { name: 'Aarav Sharma attendance' })
      .getByRole('button', { name: 'Absent', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
});
