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
test('teacher sees assigned students only, uses the dedicated punch page, and campus radius is editable on the map', async ({
  page,
  browser,
}) => {
  test.setTimeout(180000);
  page.setDefaultTimeout(15000);
  await page.context().grantPermissions(['geolocation']);
  await page.context().setGeolocation({ latitude: 26.9, longitude: 75.8, accuracy: 10 });
  await page.route('https://tile.openstreetmap.org/**', (route) =>
    route.fulfill({
      contentType: 'image/png',
      body: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j7VQAAAAASUVORK5CYII=',
        'base64',
      ),
    }),
  );
  await login(page);
  const auth = await request<{ memberships: { schoolId: string }[] }>(page, '/auth/session');
  const root = `/schools/${auth.memberships[0].schoolId}`;
  const year = await request<{ id: string }>(page, `${root}/academic-years`, 'POST', {
    name: 'Teacher scope year',
    start: '2026-01-01',
    end: '2026-12-31',
  });
  const status = await request<{ academicRevision: number }>(page, `${root}/onboarding`);
  await request(page, `${root}/academic-years/${year.id}/select`, 'POST', {
    revision: status.academicRevision,
  });
  const batch = `${root}/academic-years/${year.id}/structure-batch`;
  await request(page, batch, 'POST', {
    kind: 'classes',
    rows: ['10', '12'].map((name) => ({ name, grade: name, status: 'active' })),
  });
  const classes = await request<{ classes: { id: string; name: string }[] }>(
    page,
    `${root}/academic-years/${year.id}/structure?kind=subjects`,
  );
  const classId = classes.classes.find((c) => c.name === '10')!.id;
  await request(page, batch, 'POST', {
    kind: 'sections',
    rows: ['A', 'B'].map((name) => ({ classId, name, status: 'active' })),
  });
  await request(page, batch, 'POST', {
    kind: 'subjects',
    rows: [{ classId, name: 'Mathematics', status: 'active' }],
  });
  const sections = await request<{ children: { id: string; name: string }[] }>(
    page,
    `${root}/academic-years/${year.id}/structure?kind=sections`,
  );
  const subjects = await request<{ children: { id: string }[] }>(
    page,
    `${root}/academic-years/${year.id}/structure?kind=subjects`,
  );
  for (const [index, section] of sections.children.entries())
    await request(page, `${root}/academic-years/${year.id}/students`, 'POST', {
      classId,
      cells: [
        `Student ${section.name}`,
        `SC-${index + 1}`,
        '2012-01-01',
        'Guardian',
        'Parent',
        '',
        '',
        String(index + 1),
        section.name,
      ],
    });
  const month = new Date().toISOString().slice(0, 7);
  const hr = await request<{ settings: Record<string, unknown> }>(
    page,
    `${root}/hr/workspace?month=${month}`,
  );
  const { id, schoolId, ...settings } = hr.settings;
  void id;
  void schoolId;
  await request(page, `${root}/hr/settings`, 'PUT', {
    ...settings,
    workingDays: [0, 1, 2, 3, 4, 5, 6],
    holidays: [],
    locations: [{ name: 'Main campus', latitude: 26.9, longitude: 75.8, radius: 100 }],
    maxAccuracy: 50,
  });
  await page.goto('/settings?tab=Staff+%26+Payroll&section=work');
  await page.getByRole('button', { name: 'Edit Work & Leave Rules' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('region', { name: 'School location map' })).toBeVisible();
  await dialog.getByRole('button', { name: 'Use current location', exact: true }).click();
  await expect(dialog.getByText(/Device accuracy: approximately ±10 metres/)).toBeVisible();
  await dialog.getByRole('button', { name: '200 m', exact: true }).click();
  await expect(dialog.getByLabel('Allowed radius', { exact: true })).toHaveValue('200');
  await expect(dialog.locator('.leaflet-overlay-pane path')).toHaveCount(2);
  await page.screenshot({ path: '/tmp/campus-map-desktop.png', animations: 'disabled' });
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  const saved = await request<{ settings: { locations: { radius: number; latitude: number }[] } }>(
    page,
    `${root}/hr/workspace?month=${month}`,
  );
  expect(saved.settings.locations[0]).toMatchObject({ radius: 200, latitude: 26.9 });
  const role = await request<{ id: string }>(page, `${root}/roles`, 'POST', {
    name: 'Scoped class teacher',
    permissions: [
      'overview.view',
      'student-attendance.view',
      'student-attendance.manage',
      'attendance.manage',
      'teaching.self',
      'attendance.self',
    ],
  });
  const staff = await request<{ id: string }>(page, `${root}/people/staff`, 'POST', {
    cells: [
      'SCOPE-TEACH',
      'Scoped Teacher',
      'yes',
      'Academics',
      'Teacher',
      '',
      '',
      '2020-01-01',
      '',
    ],
  });
  await request(page, `${root}/hr/staff/${staff.id}/login`, 'POST', {
    email: 'scoped-teacher@example.test',
    password: 'Teacher browser passphrase 2026',
    roleId: role.id,
  });
  const assignedSection = sections.children.find((s) => s.name === 'A')!;
  await request(page, `${root}/academic-years/${year.id}/teaching-assignments`, 'POST', {
    staffId: staff.id,
    classId,
    sectionId: assignedSection.id,
    subjectId: subjects.children[0].id,
  });
  const teacherContext = await browser.newContext({
    permissions: ['geolocation'],
    geolocation: { latitude: 26.9, longitude: 75.8, accuracy: 10 },
  });
  const teacher = await teacherContext.newPage();
  teacher.setDefaultTimeout(15000);
  await login(teacher, 'scoped-teacher@example.test', 'Teacher browser passphrase 2026');
  await teacher.goto(`/overview?year=${year.id}`);
  await expect(teacher.getByRole('group', { name: 'School summary' })).not.toContainText(
    'Teaching team',
  );
  await expect(teacher.getByRole('group', { name: 'School summary' })).not.toContainText(
    'Staff attending',
  );
  await teacher.goto(`/attendance?year=${year.id}&class=invalid&section=invalid`);
  await expect(teacher.getByRole('tab', { name: 'Staff Attendance', exact: true })).toHaveCount(0);
  await expect(teacher.getByLabel('Class', { exact: true }).locator('option')).toHaveText(['10']);
  await expect(teacher.getByLabel('Section', { exact: true }).locator('option')).toHaveText([
    'Section A',
  ]);
  await expect(teacher.getByLabel('Section', { exact: true })).toHaveValue(assignedSection.id);
  await expect(teacher.getByRole('group', { name: 'Student A attendance' })).toBeVisible();
  await expect(teacher.getByRole('group', { name: 'Student B attendance' })).toHaveCount(0);
  await expect(
    teacher.getByRole('heading', { name: 'Punch in before taking attendance' }),
  ).toBeVisible();
  await expect(
    teacher.getByRole('button', { name: 'Mark all present', exact: true }),
  ).toBeDisabled();
  await teacher.getByRole('link', { name: 'Punch in & out', exact: true }).click();
  const punch = teacher.getByRole('region', { name: 'My school punch' });
  await teacherContext.setGeolocation({ latitude: 27.9, longitude: 75.8, accuracy: 10 });
  await punch.getByRole('button', { name: 'Punch in', exact: true }).click();
  await expect(punch.getByRole('alert')).toBeVisible();
  await expect(
    punch.getByText('You appear outside the school area', { exact: true }),
  ).toBeVisible();
  await teacherContext.setGeolocation({ latitude: 26.9, longitude: 75.8, accuracy: 1000 });
  await punch.getByRole('button', { name: 'Punch in', exact: true }).click();
  await expect(
    punch.getByText('Your location is not accurate enough', { exact: true }),
  ).toBeVisible();
  await expect(punch.getByRole('alert')).toContainText('1000 m');
  await teacher.screenshot({
    path: '/tmp/punch-page-location-error.png',
    fullPage: true,
    animations: 'disabled',
  });
  await teacherContext.setGeolocation({ latitude: 26.9, longitude: 75.8, accuracy: 10 });
  await punch.getByRole('button', { name: 'Punch in', exact: true }).click();
  await expect(punch.getByRole('button', { name: 'Punch out', exact: true })).toBeEnabled();
  await expect(punch.getByRole('region', { name: 'Today’s recorded times' })).not.toContainText(
    'Invalid',
  );
  await teacher.screenshot({
    path: '/tmp/punch-page-desktop.png',
    fullPage: true,
    animations: 'disabled',
  });
  await teacher.goto('/staff/self');
  await expect(
    teacher
      .getByRole('region', { name: 'My attendance calendar' })
      .getByRole('button', { name: /Present|Late/ }),
  ).toBeVisible();
  await teacher.goto(`/attendance?year=${year.id}`);
  await expect(
    teacher.getByRole('heading', { name: 'Punch in before taking attendance' }),
  ).toHaveCount(0);
  await teacher
    .getByRole('group', { name: 'Student A attendance' })
    .getByRole('button', { name: 'Present', exact: true })
    .click();
  await teacher.getByRole('button', { name: 'Save attendance', exact: true }).click();
  await expect(teacher.getByText('Register up to date', { exact: true })).toBeVisible();
  await expect(teacher.locator('.loading-overlay-layer')).toHaveCount(0);
  await teacher.screenshot({
    path: '/tmp/teacher-assigned-desktop.png',
    fullPage: true,
    animations: 'disabled',
  });
  await teacher.goto('/staff/punch');
  await punch.getByRole('button', { name: 'Punch out', exact: true }).click();
  await expect(punch.getByText('School day completed', { exact: true })).toBeVisible();
  await teacher.setViewportSize({ width: 390, height: 844 });
  await teacher.screenshot({
    path: '/tmp/punch-page-mobile.png',
    fullPage: true,
    animations: 'disabled',
  });
  expect(await teacher.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
    true,
  );
  await teacher.goto(`/attendance?year=${year.id}`);
  await expect(
    teacher.getByRole('heading', { name: 'Punch in before taking attendance' }),
  ).toBeVisible();
  await expect(teacher.locator('.loading-overlay-layer')).toHaveCount(0);
  await teacher.setViewportSize({ width: 390, height: 844 });
  expect(await teacher.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
    true,
  );
  await teacher.screenshot({
    path: '/tmp/teacher-assigned-mobile.png',
    fullPage: true,
    animations: 'disabled',
  });
  await teacher.getByRole('button', { name: 'Open navigation', exact: true }).click();
  await expect(teacher.getByRole('link', { name: 'Punch in & out', exact: true })).toBeVisible();
  await expect(
    teacher.locator('.sidebar').getByRole('button', { name: 'Punch in', exact: true }),
  ).toHaveCount(0);
  await teacher.screenshot({ path: '/tmp/teacher-punch-mobile.png', animations: 'disabled' });
  await teacher.goto('/attendance/staff');
  await expect(teacher).toHaveURL(/\/staff\/punch$/);
  // Calendar-driven ARS uses real API data and school-local approved hours.
  const punchStatus = await request<{ today: string }>(teacher, `${root}/hr/punch-status`);
  const previousDate = new Date(`${punchStatus.today}T12:00:00Z`);
  previousDate.setUTCDate(previousDate.getUTCDate() - 1);
  const previous = previousDate.toISOString().slice(0, 10);
  const displayDate = previous.split('-').reverse().join('-');
  await request(page, `${root}/hr/staff/${staff.id}/attendance`, 'PUT', {
    date: previous,
    revision: 0,
    status: 'half-day',
    decision: 'paid',
    unpaidUnits: 0,
    reason: 'Initial half day recorded by school',
  });
  await teacher.goto('/staff/self');
  await teacher.getByLabel('Calendar / salary month').fill(previous.slice(0, 7));
  const calendar = teacher.getByRole('region', { name: 'My attendance calendar' });
  await expect(calendar.getByLabel('Attendance legend')).toHaveText(
    'LateOn leaveAbsentHalf daySchool holidayInvalid',
  );
  const dateButton = calendar.getByRole('button', {
    name: `${displayDate}: Half-Day`,
    exact: true,
  });
  await expect(dateButton).toHaveText(String(Number(previous.slice(-2))));
  await dateButton.click();
  const requestDialog = teacher.getByRole('dialog');
  await expect(requestDialog).toContainText(displayDate);
  await expect(requestDialog).toContainText('Your attendance stays Half day');
  await requestDialog.getByLabel('ARS type', { exact: true }).selectOption('full-day');
  await requestDialog.getByLabel('ARS reason', { exact: true }).selectOption('other');
  await requestDialog
    .getByLabel('Other reason', { exact: true })
    .fill('Network was unavailable during school hours');
  await teacher.screenshot({
    path: '/tmp/calendar-ars-modal-mobile.png',
    fullPage: true,
    animations: 'disabled',
  });
  await requestDialog.getByRole('button', { name: 'Submit ARS', exact: true }).click();
  await expect(requestDialog).toHaveCount(0);
  await expect(
    calendar.getByRole('button', { name: `${displayDate}: Half-Day`, exact: true }),
  ).toBeVisible();
  await teacher.reload();
  await expect(
    calendar.getByRole('button', { name: `${displayDate}: Half-Day`, exact: true }),
  ).toBeVisible();
  await teacher.getByRole('tab', { name: 'ARS', exact: true }).click();
  await expect(teacher.getByRole('tab', { name: 'Pending (1)', exact: true })).toBeVisible();
  await page.goto('/attendance/staff?view=requests');
  await page.getByRole('button', { name: 'Review request', exact: true }).click();
  const reviewDialog = page.getByRole('dialog');
  await expect(reviewDialog.getByLabel('Salary treatment')).toHaveCount(0);
  await expect(reviewDialog).toContainText('Full-Day');
  await reviewDialog
    .getByLabel('Decision reason', { exact: true })
    .fill('Confirmed full school day');
  await reviewDialog.getByRole('button', { name: 'Save decision', exact: true }).click();
  await expect(reviewDialog).toHaveCount(0);
  await page.getByRole('tab', { name: 'Past requests', exact: true }).click();
  await expect(
    page.getByRole('region', { name: 'Attendance requests', exact: true }),
  ).toContainText('Approved');
  await teacher.getByRole('button', { name: 'Refresh requests', exact: true }).click();
  await teacher.getByRole('tab', { name: 'Past requests', exact: true }).click();
  await expect(
    teacher.getByRole('region', { name: 'Attendance requests', exact: true }),
  ).toContainText('Approved');
  await teacher.getByRole('tab', { name: 'Attendance', exact: true }).click();
  await calendar.getByRole('button', { name: `${displayDate}: Present`, exact: true }).click();
  await expect(teacher.getByRole('dialog')).toHaveCount(0);
  const details = calendar.getByRole('region', { name: 'Selected day details' });
  await expect(details).toContainText('7h 0m');
  await expect(details).not.toContainText('Late');
  await expect(details).toContainText('08:00 am');
  await expect(teacher.locator('.loading-overlay-layer')).toHaveCount(0);
  await teacher.screenshot({
    path: '/tmp/calendar-mobile-approved.png',
    fullPage: true,
    animations: 'disabled',
  });
  expect(await teacher.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
    true,
  );
  await page.goto(`/teachers/${staff.id}?month=${previous.slice(0, 7)}`);
  await expect(page.getByRole('heading', { name: 'Scoped Teacher', exact: true })).toBeVisible();
  await expect(page.getByText('Confirmed full school day', { exact: true })).toBeVisible();
  await page.screenshot({
    path: '/tmp/calendar-staff-profile.png',
    fullPage: true,
    animations: 'disabled',
  });
  await page.goto('/attendance/staff');
  await page.getByLabel('Salary / attendance month').fill(previous.slice(0, 7));
  await page.getByLabel('Attendance date', { exact: true }).fill(displayDate);
  await page.getByRole('button', { name: 'Correct attendance', exact: true }).click();
  const correction = page.getByRole('dialog');
  await correction.getByLabel('Punch-in time', { exact: true }).fill('08:00');
  await correction.getByLabel('Punch-out time', { exact: true }).fill('10:00');
  await correction
    .getByLabel('Reason for correction', { exact: true })
    .fill('Corrected from school register');
  await correction.getByRole('button', { name: 'Save correction', exact: true }).click();
  await expect(correction).toHaveCount(0);
  await expect(page.locator('.staff-attendance-register')).toContainText('Half-Day');
  await expect(page.locator('.staff-attendance-register')).not.toContainText('Salary treatment');
  await teacher.goto('/staff/self');
  await teacher.getByLabel('Calendar / salary month').fill(previous.slice(0, 7));
  await calendar.getByRole('button', { name: `${displayDate}: Half-Day`, exact: true }).click();
  await expect(teacher.getByRole('dialog')).toContainText('2h 0m');
  await teacher
    .getByRole('dialog')
    .getByRole('button', { name: 'Close dialog', exact: true })
    .click();
  await teacherContext.close();
});
