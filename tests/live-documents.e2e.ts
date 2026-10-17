import { test, expect } from '@playwright/test';
import { createSeed } from '../src/mocks/seed';
import { saveStaffMember } from '../src/lib/staffStructure';
import { defaultStaffPayroll } from '../src/lib/settings';
import { recordStudentPayment, recordSalaryPayment } from '../src/lib/financeTransactions';
import { feeReceiptFor, salarySlipFor, documentTemplatesFor } from '../src/lib/documentData';
import { encodeSchoolStorage } from '../src/lib/schoolStorage';
import { STORAGE_KEY } from '../src/lib/config';

test('legacy receipts and salary slips use current artwork and template while storage retains facts only', async ({
  page,
}, info) => {
  test.setTimeout(120000);
  let state = saveStaffMember(createSeed('2026-10-15'), defaultStaffPayroll, {
    name: 'Live Branding Staff',
    designation: 'Helper',
    departmentId: 'department-support',
    phone: '',
    email: '',
    status: 'active',
    joinedOn: '2026-04-01',
    salary: { effectiveFrom: '2026-04', basic: 3800000, allowance: 0, bonus: 0, deduction: 0 },
  });
  const member = state.staffMembers!.at(-1)!;
  state = recordStudentPayment(state, {
    enrollmentId: 'enr-001',
    amount: 100000,
    date: '2026-10-15',
    method: 'Cash',
    reference: 'LIVE-FEE',
  });
  state = recordSalaryPayment(state, {
    staffId: member.id,
    month: '2026-10',
    date: '2026-10-15',
    method: 'Bank',
    reference: 'LIVE-SALARY',
  });
  const fee = state.payments.at(-1)!,
    salary = state.salaryPayments![0];
  // A real pre-update cache: each old payment contains a complete frozen presentation.
  fee.document = feeReceiptFor(state, fee);
  salary.document = salarySlipFor(state, salary);
  state.documentTemplates = documentTemplatesFor(state);
  await page.addInitScript(
    ({ key, raw }) => {
      if (!localStorage.getItem(key)) localStorage.setItem(key, raw);
    },
    { key: STORAGE_KEY, raw: encodeSchoolStorage(state) },
  );
  await page.goto('/settings?tab=Templates');
  await expect(page.getByLabel('Import Header', { exact: true })).toBeVisible();
  const migrated = await page.evaluate(async (key) => {
    const { decodeSchoolStorage } = await import('/src/lib/schoolStorage.ts');
    return decodeSchoolStorage(localStorage.getItem(key)!);
  }, STORAGE_KEY);
  expect(migrated.payments.at(-1).document).not.toHaveProperty('branding');
  expect(migrated.salaryPayments[0].document).not.toHaveProperty('template');
  const financialFacts = JSON.stringify({
    payments: migrated.payments,
    salaries: migrated.salaryPayments,
  });
  const artwork = await page.evaluate(() =>
    [
      ['School logo', '#b32b31', 200, 200],
      ['Header', '#224488', 2080, 280],
      ['Footer', '#558833', 2080, 220],
      ['Official signature', '#884422', 300, 100],
      ['School stamp', '#662288', 200, 200],
    ].map(([label, color, width, height]) => {
      const canvas = document.createElement('canvas');
      canvas.width = Number(width);
      canvas.height = Number(height);
      const c = canvas.getContext('2d')!;
      c.fillStyle = String(color);
      c.fillRect(0, 0, canvas.width, canvas.height);
      return { label: String(label), url: canvas.toDataURL('image/png') };
    }),
  );
  for (const asset of artwork) {
    await page.getByLabel(`Import ${asset.label}`, { exact: true }).setInputFiles({
      name: `${asset.label}.png`,
      mimeType: 'image/png',
      buffer: Buffer.from(asset.url.split(',')[1], 'base64'),
    });
    await expect(
      page.getByRole('img', { name: `${asset.label} artwork`, exact: true }),
    ).toHaveAttribute('src', asset.url);
  }
  await page.getByRole('button', { name: 'Ribbon Fee Receipt template', exact: true }).click();
  await page.getByLabel('Template accent color', { exact: true }).fill('#123456');
  await page.getByRole('button', { name: 'Use this template', exact: true }).click();
  await page.getByRole('tab', { name: 'Salary Slip', exact: true }).click();
  await page
    .getByRole('button', { name: 'Formal Frame Salary Slip template', exact: true })
    .click();
  await page.getByLabel('Template accent color', { exact: true }).fill('#654321');
  await page.getByRole('button', { name: 'Use this template', exact: true }).click();
  await page.reload();
  const current = await page.evaluate(async (key) => {
    const { repository } = await import('/src/lib/repository.ts');
    const { feeReceiptFor, salarySlipFor } = await import('/src/lib/documentData.ts');
    const { decodeSchoolStorage } = await import('/src/lib/schoolStorage.ts');
    const state = repository.getSnapshot();
    return {
      raw: decodeSchoolStorage(localStorage.getItem(key)!),
      fee: feeReceiptFor(state, state.payments.at(-1)!),
      salary: salarySlipFor(state, state.salaryPayments![0]),
    };
  }, STORAGE_KEY);
  expect(
    JSON.stringify({ payments: current.raw.payments, salaries: current.raw.salaryPayments }),
  ).toBe(financialFacts);
  for (const data of [current.fee, current.salary])
    for (const [key, label] of [
      ['header', 'Header'],
      ['footer', 'Footer'],
      ['signature', 'Official signature'],
      ['stamp', 'School stamp'],
      ['logo', 'School logo'],
    ])
      expect(data.branding[key]).toBe(artwork.find((asset) => asset.label === label)!.url);
  expect(current.fee.template).toMatchObject({ templateId: 'ribbon', accent: '#123456' });
  expect(current.salary.template).toMatchObject({ templateId: 'frame', accent: '#654321' });
  await page.goto('/fees?tab=Student+Fees');
  await page
    .getByLabel('Search student or admission number…', { exact: true })
    .fill('WBA-2026-0001');
  await page.getByRole('button', { name: 'View receipts for Aarav Sharma', exact: true }).click();
  await page
    .getByRole('button', { name: `View receipt ${fee.receiptNumber}`, exact: true })
    .click();
  await expect(page.getByAltText(/Fee Receipt preview/)).toBeVisible();
  const headerPixel = async () =>
    page.getByAltText(/(?:Fee Receipt|Salary Slip) preview/).evaluate((element) => {
      const image = element as HTMLImageElement;
      const c = document.createElement('canvas');
      c.width = image.naturalWidth;
      c.height = image.naturalHeight;
      const context = c.getContext('2d')!;
      context.drawImage(image, 0, 0);
      return [
        ...context.getImageData(
          Math.round((140 * c.width) / 1200),
          Math.round((102 * c.width) / 1200),
          1,
          1,
        ).data,
      ];
    });
  expect(await headerPixel()).toEqual([34, 68, 136, 255]);
  await page.screenshot({ path: info.outputPath('existing-fee-live-template.png') });
  await page.goto('/fees?tab=Salary+Expenses&month=2026-10');
  await page.getByLabel('Search staff name or designation…', { exact: true }).fill(member.name);
  await page.getByRole('button', { name: `View salary slip ${member.name}`, exact: true }).click();
  await expect(page.getByAltText(/Salary Slip preview/)).toBeVisible();
  expect(await headerPixel()).toEqual([34, 68, 136, 255]);
  await page.screenshot({ path: info.outputPath('existing-salary-live-template.png') });
  await expect(page.getByRole('dialog')).toContainText(salary.slipNumber);
});

test('a full browser cache does not discard records when old presentation copies cannot be migrated', async ({
  page,
}) => {
  const state = createSeed('2026-10-15');
  state.school.name = 'Saved School with Full Storage';
  const payment = state.payments[0];
  payment.document = feeReceiptFor(state, payment);
  const raw = encodeSchoolStorage(state);
  await page.addInitScript(
    ({ key, raw }) => {
      const write = Storage.prototype.setItem;
      write.call(localStorage, key, raw);
      Storage.prototype.setItem = function (name, value) {
        if (this === localStorage && name === key)
          throw new DOMException('Storage is full', 'QuotaExceededError');
        write.call(this, name, value);
      };
    },
    { key: STORAGE_KEY, raw },
  );
  await page.goto('/fees?tab=Student+Fees');
  const loaded = await page.evaluate(async (key) => {
    const { repository } = await import('/src/lib/repository.ts');
    return { state: repository.getSnapshot(), raw: localStorage.getItem(key) };
  }, STORAGE_KEY);
  expect(loaded.state.school.name).toBe(state.school.name);
  expect(loaded.state.payments).toHaveLength(state.payments.length);
  expect(loaded.state.payments[0]).toMatchObject({ id: payment.id, amount: payment.amount });
  expect(loaded.state.payments[0].document).not.toHaveProperty('branding');
  expect(loaded.raw).toBe(raw);
});
