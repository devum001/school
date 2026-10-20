import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSeed } from '../mocks/seed';
import { restoreSchoolState } from '../mocks/restore';
import { createTest, testRoster, updateTest } from './academics';
import { examClasses, examIncludes } from './testScope';
import { examGroups } from './academicGroups';
import {
  marksAdded,
  overallLeaderboard,
  savedSubjects,
  saveMarksSheet,
  sectionStats,
  sheetDraft,
  subjectResults,
} from './academicSheets';
import { previewSheetImport, sheetTemplate } from './sheetImport';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-15T06:30:00Z'));
});
afterEach(() => vi.useRealTimers());

function fixture() {
  const state = createSeed('2026-10-15');
  state.exams = [];
  state.results = [];
  state.sections = state.sections.filter((s) => s.classId !== 'class-9');
  let roll = 0;
  state.enrollments = state.enrollments.map((e) =>
    e.classId === 'class-9' ? { ...e, sectionId: '', rollNumber: ++roll } : e,
  );
  const unsectioned = state.enrollments.find((e) => e.classId === 'class-8')!;
  unsectioned.sectionId = '';
  return createTest(state, {
    name: 'Class and section results',
    date: '2026-10-15',
    classId: '',
    classIds: ['class-8', 'class-9'],
    sectionIds: ['class-8-a', 'class-8-b'],
    sectionlessClassIds: ['class-8', 'class-9'],
  });
}
function score(
  state: ReturnType<typeof fixture>,
  classId: string,
  section: string,
  max: string,
  mark: string,
) {
  const draft = sheetDraft(state, state.exams[0], section, classId);
  draft.columns[0].maximum = max;
  draft.rows[0].cells[0] = mark;
  return saveMarksSheet(state, state.exams[0].id, section, draft.columns, draft.rows, classId);
}

describe('academic results with optional sections', () => {
  it('includes sectionless classes explicitly and keeps section-only exams restricted', () => {
    const state = fixture(),
      exam = state.exams[0];
    expect(examClasses(state, exam).map((c) => c.id)).toEqual(['class-8', 'class-9']);
    expect(examGroups(state, exam)).toHaveLength(4);
    expect(testRoster(state, exam)).toHaveLength(48);
    expect(examIncludes({ ...exam, sectionlessClassIds: [] }, 'class-8', '')).toBe(false);
    expect(examIncludes(exam, 'class-10', '')).toBe(false);
    expect(() => createTest(state, { ...exam, sectionlessClassIds: ['class-10'] })).toThrow();
    expect(() =>
      createTest(state, { ...exam, sectionlessClassIds: ['class-9', 'class-9'] }),
    ).toThrow();
  });
  it('saves and restores two sectionless class sheets independently, including their imports', () => {
    let state = fixture();
    state = score(state, 'class-8', '', '20', '18');
    state = score(state, 'class-9', '', '50', '35');
    const restored = restoreSchoolState(createSeed(), structuredClone(state));
    expect(restored.exams).toEqual(state.exams);
    const exam = restored.exams[0];
    expect(sheetDraft(restored, exam, '', 'class-8').rows[0].cells[0]).toBe('18');
    expect(sheetDraft(restored, exam, '', 'class-9').rows[0].cells[0]).toBe('35');
    const draft = sheetDraft(restored, exam, '', 'class-9');
    const grid = sheetTemplate(draft.columns, draft.students);
    grid[2][5] = '40';
    expect(grid[2][3]).toBe('');
    expect(
      previewSheetImport(draft.columns, draft.rows, draft.students, grid).changes,
    ).toHaveLength(1);
    grid[2][2] = 'Grade 8';
    expect(previewSheetImport(draft.columns, draft.rows, draft.students, grid).issues).toHaveLength(
      1,
    );
    const otherRows = sheetDraft(restored, exam, '', 'class-8').rows;
    expect(() =>
      saveMarksSheet(restored, exam.id, '', draft.columns, otherRows, 'class-9'),
    ).toThrow(/roster changed/);
    expect(() => saveMarksSheet(restored, exam.id, '', draft.columns, draft.rows)).toThrow(
      /Choose a class/,
    );
  });
  it('keeps combined student, absent and pending totals equal to the sum of student groups', () => {
    let state = fixture();
    state = score(state, 'class-8', 'class-8-a', '20', '18');
    state = score(state, 'class-8', 'class-8-b', '20', '10');
    state = score(state, 'class-8', '', '20', 'A');
    const exam = state.exams[0];
    const combined = sectionStats(state, exam, undefined, 'class-8');
    const groups = examGroups(state, exam, 'class-8').map((g) =>
      sectionStats(state, exam, g.sectionId, g.classId),
    );
    for (const key of ['students', 'absent', 'pending'] as const)
      expect(combined[key]).toBe(groups.reduce((n, g) => n + g[key], 0));
    expect(combined.students).toBe(24);
    expect(combined.average).toBeCloseTo((90 + 50) / 2);
    expect(marksAdded(state, exam, '', 'class-8')).toBe(true);
    expect(marksAdded(state, exam, '', 'class-9')).toBe(false);
    const subject = savedSubjects(state, exam, undefined, 'class-8')[0];
    const result = subjectResults(state, exam, undefined, subject, 'class-8');
    expect(result.average).toBeCloseTo((90 + 50) / 2);
    expect(result.rows.filter((r) => r.percentage !== null).map((r) => r.percentage)).toEqual([
      90, 50,
    ]);
    expect(result.absent).toBe(1);
    expect(result.pending).toBe(21);
    const ranks = overallLeaderboard(
      state,
      testRoster(state, exam).filter((r) => r.enrollment.classId === 'class-8'),
      [exam],
    );
    expect(ranks.map((r) => r.rank)).toEqual([1, 2]);
    expect(ranks.map((r) => r.percentage)).toEqual([90, 50]);
  });
  it('distinguishes subjects excluded in a section from pending student marks', () => {
    let state = score(fixture(), 'class-8', 'class-8-a', '20', '18');
    const b = sheetDraft(state, state.exams[0], 'class-8-b');
    b.columns[2].maximum = '50';
    b.rows[0].cells[2] = '40';
    state = saveMarksSheet(state, state.exams[0].id, 'class-8-b', b.columns, b.rows);
    const exam = state.exams[0],
      subjects = savedSubjects(state, exam, undefined, 'class-8');
    expect(subjects.map((s) => s.name)).toEqual(['Mathematics', 'English']);
    const maths = subjectResults(state, exam, undefined, subjects[0], 'class-8');
    expect(maths.rows.find((r) => r.enrollment.id === b.rows[0].enrollmentId)).toMatchObject({
      applicable: false,
      pending: false,
    });
    expect(maths.pending).toBe(10);
  });
  it('protects recorded sectionless students and preserves their subjects on metadata edits', () => {
    const state = score(fixture(), 'class-9', '', '20', '18'),
      exam = state.exams[0];
    expect(() =>
      updateTest(state, exam.id, { ...exam, sectionlessClassIds: ['class-8'] }),
    ).toThrow();
    const next = updateTest(state, exam.id, { ...exam, name: 'Renamed' });
    expect(next.exams[0].sheets).toEqual(exam.sheets);
    expect(next.results).toEqual(state.results);
  });
});

it('combines legacy subject names with newer subject IDs without duplicate columns', () => {
  let state = fixture();
  state.exams[0].subjects = [{ name: 'Mathematics', maxMarks: 100 }];
  state = score(state, 'class-8', 'class-8-a', '100', '90');
  const exam = state.exams[0];
  const subjects = savedSubjects(state, exam, undefined, 'class-8');
  expect(subjects).toHaveLength(1);
  const result = subjectResults(state, exam, undefined, subjects[0], 'class-8');
  expect(
    result.rows
      .filter((r) => r.enrollment.sectionId === 'class-8-b')
      .every((r) => r.applicable && r.pending),
  ).toBe(true);
});
