import { test, expect } from '@playwright/test';
import { createSeed } from '../src/mocks/seed';
import { STORAGE_KEY } from '../src/lib/config';
import { encodeSchoolStorage } from '../src/lib/schoolStorage';
import { STUDENT_IMPORT_HEADERS } from '../src/lib/studentImport';
import { studentWorkbook } from '../src/lib/xlsx';
import { academicFixture } from './academicFixture';
import AxeBuilder from '@axe-core/playwright';

const classesUrl = '/settings?tab=Classes%2C+Sections+%26+Grades&classId=class-5';
async function setup(page: import('@playwright/test').Page, state = createSeed('2026-10-18')) {
  await page.clock.setFixedTime(new Date('2026-10-18T06:30:00Z'));
  await page.addInitScript(
    ({ key, value }) => {
      if (!localStorage.getItem(key)) localStorage.setItem(key, value);
    },
    { key: STORAGE_KEY, value: encodeSchoolStorage(state) },
  );
}
async function saved(page: import('@playwright/test').Page) {
  return page.evaluate(async (key) => {
    const { decodeSchoolStorage } = await import('/src/lib/schoolStorage.ts');
    return decodeSchoolStorage(localStorage.getItem(key)!);
  }, STORAGE_KEY);
}

test('settings capsule and feature routes remove unwanted sections and work on mobile', async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await setup(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Leave follow-up' })).toHaveCount(0);
  await page.goto('/settings');
  await expect(page.getByRole('tab', { name: 'Attendance', exact: true })).toHaveCount(0);
  await expect(page.getByRole('tab', { name: 'School Profile', exact: true })).toBeVisible();
  await page.getByRole('tab', { name: 'School Timing', exact: true }).click();
  await expect(page).toHaveURL(/section=timing/);
  await expect(page.getByText('School opening time', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('tab', { name: 'School Timing' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await page.getByRole('tab', { name: 'Staff & Payroll', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Work & Leave Rules', exact: true })).toHaveCount(
    0,
  );
  await page.getByRole('tab', { name: 'Work & Leave', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Work & Leave Rules', exact: true }),
  ).toBeVisible();
  await page.getByRole('tab', { name: 'Payroll', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Payroll Settings', exact: true })).toBeVisible();
  await page.getByRole('tab', { name: 'Data & Security', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Backup & Restore' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Data Export', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Login & Session Security' })).toHaveCount(0);
  await page.getByRole('tab', { name: 'Login & Sessions', exact: true }).click();
  await expect(page.getByLabel('Auto logout after inactivity')).toBeVisible();
  await page.getByRole('tab', { name: 'Activity Log', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Activity Log', exact: true })).toBeVisible();
  await page.getByRole('tab', { name: 'Preferences', exact: true }).click();
  await expect(page.getByLabel('Date Format', { exact: true })).toHaveCount(0);
  await page.getByRole('tab', { name: 'Default Context', exact: true }).click();
  await expect(page.getByLabel('Week Starts On', { exact: true })).toBeVisible();
  await page.goto(classesUrl);
  await expect(page.getByLabel('Setup class')).toBeVisible();
  await page.screenshot({
    path: info.outputPath('settings-desktop.png'),
    fullPage: true,
    animations: 'disabled',
  });
  const capsule = await page
    .locator('.settings-tabs > div')
    .evaluate((element) => getComputedStyle(element).borderRadius);
  expect(parseFloat(capsule)).toBeGreaterThanOrEqual(24);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: info.outputPath('settings-mobile.png'),
    fullPage: true,
    animations: 'disabled',
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('tab', { name: 'Students', exact: true }).click();
  await expect(page.getByLabel('Class students section')).toHaveValue('');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test('one class roster shows all sections and routed admission preserves manual numbers', async ({
  page,
}, info) => {
  await setup(page);
  await page.goto(classesUrl + '&section=students');
  await expect(
    page.getByRole('region', { name: 'Class students', exact: true }).locator('tbody tr'),
  ).toHaveCount(24);
  await expect(page.getByLabel('Class students section')).toHaveValue('');
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.getByRole('button', { name: 'Add student', exact: true }).click();
  await expect(page).toHaveURL(/\/students\/new\?/);
  await expect(page.getByRole('heading', { name: 'Add student', exact: true })).toBeInViewport();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const form = page.getByRole('region', { name: 'Add student', exact: true });
  await expect(form.getByLabel('Admission number')).toBeEditable();
  await expect(form.getByLabel('Roll number')).toBeEditable();
  await form.getByLabel('Student name', { exact: true }).fill('New Manual Student');
  await form.getByLabel('Admission number', { exact: true }).fill('OFFICE-2026-501');
  await form.getByLabel('Roll number', { exact: true }).fill('57');
  await form.getByLabel('Date of birth', { exact: true }).fill('2015-04-01');
  await form.getByLabel('Student section', { exact: true }).selectOption('class-5-b');
  await form.getByLabel('Guardian name', { exact: true }).fill('School Parent');
  await form.getByLabel('Total Fee', { exact: true }).fill('9000');
  await form.getByLabel('Fee due date').fill('2026-12-01');
  await page.screenshot({
    path: info.outputPath('routed-student-form.png'),
    fullPage: true,
    animations: 'disabled',
  });
  await form.getByRole('button', { name: 'Save student', exact: true }).click();
  await expect(page).toHaveURL(/section=students/);
  await expect(
    page.getByRole('region', { name: 'Class students', exact: true }).locator('tbody tr'),
  ).toHaveCount(25);
  const row = page.getByRole('row').filter({ hasText: 'OFFICE-2026-501' });
  await expect(row).toContainText('Section B');
  await expect(row).toContainText('57');
  await row.getByRole('button', { name: 'Edit student New Manual Student', exact: true }).click();
  await page.getByLabel('Student name', { exact: true }).fill('Aaa Renamed Student');
  await expect(page.getByLabel('Roll number', { exact: true })).toHaveValue('57');
  await page.getByRole('button', { name: 'Save student', exact: true }).click();
  await page.reload();
  const state = await saved(page);
  const added = state.students.find((student) => student.admissionNumber === 'OFFICE-2026-501')!;
  expect(state.enrollments.find((entry) => entry.studentId === added.id)?.rollNumber).toBe(57);
  expect(added.name).toBe('Aaa Renamed Student');
  await expect(page.getByRole('row').filter({ hasText: 'OFFICE-2026-501' })).toContainText('57');
});

test('single workbook routes students to multiple sections and rejects invalid rows atomically', async ({
  page,
}, info) => {
  await setup(page);
  await page.goto(classesUrl + '&section=students');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download Sample Excel' }).click();
  expect((await download).suggestedFilename()).toContain('.xlsx');
  await page.getByRole('button', { name: 'Import Excel (.xlsx)', exact: true }).click();
  await expect(page).toHaveURL(/students\/import\?/);
  await expect(page.getByRole('heading', { name: 'Import students from Excel' })).toBeInViewport();
  const grid = [
    STUDENT_IMPORT_HEADERS,
    ['Batch Alpha', 'BATCH-A-1', '2015-05-21', 'Parent', '', '', '', 51, 'A'],
    ['Batch Beta', 'BATCH-B-1', '2015-05-21', 'Parent', '', '', '', 51, 'Section B'],
  ];
  const upload = async (rows: (string | number)[][]) =>
    page.getByLabel('Excel file (.xlsx)').setInputFiles({
      name: 'class-students.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: Buffer.from(await studentWorkbook(rows).arrayBuffer()),
    });
  const invalid = grid.map((row) => [...row]);
  invalid[2][8] = 'Z';
  await upload(invalid);
  await expect(page.getByRole('button', { name: 'Import 2 students', exact: true })).toBeDisabled();
  expect(
    (await saved(page)).students.some((student) => student.admissionNumber === 'BATCH-A-1'),
  ).toBe(false);
  await upload(grid);
  await expect(page.getByRole('button', { name: 'Import 2 students', exact: true })).toBeEnabled();
  await expect(page.locator('.import-preview')).toContainText('Section B');
  await page.screenshot({
    path: info.outputPath('class-import-preview.png'),
    fullPage: true,
    animations: 'disabled',
  });
  await page.getByRole('button', { name: 'Import 2 students', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Grade 5 students', exact: true })).toBeVisible();
  const state = await saved(page);
  for (const [admission, section] of [
    ['BATCH-A-1', 'class-5-a'],
    ['BATCH-B-1', 'class-5-b'],
  ]) {
    const student = state.students.find((entry) => entry.admissionNumber === admission)!;
    expect(state.enrollments.find((entry) => entry.studentId === student.id)).toMatchObject({
      sectionId: section,
      rollNumber: 51,
    });
  }
  await page.reload();
  await expect(
    page.getByRole('region', { name: 'Class students', exact: true }).locator('tbody tr'),
  ).toHaveCount(26);
});

test('unsaved subjects and routed student/import forms can keep or discard changes', async ({
  page,
}) => {
  await setup(page);
  await page.goto(classesUrl + '&section=subjects');
  await page.getByLabel('Subject 1 name', { exact: true }).fill('Changed Maths');
  await page.getByRole('tab', { name: 'Students', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Keep editing', exact: true }).click();
  await expect(page.getByLabel('Subject 1 name', { exact: true })).toHaveValue('Changed Maths');
  await page.getByRole('tab', { name: 'Students', exact: true }).click();
  await page.getByRole('button', { name: 'Discard changes', exact: true }).click();
  await page.getByRole('button', { name: 'Add student', exact: true }).click();
  await page.getByLabel('Student name', { exact: true }).fill('Unsaved Student');
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Discard student changes?' })).toBeVisible();
  await page.getByRole('button', { name: 'Keep editing', exact: true }).click();
  await expect(page.getByLabel('Student name', { exact: true })).toHaveValue('Unsaved Student');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('button', { name: 'Discard changes', exact: true }).click();
  await expect(page).toHaveURL(/section=students/);
});

test('finance and academics show one nested feature at a time with independent URLs', async ({
  page,
}, info) => {
  await setup(page, academicFixture(true));
  await page.goto('/fees');
  await expect(page.getByText('Net Revenue', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Salary Overview', exact: true })).toHaveCount(0);
  await page.getByRole('tab', { name: 'Salary Summary', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Salary Overview', exact: true })).toBeVisible();
  await expect(page.getByText('Net Revenue', { exact: true })).toHaveCount(0);
  await page.getByRole('tab', { name: 'Student Fees', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'Student balances', exact: true })).toBeVisible();
  await page.goto('/academics?class=class-8&view=results');
  await expect(page.getByRole('heading', { name: 'Overall Performance — Grade 8' })).toBeVisible();
  await expect(page.getByLabel('Results month')).toHaveCount(0);
  await page.getByRole('tab', { name: 'Recent Results', exact: true }).click();
  await expect(page.getByLabel('Results month')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Overall Performance — Grade 8' })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('tab', { name: 'Recent Results', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await page.screenshot({
    path: info.outputPath('academics-navigation.png'),
    fullPage: true,
    animations: 'disabled',
  });
});

test('new navigation and admission/import pages have accessible controls at desktop and mobile sizes', async ({
  page,
}) => {
  test.setTimeout(120000);
  await setup(page);
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const url of [
      classesUrl + '&section=students',
      '/students/new',
      '/students/import?classId=class-5',
    ]) {
      await page.goto(url);
      await expect(page.locator('.routed-form, .class-students-panel').first()).toBeVisible();
      const result = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze();
      expect(
        result.violations.map((entry) => ({
          id: entry.id,
          targets: entry.nodes.map((node) => node.target),
        })),
      ).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      if (url === '/students/new') {
        await expect(page.getByLabel('Student class', { exact: true })).toHaveValue('class-5');
        await expect(page.getByLabel('Student section', { exact: true })).toHaveValue('class-5-a');
      }
    }
  }
});

test('preferences and letterhead drafts survive sub-tabs and timing edits open their own fields', async ({
  page,
}) => {
  await setup(page);
  await page.goto('/settings?tab=Preferences');
  await page.getByLabel('Time Format', { exact: true }).selectOption('24-hour');
  await page.getByRole('tab', { name: 'Default Context', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByLabel('Week Starts On', { exact: true }).selectOption('Sunday');
  await page.getByRole('button', { name: 'Save preferences', exact: true }).click();
  await page.getByRole('tab', { name: 'Regional & Display', exact: true }).click();
  await expect(page.getByLabel('Time Format', { exact: true })).toHaveValue('24-hour');
  await page.reload();
  await expect(page.getByLabel('Time Format', { exact: true })).toHaveValue('24-hour');
  await page.getByRole('tab', { name: 'Templates', exact: true }).click();
  await page.getByRole('button', { name: 'Remove Header', exact: true }).click();
  await page.getByRole('tab', { name: 'Fee Receipt', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('.template-option')).toHaveCount(6);
  await page.getByRole('tab', { name: 'Salary Slip', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Save templates', exact: true }).click();
  await page.getByRole('tab', { name: 'School Letterhead', exact: true }).click();
  await expect(page.getByRole('img', { name: 'Header artwork', exact: true })).toHaveCount(0);
  await page.getByRole('tab', { name: 'General', exact: true }).click();
  await page.getByRole('tab', { name: 'School Timing', exact: true }).click();
  await page.getByRole('button', { name: 'Edit Timing', exact: true }).click();
  await expect(page.getByLabel('School name', { exact: true })).toHaveCount(0);
  await page.getByLabel('School opening time', { exact: true }).fill('09:00');
  await page.getByLabel('School closing time', { exact: true }).fill('16:00');
  await page.getByLabel('Monday', { exact: true }).check();
  await page.getByRole('button', { name: 'Save timing', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('.settings-profile-details')).toContainText('09:00');
});
