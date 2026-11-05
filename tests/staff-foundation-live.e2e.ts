import { test, expect, type Page } from '@playwright/test';
const api = 'http://127.0.0.1:3107/api/v1';
async function request<T>(page: Page, path: string, method = 'GET', body?: unknown): Promise<T> {
  const result = await page.evaluate(
    async ({ api, path, method, body }) => {
      const csrf =
        method === 'GET'
          ? null
          : await (await fetch(`${api}/auth/csrf`, { credentials: 'include' })).json();
      const res = await fetch(api + path, {
        method,
        credentials: 'include',
        headers: {
          'content-type': 'application/json',
          ...(csrf ? { 'x-csrf-token': csrf.data.csrfToken } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      return { status: res.status, payload: await res.json() };
    },
    { api, path, method, body },
  );
  expect(result.status, JSON.stringify(result.payload.error)).toBeLessThan(300);
  return result.payload.data as T;
}
async function login(
  page: Page,
  email = 'browser-owner@example.test',
  password = 'Browser fixture passphrase 2026!',
) {
  await page.goto('/settings');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Sign out', exact: true })).toBeVisible();
}

test('live directory, scoped profile sections and grouped permissions use the existing shell on desktop and mobile', async ({
  page,
}) => {
  test.setTimeout(120000);
  page.setDefaultTimeout(15000);
  await login(page);
  const session = await request<{ memberships: { schoolId: string }[] }>(page, '/auth/session');
  const root = `/schools/${session.memberships[0].schoolId}`;
  const staff = await request<{ id: string }>(page, `${root}/people/staff`, 'POST', {
    cells: [
      'CON-1',
      'Contact Teacher',
      'Yes',
      'Academics',
      'Teacher',
      'contact@example.test',
      '9876543210',
      '2026-01-01',
      'B.Ed',
    ],
  });
  await page.goto('/teachers');
  await expect(page.getByRole('link', { name: 'Contact Teacher', exact: true })).toBeVisible();
  await expect(page.getByLabel('Filter by class')).toHaveCount(0);
  await expect(page.locator('.loading-overlay-layer')).toHaveCount(0);
  await page.screenshot({
    path: '/tmp/staff-ui-directory.png',
    fullPage: true,
    animations: 'disabled',
  });
  await page.getByRole('link', { name: 'Contact Teacher', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/teachers/${staff.id}`));
  await expect(page.getByRole('heading', { name: 'Contact Teacher', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Daily records', exact: true })).toHaveCount(0);
  await expect(
    page.getByRole('link', { name: 'Call Contact Teacher: 9876543210' }),
  ).toHaveAttribute('href', 'tel:9876543210');
  await page.getByRole('tab', { name: 'Attendance', exact: true }).click();
  await expect(
    page.getByRole('region', { name: 'Contact Teacher attendance calendar' }),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open register and corrections' })).toHaveAttribute(
    'href',
    new RegExp(`/attendance/staff\\?staff=${staff.id}&month=`),
  );
  await page.getByRole('tab', { name: 'Salary', exact: true }).click();
  await page.getByRole('link', { name: 'Open salary processing' }).click();
  await expect(page).toHaveURL(/\/fees\?tab=Salary\+Expenses/);
  await expect(page.getByRole('tab', { name: 'Salary Expenses', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await page.goto(`/teachers/${staff.id}`);
  await page.getByRole('tab', { name: 'Account', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Create login', exact: true })).toBeVisible();
  await page.goto('/contacts');
  await page.getByRole('tab', { name: 'Teachers', exact: true }).click();
  await page.getByLabel('Search', { exact: true }).fill('9876543210');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Call Contact Teacher: 9876543210' })).toBeVisible();
  await expect(page.locator('.loading-overlay-layer')).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({
    path: '/tmp/staff-contacts-mobile.png',
    fullPage: true,
    animations: 'disabled',
  });
  await page.getByRole('link', { name: 'Contact Teacher', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Contact Teacher', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.locator('.loading-overlay-layer')).toHaveCount(0);
  await page.screenshot({
    path: '/tmp/staff-profile-mobile.png',
    fullPage: true,
    animations: 'disabled',
  });
  await page.setViewportSize({ width: 1440, height: 1050 });
  await page.goto('/settings?tab=Roles+%26+Permissions&section=roles');
  await page.getByRole('button', { name: 'Create role', exact: true }).click();
  await expect(page.getByRole('group', { name: 'Quick Connect', exact: true })).toBeVisible();
  await page.getByRole('tab', { name: 'Manage', exact: true }).click();
  await expect(
    page.getByRole('checkbox', { name: 'Create staff profiles', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('checkbox', { name: 'Approve staff leave', exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: '/tmp/staff-role-permissions.png', fullPage: true });
});

test('overview chart and separate assignment replacement preserve the recipient’s other classes', async ({
  page,
}) => {
  test.setTimeout(120000);
  await login(page);
  const session = await request<{ memberships: { schoolId: string }[] }>(page, '/auth/session');
  const root = `/schools/${session.memberships[0].schoolId}`;
  const status = await request<{ academicRevision: number }>(page, `${root}/onboarding`);
  const year = await request<{ id: string }>(page, `${root}/academic-years`, 'POST', {
    name: 'Assignment UI year',
    start: '2026-01-01',
    end: '2026-12-31',
  });
  await request(page, `${root}/academic-years/${year.id}/select`, 'POST', {
    revision: status.academicRevision,
  });
  const yr = `${root}/academic-years/${year.id}`;
  await request(page, `${yr}/structure-batch`, 'POST', {
    kind: 'classes',
    includeDefaultSubjects: true,
    rows: [
      { name: 'Class 1', grade: '1', status: 'active' },
      { name: 'Class 9', grade: '9', status: 'active' },
    ],
  });
  const structure = await request<{
    classes: { id: string; name: string }[];
    children: { id: string; classId: string; name: string }[];
  }>(page, `${yr}/structure?kind=subjects`);
  const firstClass = structure.classes.find((c) => c.name === 'Class 1')!,
    otherClass = structure.classes.find((c) => c.name === 'Class 9')!;
  const firstSubject = structure.children.find((s) => s.classId === firstClass.id)!,
    otherSubject = structure.children.find((s) => s.classId === otherClass.id)!;
  const add = (code: string, name: string) =>
    request<{ id: string }>(page, `${root}/people/staff`, 'POST', {
      cells: [
        code,
        name,
        'Yes',
        'Academics',
        'Teacher',
        `${code}@example.test`,
        '9876543210',
        '2026-01-01',
        'B.Ed',
      ],
    });
  const original = await add('REPLACE-1', 'Original Teacher'),
    recipient = await add('REPLACE-2', 'Replacement Teacher');
  await request(page, `${yr}/teaching-assignments-batch`, 'POST', {
    items: [
      { staffId: original.id, classId: firstClass.id, sectionId: '', subjectId: firstSubject.id },
      { staffId: recipient.id, classId: otherClass.id, sectionId: '', subjectId: otherSubject.id },
    ],
  });
  const attendanceDate = await request<{ date: string }>(page, `${root}/staff-directory`);
  for (const [staffId, attendanceStatus] of [
    [original.id, 'late'],
    [recipient.id, 'absent'],
  ]) {
    await request(page, `${root}/hr/staff/${staffId}/attendance`, 'PUT', {
      date: attendanceDate.date,
      revision: 0,
      status: attendanceStatus,
      decision: 'paid',
      unpaidUnits: 0,
      reason: 'Verified fixture attendance',
    });
  }
  await page.goto('/overview');
  await expect(
    page.getByRole('heading', { name: 'Teacher attendance', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Staff attendance requests', exact: true }),
  ).toHaveCount(0);
  await expect(
    page
      .getByRole('navigation', { name: 'Administration' })
      .getByRole('link', { name: 'Staff attendance', exact: true }),
  ).toHaveCount(0);
  await expect(page.locator('.topbar')).not.toContainText('Student profile');
  await expect(
    page.locator('.teacher-attendance-panel').getByText('Unmarked', { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('img', { name: '1 of 2 teachers present; 1 absent; 0 on leave' }),
  ).toBeVisible();
  await expect(page.locator('.loading-overlay-layer')).toHaveCount(0);
  await page.screenshot({
    path: '/tmp/staff-ui-overview.png',
    fullPage: true,
    animations: 'disabled',
  });
  await page.goto('/teachers?section=assignments');
  const row = page
    .getByRole('row')
    .filter({ has: page.getByRole('link', { name: 'Original Teacher', exact: true }) });
  await row.getByRole('button', { name: 'Edit', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Edit assignment' })).toBeVisible();
  await expect(
    page.getByRole('dialog').getByRole('combobox', { name: 'Class', exact: true }),
  ).toBeVisible();
  await page.keyboard.press('Escape');
  await row.getByRole('button', { name: 'Replace teacher', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Replace teacher', exact: true });
  await expect(dialog.getByRole('combobox')).toHaveCount(1);
  await dialog
    .getByRole('combobox', { name: 'Replacement teacher', exact: true })
    .selectOption(recipient.id);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('.loading-overlay-layer')).toHaveCount(0);
  await page.screenshot({
    path: '/tmp/staff-ui-replacement-mobile.png',
    fullPage: true,
    animations: 'disabled',
  });
  await dialog.getByRole('button', { name: 'Confirm replacement' }).click();
  await expect(dialog).toHaveCount(0);
  const result = await request<{ items: { personId: string; classId: string; status: string }[] }>(
    page,
    `${yr}/teaching-assignments?staffId=${recipient.id}`,
  );
  expect(
    result.items
      .filter((i) => i.status === 'active')
      .map((i) => i.classId)
      .sort(),
  ).toEqual([firstClass.id, otherClass.id].sort());
  await page.goto('/overview');
  await expect(
    page.getByRole('heading', { name: 'Teacher attendance', exact: true }),
  ).toBeVisible();
  await expect(page.locator('.loading-overlay-layer')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({
    path: '/tmp/staff-ui-overview-mobile.png',
    fullPage: true,
    animations: 'disabled',
  });
  const role = await request<{ id: string }>(page, `${root}/roles`, 'POST', {
    name: 'Replacement teacher role',
    permissions: ['teaching.self'],
  });
  const credentials = {
    email: 'replacement-login@example.test',
    password: 'Replacement fixture passphrase 2026!',
    roleId: role.id,
  };
  await request(page, `${root}/hr/staff/${recipient.id}/login`, 'POST', credentials);
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await login(page, credentials.email, credentials.password);
  await page.goto('/overview');
  await expect(page.locator('.class-pulse .pulse-row')).toHaveCount(2);
  await expect(page.locator('.class-pulse')).toContainText('Class 1');
  await expect(page.locator('.class-pulse')).toContainText('Class 9');
  await expect(page.getByRole('heading', { name: 'Teacher attendance', exact: true })).toHaveCount(
    0,
  );
});

test('a teacher login needs no attendance setup and short working hours remain Present and Late', async ({
  page,
}) => {
  test.setTimeout(120000);
  page.setDefaultTimeout(15000);
  await login(page);
  const session = await request<{ memberships: { schoolId: string }[] }>(page, '/auth/session');
  const root = `/schools/${session.memberships[0].schoolId}`;
  const role = await request<{ id: string }>(page, `${root}/roles`, 'POST', {
    name: 'Automatic attendance teacher',
    permissions: ['attendance.self', 'teaching.self'],
  });
  const staff = await request<{ id: string }>(page, `${root}/people/staff`, 'POST', {
    cells: [
      'AUTO-1',
      'Automatic Teacher',
      'Yes',
      'Academics',
      'Teacher',
      'auto-attendance@example.test',
      '9876543210',
      '2026-01-01',
      'B.Ed',
    ],
  });
  await page.goto(`/teachers/${staff.id}`);
  await page.getByRole('button', { name: 'Create login', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('combobox', { name: 'School role', exact: true }).selectOption(role.id);
  await expect(dialog.getByRole('checkbox', { name: /Start attendance/ })).toHaveCount(0);
  await dialog.getByLabel('Password', { exact: true }).fill('Automatic fixture passphrase 2026!');
  await page.screenshot({
    path: '/tmp/attendance-simple-login.png',
    fullPage: true,
    animations: 'disabled',
  });
  await dialog.getByRole('button', { name: 'Create login', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  const people = await request<{
    date: string;
    items: { id: string }[];
  }>(page, `${root}/staff-directory?search=AUTO-1`);
  const data = await request<{ today: string; settings: Record<string, unknown> }>(
    page,
    `${root}/hr/workspace?month=${people.date.slice(0, 7)}`,
  );
  await expect(page.getByRole('button', { name: 'Start attendance', exact: true })).toHaveCount(0);
  await request(page, `${root}/hr/settings`, 'PUT', {
    ...Object.fromEntries(
      [
        'revision',
        'departments',
        'workingDays',
        'holidays',
        'paymentDay',
        'deductionBasis',
        'divisor',
        'paidLeaveDays',
        'maxAccuracy',
        'locations',
      ].map((key) => [key, data.settings[key]]),
    ),
    start: '09:00',
    end: '17:00',
    lateAfter: '10:26',
    halfDayAfter: '14:26',
    halfDayMinutes: 600,
  });
  const previous = new Date(`${data.today}T12:00:00Z`);
  previous.setUTCDate(previous.getUTCDate() - 1);
  const date = previous.toISOString().slice(0, 10);
  await request(page, `${root}/hr/staff/${staff.id}/attendance-times`, 'PUT', {
    date,
    revision: 0,
    punchIn: '11:00',
    punchOut: '16:00',
    reason: 'Browser fixture attendance check',
  });
  await page.goto(`/attendance/staff?date=${date}&month=${date.slice(0, 7)}`);
  await page.getByLabel('Find staff').fill('Automatic Teacher');
  const row = page
    .getByRole('row')
    .filter({ has: page.getByRole('link', { name: 'Automatic Teacher', exact: true }) });
  await expect(row).toContainText('Present');
  await expect(row).toContainText('Late');
  await expect(row).not.toContainText('Half Day');
  await expect(page.getByRole('button', { name: 'Present · 1', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Late · 1', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Present · 1', exact: true }).click();
  await expect(row).toBeVisible();
});

test('school absence policy is optional and persists through the Work & Leave editor', async ({
  page,
}) => {
  test.setTimeout(90000);
  await login(page);
  await page.goto('/settings?tab=Staff+%26+Payroll&section=work');
  await page.getByRole('button', { name: 'Edit Work & Leave Rules' }).click();
  const dialog = page.getByRole('dialog');
  const policy = dialog.getByRole('combobox', {
    name: 'Absence reduces leave balance',
    exact: true,
  });
  await expect(policy).toHaveValue('no');
  await policy.selectOption('yes');
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByText('Yes · one day per absence', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('Yes · one day per absence', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Edit Work & Leave Rules' }).click();
  await policy.selectOption('no');
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(dialog).toHaveCount(0);
});

test('manual attendance records partial punches, preserves times and works on mobile', async ({
  page,
  browser,
}) => {
  test.setTimeout(120000);
  await login(page);
  const session = await request<{ memberships: { schoolId: string }[] }>(page, '/auth/session');
  const root = `/schools/${session.memberships[0].schoolId}`;
  const role = await request<{ id: string }>(page, `${root}/roles`, 'POST', {
    name: 'Manual attendance teacher',
    permissions: ['attendance.self', 'teaching.self'],
  });
  const staff = await request<{ id: string }>(page, `${root}/people/staff`, 'POST', {
    cells: [
      'MAN-1',
      'Manual Teacher',
      'Yes',
      'Academics',
      'Teacher',
      'manual@example.test',
      '9876543210',
      '2026-01-01',
      'B.Ed',
    ],
  });
  await request(page, `${root}/hr/staff/${staff.id}/login`, 'POST', {
    email: 'manual@example.test',
    password: 'Manual fixture passphrase 2026!',
    roleId: role.id,
  });
  const directory = await request<{ date: string }>(page, `${root}/staff-directory`);
  await page.goto(`/attendance/staff?date=${directory.date}`);
  await page.getByLabel('Find staff').fill('Manual Teacher');
  const row = page
    .getByRole('row')
    .filter({ has: page.getByRole('link', { name: 'Manual Teacher', exact: true }) });
  await row.getByRole('button', { name: 'Mark / correct', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('radio', { name: 'Punch-in only', exact: true })).toBeChecked();
  await expect(dialog.getByLabel('Punch-out time', { exact: true })).toHaveCount(0);
  await dialog.getByLabel('Punch-in time', { exact: true }).fill('00:00');
  await page.screenshot({ path: '/tmp/manual-attendance-desktop.png', fullPage: true });
  await dialog.getByRole('button', { name: 'Save punch-in', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  const teacherContext = await browser.newContext();
  const teacher = await teacherContext.newPage();
  await teacher.goto('http://127.0.0.1:5176');
  await request(teacher, '/auth/login', 'POST', {
    email: 'manual@example.test',
    password: 'Manual fixture passphrase 2026!',
  });
  expect((await request<{ active: boolean }>(teacher, `${root}/hr/punch-status`)).active).toBe(
    true,
  );
  await row.getByRole('button', { name: 'Mark / correct', exact: true }).click();
  await expect(dialog.getByRole('radio', { name: 'Punch-out only', exact: true })).toBeChecked();
  await expect(dialog.getByLabel('Punch-in time', { exact: true })).toHaveCount(0);
  await dialog.getByLabel('Punch-out time', { exact: true }).fill('00:01');
  await dialog.getByRole('button', { name: 'Save punch-out', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect((await request<{ active: boolean }>(teacher, `${root}/hr/punch-status`)).active).toBe(
    false,
  );
  await teacherContext.close();
  await row.getByRole('button', { name: 'Mark / correct', exact: true }).click();
  const previous = new Date(`${directory.date}T12:00:00Z`);
  previous.setUTCMonth(previous.getUTCMonth() - 1);
  const past = previous.toISOString().slice(0, 10);
  await dialog
    .getByRole('textbox', { name: 'Attendance date Open calendar', exact: true })
    .fill(past.split('-').reverse().join('-'));
  await expect(dialog.locator('.loading-overlay-layer')).toHaveCount(0);
  await dialog.getByRole('radio', { name: 'Both times', exact: true }).check();
  await dialog.getByLabel('Punch-in time', { exact: true }).fill('08:00');
  await dialog.getByLabel('Punch-out time', { exact: true }).fill('15:00');
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: '/tmp/manual-attendance-mobile.png', fullPage: true });
  await dialog.getByRole('button', { name: 'Save both times', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  const result = await request<{
    attendance: { staffId: string; date: string; punchIn?: string; punchOut?: string }[];
  }>(page, `${root}/hr/workspace?month=${past.slice(0, 7)}`);
  const saved = result.attendance.find((d) => d.staffId === staff.id && d.date === past);
  expect(saved?.punchIn).toBeTruthy();
  expect(saved?.punchOut).toBeTruthy();
});
