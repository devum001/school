import { expect, type Page } from '@playwright/test';
import { createSeed } from '../src/mocks/seed';
import { STORAGE_KEY } from '../src/lib/config';
import { encodeSchoolStorage } from '../src/lib/schoolStorage';
import { sheetDraft, saveMarksSheet } from '../src/lib/academicSheets';
import type { DemoState } from '../src/types/domain';
export function academicFixture(marked = false) {
  let state = createSeed('2026-10-15');
  state.exams = [
    {
      id: 'flow-test',
      schoolId: state.school.id,
      academicYearId: state.academicYear.id,
      name: 'Daily Practice',
      kind: 'Weekly Practice',
      date: '2026-10-15',
      classId: 'class-8',
      sectionId: '',
      sectionIds: ['class-8-a', 'class-8-b'],
      subjects: [],
    },
  ];
  state.results = [];
  if (marked) {
    const d = sheetDraft(state, state.exams[0], 'class-8-a');
    d.columns[0].maximum = '20';
    d.rows[0].cells[0] = '18';
    d.rows[1].cells[0] = 'A';
    state = saveMarksSheet(state, 'flow-test', 'class-8-a', d.columns, d.rows);
  }
  return state;
}
export async function loadAcademicFixture(page: Page, state = academicFixture()) {
  await page.clock.setFixedTime(new Date('2026-10-15T06:30:00Z'));
  await page.addInitScript(
    ({ key, raw }) => {
      if (!localStorage.getItem(key)) localStorage.setItem(key, raw);
    },
    { key: STORAGE_KEY, raw: encodeSchoolStorage(state) },
  );
  return state;
}
export async function openSheet(page: Page) {
  await page.goto('/academics?class=class-8');
  await page
    .getByRole('button', { name: 'Add/Edit Marks for Daily Practice', exact: true })
    .click();
  await expect(page.getByRole('dialog')).toBeVisible();
}
export async function savedAcademics(page: Page) {
  return page.evaluate(async (key) => {
    const { decodeSchoolStorage } = await import('/src/lib/schoolStorage.ts');
    return decodeSchoolStorage(localStorage.getItem(key)!) as DemoState;
  }, STORAGE_KEY);
}
