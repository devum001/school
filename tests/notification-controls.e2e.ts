import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { createSeed } from '../src/mocks/seed';
import { communicationFor, reconcileCommunication } from '../src/lib/communication';
import { STORAGE_KEY } from '../src/lib/config';
import { defaultStaffPayroll } from '../src/lib/settings';
import { staffDirectory } from '../src/lib/staffStructure';

test.beforeEach(async ({ page }) => {
  test.setTimeout(90000);
  await page.clock.setFixedTime(new Date('2026-10-14T06:30:00Z'));
});

test('low attendance card opens sent history instead of an empty queue and removes Needs Action', async ({
  page,
}) => {
  const state = reconcileCommunication(createSeed('2026-10-14'), '2026-10-14');
  state.communication = communicationFor(state);
  state.communication.records = state.communication.records.map((record) =>
    record.event === 'Low Attendance'
      ? { ...record, status: 'Delivered', sentAt: '2026-10-14T05:00:00.000Z', attempts: 1 }
      : record,
  );
  const count = new Set(
    state.communication.records
      .filter((r) => r.event === 'Low Attendance' && r.date === '2026-10-14')
      .map((r) => r.recipient.enrollmentId),
  ).size;
  await page.addInitScript(
    ({ key, state }) => {
      if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(state));
    },
    { key: STORAGE_KEY, state },
  );
  await page.goto(
    '/notifications?tab=Overview&historyType=Event+%2F+Announcement&historyClass=class-5&historyChannel=Email&historyStatus=Failed',
  );
  await expect(page.getByRole('heading', { name: 'Needs Action', exact: true })).toHaveCount(0);
  const card = page.locator('.communication-stat').filter({ hasText: 'Low Attendance alerts' });
  await expect(card.locator('strong')).toHaveText(String(count));
  await card.click();
  await expect(page.getByRole('tab', { name: 'History', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(page.getByLabel('Type', { exact: true })).toHaveValue('Low Attendance');
  await expect(page.getByLabel('Status', { exact: true })).toHaveValue('');
  await expect(
    page.getByRole('region', { name: 'Notification history', exact: true }).locator('tbody tr'),
  ).toHaveCount(count);
});

test('pending low attendance opens the queue, sending updates the header bell and year details work', async ({
  page,
}, info) => {
  const state = createSeed('2026-10-14');
  state.students.forEach((student) => {
    student.guardian.contact = '+91 98765 01000';
  });
  await page.addInitScript(
    ({ key, state }) => {
      if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(state));
    },
    { key: STORAGE_KEY, state },
  );
  await page.goto('/notifications');
  await expect(page.locator('.global-search kbd')).toHaveCount(0);
  await page.getByRole('button', { name: 'Academic year details', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Academic Year', exact: true })).toContainText(
    state.academicYear.name,
  );
  await page.getByRole('link', { name: 'Academic year preferences', exact: true }).click();
  await expect(page.getByLabel('Default Academic Year')).toHaveValue(state.academicYear.id);
  await page.goto('/notifications');
  const bell = page.locator('.notification-bell');
  const before = Number((await bell.getAttribute('aria-label'))!.match(/\d+/)![0]);
  await bell.click();
  const dialog = page.getByRole('dialog', { name: 'Notifications', exact: true });
  await expect(
    dialog.getByRole('link').filter({ hasText: 'Low Attendance' }).first(),
  ).toBeVisible();
  await dialog.getByRole('link').filter({ hasText: 'Low Attendance' }).first().click();
  await expect(page.locator('#pending-alerts')).toBeFocused();
  const queue = page.getByRole('region', { name: 'Notification queue', exact: true });
  await expect(queue.locator('tbody tr').first()).toContainText('Low Attendance');
  await queue
    .getByRole('button', { name: /^Review / })
    .first()
    .click();
  await page.getByRole('button', { name: 'Confirm demo send', exact: true }).click();
  await expect(bell).toHaveAttribute('aria-label', `Notifications: ${before - 1} need attention`);
  await page.screenshot({
    path: info.outputPath('notification-header-desktop.png'),
    fullPage: true,
  });
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([]);
});

test('Staff Access combines department and name filters and Off survives reload', async ({
  page,
}, info) => {
  const state = createSeed('2026-10-14');
  const members = staffDirectory(state, defaultStaffPayroll);
  const accounts = defaultStaffPayroll.setup.departments.find((d) => d.name === 'Accounts')!;
  state.staffMembers = [
    {
      ...members[0],
      departmentId: accounts.id,
      designationId: undefined,
      designation: 'Accountant',
    },
  ];
  await page.addInitScript(
    ({ key, state }) => {
      if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(state));
    },
    { key: STORAGE_KEY, state },
  );
  await page.goto('/settings?tab=Roles+%26+Permissions');
  await page.getByLabel('Staff access department').selectOption(accounts.id);
  const rows = page
    .getByRole('region', { name: 'Staff login access', exact: true })
    .locator('tbody tr');
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText(members[0].name);
  await page.getByLabel('Search staff', { exact: true }).fill('no matching person');
  await expect(rows).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'No matching staff', exact: true })).toBeVisible();
  await page.getByLabel('Search staff', { exact: true }).fill('');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: info.outputPath('staff-access-mobile.png'), fullPage: true });
  await page.goto('/settings?tab=Data+%26+Security');
  await page.getByLabel('Auto logout after inactivity', { exact: true }).selectOption('0');
  await page.reload();
  await expect(page.getByLabel('Auto logout after inactivity', { exact: true })).toHaveValue('0');
});
