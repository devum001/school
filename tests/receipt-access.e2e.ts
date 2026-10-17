import { test, expect } from '@playwright/test';
import { createSeed } from '../src/mocks/seed';
import { recordStudentPayment } from '../src/lib/financeTransactions';
import { STORAGE_KEY } from '../src/lib/config';

test('Finance reopens legacy and saved receipts from each student row without saving PDFs or changing payments', async ({
  page,
}, info) => {
  test.setTimeout(90000);
  const state = recordStudentPayment(createSeed('2026-10-15'), {
    enrollmentId: 'enr-001',
    amount: 3600000,
    date: '2026-10-15',
    method: 'Cash',
    reference: 'BALANCE-FINAL',
  });
  const payment = state.payments.at(-1)!;
  await page.addInitScript(
    ({ key, state }) => {
      if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(state));
    },
    { key: STORAGE_KEY, state },
  );
  await page.goto('/fees?tab=Student+Fees');
  await page
    .getByLabel('Search student or admission number…', { exact: true })
    .fill('WBA-2026-0001');
  const row = page.locator('tbody tr');
  await expect(row).toHaveCount(1);
  await expect(row.getByRole('button', { name: 'Record payment', exact: true })).toBeDisabled();
  const receipts = row.getByRole('button', { name: 'View receipts for Aarav Sharma', exact: true });
  await expect(receipts).toBeEnabled();
  const recordBox = await row
      .getByRole('button', { name: 'Record payment', exact: true })
      .boundingBox(),
    receiptBox = await receipts.boundingBox();
  expect(receiptBox!.y).toBeGreaterThanOrEqual(recordBox!.y + recordBox!.height);
  const before = await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY);
  await receipts.click();
  await expect(page.getByRole('dialog', { name: 'Payment receipts', exact: true })).toContainText(
    '1st installment',
  );
  await expect(page.getByRole('dialog')).toContainText('2nd installment, 3rd installment');
  await page.screenshot({ path: info.outputPath('student-receipts.png') });
  await page.getByRole('button', { name: 'View receipt WBA-APR-1', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Fee Receipt', exact: true })).toBeVisible();
  await expect(page.getByAltText(/Fee Receipt preview/)).toBeVisible();
  await page.getByText('Document details', { exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('1st installment');
  await expect(page.getByRole('dialog')).toContainText('₹18,000');
  await expect(page.getByRole('button', { name: 'Print Fee Receipt', exact: true })).toBeEnabled();
  await expect(
    page.getByRole('button', { name: 'Download Fee Receipt', exact: true }),
  ).toBeEnabled();
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await page
    .getByRole('button', { name: `View receipt ${payment.receiptNumber}`, exact: true })
    .click();
  await expect(page.getByRole('dialog')).toContainText(payment.receiptNumber!);
  await expect(page.getByAltText(/Fee Receipt preview/)).toBeVisible();
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  expect(await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY)).toBe(before);
  await row
    .getByRole('button', { name: 'View installments for Aarav Sharma', exact: true })
    .click();
  await expect(page.getByRole('dialog')).toContainText('1st installment');
  await expect(page.getByRole('dialog')).not.toContainText('Term 1');
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await page.reload();
  await page
    .getByLabel('Search student or admission number…', { exact: true })
    .fill('WBA-2026-0001');
  await receipts.click();
  await expect(page.getByRole('dialog', { name: 'Payment receipts', exact: true })).toContainText(
    'BALANCE-FINAL',
  );
});
