import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSeed } from '../mocks/seed';
import { restoreSchoolState } from '../mocks/restore';
import { createTest, examinationSchema, testRoster, updateTest } from './academics';
import { examClasses, examIncludes } from './testScope';
import { overallLeaderboard, savedSubjects, saveMarksSheet, sheetDraft } from './academicSheets';
import { classSubjects, saveClassSubjects } from './classSubjects';
import { previewSheetImport, sheetTemplate } from './sheetImport';
import { roster } from './selectors';
import { studentReportMessage } from './reportShare';
import { deleteSchoolClass } from './classStructure';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-15T06:30:00Z'));
});
afterEach(() => vi.useRealTimers());
const input = {
  name: 'Shared practice',
  kind: 'Weekly Practice',
  date: '2026-10-15',
  classId: '',
  classIds: ['class-8', 'class-9'],
  sectionIds: ['class-8-a', 'class-8-b', 'class-9-b'],
};
function setup() {
  const fresh = createSeed('2026-10-15');
  fresh.exams = [];
  fresh.results = [];
  const state = createTest(fresh, input);
  return { state, exam: state.exams[0] };
}

describe('multiple classes with their selected sections', () => {
  it('assigns one test to multiple classes without including unselected sections', () => {
    const { state, exam } = setup();
    expect(examClasses(state, exam).map((c) => c.id)).toEqual(['class-8', 'class-9']);
    expect(testRoster(state, exam)).toHaveLength(36);
    expect(examIncludes(exam, 'class-9', 'class-9-a')).toBe(false);
    expect(examIncludes(exam, 'class-7', 'class-7-b')).toBe(false);
    expect(examIncludes(exam, 'class-9', 'class-9-b')).toBe(true);
    expect(examinationSchema.parse(exam).classIds).toEqual(input.classIds);
  });
  it('requires valid unique classes and at least one selected section per class', () => {
    const { state } = setup();
    for (const invalid of [
      { ...input, classIds: [] },
      { ...input, classIds: ['class-8', 'class-8'] },
      { ...input, classIds: ['class-8', 'unknown'] },
      { ...input, sectionIds: ['class-8-a'] },
      { ...input, sectionIds: [] },
      { ...input, sectionIds: ['class-8-a', 'class-9-b', 'class-7-a'] },
      { ...input, sectionIds: ['class-8-a', 'class-9-b', 'class-9-b'] },
    ])
      expect(() => createTest(state, invalid)).toThrow();
  });
  it('keeps different classes’ subject configuration, maximums, results and rankings separate', () => {
    let { state, exam } = setup();
    state = saveClassSubjects(
      state,
      'class-9',
      classSubjects(state, 'class-9').map((s) =>
        s.name === 'Mathematics' ? { ...s, name: 'Advanced Maths' } : s,
      ),
    );
    const a = sheetDraft(state, exam, 'class-8-a');
    a.columns[0].maximum = '20';
    a.rows[0].cells[0] = '18';
    state = saveMarksSheet(state, exam.id, 'class-8-a', a.columns, a.rows);
    const b = sheetDraft(state, state.exams[0], 'class-9-b');
    b.columns[0].maximum = '100';
    b.rows[0].cells[0] = '80';
    expect(b.columns[0].name).toBe('Advanced Maths');
    state = saveMarksSheet(state, exam.id, 'class-9-b', b.columns, b.rows);
    exam = state.exams[0];
    expect(sheetDraft(state, exam, 'class-8-a').rows[0].cells[0]).toBe('18');
    expect(savedSubjects(state, exam, 'class-8-a')[0]).toMatchObject({
      name: 'Mathematics',
      maxMarks: 20,
    });
    expect(savedSubjects(state, exam, 'class-9-b')[0]).toMatchObject({
      name: 'Advanced Maths',
      maxMarks: 100,
    });
    expect(
      overallLeaderboard(
        state,
        roster(state).filter((r) => r.enrollment.classId === 'class-8'),
        [exam],
      )[0],
    ).toMatchObject({ marks: 18, maximum: 20, percentage: 90 });
    expect(
      overallLeaderboard(
        state,
        roster(state).filter((r) => r.enrollment.classId === 'class-9'),
        [exam],
      )[0],
    ).toMatchObject({ marks: 80, maximum: 100, percentage: 80 });
    expect(studentReportMessage(state, b.students[0], [exam])).toContain('Advanced Maths');
    expect(
      studentReportMessage(
        state,
        roster(state).find((r) => r.enrollment.sectionId === 'class-9-a')!,
        [exam],
      ),
    ).toBe('');
    const restored = restoreSchoolState(createSeed(), structuredClone(state));
    expect(restored.exams).toEqual(state.exams);
    expect(restored.results).toEqual(state.results);
  });
  it('allows adding class assignments and protects scopes with saved marks', () => {
    const { state, exam } = setup(),
      d = sheetDraft(state, exam, 'class-8-a');
    d.columns[0].maximum = '20';
    d.rows[0].cells[0] = '18';
    const saved = saveMarksSheet(state, exam.id, 'class-8-a', d.columns, d.rows);
    const extended = updateTest(saved, exam.id, {
      ...input,
      classIds: [...input.classIds, 'class-10'],
      sectionIds: [...input.sectionIds, 'class-10-a'],
    });
    expect(extended.results).toEqual(saved.results);
    expect(() =>
      updateTest(saved, exam.id, { ...input, classIds: ['class-9'], sectionIds: ['class-9-b'] }),
    ).toThrow(/saved marks/);
    expect(() => deleteSchoolClass(saved, 'class-8')).toThrow();
  });
  it('rejects another class or section’s import even when roll and name are identical', () => {
    const { state, exam } = setup(),
      d = sheetDraft(state, exam, 'class-8-a');
    d.columns[0].maximum = '20';
    const grid = sheetTemplate(d.columns, d.students);
    grid[2][4] = '18';
    expect(previewSheetImport(d.columns, d.rows, d.students, grid).changes).toHaveLength(1);
    for (const [column, value] of [
      [2, 'Grade 9'],
      [3, 'B'],
    ] as const) {
      const wrong = structuredClone(grid);
      wrong[2][column] = value;
      expect(() => previewSheetImport(d.columns, d.rows, d.students, wrong)).toThrow(
        /different class or section/,
      );
    }
  });
  it('retains the meaning of older single-class and shared-school tests', () => {
    const state = createSeed('2026-10-15'),
      legacy = state.exams.find((e) => e.id === 'exam-daily')!;
    expect(examClasses(state, legacy)).toHaveLength(state.classes.length);
    const single = { ...legacy, classId: 'class-8', sectionId: 'class-8-a' };
    expect(examClasses(state, single).map((c) => c.id)).toEqual(['class-8']);
    expect(testRoster(state, single)).toHaveLength(12);
  });
});
