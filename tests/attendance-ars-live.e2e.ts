import { test, expect } from '@playwright/test';
test('a missed punch opens ARS automatically and submission permits the next punch before approval', async ({
  page,
  context,
}) => {
  test.setTimeout(60000);
  page.setDefaultTimeout(15000);
  await page.setViewportSize({ width: 390, height: 844 });
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({ latitude: 26.9, longitude: 75.8, accuracy: 5 });
  await page.goto('/');
  await page.getByLabel('Email', { exact: true }).fill('ars-mobile@example.test');
  await page.getByLabel('Password', { exact: true }).fill('ARS browser fixture passphrase 2026!');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.locator('.app-shell')).toBeVisible();
  await expect(page).toHaveURL(/\/staff\/punch$/);
  const dialog = page.getByRole('dialog', { name: 'Attendance correction (ARS)', exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('Invalid');
  await expect(dialog).toContainText('09:00 am');
  await dialog.getByLabel('ARS type').selectOption('first-half');
  await dialog.getByLabel('ARS reason').selectOption('forgot-out');
  const submit = dialog.getByRole('button', { name: 'Submit ARS', exact: true });
  await expect(submit).toBeInViewport({ ratio: 1 });
  await page.screenshot({
    path: '/tmp/calendar-missed-punch-modal.png',
    fullPage: true,
    animations: 'disabled',
  });
  await submit.click();
  await expect(dialog).toHaveCount(0);
  await page.getByRole('button', { name: 'Punch in', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Punch out', exact: true })).toBeEnabled();
  await page.goto('/staff/self?view=requests');
  await expect(page.getByRole('tab', { name: 'Pending (1)', exact: true })).toBeVisible();
  await expect(
    page.getByRole('region', { name: 'Attendance requests', exact: true }),
  ).toContainText('First-Half');
  await page.getByRole('tab', { name: 'Attendance', exact: true }).click();
  const calendar = page.getByRole('region', { name: 'My attendance calendar' });
  await expect(calendar.getByLabel('Attendance legend')).toHaveText(
    'LateOn leaveAbsentHalf daySchool holidayInvalid',
  );
  await expect(calendar.locator('.hr-calendar-day').filter({ hasText: 'On duty' })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
    true,
  );
  await page.screenshot({
    path: '/tmp/calendar-mobile-pending.png',
    fullPage: true,
    animations: 'disabled',
  });
  await page.getByRole('button', { name: 'Request leave', exact: true }).click();
  const leaveDialog = page.getByRole('dialog', { name: 'Request leave', exact: true });
  const future = new Date();
  future.setUTCDate(future.getUTCDate() + 2);
  const iso = future.toISOString().slice(0, 10);
  const display = iso.split('-').reverse().join('-');
  await leaveDialog.getByLabel('From', { exact: true }).fill(display);
  await leaveDialog.getByLabel('Through', { exact: true }).fill(display);
  await leaveDialog.getByLabel('Reason', { exact: true }).fill('Future appointment');
  await leaveDialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(leaveDialog).toHaveCount(0);
  await page.getByRole('tab', { name: 'Attendance', exact: true }).click();
  await page.getByRole('button', { name: new RegExp(`${display}:.*leave requested`) }).click();
  const cancellation = page.getByRole('dialog', { name: 'Cancel leave request?', exact: true });
  await expect(cancellation).toContainText('Future appointment');
  await cancellation.getByRole('button', { name: 'Cancel leave request', exact: true }).click();
  await expect(cancellation).toHaveCount(0);
  await expect(page.getByRole('button', { name: /leave requested/ })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('button', { name: /leave requested/ })).toHaveCount(0);
});
