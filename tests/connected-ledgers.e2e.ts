import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { createSeed } from '../src/mocks/seed';
import { STORAGE_KEY } from '../src/lib/config';
import { saveStaffMember } from '../src/lib/staffStructure';
import { defaultStaffPayroll } from '../src/lib/settings';
import { saveStaffAttendance } from '../src/lib/staffAttendance';
import { saveFeePlan } from '../src/lib/feePlans';
import { roster } from '../src/lib/selectors';
import type { DemoState } from '../src/types/domain';
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-14T06:30:00Z'));
});
async function load(page: Page, state: DemoState) {
  await page.addInitScript(
    ({ key, state }) => {
      if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(state));
    },
    { key: STORAGE_KEY, state },
  );
}
async function audit(page: Page) {
  const result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(
    result.violations.map((v) => ({ id: v.id, targets: v.nodes.map((n) => n.target) })),
  ).toEqual([]);
}

test('custom student fee plan, partial payment, receipt facts and current template persist', async ({
  page,
}, info) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/settings?tab=Templates');
  await expect(page.locator('.template-option')).toHaveCount(6);
  await page.getByRole('button', { name: 'Ribbon Fee Receipt template', exact: true }).click();
  await page.getByLabel('Template accent color').fill('#934423');
  await page.getByRole('button', { name: 'Use this template', exact: true }).click();
  await page.goto('/students');
  await page.getByRole('button', { name: 'Add student', exact: true }).click();
  for (const [label, value] of [
    ['Student name', 'Ledger Student'],
    ['Date of birth', '2015-03-15'],
    ['Guardian name', 'Guardian Test'],
    ['Parent mobile (optional)', '9876543210'],
  ])
    await page.getByLabel(label, { exact: true }).fill(value);
  await page.getByRole('radio', { name: 'Installments', exact: true }).check();
  await page.getByLabel('Total Fee', { exact: true }).fill('24000');
  await page.getByLabel('Installment 1 amount').fill('6000');
  await page.getByLabel('Installment 1 due date').fill('2026-04-10');
  for (const [n, amount, date] of [
    [2, '8000', '2026-10-18'],
    [3, '10000', '2027-01-10'],
  ] as const) {
    await page.getByRole('button', { name: 'Add Installment', exact: true }).click();
    await page.getByLabel(`Installment ${n} amount`).fill(amount);
    await page.getByLabel(`Installment ${n} due date`).fill(date);
  }
  await expect(page.locator('.fee-plan-total')).toContainText('₹24,000');
  await audit(page);
  await page.getByRole('button', { name: 'Save student', exact: true }).click();
  await page.getByPlaceholder('Search name or admission number…').fill('Ledger Student');
  await page.getByRole('link', { name: 'Open Ledger Student', exact: true }).click();
  await page.getByRole('tab', { name: 'Fees', exact: true }).click();
  await expect(
    page
      .locator('section')
      .filter({ has: page.getByRole('heading', { name: 'Installment schedule', exact: true }) }),
  ).toContainText('₹10,000');
  await page.getByRole('button', { name: 'Record payment', exact: true }).click();
  await page.getByLabel('Payment amount').fill('2000');
  await page.getByLabel('Payment method').selectOption('Card');
  await page.getByRole('button', { name: 'Confirm payment', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Payment Successful' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Download Fee Receipt' })).toBeEnabled();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download Fee Receipt' }).click(),
  ]);
  await download.saveAs(info.outputPath('fee-receipt.pdf'));
  const snapshot = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!).payments.at(-1).document,
    STORAGE_KEY,
  );
  expect(snapshot).not.toHaveProperty('template');
  expect(snapshot.amount).toBe(200000);
  await page.context().addInitScript(() => {
    window.print = () => {
      document.documentElement.dataset.printInvoked = 'yes';
    };
  });
  const [popup] = await Promise.all([
    page.waitForEvent('popup'),
    page.getByRole('button', { name: 'Print Fee Receipt', exact: true }).click(),
  ]);
  await expect(popup.locator('img')).toBeVisible();
  await expect(popup.locator('html')).toHaveAttribute('data-print-invoked', 'yes');
  await popup.close();
  await page.screenshot({ path: info.outputPath('fee-receipt.png'), fullPage: true });
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(page.locator('.stat-value').filter({ hasText: '₹22,000' })).toBeVisible();
  await page.reload();
  await expect(page.locator('.stat-value').filter({ hasText: '₹22,000' })).toBeVisible();
  await page.goto('/settings?tab=Templates');
  await page.getByRole('button', { name: 'Minimal Fee Receipt template', exact: true }).click();
  await page.getByRole('button', { name: 'Use this template', exact: true }).click();
  const frozen = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!).payments.at(-1).document,
    STORAGE_KEY,
  );
  expect(frozen).toEqual(snapshot);
  expect(errors).toEqual([]);
});

test('attendance leaves drive salary payment, PDF slip, history and cash totals', async ({
  page,
}, info) => {
  let state = saveStaffMember(createSeed('2026-10-14'), defaultStaffPayroll, {
    name: 'Neha Ledger',
    designation: 'Teacher',
    departmentId: 'department-academics',
    email: 'neha@example.com',
    phone: '9876543210',
    joinedOn: '2026-01-01',
    status: 'active',
    isTeachingStaff: true,
    qualification: 'B.Ed',
    salary: { effectiveFrom: '2026-01', basic: 3800000, allowance: 0, bonus: 0, deduction: 0 },
  });
  const member = state.staffMembers![0];
  for (const [date, status] of [
    ['2026-10-06', 'absent'],
    ['2026-10-07', 'half-day'],
    ['2026-10-08', 'late'],
  ] as const)
    state = saveStaffAttendance(state, defaultStaffPayroll, date, { [member.id]: status });
  await load(page, state);
  await page.goto(`/staff?tab=Salary&staff=${member.id}`);
  const row = page.locator('.staff-payroll-table tbody tr');
  await expect(row).toContainText('1.5 leaves');
  await expect(row).toContainText('₹1,838.71');
  await expect(row).toContainText('₹36,161.29');
  await page
    .getByRole('button', { name: 'Record Salary Payment Neha Ledger', exact: true })
    .click();
  await page.getByLabel('Salary payment mode').selectOption('UPI');
  await page.getByRole('button', { name: 'Confirm Payment', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Salary Payment Successful' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Download Salary Slip' })).toBeEnabled();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download Salary Slip' }).click(),
  ]);
  await download.saveAs(info.outputPath('salary-slip.pdf'));
  await page.screenshot({ path: info.outputPath('salary-slip.png'), fullPage: true });
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(row).toContainText('Paid');
  await expect(
    page.getByRole('button', { name: 'Record Salary Payment Neha Ledger', exact: true }),
  ).toHaveCount(0);
  await expect(
    page
      .locator('section')
      .filter({ has: page.getByRole('heading', { name: 'Salary payment history', exact: true }) }),
  ).toContainText('UPI');
  await page.reload();
  await expect(row).toContainText('Paid');
  await page.goto(`/staff?tab=Attendance&staff=${member.id}&date=2026-10-06`);
  await page
    .getByRole('group', { name: 'Neha Ledger attendance', exact: true })
    .getByRole('button', { name: 'Present', exact: true })
    .click();
  await page.getByRole('button', { name: 'Save staff attendance', exact: true }).click();
  await page.goto(`/fees?tab=Salary+Expenses&staff=${member.id}`);
  await expect(row).toContainText('1.5 leaves');
  await expect(row).toContainText('₹36,161.29');
  await page.goto('/fees');
  await expect(
    page.locator('.finance-summary .stat-card').filter({ hasText: 'Salary Expenses' }),
  ).toContainText('₹36,161.29');
});

test('teacher profile uses shared details and actual document uploads without academic placeholders', async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/teachers');
  await page.getByRole('link', { name: /Aditya Sethi/ }).click();
  await expect(page.getByRole('tab')).toHaveText(['Overview', 'Documents']);
  for (const label of [
    'Assigned Classes',
    'Students Covered',
    "Today's Classes",
    'Timetable',
    'Academic Activity',
  ])
    await expect(page.getByText(label, { exact: true })).toHaveCount(0);
  await audit(page);
  await page.getByRole('tab', { name: 'Documents', exact: true }).click();
  await page.getByLabel('Document category').selectOption('Degree / marksheets');
  await page.getByLabel('Upload document').setInputFiles({
    name: 'degree.png',
    mimeType: 'image/png',
    buffer: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j3XkAAAAASUVORK5CYII=',
      'base64',
    ),
  });
  await expect(page.getByRole('region', { name: 'Uploaded documents' })).toContainText(
    'degree.png',
  );
  await page.reload();
  await expect(page.getByRole('region', { name: 'Uploaded documents' })).toContainText(
    'degree.png',
  );
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download degree.png', exact: true }).click(),
  ]);
  expect(download.suggestedFilename()).toBe('degree.png');
  await page.getByRole('button', { name: 'degree.png', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('button', { name: 'Delete degree.png', exact: true }).click();
  await page.getByRole('button', { name: 'Delete document', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Uploaded documents' })).toHaveCount(0);
  await page.getByRole('tab', { name: 'Overview', exact: true }).click();
  await page.getByRole('link', { name: 'View in Staff & HR →', exact: true }).click();
  await expect(page.getByRole('tab')).toHaveText(['All Staff', 'Attendance', 'Leave']);
  await page.screenshot({ path: info.outputPath('staff-directory.png'), fullPage: true });
  expect(errors).toEqual([]);
});

test('installment alerts review the actual amount and cancel after settlement', async ({
  page,
}) => {
  let state = createSeed('2026-10-14');
  const row = roster(state)[0];
  state.students.find((s) => s.id === row.student.id)!.guardian.contact = '9876543210';
  state = { ...state, obligations: [], payments: [] };
  state = saveFeePlan(state, row.enrollment.id, {
    kind: 'Installments',
    totalFee: 2400000,
    installments: [
      { amount: 600000, dueDate: '2026-04-10' },
      { amount: 800000, dueDate: '2026-10-12' },
      { amount: 1000000, dueDate: '2026-10-18' },
    ],
  });
  await load(page, state);
  await page.goto('/notifications');
  const card = page.locator('.communication-stat').filter({ hasText: 'Fee Installments Overdue' });
  await expect(card.locator('strong')).toHaveText('1');
  await card.click();
  const queue = page.getByRole('region', { name: 'Notification queue', exact: true });
  await expect(queue.getByRole('row')).toHaveCount(3);
  await expect(queue).toContainText('₹6,000');
  await expect(queue).toContainText('₹8,000');
  await queue
    .getByRole('button', { name: /^Review / })
    .first()
    .click();
  await expect(page.getByRole('dialog')).toContainText('₹6,000');
  await page.getByRole('button', { name: 'Confirm demo send', exact: true }).click();
  await page.goto(`/students/${row.student.id}?tab=fees`);
  await page.getByRole('button', { name: 'Record payment', exact: true }).click();
  await page.getByLabel('Payment amount').fill('14000');
  await page.getByRole('button', { name: 'Confirm payment', exact: true }).click();
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await page.goto('/notifications');
  await page.locator('.communication-stat').filter({ hasText: 'Fee Installments Due' }).click();
  await expect(queue).toContainText('₹10,000');
  await expect(queue).not.toContainText('₹8,000');
  await expect(queue).not.toContainText('₹6,000');
  await page.getByRole('button', { name: 'Send All', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('₹10,000');
  await page.getByRole('button', { name: 'Confirm demo send', exact: true }).click();
});

test('new profile, HR tabs and both PNG galleries fit mobile and pass accessibility checks', async ({
  page,
}, info) => {
  test.setTimeout(120000);
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const route of [
      '/teachers/teacher-2',
      '/staff?tab=All+Staff',
      '/staff?tab=Leave',
      '/staff?tab=Salary',
      '/settings?tab=Templates',
    ]) {
      await page.goto(route);
      await expect(page.locator('main')).toBeVisible();
      await audit(page);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      if (route.includes('Templates')) {
        await expect(page.locator('.template-option img')).toHaveCount(6);
        await page.getByRole('tab', { name: 'Salary Slip', exact: true }).click();
        await expect(page.locator('.template-option img')).toHaveCount(6);
        await audit(page);
      }
      await page.screenshot({
        path: info.outputPath(`new-${width}-${route.replace(/[^a-zA-Z0-9]/g, '_')}.png`),
        fullPage: true,
      });
    }
  }
});
