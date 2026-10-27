import { readFile } from 'node:fs/promises';
import { parseMarksCsv } from '../src/lib/marksImport';
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
test('original overview, attendance and academic screens save real school records and never touch demo storage', async ({
  page,
  browser,
}) => {
  test.setTimeout(120000);
  const modules: string[] = [];
  page.on('request', (r) => modules.push(r.url()));
  await login(page);
  await expect(page.locator('.settings-profile h2')).toHaveText('Browser Test School');
  const session = await request<{ memberships: { schoolId: string; schoolName: string }[] }>(
    page,
    '/auth/session',
  );
  const schoolId = session.memberships.find(
    (m) => m.schoolName === 'Browser Test School',
  )!.schoolId;
  const root = `/schools/${schoolId}`;
  const year = await request<{ id: string }>(page, `${root}/academic-years`, 'POST', {
    name: 'Learning Browser Year',
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
    rows: [{ name: '12', grade: '12', status: 'active' }],
  });
  const structure = await request<{ classes: { id: string }[] }>(
    page,
    `${root}/academic-years/${year.id}/structure?kind=subjects`,
  );
  const classId = structure.classes[0].id;
  await request(page, batch, 'POST', {
    kind: 'subjects',
    rows: [
      { classId, name: 'Mathematics', status: 'active' },
      { classId, name: 'Hindi', status: 'active' },
    ],
  });
  await request(page, `${root}/academic-years/${year.id}/students`, 'POST', {
    classId,
    cells: [
      'Learning Student',
      'BR-772',
      '2012-01-01',
      'Guardian Name',
      'Father',
      '',
      'City',
      '772',
      '',
    ],
  });
  await page.goto(`/attendance?year=${year.id}`);
  await expect(page.getByRole('heading', { name: 'Attendance register' })).toBeVisible();
  await page
    .getByRole('group', { name: 'Learning Student attendance' })
    .getByRole('button', { name: 'Absent', exact: true })
    .click();
  await page.getByRole('button', { name: 'Save attendance', exact: true }).click();
  await expect(page.getByText('Register up to date', { exact: true })).toBeVisible();
  await page.goto(`/?year=${year.id}`);
  await expect(
    page.getByRole('heading', { name: 'A good day starts with clarity.' }),
  ).toBeVisible();
  await expect(page.getByRole('group', { name: 'School summary' })).toContainText(
    'Enrolled students',
  );
  await expect(page.getByRole('heading', { name: 'Absent students · selected day' })).toBeVisible();
  await expect(page.locator('.dashboard-absence')).toContainText('Learning Student');
  await page.screenshot({ path: '/tmp/live-original-overview.png', fullPage: true });
  await page.goto(`/academics?year=${year.id}`);
  await page.getByRole('button', { name: 'Add Test / Exam', exact: true }).click();
  await page.getByLabel('Test name', { exact: true }).fill('Learning Browser Test');
  await page.getByLabel('Default maximum marks').fill('100');
  await page.getByLabel('Test type', { exact: true }).fill('Yearly Examination');
  await page.getByRole('button', { name: 'Create Test', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page
    .getByRole('button', { name: 'Add/Edit Marks for Learning Browser Test', exact: true })
    .click();
  await expect(page.getByLabel('Mathematics maximum marks')).toHaveValue('100');
  await expect(page.getByLabel('Mathematics maximum marks')).toBeDisabled();
  await page.getByLabel('Learning Student Mathematics marks').fill('87');
  await page.getByRole('button', { name: 'Save Marks', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.reload();
  await expect(page.locator('.academic-test-card')).toContainText('Marks Added');
  // Import an actual downloaded referenced template and persist the confirmed update through MongoDB.
  await page
    .getByRole('button', { name: 'Add/Edit Marks for Learning Browser Test', exact: true })
    .click();
  const marksDialog = page.getByRole('dialog');
  const downloading = page.waitForEvent('download');
  await marksDialog.getByText('Download sample Excel / CSV', { exact: true }).click();
  await marksDialog.getByRole('button', { name: 'CSV (.csv)', exact: true }).click();
  const grid = parseMarksCsv(await readFile((await (await downloading).path())!, 'utf8'));
  const subjectIndex = grid[0].findIndex((c) => c === 'Mathematics');
  expect(subjectIndex).toBeGreaterThan(4);
  grid[2][subjectIndex] = '90';
  const csv = grid
    .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(','))
    .join('\r\n');
  await marksDialog.getByLabel('Import marks file').setInputFiles({
    name: 'referenced-marks.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(csv),
  });
  const preview = marksDialog.getByRole('region', { name: 'Import preview' });
  await expect(preview).toContainText('1 replacing saved rows');
  for (const checkbox of await preview.getByRole('checkbox').all()) await checkbox.check();
  await marksDialog.getByRole('button', { name: 'Apply to sheet', exact: true }).click();
  await marksDialog.getByRole('button', { name: 'Save Marks', exact: true }).click();
  await expect(marksDialog).toHaveCount(0);
  await page.reload();
  await page.getByRole('tab', { name: 'Results', exact: true }).click();
  await page.getByRole('tab', { name: 'Recent Results', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'View Result', exact: false }).first(),
  ).toBeVisible();
  await page.getByRole('button', { name: 'View Result', exact: false }).first().click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('.assessment-result-page')).toContainText('90/100');
  await expect(page.locator('.assessment-result-page')).toContainText('Yearly Examination');
  await page.screenshot({ path: '/tmp/live-original-academics.png', fullPage: true });
  expect(
    await page.evaluate(() =>
      Object.keys(localStorage).filter((k) => /demo|schoolwell.*state/i.test(k)),
    ),
  ).toEqual([]);
  expect(modules.some((url) => /\/src\/(mocks\/|lib\/demoRepository\.ts)/.test(url))).toBe(false);
  // Provision a distinct teacher through the school API and exercise the actual scoped UI.
  const role = await request<{ id: string }>(page, `${root}/roles`, 'POST', {
    name: 'Learning teacher',
    permissions: ['teaching.self', 'student-attendance.assigned', 'attendance.self'],
  });
  const person = await request<{ id: string }>(page, `${root}/people/staff`, 'POST', {
    cells: [
      'B-TEACH',
      'Learning Teacher',
      'yes',
      'Academics',
      'Teacher',
      'teacher-browser@example.test',
      '',
      '2020-01-01',
      '',
    ],
  });
  await request(page, `${root}/hr/staff/${person.id}/login`, 'POST', {
    email: 'learning-teacher@example.test',
    password: 'Learning teacher fixture42',
    roleId: role.id,
  });
  const subjects = await request<{ children: { id: string; name: string }[] }>(
    page,
    `${root}/academic-years/${year.id}/structure?kind=subjects`,
  );
  const assignment = await request<{ id: string; revision: number }>(
    page,
    `${root}/academic-years/${year.id}/teaching-assignments`,
    'POST',
    {
      staffId: person.id,
      classId,
      sectionId: '',
      subjectId: subjects.children.find((s) => s.name === 'Mathematics')!.id,
    },
  );
  const teacherContext = await browser.newContext();
  const teacher = await teacherContext.newPage();
  await login(teacher, 'learning-teacher@example.test', 'Learning teacher fixture42');
  await teacher.goto(`/attendance?year=${year.id}`);
  await expect(teacher.getByRole('group', { name: 'Learning Student attendance' })).toBeVisible();
  await request(
    page,
    `${root}/academic-years/${year.id}/teaching-assignments/${assignment.id}/end`,
    'POST',
    { revision: assignment.revision },
  );
  await teacher.reload();
  await expect(teacher.getByRole('group', { name: 'Learning Student attendance' })).toHaveCount(0);
  await teacher.goto('/staff/self');
  await expect(teacher.getByRole('tab', { name: 'Leave', exact: true })).toBeVisible();
  await teacher.getByRole('tab', { name: 'Leave', exact: true }).click();
  await teacher.getByRole('button', { name: 'Request leave', exact: true }).click();
  await teacher
    .getByRole('dialog')
    .getByLabel('Reason', { exact: true })
    .fill('Personal appointment today');
  await teacher.getByRole('dialog').getByRole('button', { name: 'Save', exact: true }).click();
  await expect(teacher.getByRole('dialog')).toHaveCount(0);
  await expect(
    teacher.getByRole('row').filter({ hasText: 'Personal appointment today' }),
  ).toContainText('pending');
  await page.goto('/staff?section=leave');
  await page
    .getByRole('row')
    .filter({ hasText: 'Personal appointment today' })
    .getByRole('button', { name: 'Review', exact: true })
    .click();
  await page.getByRole('dialog').getByLabel('Review reason').fill('Approved paid leave');
  await page.getByRole('dialog').getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await teacher.reload();
  await expect(
    teacher.getByRole('row').filter({ hasText: 'Personal appointment today' }),
  ).toContainText('approved');
  await teacher.getByRole('tab', { name: 'Attendance', exact: true }).click();
  await expect(teacher.getByRole('button', { name: /: Leave$/ })).toHaveCount(1);
  await teacher.setViewportSize({ width: 390, height: 844 });
  await expect(teacher.getByRole('region', { name: 'My attendance calendar' })).toBeVisible();
  expect(await teacher.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
    true,
  );
  await expect(teacher.locator('.sidebar')).not.toBeInViewport();
  await teacher.screenshot({ path: '/tmp/teacher-corrected-self.png', fullPage: true });
  await teacherContext.close();
});
