import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile } from 'node:fs/promises';
import { createSeed } from '../src/mocks/seed';
import { STORAGE_KEY } from '../src/lib/config';
import { roster } from '../src/lib/selectors';
import { staffDirectory } from '../src/lib/staffStructure';
import { defaultStaffPayroll } from '../src/lib/settings';
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-14T06:30:00Z'));
});
async function audit(page: Page) {
  expect(
    (
      await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
    ).violations.map((v) => ({ id: v.id, targets: v.nodes.map((n) => n.target) })),
  ).toEqual([]);
}
test('dashboard focuses on attendance, follows prolonged leave and opens the pending absent queue directly', async ({
  page,
}, info) => {
  const state = createSeed('2026-10-14'),
    student = roster(state)[0],
    staff = staffDirectory(state, defaultStaffPayroll),
    days = ['2026-10-09', '2026-10-10', '2026-10-12', '2026-10-13', '2026-10-14'];
  state.attendance = state.attendance.filter((r) => r.enrollmentId !== student.enrollment.id);
  state.attendance.push(
    ...days.map((date) => ({
      schoolId: state.school.id,
      enrollmentId: student.enrollment.id,
      date,
      status: 'absent' as const,
    })),
  );
  state.staffAttendance = [
    ...days.map((date) => ({
      schoolId: state.school.id,
      staffId: staff[0].id,
      date,
      status: 'absent' as const,
    })),
    { schoolId: state.school.id, staffId: staff[1].id, date: '2026-10-14', status: 'present' },
  ];
  await page.addInitScript(
    ({ key, state }) => {
      if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(state));
    },
    { key: STORAGE_KEY, state },
  );
  await page.goto('/');
  await expect(page.locator('.context-strip')).toHaveCount(0);
  for (const title of ['Fees, in focus', 'Around the school', 'Finance Overview'])
    await expect(page.getByRole('heading', { name: title, exact: true })).toHaveCount(0);
  await expect(page.locator('.stats-grid .stat-card')).toHaveCount(4);
  await expect(
    page.locator('.stat-card').filter({ hasText: 'Staff attending today' }),
  ).toContainText('1');
  await expect(page.getByRole('region', { name: 'Students on prolonged leave' })).toContainText(
    student.student.name,
  );
  await expect(page.getByRole('region', { name: 'Teachers on prolonged leave' })).toContainText(
    staff[0].name,
  );
  await expect(page.getByRole('region', { name: 'Teachers on prolonged leave' })).toContainText(
    '5 days',
  );
  await page.locator('.stat-card').filter({ hasText: 'Staff attending today' }).click();
  await expect(page).toHaveURL(/attendance\/staff/);
  await expect(page.getByRole('tab', { name: 'Staff Attendance', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await page.goto('/');
  await page.getByRole('link', { name: 'Notify parents', exact: true }).click();
  await expect(page.getByLabel('Notification type')).toHaveValue('Student Absent');
  await expect(page.locator('#pending-alerts')).toBeFocused();
  const box = await page.locator('#pending-alerts').boundingBox();
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.y).toBeLessThan(200);
  await expect(page.getByRole('region', { name: 'Notification queue' })).toContainText(
    student.student.name,
  );
  await page.screenshot({ path: info.outputPath('direct-absence-queue.png'), fullPage: true });
  await audit(page);
});
test('both attendance tabs use register summaries and saving staff attendance updates counts and the activity log', async ({
  page,
}, info) => {
  await page.goto('/attendance');
  await expect(
    page.getByRole('tablist', { name: 'Attendance registers' }).getByRole('tab'),
  ).toHaveText(['Student Attendance', 'Staff Attendance']);
  await page.getByRole('tab', { name: 'Staff Attendance', exact: true }).click();
  await expect(page.locator('.attendance-summary > .panel')).toHaveCount(5);
  await page.getByRole('button', { name: 'Mark all present', exact: true }).click();
  await page
    .getByRole('group', { name: 'Aditya Sethi attendance', exact: true })
    .getByRole('button', { name: 'Absent', exact: true })
    .click();
  await page.getByRole('button', { name: 'Save staff attendance', exact: true }).click();
  await page.getByRole('tab', { name: 'Student Attendance', exact: true }).click();
  await expect(page.locator('.attendance-summary > .panel')).toHaveCount(5);
  await page.goto('/');
  await expect(
    page.locator('.stat-card').filter({ hasText: 'Staff attending today' }),
  ).toContainText('11');
  await page.goto('/settings?tab=Data+%26+Security');
  await page.getByLabel('Activity Module').selectOption('Attendance');
  await expect(page.getByRole('region', { name: 'Activity records' })).toContainText(
    'Updated staff attendance',
  );
  await page.reload();
  await expect(page.getByRole('region', { name: 'Activity records' })).toContainText(
    'Updated staff attendance',
  );
  await page.screenshot({ path: info.outputPath('saved-activity-log.png'), fullPage: true });
});
test('simple data security provides real Excel exports and safe backup, password and session previews', async ({
  page,
}, info) => {
  await page.goto('/settings?tab=Data+%26+Security');
  await expect(page.locator('.admin-settings-stack > section > .panel-heading h2')).toHaveText([
    'Backup & Restore',
    'Data Export',
    'Login & Session Security',
    'Activity Log',
  ]);
  await expect(page.getByRole('button', { name: 'Reset workspace data', exact: true })).toHaveCount(
    0,
  );
  await page.getByRole('switch', { name: 'Automatic Backup', exact: true }).check();
  await page.getByLabel('Backup Frequency').selectOption('Weekly');
  await page.getByRole('button', { name: 'Create Backup Now', exact: true }).click();
  await expect(page.getByText('Preview successful', { exact: true })).toBeVisible();
  const before = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!).students,
    STORAGE_KEY,
  );
  await page.getByRole('button', { name: 'Restore Backup', exact: true }).click();
  await page.getByRole('button', { name: 'Preview Restore', exact: true }).click();
  expect(
    await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).students, STORAGE_KEY),
  ).toEqual(before);
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Export Students Excel', exact: true }).click(),
  ]);
  await download.saveAs(info.outputPath('students.xlsx'));
  const bytes = await readFile(info.outputPath('students.xlsx'));
  expect(bytes.subarray(0, 2).toString()).toBe('PK');
  const [csv] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Export Attendance CSV', exact: true }).click(),
  ]);
  expect(csv.suggestedFilename()).toBe('attendance.csv');
  await page.getByRole('button', { name: 'Change Password', exact: true }).click();
  await page.getByLabel('Current password', { exact: true }).fill('current-demo');
  await page.getByLabel('New password', { exact: true }).fill('new-demo-password');
  await page.getByLabel('Confirm new password', { exact: true }).fill('different-password');
  await page.getByRole('button', { name: 'Preview Change', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('do not match');
  await page.getByLabel('Confirm new password', { exact: true }).fill('new-demo-password');
  await page.getByRole('button', { name: 'Preview Change', exact: true }).click();
  const saved = await page.evaluate((key) => localStorage.getItem(key)!, STORAGE_KEY);
  expect(saved).not.toContain('new-demo-password');
  await page.getByRole('button', { name: 'Logout All Devices', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm Logout', exact: true }).click();
  await expect(page.getByText('No active preview sessions.', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Backup Frequency')).toHaveValue('Weekly');
  await audit(page);
});
test('preferences save regional display and the default landing page while overview stays reachable', async ({
  page,
}) => {
  await page.goto('/settings?tab=Preferences');
  await expect(page.locator('.admin-settings-stack > section > .panel-heading h2')).toHaveText([
    'Regional & Display',
    'Default Context',
  ]);
  await page.getByLabel('Date Format', { exact: true }).selectOption('DD/MM/YYYY');
  await page.getByLabel('Time Format', { exact: true }).selectOption('24-hour');
  await page.getByLabel('Week Starts On', { exact: true }).selectOption('Sunday');
  await page.getByLabel('Default landing page', { exact: true }).selectOption('Students');
  await page.getByRole('button', { name: 'Save preferences', exact: true }).click();
  await page.reload();
  await expect(page.getByLabel('Date Format', { exact: true })).toHaveValue('DD/MM/YYYY');
  await page.goto('/');
  await expect(page).toHaveURL(/\/students$/);
  await page.getByRole('link', { name: 'Overview', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'A good day starts with clarity.', exact: true }),
  ).toBeVisible();
  await page.goto('/settings?tab=Preferences');
  await page.getByLabel('Language', { exact: true }).selectOption('Hindi');
  await page.getByRole('button', { name: 'Save preferences', exact: true }).click();
  await expect(page.getByRole('link', { name: 'विद्यार्थी', exact: true })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'hi');
  await audit(page);
});
test('updated overview, attendance registers and settings fit desktop and mobile', async ({
  page,
}, info) => {
  test.setTimeout(150000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const route of [
      '/',
      '/attendance',
      '/attendance/staff',
      '/fees',
      '/settings?tab=Data+%26+Security',
      '/settings?tab=Preferences',
    ]) {
      await page.goto(route);
      await page.getByRole('heading', { level: 1 }).waitFor();
      await audit(page);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        route,
      ).toBe(true);
      await page.screenshot({
        path: info.outputPath(`${width}-${route.replace(/[^a-z0-9]/gi, '_')}.png`),
        fullPage: true,
      });
    }
  }
  expect(errors).toEqual([]);
});
