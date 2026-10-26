import { test, expect } from '@playwright/test';
test('staff salary setup, approval and partial payments persist through the live UI', async ({
  page,
}) => {
  await page.goto('/settings');
  await expect(page.getByLabel('Email', { exact: true })).toBeVisible();
  await page.screenshot({ path: '/tmp/school-login-desktop.png', fullPage: true });
  await page.getByLabel('Email', { exact: true }).fill('browser-owner@example.test');
  await page.getByLabel('Password', { exact: true }).fill('Browser fixture passphrase 2026!');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.locator('.settings-profile h2')).toHaveText('Browser Test School');
  await page.goto('/staff');
  await page.getByRole('button', { name: 'Add Staff', exact: true }).click();
  const staff = page.getByRole('dialog');
  await staff.getByLabel('Staff name', { exact: true }).fill('Payroll Fixture');
  await staff.getByLabel('Staff code', { exact: true }).fill('HR-ONE');
  await staff.getByLabel('Department', { exact: true }).fill('Academics');
  await staff.getByLabel('Designation', { exact: true }).fill('Teacher');
  await staff.getByLabel('Joining Date', { exact: false }).fill('01-01-2025');
  await staff.getByRole('button', { name: 'Save staff', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Salary & attendance');
  await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
  await expect(staff).toHaveCount(0);
  await page.goto('/fees');
  await page.getByLabel('Salary / attendance month').fill('2025-09');
  await page
    .getByRole('row')
    .filter({ hasText: 'Payroll Fixture' })
    .getByRole('button', { name: 'Salary setup', exact: true })
    .click();
  const salary = page.getByRole('dialog');
  await salary.getByLabel('Basic salary (₹)', { exact: true }).fill('30000');
  await salary.getByLabel('Reason for salary setup/change').fill('Initial salary setup');
  await salary.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(salary).toHaveCount(0);
  await page
    .getByRole('row')
    .filter({ hasText: 'Payroll Fixture' })
    .getByRole('button', { name: 'Prepare salary', exact: true })
    .click();
  await page.getByRole('dialog').getByRole('button', { name: 'Save', exact: true }).click();
  await page.getByRole('button', { name: 'Review & approve', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('row').filter({ hasText: 'Payroll Fixture' })).toContainText(
    'Unpaid',
  );
  await page.getByRole('button', { name: 'Record payment', exact: true }).click();
  await page.getByRole('dialog').getByLabel('Amount actually paid (₹)').fill('10000');
  await page.getByRole('dialog').getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('row').filter({ hasText: 'Payroll Fixture' })).toContainText(
    'Partially paid',
  );
  await page.reload();
  await page.getByLabel('Salary / attendance month').fill('2025-09');
  await expect(page.getByRole('row').filter({ hasText: 'Payroll Fixture' })).toContainText(
    'Partially paid',
  );
  await expect(page.locator('.hr-summary .stat-card')).toHaveCount(4);
  await page.screenshot({ path: '/tmp/hr-salary-desktop.png', fullPage: true });
  await page.getByRole('button', { name: 'Statement', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Outstanding');
  await expect(page.getByRole('dialog')).toContainText('20,000');
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: '/tmp/hr-payroll-mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
  await page.setViewportSize({ width: 1440, height: 1050 });
  await page.getByRole('button', { name: 'Record payment', exact: true }).click();
  await page.getByRole('dialog').getByLabel('Amount actually paid (₹)').fill('20000');
  await page.getByRole('dialog').getByRole('button', { name: 'Save', exact: true }).click();
  const paidRow = page.getByRole('row').filter({ hasText: 'Payroll Fixture' });
  await expect(paidRow.locator('.badge')).toHaveText('Paid');
  await expect(paidRow.getByRole('button', { name: 'Record payment', exact: true })).toHaveCount(0);
});
test('teacher self-service checks the configured campus and records a punch', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({ latitude: 28.6, longitude: 77.2, accuracy: 5 });
  await page.goto('/settings');
  await page.getByLabel('Email', { exact: true }).fill('browser-owner@example.test');
  await page.getByLabel('Password', { exact: true }).fill('Browser fixture passphrase 2026!');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.locator('.settings-profile h2')).toHaveText('Browser Test School');
  await page.goto('/settings?tab=Staff+%26+Payroll&section=work');
  await expect(page.locator('.settings-policy-card')).toHaveCount(3);
  await expect(page.getByLabel('Salary / attendance month')).toHaveCount(0);
  await page.screenshot({ path: '/tmp/hr-settings-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({
    path: '/tmp/hr-settings-mobile.png',
    fullPage: true,
    animations: 'disabled',
  });
  await page.setViewportSize({ width: 1440, height: 1050 });
  await page.getByRole('button', { name: 'Edit Work & Leave Rules', exact: true }).click();
  const settings = page.getByRole('dialog');
  for (const name of ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'])
    await settings.getByLabel(name, { exact: true }).check();
  await settings.getByRole('button', { name: 'Add school location', exact: true }).click();
  await settings.getByLabel('latitude', { exact: true }).fill('28.6');
  await settings.getByLabel('longitude', { exact: true }).fill('77.2');
  await settings.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(settings).toHaveCount(0);
  await page.goto('/staff');
  await page.getByRole('button', { name: 'Add Staff', exact: true }).click();
  const editor = page.getByRole('dialog');
  await editor.getByLabel('Staff name', { exact: true }).fill('Punch Fixture');
  await editor.getByLabel('Staff code', { exact: true }).fill('HR-PUNCH');
  await editor.getByLabel('Teaching staff — show in Teachers directory').check();
  await editor.getByRole('button', { name: 'Save staff', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Salary & attendance');
  await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
  await expect(editor).toHaveCount(0);
  await page.goto('/fees');
  await page
    .getByRole('row')
    .filter({ hasText: 'Punch Fixture' })
    .getByRole('button', { name: 'Salary setup', exact: true })
    .click();
  const salary = page.getByRole('dialog');
  await salary.getByLabel('Attendance method').selectOption('punch');
  await salary
    .getByLabel('School login account')
    .selectOption({ label: 'Browser Owner · browser-owner@example.test' });
  await salary.getByLabel('Basic salary (₹)').fill('1000');
  await salary.getByLabel('Reason for salary setup/change').fill('Teacher punching setup');
  await salary.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page
    .getByRole('dialog', { name: 'Discard changes?' })
    .getByRole('button', { name: 'Keep editing' })
    .click();
  await salary.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(salary).toHaveCount(0);
  await page.goto('/staff/self');
  await page.getByRole('button', { name: 'Punch in', exact: true }).click();
  await expect(
    page
      .getByRole('region', { name: 'My attendance calendar' })
      .getByRole('button', { name: /Review/ }),
  ).toBeVisible();
  await context.setGeolocation({ latitude: 29, longitude: 77.2, accuracy: 5 });
  await page.getByRole('button', { name: 'Punch out', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('inside an allowed school area');
  await context.setGeolocation({ latitude: 28.6, longitude: 77.2, accuracy: 5 });
  await page.getByRole('button', { name: 'Punch out', exact: true }).click();
  await expect(
    page
      .getByRole('region', { name: 'My attendance calendar' })
      .getByRole('button', { name: /Half-Day/ }),
  ).toBeVisible();
});

test('school owner manages departments and creates teacher login', async ({ page }) => {
  await page.goto('/settings');
  await page.getByLabel('Email', { exact: true }).fill('browser-owner@example.test');
  await page.getByLabel('Password', { exact: true }).fill('Browser fixture passphrase 2026!');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.locator('.settings-profile h2')).toHaveText('Browser Test School');
  await page.goto('/settings?tab=Staff+%26+Payroll&section=departments');
  await page.getByRole('button', { name: 'Add Department', exact: true }).click();
  await page.getByLabel('Department name', { exact: true }).fill('office');
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Save department', exact: true })
    .click();
  await expect(page.getByRole('button', { name: 'Office', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Edit department Office', exact: true }).click();
  await page.getByLabel('Department name', { exact: true }).fill('support');
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Save department', exact: true })
    .click();
  await page.getByRole('button', { name: 'Delete department Support', exact: true }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Delete department', exact: true })
    .click();
  await expect(page.getByRole('button', { name: 'Support', exact: true })).toHaveCount(0);
  await page.goto('/settings?tab=Roles+%26+Permissions&section=roles');
  await page.getByRole('button', { name: 'Create role', exact: true }).click();
  await page.getByLabel('Role name', { exact: true }).fill('Teacher self service');
  await page.getByLabel('Own attendance and salary', { exact: true }).check();
  await page.getByRole('button', { name: 'Save role', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.goto('/teachers');
  await page.getByRole('button', { name: 'Add Teacher', exact: true }).click();
  await page.getByLabel('Staff name', { exact: true }).fill('new teacher');
  await page.getByLabel('Staff code', { exact: true }).fill('HR-LOGIN');
  await page.getByLabel('Teaching staff — show in Teachers directory').check();
  await page.getByRole('button', { name: 'Save staff', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Salary & attendance');
  await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
  await expect(page.getByRole('row').filter({ hasText: 'Payroll Fixture' })).toHaveCount(0);
  await page.getByRole('tab', { name: 'Teachers', exact: true }).click();
  const row = page.getByRole('row').filter({ hasText: 'HR-LOGIN' });
  await row.getByRole('button', { name: 'Enable login', exact: true }).click();
  await page.getByLabel('Login email', { exact: true }).fill('new-teacher@example.test');
  await page.getByLabel('Password', { exact: true }).fill('Teacher fixture password 42');
  await page
    .getByRole('combobox', { name: 'School role', exact: true })
    .selectOption({ label: 'Teacher Self Service' });
  await page.getByRole('dialog').getByRole('button', { name: 'Create login', exact: true }).click();
  await expect(row).toContainText('Login linked');
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await page.getByLabel('Email', { exact: true }).fill('new-teacher@example.test');
  await page.getByLabel('Password', { exact: true }).fill('Teacher fixture password 42');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Sign out', exact: true })).toBeVisible();
  await page.goto('/staff/self');
  await expect(
    page.getByRole('heading', { name: 'My attendance & salary', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Salary setup', exact: true })).toHaveCount(0);
  for (const name of ['Students', 'Teachers', 'Staff & HR', 'Finance', 'Academics']) {
    await expect(page.getByRole('link', { name, exact: true })).toHaveCount(0);
  }
  await expect(page.getByRole('region', { name: 'My attendance calendar' })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect((await page.locator('.hr-calendar-day').first().boundingBox())!.width).toBeGreaterThan(30);
  await page.screenshot({
    path: '/tmp/teacher-calendar-mobile.png',
    fullPage: true,
    animations: 'disabled',
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
