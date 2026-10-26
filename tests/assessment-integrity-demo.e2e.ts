import { expect, test } from '@playwright/test';
import { loadAcademicFixture, savedAcademics } from './academicFixture';

for (const mobile of [false, true]) {
  test(`test types show all choices with Daily test prefilled, support search and retain the saved choice (${mobile ? 'mobile' : 'desktop'})`, async ({
    page,
  }) => {
    if (mobile) await page.setViewportSize({ width: 390, height: 844 });
    await loadAcademicFixture(page);
    await page.goto('/academics?class=class-8');
    await page.getByRole('button', { name: 'Add Test / Exam', exact: true }).click();
    const dialog = page.getByRole('dialog');
    const type = dialog.getByRole('combobox', { name: 'Test type', exact: true });
    await expect(type).toHaveValue('Daily test');
    await dialog.getByRole('button', { name: 'Show all test types' }).click();
    for (const choice of [
      'Daily test',
      'Monthly test',
      'Half-Yearly Examination',
      'Pre-Board Examination',
      'Yearly Examination',
      'Term exam',
    ]) {
      await expect(dialog.getByRole('option', { name: choice, exact: true })).toBeVisible();
    }
    await dialog.getByRole('option', { name: 'Monthly test', exact: true }).click();
    await expect(type).toHaveValue('Monthly test');
    await type.focus();
    await type.press('ArrowDown');
    await type.press('ArrowDown');
    await type.press('Enter');
    await expect(type).toHaveValue('Half-Yearly Examination');
    await type.fill('Yearly');
    await expect(dialog.getByRole('option', { name: 'Daily test', exact: true })).toHaveCount(0);
    await dialog.getByRole('option', { name: 'Yearly Examination', exact: true }).click();
    await dialog.getByLabel('Test name', { exact: true }).fill('Dropdown Regression');
    await dialog.getByLabel('Default maximum marks').fill('20');
    await dialog.getByRole('button', { name: 'Create Test', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await page.reload();
    await page.getByLabel('More options for Dropdown Regression').click();
    await page.getByRole('button', { name: 'Edit Test', exact: true }).click();
    await expect(type).toHaveValue('Yearly Examination');
    await type.fill('Practical assessment');
    await dialog.getByRole('option', { name: 'Use “Practical assessment”', exact: true }).click();
    await dialog.getByRole('button', { name: 'Save test', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    expect(
      (await savedAcademics(page)).exams.find((e) => e.name === 'Dropdown Regression')?.kind,
    ).toBe('Practical assessment');
  });
}

test('assessment maxima persist while switching sections; full results show marks and true tied ranks on a normal page', async ({
  page,
}) => {
  await loadAcademicFixture(page);
  await page.goto('/academics?class=class-8');
  await page.getByRole('button', { name: 'Add Test / Exam', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Test type', { exact: true }).fill('Yearly Examination');
  await dialog.getByLabel('Test name', { exact: true }).fill('Combined Assessment');
  await dialog.getByLabel('Default maximum marks').fill('20');
  await dialog.getByRole('button', { name: 'Create Test', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page
    .getByRole('button', { name: 'Add/Edit Marks for Combined Assessment', exact: true })
    .click();
  await expect(dialog.getByLabel('Marks section')).toHaveValue('');
  await expect(dialog.locator('tbody tr')).toHaveCount(24);
  const maximum = dialog.getByLabel('Mathematics maximum marks', { exact: true });
  await expect(maximum).toHaveValue('20');
  await expect(maximum).toBeDisabled();
  await dialog.locator('tbody tr').nth(0).locator('input').first().fill('10');
  await dialog.locator('tbody tr').nth(1).locator('input').first().fill('10');
  await dialog.locator('tbody tr').nth(2).locator('input').first().fill('A');
  await dialog.getByLabel('Marks section').selectOption('class-8-b');
  await expect(maximum).toHaveValue('20');
  await dialog.locator('tbody tr').first().locator('input').first().fill('20');
  await dialog.getByLabel('Marks section').selectOption('');
  await expect(maximum).toHaveValue('20');
  await dialog.getByRole('button', { name: 'Save Marks', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page.reload();
  await page.getByRole('tab', { name: 'Results', exact: true }).click();
  await expect(page.locator('.academic-overall')).toContainText('marks');
  await page.getByRole('tab', { name: 'Recent Results', exact: true }).click();
  await page
    .locator('.academic-result-card')
    .filter({ hasText: 'Combined Assessment' })
    .getByRole('button', { name: 'View Result' })
    .click();
  await expect(dialog).toHaveCount(0);
  const result = page.locator('.assessment-result-page');
  await expect(result).toContainText('10/20');
  await expect(result).toContainText('50.0%');
  await expect(result.locator('tbody tr').filter({ hasText: '#2' })).toHaveCount(2);
  const absent = result.locator('tbody tr').filter({ hasText: 'Absent' });
  await expect(absent).toHaveCount(1);
  await expect(absent.locator('td').first()).toHaveText('—');
  await expect(result.locator('tfoot')).toHaveCount(0);
  const state = await savedAcademics(page);
  const first = state.students.find(
    (s) =>
      s.id ===
      state.enrollments.find(
        (e) =>
          e.id ===
          state.results.find(
            (r) => r.examId === state.exams.find((e) => e.name === 'Combined Assessment')?.id,
          )!.enrollmentId,
      )!.studentId,
  )!;
  await result
    .getByPlaceholder('Search name, roll or admission number…')
    .fill(first.admissionNumber);
  await expect(result.locator('tbody tr')).toHaveCount(1);
  await result.getByPlaceholder('Search name, roll or admission number…').fill('');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    .toBe(true);
  await expect(page.locator('.sidebar')).not.toBeInViewport();
  await page.screenshot({ path: '/tmp/assessment-results-mobile-20261020.png', fullPage: true });
  await page.reload();
  await expect(page.locator('.assessment-result-page')).toContainText('Combined Assessment');
});

test('an explicit maximum edit confirms its effect, rejects a maximum below recorded scores, and never rescales marks', async ({
  page,
}) => {
  await loadAcademicFixture(page);
  await page.goto('/academics?class=class-8');
  await page.getByRole('button', { name: 'Add/Edit Marks for Daily Practice' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Mathematics maximum marks', { exact: true }).fill('20');
  await dialog.locator('tbody tr').first().locator('input').first().fill('18');
  await dialog.getByRole('button', { name: 'Save Marks', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page.getByLabel('More options for Daily Practice').click();
  await page.getByRole('button', { name: 'Edit Test', exact: true }).click();
  // Metadata-only legacy assessments retain all configured subjects. Supply valid maxima for each before saving.
  const maxima = dialog.locator('.assessment-maximum-field input');
  for (const input of await maxima.all()) await input.fill('20');
  await dialog.getByLabel('Grade 8 Mathematics maximum marks').fill('17');
  await dialog.getByText('Apply these maximums to every section').click();
  await dialog.getByRole('button', { name: 'Save test', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('lower than');
  await dialog.getByLabel('Grade 8 Mathematics maximum marks').fill('40');
  await dialog.getByText('Apply these maximums to every section').click();
  await dialog.getByRole('button', { name: 'Save test', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  const state = await savedAcademics(page);
  expect(
    state.results.find((r) => r.subjects.some((s) => s.marks === 18))!.subjects[0],
  ).toMatchObject({ marks: 18, maxMarks: 40 });
});
