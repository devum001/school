import { test, expect } from '@playwright/test';
test('demo staff salary edits and payment records remain local and survive reload', async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date('2026-10-13T06:30:00Z'));
  const apiRequests: string[] = [];
  page.on('request', (r) => {
    if (r.url().includes('/api/v1/')) apiRequests.push(r.url());
  });
  await page.goto('/settings?tab=Staff+%26+Payroll');
  await page.getByRole('button', { name: 'Academics', exact: true }).click();
  await page.getByRole('button', { name: 'Edit staff Aditya Sethi', exact: true }).click();
  await page.getByLabel('Salary effective from').fill('2026-01');
  await page.getByLabel('Basic Salary (₹)', { exact: true }).fill('31000');
  await page.getByLabel('Allowance (₹)', { exact: true }).fill('0');
  await page.getByLabel('Bonus (₹)', { exact: true }).fill('0');
  await page.getByLabel('Deduction (₹)', { exact: true }).fill('0');
  await page.getByRole('button', { name: 'Save staff', exact: true }).click();
  await page.goto('/staff?tab=Salary');
  const row = page.locator('.staff-payroll-table tbody tr').filter({ hasText: 'Aditya Sethi' });
  await expect(row).toContainText('₹31,000');
  await row
    .getByRole('button', { name: 'Record Salary Payment Aditya Sethi', exact: true })
    .click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Confirm Payment', exact: true })
    .click();
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(row).toContainText('Paid');
  await page.reload();
  await expect(row).toContainText('Paid');
  expect(apiRequests).toEqual([]);
});
