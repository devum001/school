import { test, expect } from '@playwright/test';
import { createSeed } from '../src/mocks/seed';
import { saveFeePlan } from '../src/lib/feePlans';
import { recordStudentPayment } from '../src/lib/financeTransactions';
import { roster } from '../src/lib/selectors';
import { STORAGE_KEY } from '../src/lib/config';

test('Finance shows paid, part-paid and remaining installments; new receipt freezes its post-payment balance', async ({
  page,
}, info) => {
  test.setTimeout(90000);
  await page.clock.setFixedTime(new Date('2026-10-15T06:30:00Z'));
  const seed = createSeed('2026-10-15'),
    student = roster(seed)[0];
  let state = saveFeePlan({ ...seed, payments: [] }, student.enrollment.id, {
    kind: 'Installments',
    totalFee: 2400000,
    installments: [
      { amount: 600000, dueDate: '2026-04-10' },
      { amount: 800000, dueDate: '2026-07-10' },
      { amount: 1000000, dueDate: '2026-10-10' },
    ],
  });
  state = recordStudentPayment(state, {
    enrollmentId: student.enrollment.id,
    amount: 900000,
    date: '2026-10-15',
    method: 'Cash',
    reference: 'First partial payment',
  });
  await page.addInitScript(
    ({ key, state }) => {
      if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(state));
    },
    { key: STORAGE_KEY, state },
  );
  await page.goto('/fees?tab=Student+Fees');
  await page
    .getByLabel('Search student or admission number…', { exact: true })
    .fill(student.student.admissionNumber);
  const row = page
    .getByRole('row')
    .filter({ has: page.getByRole('link', { name: new RegExp(student.student.name) }) });
  await expect(row).toContainText('3 total');
  await expect(row).toContainText('1 paid · 2 remaining (1 part paid)');
  await expect(row).toContainText('₹15,000');
  await page
    .getByRole('button', { name: `View installments for ${student.student.name}`, exact: true })
    .click();
  const dialog = page.getByRole('dialog', { name: 'Fee installments', exact: true });
  await expect(dialog).toContainText('Total fee');
  await expect(dialog).toContainText('₹24,000');
  await expect(dialog).toContainText('₹9,000');
  await expect(dialog).toContainText('₹15,000');
  const installment = dialog.locator('tbody tr').nth(1);
  await expect(installment).toContainText('₹8,000');
  await expect(installment).toContainText('₹3,000');
  await expect(installment).toContainText('₹5,000');
  await expect(installment).toContainText('Part paid');
  await page.screenshot({
    path: info.outputPath('installment-details-desktop.png'),
    fullPage: true,
  });
  await dialog.getByRole('button', { name: 'Record payment', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Fee plan summary', exact: true })).toContainText(
    '1 paid · 2 remaining',
  );
  await page.getByLabel('Payment amount', { exact: true }).fill('5000');
  await page.getByRole('button', { name: 'Confirm payment', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Payment Successful', exact: true })).toBeVisible();
  await page.getByText('Document details', { exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Total paid after this payment');
  await expect(page.getByRole('dialog')).toContainText('₹14,000');
  await expect(page.getByRole('dialog')).toContainText('₹10,000');
  await expect(page.getByRole('dialog')).toContainText('3 total · 2 paid · 1 remaining');
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download Fee Receipt', exact: true }).click(),
  ]);
  await download.saveAs(info.outputPath('installment-fee-receipt.pdf'));
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(row).toContainText('2 paid · 1 remaining');
  await page.reload();
  await page
    .getByLabel('Search student or admission number…', { exact: true })
    .fill(student.student.admissionNumber);
  await expect(row).toContainText('2 paid · 1 remaining');
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByRole('button', { name: `View installments for ${student.student.name}`, exact: true })
    .click();
  await expect(dialog).toContainText('₹10,000');
  await page.screenshot({
    path: info.outputPath('installment-details-mobile.png'),
    fullPage: true,
  });
});
