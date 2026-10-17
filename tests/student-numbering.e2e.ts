import { test, expect } from '@playwright/test';
import { createSeed } from '../src/mocks/seed';
import { STORAGE_KEY } from '../src/lib/config';

test('student numbering, address, amount entry and document upload remain consistent', async ({
  page,
}, info) => {
  test.setTimeout(90000);
  const state = createSeed('2026-10-15');
  state.obligations = state.obligations.map((item) =>
    item.enrollmentId === 'enr-001' ? { ...item, adjustment: -100000 } : item,
  );
  await page.addInitScript(
    ({ state, key }) => {
      if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(state));
    },
    { state, key: STORAGE_KEY },
  );
  await page.goto('/students');
  await page.getByRole('button', { name: 'Add student', exact: true }).click();
  const dialog = page.getByRole('dialog');
  const admission = dialog.getByLabel('Admission number', { exact: true });
  await expect(admission).toHaveAttribute('readonly', '');
  const admissionNumber = await admission.inputValue();
  expect(admissionNumber).toMatch(/-2026-0145$/);
  await dialog.getByLabel('Student name', { exact: true }).fill('Aaa Numbering Student');
  await expect(dialog.getByLabel('Roll number', { exact: true })).toHaveValue('1');
  await dialog.getByLabel('Date of birth', { exact: true }).fill('2015-04-01');
  await dialog.getByLabel('Guardian name', { exact: true }).fill('Test Guardian');
  const address = dialog.getByLabel('Address (optional)', { exact: true });
  await address.fill('12 School Road, Jaipur');
  await address.evaluate((element) =>
    element.scrollIntoView({ block: 'center', behavior: 'instant' }),
  );
  const addressStyle = await address.evaluate((element) => {
    const css = getComputedStyle(element);
    return {
      border: parseFloat(css.borderTopWidth),
      height: element.getBoundingClientRect().height,
    };
  });
  expect(addressStyle.border).toBe(1);
  expect(addressStyle.height).toBeGreaterThanOrEqual(88);
  await page.screenshot({ path: info.outputPath('student-address.png') });
  const fee = dialog.getByLabel('Total Fee', { exact: true });
  await fee.fill('9000');
  await fee.press('ArrowDown');
  await fee.press('ArrowUp');
  await fee.hover();
  await page.mouse.wheel(0, 300);
  await expect(fee).toHaveValue('9000');
  await fee.fill('9000.50');
  await dialog.getByLabel('Fee due date').fill('2026-12-01');
  await dialog.getByRole('button', { name: 'Save student', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page.getByPlaceholder('Search name or admission number…').fill(admissionNumber);
  await page.getByRole('button', { name: 'Edit Aaa Numbering Student', exact: true }).click();
  await expect(page.getByLabel('Total Fee', { exact: true })).toHaveValue('9000.5');
  await expect(page.getByLabel('Address (optional)', { exact: true })).toHaveValue(
    '12 School Road, Jaipur',
  );
  await page.getByLabel('Student name', { exact: true }).fill('Zzz Numbering Student');
  await expect(page.getByLabel('Roll number', { exact: true })).toHaveValue('13');
  await page.getByRole('button', { name: 'Save student', exact: true }).click();
  await page.reload();
  await page.getByPlaceholder('Search name or admission number…').fill(admissionNumber);
  await page.getByRole('link', { name: 'Open Zzz Numbering Student', exact: true }).click();
  await expect(page.locator('.profile-hero')).toContainText('Roll no. 13');
  await page.getByRole('tab', { name: 'Documents', exact: true }).click();
  const categoryBox = await page.getByLabel('Document category', { exact: true }).boundingBox();
  const uploadBox = await page.locator('.document-upload-control').boundingBox();
  expect(
    Math.abs(categoryBox!.y + categoryBox!.height - uploadBox!.y - uploadBox!.height),
  ).toBeLessThan(2);
  await page.getByLabel('Upload document', { exact: true }).setInputFiles({
    name: 'identity.png',
    mimeType: 'image/png',
    buffer: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=',
      'base64',
    ),
  });
  await expect(page.getByRole('button', { name: 'identity.png', exact: true })).toBeVisible();
  await page.screenshot({ path: info.outputPath('document-upload-desktop.png') });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(page.getByLabel('Document category', { exact: true })).toBeVisible();
  await page.screenshot({ path: info.outputPath('document-upload-mobile.png') });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.goto('/students/stu-001?tab=fees');
  await expect(page.getByText(/Scholarship/i)).toHaveCount(0);
  await expect(page.locator('.stat-card').first()).toContainText('₹54,000');
  await page.setViewportSize({ width: 1440, height: 1050 });
  await page.goto('/students');
  await page.getByPlaceholder('Search name or admission number…').fill(admissionNumber);
  await page.getByRole('link', { name: 'Open Zzz Numbering Student', exact: true }).click();
  await page.getByRole('tab', { name: 'Fees', exact: true }).click();
  await page.getByRole('button', { name: 'Record payment', exact: true }).click();
  const payment = page.getByLabel('Payment amount', { exact: true });
  await payment.fill('9000');
  await payment.press('ArrowDown');
  await expect(payment).toHaveValue('9000');
  await page.getByRole('button', { name: 'Confirm payment', exact: true }).click();
  await expect(page.getByText('Payment Successful', { exact: true })).toBeVisible();
  await page.goto('/students');
  await page.getByPlaceholder('Search name or admission number…').fill(admissionNumber);
  await page.getByRole('link', { name: 'Open Zzz Numbering Student', exact: true }).click();
  await page.getByRole('tab', { name: 'Fees', exact: true }).click();
  await expect(page.locator('.stat-card').nth(2)).toContainText('₹0.5');
  await page.goto('/staff');
  await page.getByRole('button', { name: 'Add Staff', exact: true }).click();
  const salary = page.getByLabel('Basic Salary (₹)', { exact: true });
  await salary.fill('9000');
  await salary.press('ArrowDown');
  await expect(salary).toHaveValue('9000');
});
