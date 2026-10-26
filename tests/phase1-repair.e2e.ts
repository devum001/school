import { studentWorkbook } from '../src/lib/xlsx';
import { STUDENT_IMPORT_HEADERS } from '../src/lib/studentTemplate';
import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
const baseline = JSON.parse(
  readFileSync(new URL('../docs/phase1-ui-baseline.json', import.meta.url), 'utf8'),
) as {
  workspaceNavigation: string[];
  administrationNavigation: string[];
  settings: Record<string, string[]>;
};
const api = 'http://127.0.0.1:3107/api/v1';
async function login(page: Page) {
  await page.goto('/settings');
  await page.getByLabel('Email', { exact: true }).fill('browser-owner@example.test');
  await page.getByLabel('Password', { exact: true }).fill('Browser fixture passphrase 2026!');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.locator('.settings-profile h2')).toHaveText('Browser Test School');
}
async function schoolId(page: Page) {
  return page.evaluate(async (api) => {
    const response = await fetch(`${api}/auth/session`, { credentials: 'include' });
    const payload = await response.json();
    return payload.data.memberships.find(
      (m: { schoolName: string }) => m.schoolName === 'Browser Test School',
    ).schoolId as string;
  }, api);
}
test('shared shell, route links and original settings tabs; no demo storage or seed module', async ({
  page,
}) => {
  const sources: string[] = [];
  page.on('request', (request) => sources.push(request.url()));
  await login(page);
  await expect(
    page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link'),
  ).toHaveText(baseline.workspaceNavigation);
  await expect(
    page.getByRole('navigation', { name: 'Administration' }).getByRole('link'),
  ).toHaveText(baseline.administrationNavigation);
  await expect(
    page.getByRole('tablist', { name: 'Settings', exact: true }).getByRole('tab'),
  ).toHaveText(
    Object.keys(baseline.settings).map((t) =>
      t === 'Classes, Sections & Grades' ? 'Classes & sections' : t,
    ),
  );
  await expect(page.getByRole('link', { name: 'Overview', exact: true })).toHaveAttribute(
    'href',
    '/',
  );
  await expect(page.getByRole('textbox', { name: 'Search the student directory' })).toBeVisible();
  await page.getByRole('tab', { name: 'Staff & Payroll', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'Departments', exact: true })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Work & Leave', exact: true })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Payroll', exact: true })).toBeVisible();
  await page.getByRole('tab', { name: 'General', exact: true }).click();
  await page.getByRole('button', { name: 'Edit Details' }).click();
  await expect(page.getByLabel('Street address', { exact: true })).toHaveCount(0);
  for (const label of [
    'School name',
    'School motto',
    'Location',
    'School code',
    'Principal',
    'Phone',
    'Email',
    'Website',
  ])
    await expect(page.getByRole('dialog').getByLabel(label, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(sources.some((s) => /\/src\/(lib\/repository|mocks\/seed)\./.test(s))).toBe(false);
  expect(await page.evaluate(() => Object.keys(localStorage))).toEqual([]);
  await page.setViewportSize({ width: 390, height: 900 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Sign in to your school' })).toBeVisible();
});
test('original class dialogs, persisted subjects and unused deletion work against MongoDB', async ({
  page,
}) => {
  await login(page);
  const school = await schoolId(page);
  const year = await page.evaluate(
    async ({ api, school }) => {
      const token = await fetch(`${api}/auth/csrf`, { credentials: 'include' }).then((r) =>
        r.json(),
      );
      const response = await fetch(`${api}/schools/${school}/academic-years`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json', 'x-csrf-token': token.data.csrfToken },
        body: JSON.stringify({ name: 'Repair year', start: '2030-04-01', end: '2031-03-31' }),
      });
      if (response.status !== 201) throw new Error('Unable to create isolated year');
      const result = await response.json();
      const select = await fetch(
        `${api}/schools/${school}/academic-years/${result.data.id}/select`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'content-type': 'application/json', 'x-csrf-token': token.data.csrfToken },
          body: JSON.stringify({ revision: 0 }),
        },
      );
      if (select.status !== 200) throw new Error('Unable to select isolated year');
      return result.data.id as string;
    },
    { api, school },
  );
  await page.goto('/settings?tab=Classes%2C+Sections+%26+Grades');

  await expect(page.getByRole('button', { name: 'Configure classes together' })).toHaveCount(0);
  async function addClass(name: string) {
    await page.getByRole('button', { name: 'Set up classes', exact: true }).click();
    await page.getByLabel('Class 1 name', { exact: true }).fill(name);
    await page.getByLabel('Class 1 sections', { exact: true }).fill('A');
    await page.getByRole('button', { name: 'Create classes & sections', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.getByLabel('Setup class').selectOption({ label: name });
  }
  await addClass('Class 2');
  await expect(page.getByRole('button', { name: 'Edit section A', exact: true })).toBeVisible();
  await page.getByRole('tab', { name: 'Subjects', exact: true }).click();
  await expect(page.getByLabel('Subject 1 name')).toHaveValue('English');
  await expect(page.getByRole('checkbox', { name: /optional/i })).toHaveCount(0);
  await page.getByLabel('Subject 1 name').fill('English Language');
  await page.getByRole('button', { name: 'Save subjects', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Save subjects', exact: true })).toBeDisabled();
  await page.reload();
  await expect(page.getByLabel('Subject 1 name')).toHaveValue('English Language');
  await page.getByRole('tab', { name: 'Sections', exact: true }).click();
  await addClass('Unused Class');
  await page.getByRole('button', { name: 'Delete section A', exact: true }).click();
  await page.getByRole('button', { name: 'Delete permanently', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Delete class Unused Class', exact: true }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Delete permanently', exact: true })
    .click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(
    page.getByLabel('Setup class').getByRole('option', { name: 'Unused Class', exact: true }),
  ).toHaveCount(0);
  expect(
    (await page.request.get(`${api}/schools/${school}/academic-years/${year}/classes`)).status(),
  ).toBe(200);
  await page.getByRole('tab', { name: 'Students', exact: true }).click();
  const beforeImport = page.url();
  await page.getByRole('button', { name: 'Import Excel (.xlsx)', exact: true }).click();
  await expect(page.getByLabel('Excel file (.xlsx)')).toBeVisible();
  expect(page.url()).toBe(beforeImport);
  await page.getByLabel('Excel file (.xlsx)').setInputFiles({
    name: 'class-students.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: Buffer.from(
      await studentWorkbook([
        STUDENT_IMPORT_HEADERS,
        [
          'Class Workspace Student',
          'WORKSPACE-81001',
          '2018-05-21',
          'Parent',
          'Parent',
          '',
          '',
          1,
          'A',
          'Class 2',
        ],
      ]).arrayBuffer(),
    ),
  });
  await page.getByRole('button', { name: 'Next: preview', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Next: submit', exact: true })).toBeEnabled({
    timeout: 20000,
  });
  await page.reload();
  await expect(page.getByRole('button', { name: 'Next: submit', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Next: submit', exact: true }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Import students', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Student import · completed', exact: true }),
  ).toBeVisible({ timeout: 20000 });
  await page.getByRole('button', { name: 'Back to class students' }).click();
  await expect(page.getByLabel('Class students section')).toBeVisible();
  await expect(page.getByText('Class Workspace Student', { exact: true })).toBeVisible();
  await expect(page.locator('.setup-toolbar').first()).toContainText('1 sections · 1 students');
  await page.getByRole('tab', { name: 'Subjects', exact: true }).click();
  await page.getByLabel('Subject 1 name').fill('Unsaved name');
  await page.getByRole('button', { name: /Browser Test School.*School workspace/ }).click();
  page.once('dialog', (d) => d.dismiss());
  await page.getByLabel('Select school').selectOption({ label: 'Second Browser School' });
  await expect(page.getByLabel('Select school')).toHaveValue(school);
  page.once('dialog', (d) => d.accept());
  await page.getByLabel('Select school').selectOption({ label: 'Second Browser School' });
  await expect(page.getByText('An academic year is required for class settings.')).toBeVisible();
  await expect(page.getByLabel('Subject 1 name')).toHaveCount(0);
});
test('profile failure exposes no seed records and can be retried', async ({ page }) => {
  let fail = true;
  await page.route(`${api}/schools/*/profile`, async (route) =>
    fail
      ? route.fulfill({
          status: 503,
          json: { data: null, error: { code: 'SERVICE_UNAVAILABLE', message: 'private-secret' } },
        })
      : route.continue(),
  );
  await page.goto('/settings');
  await page.getByLabel('Email', { exact: true }).fill('browser-owner@example.test');
  await page.getByLabel('Password', { exact: true }).fill('Browser fixture passphrase 2026!');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'School profile unavailable' })).toBeVisible();
  await expect(page.locator('body')).not.toContainText('private-secret');
  await expect(page.locator('body')).not.toContainText('Willowbrook');
  fail = false;
  await page.getByRole('button', { name: 'Retry school profile' }).click();
  await expect(page.locator('.settings-profile h2')).toHaveText('Browser Test School');
});

test('General uses the original form and persists profile and timing changes', async ({ page }) => {
  await login(page);
  await page.getByRole('button', { name: 'Edit Details', exact: true }).click();
  await page
    .getByLabel('School motto', { exact: true })
    .fill('Persisted through the original form');
  await page.getByRole('button', { name: 'Save details', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.reload();
  await expect(page.locator('.settings-profile')).toContainText(
    'Persisted through the original form',
  );
  await page.getByRole('tab', { name: 'School Timing', exact: true }).click();
  await page.getByRole('button', { name: 'Edit Timing', exact: true }).click();
  await page.getByLabel('School opening time', { exact: true }).fill('08:00');
  await page.getByLabel('School closing time', { exact: true }).fill('14:00');
  await page.getByLabel('Monday', { exact: true }).check();
  await page.getByRole('button', { name: 'Save timing', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.reload();
  await page.getByRole('button', { name: 'Edit Timing', exact: true }).click();
  await expect(page.getByLabel('School opening time', { exact: true })).toHaveValue('08:00');
  await expect(page.getByLabel('Monday', { exact: true })).toBeChecked();
});

test('optional sections and multi-class Excel dialog route students and reconcile totals', async ({
  page,
}) => {
  await login(page);
  const school = await schoolId(page);
  await page.evaluate(
    async ({ api, school }) => {
      const token = (await (await fetch(`${api}/auth/csrf`, { credentials: 'include' })).json())
        .data.csrfToken;
      const headers = { 'content-type': 'application/json', 'x-csrf-token': token };
      const response = await fetch(`${api}/schools/${school}/academic-years`, {
        method: 'POST',
        credentials: 'include',
        headers,
        body: JSON.stringify({ name: 'Mixed import year', start: '2032-04-01', end: '2033-03-31' }),
      });
      if (response.status !== 201) throw new Error('Isolated year creation failed');
      const year = (await response.json()).data;
      const current = (
        await (
          await fetch(`${api}/schools/${school}/onboarding`, { credentials: 'include' })
        ).json()
      ).data;
      const selected = await fetch(`${api}/schools/${school}/academic-years/${year.id}/select`, {
        method: 'POST',
        credentials: 'include',
        headers,
        body: JSON.stringify({ revision: current.academicRevision }),
      });
      if (selected.status !== 200) throw new Error('Isolated year selection failed');
    },
    { api, school },
  );
  await page.goto('/settings?tab=Classes%2C+Sections+%26+Grades');
  await page.getByRole('button', { name: 'Set up classes', exact: true }).click();
  await page.getByLabel('Class 1 name', { exact: true }).fill('Class 12');
  await page.getByRole('button', { name: 'Add another class', exact: true }).click();
  await page.getByLabel('Class 2 name', { exact: true }).fill('Class 10');
  await page.getByLabel('Class 2 sections', { exact: true }).fill('A, B');
  await page.getByRole('button', { name: 'Create classes & sections', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByLabel('Setup class').selectOption({ label: 'Class 12' });
  await expect(page.locator('.selected-class-name')).toHaveText('12th');
  await expect(page.locator('.selected-class-name sup')).toHaveText('th');
  await expect(page.getByText('This class has no sections', { exact: true })).toBeVisible();
  await page.getByRole('tab', { name: 'Students', exact: true }).click();
  const url = page.url();
  await page.getByRole('button', { name: 'Import Excel (.xlsx)', exact: true }).click();
  await expect(
    page.getByRole('dialog', { name: 'Import students from Excel', exact: true }),
  ).toBeVisible();
  expect(page.url()).toBe(url);
  await expect(page.getByRole('button', { name: 'Next: preview', exact: true })).toBeDisabled();
  const row = (name: string, schoolClass: string, section = '') => [
    name,
    name,
    '2015-01-01',
    'Parent',
    'Parent',
    '',
    '',
    42,
    section,
    schoolClass,
  ];
  await page.getByLabel('Excel file (.xlsx)').setInputFiles({
    name: 'mixed.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: Buffer.from(
      await studentWorkbook([
        STUDENT_IMPORT_HEADERS,
        row('Senior Student', '12th'),
        row('Ten A', 'Class 10', 'A'),
        row('Ten B', '10th', 'B'),
      ]).arrayBuffer(),
    ),
  });
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(
    page.getByRole('dialog', { name: 'Discard selected workbook?', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Keep reviewing', exact: true }).click();
  await page.getByRole('button', { name: 'Next: preview', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Next: submit', exact: true })).toBeEnabled({
    timeout: 20000,
  });
  await page.getByRole('button', { name: 'Next: submit', exact: true }).click();
  await page.getByRole('button', { name: 'Import students', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Student import · completed', exact: true }),
  ).toBeVisible({ timeout: 20000 });
  await page.getByRole('button', { name: 'Back to class students', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Senior Student', exact: true })).toBeVisible();
  await expect(page.locator('.setup-toolbar').first()).toContainText('0 sections · 1 students');
  await page.getByLabel('Setup class').selectOption({ label: 'Class 10' });
  await expect(page.locator('.setup-toolbar').first()).toContainText('2 sections · 2 students');
  await expect(page.getByRole('link', { name: 'Ten A', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Ten B', exact: true })).toBeVisible();
  const select = page.getByLabel('Class students section');
  await select.selectOption({ label: 'A' });
  await expect(page.getByRole('link', { name: 'Ten B', exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Ten A', exact: true })).toBeVisible();
  await select.selectOption({ label: 'B' });
  await expect(page.getByRole('link', { name: 'Ten A', exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Ten B', exact: true })).toBeVisible();
  await select.selectOption('');
  await expect(page.getByRole('link', { name: 'Ten A', exact: true })).toBeVisible();
});

test('student import modal keeps errors readable and row correction usable at every viewport', async ({
  page,
}, info) => {
  test.setTimeout(90000);
  await login(page);
  const school = await schoolId(page);
  await page.evaluate(
    async ({ api, school }) => {
      const token = (await (await fetch(`${api}/auth/csrf`, { credentials: 'include' })).json())
        .data.csrfToken;
      const headers = { 'content-type': 'application/json', 'x-csrf-token': token };
      const response = await fetch(`${api}/schools/${school}/academic-years`, {
        method: 'POST',
        credentials: 'include',
        headers,
        body: JSON.stringify({
          name: 'Import layout year',
          start: '2034-04-01',
          end: '2035-03-31',
        }),
      });
      if (response.status !== 201) throw new Error('Isolated year creation failed');
      const year = (await response.json()).data;
      const current = (
        await (
          await fetch(`${api}/schools/${school}/onboarding`, { credentials: 'include' })
        ).json()
      ).data;
      const selected = await fetch(`${api}/schools/${school}/academic-years/${year.id}/select`, {
        method: 'POST',
        credentials: 'include',
        headers,
        body: JSON.stringify({ revision: current.academicRevision }),
      });
      if (selected.status !== 200) throw new Error('Isolated year selection failed');
    },
    { api, school },
  );
  await page.goto('/settings?tab=Classes%2C+Sections+%26+Grades');
  await page.getByRole('button', { name: 'Set up classes', exact: true }).click();
  await page.getByLabel('Class 1 name', { exact: true }).fill('Class 12');
  await page.getByLabel('Class 1 sections', { exact: true }).fill('A');
  await page.getByRole('button', { name: 'Create classes & sections', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('tab', { name: 'Students', exact: true }).click();
  await page.getByRole('button', { name: 'Import Excel (.xlsx)', exact: true }).click();
  const modal = page.getByRole('dialog', { name: 'Import students from Excel', exact: true });
  for (const width of [1366, 768, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(
      modal.getByLabel('Which classes are in this file?', { exact: false }),
    ).toBeVisible();
    expect(await modal.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    const select = await modal.locator('select').first().boundingBox();
    expect(select!.width).toBeGreaterThan(200);
    await page.screenshot({ path: info.outputPath(`upload-${width}.png`) });
  }
  await page.setViewportSize({ width: 1366, height: 900 });
  await modal.getByLabel('Excel file (.xlsx)').setInputFiles({
    name: 'corrections.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: Buffer.from(
      await studentWorkbook([
        STUDENT_IMPORT_HEADERS,
        ...[1, 2, 3, 4].map((i) => [
          `layout STUDENT ${i}`,
          `LAYOUT-${82000 + i}`,
          i === 1 ? 'not-a-date' : '12-01-2015',
          'Guardian',
          'Parent',
          '',
          'A long address '.repeat(12),
          i,
          'A',
          '12',
        ]),
      ]).arrayBuffer(),
    ),
  });
  await modal.getByRole('button', { name: 'Next: preview', exact: true }).click();
  await expect(modal.getByRole('heading', { name: 'Student import · draft' })).toBeVisible({
    timeout: 20000,
  });
  await expect(modal.getByRole('button', { name: 'Next: submit', exact: true })).toBeDisabled();
  const table = modal.getByRole('region', { name: 'Import preview and validation' });
  await expect(table.getByRole('columnheader', { name: 'Result', exact: true })).toHaveCount(0);
  await expect(table.getByRole('cell', { name: '12-01-2015', exact: true })).toHaveCount(3);
  await expect(table.getByRole('cell', { name: 'Layout Student 2', exact: true })).toBeVisible();
  const error = table.locator('.form-error').first();
  for (const width of [1366, 768, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await error.scrollIntoViewIfNeeded();
    const box = await error.boundingBox();
    expect(box!.width).toBeGreaterThan(240);
    expect(box!.height).toBeLessThan(180);
    expect(await modal.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    expect(await table.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
    await expect(modal.getByRole('button', { name: 'Close dialog', exact: true })).toBeInViewport();
    await page.screenshot({ path: info.outputPath(`preview-${width}.png`) });
  }
  await table.getByRole('button', { name: 'Edit row 2', exact: true }).click();
  const editor = page.getByRole('dialog', { name: 'Correct row 2', exact: true });
  await expect(editor.getByLabel('Birth Date', { exact: true })).toHaveValue('not-a-date');
  await expect(editor.getByRole('button', { name: 'Close dialog', exact: true })).toBeInViewport();
  expect(await editor.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
  await page.screenshot({ path: info.outputPath('row-editor-mobile.png') });
  await editor.getByLabel('Birth Date', { exact: true }).fill('12-01-2015');
  await editor.getByRole('button', { name: 'Save correction', exact: true }).click();
  await expect(editor).toHaveCount(0);
  await expect(modal.getByRole('button', { name: 'Next: submit', exact: true })).toBeEnabled({
    timeout: 20000,
  });
  await modal.getByRole('button', { name: 'Next: submit', exact: true }).click();
  const confirm = modal;
  await expect(confirm.getByRole('button', { name: 'Import students', exact: true })).toBeVisible();
  expect(await confirm.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
  await confirm.getByRole('button', { name: 'Import students', exact: true }).click();
  await expect(modal.getByRole('heading', { name: 'Student import · completed' })).toBeVisible({
    timeout: 20000,
  });
  await modal.getByRole('button', { name: 'Back to class students', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Layout Student 1', exact: true })).toBeVisible();
});

test('student manual fields, numeric duplicate errors, confirmed deletion and request limits', async ({
  page,
}) => {
  await login(page);
  const school = await schoolId(page);
  const setup = await page.evaluate(
    async ({ api, school }) => {
      const token = (await (await fetch(`${api}/auth/csrf`, { credentials: 'include' })).json())
        .data.csrfToken;
      const headers = { 'content-type': 'application/json', 'x-csrf-token': token };
      const post = async (path: string, body: unknown) => {
        const res = await fetch(`${api}/schools/${school}${path}`, {
          method: 'POST',
          credentials: 'include',
          headers,
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error('Fixture setup failed');
        return (await res.json()).data;
      };
      const year = await post('/academic-years', {
        name: 'Manual student checks',
        start: '2040-04-01',
        end: '2041-03-31',
      });
      await post(`/academic-years/${year.id}/classes/setup`, {
        rows: [{ name: 'Class 8', sections: ['A', 'B'] }],
      });
      const classes = (
        await (
          await fetch(`${api}/schools/${school}/academic-years/${year.id}/classes`, {
            credentials: 'include',
          })
        ).json()
      ).data.items;
      const current = (
        await (
          await fetch(`${api}/schools/${school}/onboarding`, { credentials: 'include' })
        ).json()
      ).data;
      await post(`/academic-years/${year.id}/select`, { revision: current.academicRevision });
      await post(`/academic-years/${year.id}/students`, {
        classId: classes[0].id,
        cells: [
          'First Manual Student',
          'SH-91001',
          '2015-01-01',
          'Parent',
          'Father',
          '',
          '',
          'SH-12',
          'A',
        ],
      });
      return { year: year.id, classId: classes[0].id };
    },
    { api, school },
  );
  const rosterCalls: string[] = [];
  page.on('request', (req) => {
    if (req.url().includes('/student-roster')) rosterCalls.push(req.url());
  });
  await page.goto(`/students/new?year=${setup.year}&classId=${setup.classId}`);
  await expect(page.getByLabel('Student name', { exact: true })).toBeVisible();
  expect(rosterCalls).toHaveLength(0);
  await page.getByLabel('Student name', { exact: true }).fill('Second Manual Student');
  await page.getByLabel('Admission number', { exact: true }).fill('AB-91001');
  await page.getByLabel('Date of birth', { exact: true }).fill('25-05-2015');
  await page.getByLabel('Guardian name', { exact: true }).fill('Parent');
  await page.getByLabel('Roll number', { exact: true }).fill('SH-13');
  await page.getByRole('button', { name: 'Save student', exact: true }).click();
  await expect(page.getByLabel('Admission number', { exact: true })).toHaveAttribute(
    'aria-invalid',
    'true',
  );
  await expect(page.locator('#student-error-admissionNumber')).toContainText('already assigned');
  await expect(page.getByLabel('Admission number', { exact: true })).toHaveCSS(
    'border-top-color',
    'rgb(180, 35, 24)',
  );
  await page.getByLabel('Admission number', { exact: true }).fill('SH-91002');
  await page.getByLabel('Roll number', { exact: true }).fill('AB-0012');
  await page.getByRole('button', { name: 'Save student', exact: true }).click();
  await expect(page.getByLabel('Roll number', { exact: true })).toHaveAttribute(
    'aria-invalid',
    'true',
  );
  await page.getByLabel('Student section').selectOption({ label: 'Section B' });
  await page.getByRole('button', { name: 'Save student', exact: true }).click();
  await expect(
    page.getByRole('link', { name: 'Second Manual Student', exact: true }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Edit student Second Manual Student', exact: true })
    .click();
  const edit = page.getByRole('dialog', { name: 'Edit student', exact: true });
  for (const label of [
    'Admission number',
    'Roll number',
    'Student class',
    'Student section',
    'Date of birth',
    'Guardian name',
    'Relationship',
    'Parent mobile',
    'Address (optional)',
    'Enrollment status',
  ])
    await expect(edit.getByLabel(label, { exact: true })).toBeEnabled();
  await edit.getByLabel('Student name', { exact: true }).fill('Edited Manual Student');
  await edit.getByLabel('Admission number', { exact: true }).fill('NEW-91003');
  await edit.getByLabel('Roll number', { exact: true }).fill('NEW-14');
  await edit.getByRole('button', { name: 'Save student', exact: true }).click();
  await expect(edit).toHaveCount(0);
  const row = page
    .getByRole('row')
    .filter({ has: page.getByRole('link', { name: 'Edited Manual Student', exact: true }) });
  await row.getByRole('button', { name: 'Delete', exact: true }).click();
  await page.getByRole('button', { name: 'Delete permanently', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Edited Manual Student', exact: true })).toHaveCount(
    0,
  );
  await page.getByLabel('Student directory class').selectOption(setup.classId);
  await expect(page.getByLabel('Class students section').locator('option')).toHaveText([
    'Whole class · all students',
    'A',
    'B',
  ]);
  const beforeSearch = rosterCalls.length;
  await page.getByPlaceholder('Search class students…').pressSequentially('First', { delay: 30 });
  await expect(page.getByRole('link', { name: 'First Manual Student', exact: true })).toBeVisible();
  await expect.poll(() => rosterCalls.filter((url) => url.includes('search=First')).length).toBe(1);
  expect(rosterCalls.length - beforeSearch).toBeLessThanOrEqual(2);
});
