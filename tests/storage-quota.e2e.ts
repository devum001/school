import { test, expect } from '@playwright/test';
import { createSeed } from '../src/mocks/seed';
import { STORAGE_KEY } from '../src/lib/config';
import { documentTemplatesFor } from '../src/lib/documentData';
import { recordStudentPayment } from '../src/lib/financeTransactions';
import { roster } from '../src/lib/selectors';

test('a near-full legacy school cache can save payments, retain artwork and reload without resetting records', async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.clock.setFixedTime(new Date('2026-10-15T06:30:00Z'));
  let state = createSeed('2026-10-15');
  state.documentTemplates = documentTemplatesFor(state);
  const row = roster(state)[0];
  // Existing receipts carry exact historical artwork, just like a school using imported images.
  state = recordStudentPayment(state, {
    enrollmentId: row.enrollment.id,
    amount: 10000,
    method: 'Cash',
    date: '2026-10-15',
    reference: 'Existing payment',
  });
  const legacy = JSON.stringify(state),
    initialCount = state.payments.length;
  await page.addInitScript(
    ({ key, legacy }) => {
      if (!localStorage.getItem(key)) localStorage.setItem(key, legacy);
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function (name, value) {
        // Reproduce a quota that cannot fit another full artwork snapshot.
        if (name === key && value.length > legacy.length + 5000)
          throw new DOMException('Quota exceeded', 'QuotaExceededError');
        return original.call(this, name, value);
      };
    },
    { key: STORAGE_KEY, legacy },
  );
  await page.goto(`/students/${row.student.id}?tab=fees`);
  await page.getByRole('button', { name: 'Record payment', exact: true }).click();
  await page.getByLabel('Payment amount', { exact: true }).fill('50');
  await page.getByRole('button', { name: 'Confirm payment', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Payment Successful', exact: true })).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Download Fee Receipt', exact: true }),
  ).toBeEnabled();
  const compact = await page.evaluate((key) => localStorage.getItem(key)!, STORAGE_KEY);
  expect(compact.length).toBeLessThan(legacy.length);
  expect(JSON.parse(compact).payments).toHaveLength(initialCount + 1);
  await page.reload();
  const restored = await page.evaluate(async () => {
    const { repository } = await import('/src/lib/repository.ts');
    const state = repository.getSnapshot();
    return {
      payments: state.payments.length,
      latestAmount: state.payments.at(-1)?.amount,
      historical: state.payments.find((p) => p.reference === 'Existing payment')?.document
        ?.branding,
      logo: state.documentTemplates?.branding?.logo,
    };
  });
  expect(restored.payments).toBe(initialCount + 1);
  expect(restored.latestAmount).toBe(5000);
  expect(restored.historical).toEqual(state.payments.at(-1)!.document!.branding);
  expect(restored.logo).toBe(state.documentTemplates!.branding!.logo);
  await page.getByRole('button', { name: 'Record payment', exact: true }).click();
  await page.getByLabel('Payment amount', { exact: true }).fill('25');
  await page.getByRole('button', { name: 'Confirm payment', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Payment Successful', exact: true })).toBeVisible();
});
