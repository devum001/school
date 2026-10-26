import { test, expect, type Page } from '@playwright/test';
async function request<T>(page: Page, path: string, method = 'GET', body?: unknown): Promise<T> {
  const response = await page.evaluate(
    async ({ path, method, body }) => {
      const base = 'http://127.0.0.1:3107/api/v1';
      const csrf =
        method === 'GET'
          ? null
          : await (await fetch(`${base}/auth/csrf`, { credentials: 'include' })).json();
      const result = await fetch(`${base}${path}`, {
        method,
        credentials: 'include',
        headers: {
          'content-type': 'application/json',
          ...(csrf ? { 'x-csrf-token': csrf.data.csrfToken } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      return { status: result.status, data: await result.json() };
    },
    { path, method, body },
  );
  expect(response.status, JSON.stringify(response.data.error)).toBeLessThan(300);
  return response.data.data;
}
test('owner configures fees in bulk, adds old dues, collects a partial payment and reviews the responsive ledger', async ({
  page,
}) => {
  test.setTimeout(120000);
  await page.goto('/settings');
  await page.getByLabel('Email', { exact: true }).fill('browser-owner@example.test');
  await page.getByLabel('Password', { exact: true }).fill('Browser fixture passphrase 2026!');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Sign out', exact: true })).toBeVisible();
  const auth = await request<{ memberships: { schoolId: string; schoolName: string }[] }>(
    page,
    '/auth/session',
  );
  const schoolId = auth.memberships.find((s) => s.schoolName === 'Browser Test School')!.schoolId,
    root = `/schools/${schoolId}`;
  const year = await request<{ id: string }>(page, `${root}/academic-years`, 'POST', {
    name: 'Fees 2026–27',
    start: '2026-04-01',
    end: '2027-03-31',
  });
  const status = await request<{ academicRevision: number }>(page, `${root}/onboarding`);
  await request(page, `${root}/academic-years/${year.id}/select`, 'POST', {
    revision: status.academicRevision,
  });
  await request(page, `${root}/academic-years/${year.id}/structure-batch`, 'POST', {
    kind: 'classes',
    rows: [{ name: '12', grade: '12', status: 'active' }],
  });
  const context = await request<{ classes: { id: string }[] }>(
    page,
    `${root}/academic-years/${year.id}/student-context`,
  );
  const classId = context.classes[0].id;
  // Use the real admission endpoint; class has no sections.
  for (let i = 1; i <= 2; i++)
    await request(page, `${root}/academic-years/${year.id}/students`, 'POST', {
      classId,
      cells: [
        `Fee Student ${i}`,
        `FEE-${i}`,
        '2010-01-01',
        'Guardian',
        'Parent',
        '9999999999',
        'City',
        String(i),
        '',
      ],
    });
  await page.goto(`/fees?year=${year.id}&tab=Student+Fees`);
  await expect(page.getByRole('heading', { name: 'Student fees', exact: true })).toBeVisible();
  await expect(page.getByText('Setup pending', { exact: true })).toHaveCount(2);
  await page.getByRole('button', { name: 'Select all matching students' }).click();
  await expect(page.getByText('2 selected', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Set up fees', exact: true }).click();
  let dialog = page.getByRole('dialog').last();
  await dialog.getByLabel('Base yearly fee (₹)', { exact: true }).fill('30000');
  await dialog.getByLabel('Concession (₹)', { exact: true }).fill('5000');
  await expect(dialog.getByLabel('Single balance')).toBeChecked();
  await expect(dialog.getByLabel('Number of installments')).toHaveCount(0);
  await dialog.getByLabel('Split into installments').check();
  await dialog.getByLabel('Number of installments').fill('3');
  await dialog.getByRole('button', { name: 'Review students', exact: true }).click();
  await expect(dialog.getByRole('columnheader', { name: 'Final fee' })).toBeVisible();
  await dialog.getByRole('button', { name: 'Save fee setup' }).click();
  await expect(dialog.getByText('Fees are ready')).toBeVisible();
  await dialog.getByRole('button', { name: 'Return to student fees' }).click();
  await page.getByRole('button', { name: 'Previous-year dues' }).click();
  dialog = page.getByRole('dialog').last();
  await dialog.getByLabel('Previous academic year label').fill('2025–26');
  await dialog.getByLabel('Period starts').fill('01-04-2025');
  await dialog.getByLabel('Period ends').fill('31-03-2026');
  await dialog.getByLabel('FEE-1 old dues').fill('8000');
  await dialog.getByRole('button', { name: 'Review balances' }).click();
  await dialog.getByRole('button', { name: 'Confirm opening balances' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const firstRow = page.getByRole('row').filter({ hasText: 'FEE-1' });
  await firstRow.getByRole('button', { name: 'Collect payment' }).click();
  dialog = page.getByRole('dialog').last();
  await dialog.getByLabel('Amount received (₹)').fill('10000');
  await page.route('**/fees/payments', async (route) => {
    if (route.request().method() === 'POST') {
      await route.fetch();
      await route.abort('failed');
    } else await route.continue();
  });
  await dialog.getByRole('button', { name: 'Record payment & issue receipt' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Receipt', exact: true })).toBeVisible();
  await page.unroute('**/fees/payments');
  await page.getByRole('button', { name: 'Receipt', exact: true }).click();
  await expect(
    page.getByRole('dialog').last().getByRole('button', { name: 'Download Fee Receipt' }),
  ).toBeVisible();
  const downloaded = page.waitForEvent('download');
  await page
    .getByRole('dialog')
    .last()
    .getByRole('button', { name: 'Download Fee Receipt' })
    .click();
  expect((await downloaded).suggestedFilename()).toMatch(/\.pdf$/);
  await page.getByRole('dialog').last().getByRole('button', { name: 'Close dialog' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(350);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: '/tmp/school-fees-mobile.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
    true,
  );
  await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 1440, height: 1050 });
  await page.goto(`/fees?year=${year.id}`);
  await expect(page.getByText('Net fees assigned', { exact: true })).toBeVisible();
  await expect(page.locator('.loading-overlay-layer')).toHaveCount(0);
  await page.screenshot({ path: '/tmp/school-fees-dashboard.png', fullPage: true });
  const roster = await request<{ items: { id: string; student: { id: string } }[] }>(
    page,
    `${root}/academic-years/${year.id}/student-roster`,
  );
  const pupil = roster.items[0];
  await request(page, `${root}/academic-years/${year.id}/learning/attendance`, 'PUT', {
    date: '2026-10-20',
    classId,
    sectionId: '',
    rows: roster.items.map((r) => ({
      enrollmentId: r.id,
      status: r.id === pupil.id ? 'late' : 'present',
      revision: 0,
    })),
  });
  await page.goto(`/students/${pupil.student.id}?year=${year.id}`);
  await expect(page.locator('.profile-hero')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Fee Student 1', exact: true })).toBeVisible();
  await expect(page.getByText('Student information', { exact: true })).toBeVisible();
  await page.getByRole('tab', { name: 'Attendance', exact: true }).click();
  await expect(page.locator('.calendar-day.late')).toHaveCount(1);
  await expect(page.getByText('100%', { exact: true })).toBeVisible();
  await page.getByRole('tab', { name: 'Fees', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Receipt', exact: true })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('tab', { name: 'Progress Report', exact: true }).click();
  await expect(page.getByText('No tests for this student yet', { exact: true })).toBeVisible();
  await page.getByRole('tab', { name: 'Documents', exact: true }).click();
  await page.getByLabel('Upload document', { exact: true }).setInputFiles({
    name: 'identity.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4\nLocal test document\n%%EOF'),
  });
  await expect(page.getByRole('button', { name: 'identity.pdf', exact: true })).toBeVisible();
  const documentDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download identity.pdf', exact: true }).click();
  expect((await documentDownload).suggestedFilename()).toBe('identity.pdf');
  await page.reload();
  await expect(page.getByRole('button', { name: 'identity.pdf', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Edit student', exact: true }).click();
  await page.getByLabel('Student name', { exact: true }).fill('Fee Student Updated');
  await page.getByRole('button', { name: 'Save student', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Fee Student Updated', exact: true }),
  ).toBeVisible();
  await page.getByRole('tab', { name: 'Overview', exact: true }).click();
  await expect(page.getByText('Student information', { exact: true })).toBeVisible();
  await expect(page.locator('.loading-overlay-layer')).toHaveCount(0);
  await page.screenshot({ path: '/tmp/school-profile-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('tab', { name: 'Attendance', exact: true }).click();
  await expect(page.locator('.calendar-day.late')).toHaveCount(1);
  await expect(page.getByText('100%', { exact: true })).toBeVisible();
  await page.screenshot({ path: '/tmp/school-profile-mobile.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
    true,
  );
});
test('Excel import recovers a lost confirmation response and shows committed students without resubmission', async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.goto('/settings');
  await page.getByLabel('Email', { exact: true }).fill('browser-owner@example.test');
  await page.getByLabel('Password', { exact: true }).fill('Browser fixture passphrase 2026!');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Sign out', exact: true })).toBeVisible();
  const auth = await request<{ memberships: { schoolId: string; schoolName: string }[] }>(
    page,
    '/auth/session',
  );
  const schoolId = auth.memberships.find((s) => s.schoolName === 'Browser Test School')!.schoolId,
    root = `/schools/${schoolId}`;
  const year = await request<{ id: string }>(page, `${root}/academic-years`, 'POST', {
    name: 'Import 2028–29',
    start: '2028-04-01',
    end: '2029-03-31',
  });
  const status = await request<{ academicRevision: number }>(page, `${root}/onboarding`);
  await request(page, `${root}/academic-years/${year.id}/select`, 'POST', {
    revision: status.academicRevision,
  });
  await request(page, `${root}/academic-years/${year.id}/structure-batch`, 'POST', {
    kind: 'classes',
    rows: [{ name: '10', grade: '10', status: 'active' }],
  });
  const context = await request<{ classes: { id: string }[] }>(
    page,
    `${root}/academic-years/${year.id}/student-context`,
  );
  await page.goto(
    `/settings?tab=Classes%2C+Sections+%26+Grades&classId=${context.classes[0].id}&section=students`,
  );
  await page.getByRole('button', { name: 'Import Excel (.xlsx)', exact: true }).click();
  const { studentWorkbook } = await import('../src/lib/xlsx');
  const { STUDENT_IMPORT_HEADERS } = await import('../src/lib/studentTemplate');
  const rows = Array.from({ length: 25 }, (_, i) => [
    `Import Student ${i + 1}`,
    `IMP-${i + 100}`,
    '01-01-2010',
    'Guardian',
    'Parent',
    '',
    '',
    String(i + 100),
    '',
    '10',
  ]);
  await page.getByLabel('Excel file (.xlsx)').setInputFiles({
    name: 'students.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: Buffer.from(await studentWorkbook([STUDENT_IMPORT_HEADERS, ...rows]).arrayBuffer()),
  });
  await page.getByRole('button', { name: 'Continue to Review', exact: true }).click();
  await page.getByRole('button', { name: 'Proceed to Submit', exact: true }).click();
  await page.route('**/imports/*/confirm', async (route) => {
    await route.fetch();
    await route.abort('failed');
  });
  await page.getByRole('button', { name: 'Import students', exact: true }).click();
  await expect(page.getByRole('button', { name: 'View Enrolled Students' })).toBeVisible();
  await page.getByRole('button', { name: 'View Enrolled Students' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText('Import Student 1', { exact: true })).toBeVisible();
  const roster = await request<{ total: number }>(
    page,
    `${root}/academic-years/${year.id}/student-roster`,
  );
  expect(roster.total).toBe(25);
});

test('school-wide draft applies defaults, autosaves exceptions, imports one worksheet and activates without stacked dialogs', async ({
  page,
}) => {
  test.setTimeout(120000);
  await page.goto('/settings');
  await page.getByLabel('Email', { exact: true }).fill('browser-owner@example.test');
  await page.getByLabel('Password', { exact: true }).fill('Browser fixture passphrase 2026!');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Sign out', exact: true })).toBeVisible();
  const auth = await request<{ memberships: { schoolId: string; schoolName: string }[] }>(
    page,
    '/auth/session',
  );
  const schoolId = auth.memberships.find((m) => m.schoolName === 'Second Browser School')!.schoolId,
    root = `/schools/${schoolId}`;
  const year = await request<{ id: string }>(page, `${root}/academic-years`, 'POST', {
    name: 'Onboarding 2026–27',
    start: '2026-04-01',
    end: '2027-03-31',
  });
  const status = await request<{ academicRevision: number }>(page, `${root}/onboarding`);
  await request(page, `${root}/academic-years/${year.id}/select`, 'POST', {
    revision: status.academicRevision,
  });
  await request(page, `${root}/academic-years/${year.id}/structure-batch`, 'POST', {
    kind: 'classes',
    rows: ['12', '2', '1', '10'].map((name) => ({ name, grade: name, status: 'active' })),
  });
  const context = await request<{ classes: { id: string; name: string }[] }>(
    page,
    `${root}/academic-years/${year.id}/student-context`,
  );
  for (let i = 1; i <= 3; i++)
    await request(page, `${root}/academic-years/${year.id}/students`, 'POST', {
      classId: context.classes.find((c) => c.name === (i === 3 ? '12' : '1'))!.id,
      cells: [
        `Onboard Student ${i}`,
        `ONB-${i}`,
        '2010-01-01',
        'Guardian',
        'Parent',
        '',
        '',
        String(i),
        '',
      ],
    });
  await page.locator('.school-switch').click();
  await page.getByLabel('Select school', { exact: true }).selectOption(schoolId);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.goto(`/fees?year=${year.id}&tab=School+fee+setup`);
  const prepared = page.waitForResponse(
    (response) =>
      response.url().endsWith('/fees/onboarding') && response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Prepare school fee draft', exact: true }).click();
  expect((await prepared).status()).toBe(202);
  await expect(
    page.getByRole('button', { name: 'Apply to matching classes', exact: true }),
  ).toBeEnabled({ timeout: 20000 });
  await expect(page.getByLabel('Class', { exact: true }).locator('option')).toHaveText([
    'All classes',
    '1',
    '2',
    '10',
    '12',
  ]);
  await page.getByLabel('Base yearly fee (₹)', { exact: true }).fill('24000');
  await page.getByRole('button', { name: 'Apply to matching classes', exact: true }).click();
  await expect(page.getByLabel('Base fee for ONB-1', { exact: true })).toHaveValue('24000');
  await page.getByLabel('Concession for ONB-1', { exact: true }).fill('4000');
  await page.getByRole('button', { name: 'Save now', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Save now', exact: true })).toHaveCount(0);
  await page.reload();
  await page.getByRole('tab', { name: '2. Review students', exact: true }).click();
  await expect(page.getByLabel('Concession for ONB-1', { exact: true })).toHaveValue('4000');
  const download = page.waitForEvent('download');
  await page
    .getByRole('button', { name: 'Download current student worksheet', exact: true })
    .click();
  expect((await download).suggestedFilename()).toBe('student-fee-setup.xlsx');
  await expect(page.locator('.loading-overlay-layer')).toHaveCount(0);
  const { studentWorkbook } = await import('../src/lib/xlsx');
  const file = studentWorkbook(
    [
      [
        'Admission Number',
        'Base Fee',
        'Concession',
        'Already Paid',
        'Old Dues',
        'Installments',
        'First Due Date',
      ],
      ['ONB-1', '', '', 3000, 2000, 3, '30-10-2026'],
      ['ONB-2', '', 0, '', '', 1, '30-10-2026'],
    ],
    [],
    'Fees',
  );
  await page.getByLabel('Upload fee worksheet', { exact: true }).setInputFiles({
    name: 'fee-exceptions.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: Buffer.from(await file.arrayBuffer()),
  });
  await expect(
    page.getByText('2 rows saved to draft. Review and validate before activating fees.', {
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByLabel('Concession for ONB-1', { exact: true })).toHaveValue('4000');
  await expect(page.getByLabel('Already paid for ONB-1', { exact: true })).toHaveValue('3000');
  await expect(page.locator('.loading-overlay-layer')).toHaveCount(0);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: '/tmp/fee-onboarding-desktop.png',
    fullPage: true,
    animations: 'disabled',
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() => page.locator('.sidebar').evaluate((node) => node.getBoundingClientRect().right))
    .toBeLessThanOrEqual(1);
  await page.screenshot({
    path: '/tmp/fee-onboarding-mobile.png',
    fullPage: true,
    animations: 'disabled',
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
    true,
  );
  await page.setViewportSize({ width: 1440, height: 1050 });
  await page.getByRole('tab', { name: '3. Review & activate', exact: true }).click();
  await page.getByRole('button', { name: 'Validate all students', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Activate fees for this school', exact: true }),
  ).toBeEnabled({ timeout: 20000 });
  await page.getByRole('button', { name: 'Activate fees for this school', exact: true }).click();
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'School fees are ready', exact: true }),
  ).toBeVisible({ timeout: 20000 });
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const directory = await request<{
    items: { code: string; net: number; oldDues: number; paid: number }[];
  }>(page, `${root}/fees?yearId=${year.id}`);
  expect(directory.items.find((r) => r.code === 'ONB-1')).toMatchObject({
    net: 2000000,
    paid: 300000,
    oldDues: 200000,
  });
});
