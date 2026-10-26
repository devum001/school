import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createSeed } from '../mocks/seed';
import { createTest, updateTest, testRoster } from './academics';
import { overallLeaderboard, saveMarksSheet, sheetDraft, subjectResults } from './academicSheets';
import { previewSheetImport, sheetTemplate } from './sheetImport';
import { sortMarksRoster } from './marksRoster';
import { resultSummary } from './selectors';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-15T06:30:00Z'));
});
afterEach(() => vi.useRealTimers());
function fixture() {
  const initial = createSeed('2026-10-15');
  initial.exams = [];
  initial.results = [];
  return createTest(initial, {
    name: 'Yearly assessment',
    kind: 'Yearly Examination',
    date: '2026-10-15',
    classId: 'class-8',
    sectionIds: ['class-8-a', 'class-8-b'],
  });
}
it('locks the first recorded maximum across sections and explicitly revalidates all scores when editing it', () => {
  let state = fixture();
  const a = sheetDraft(state, state.exams[0], 'class-8-a');
  a.columns[0].maximum = '20';
  a.rows[0].cells[0] = '18';
  state = saveMarksSheet(state, state.exams[0].id, 'class-8-a', a.columns, a.rows);
  const b = sheetDraft(state, state.exams[0], 'class-8-b');
  expect(b.columns[0].maximum).toBe('20');
  b.columns[0].maximum = '100';
  b.rows[0].cells[0] = '90';
  expect(() => saveMarksSheet(state, state.exams[0].id, 'class-8-b', b.columns, b.rows)).toThrow(
    'every section',
  );
  const exam = state.exams[0];
  expect(() =>
    updateTest(state, exam.id, {
      ...exam,
      subjectMaximums: [{ classId: 'class-8', subjectId: a.columns[0].subjectId, maxMarks: 17 }],
    }),
  ).toThrow('lower than');
  const changed = updateTest(state, exam.id, {
    ...exam,
    subjectMaximums: [{ classId: 'class-8', subjectId: a.columns[0].subjectId, maxMarks: 40 }],
  });
  expect(changed.results[0].subjects[0]).toMatchObject({ marks: 18, maxMarks: 40 });
  expect(sheetDraft(changed, changed.exams[0], 'class-8-b').columns[0].maximum).toBe('40');
  expect(state.results[0].subjects[0].maxMarks).toBe(20);
});
it('preserves legacy conflicting maximums until a deliberate correction without rescaling scores', () => {
  const state = fixture(),
    exam = state.exams[0],
    draft = sheetDraft(state, exam, 'class-8-a');
  const subject = { subjectId: draft.columns[0].subjectId, name: draft.columns[0].name };
  exam.sheets = [
    { classId: 'class-8', sectionId: 'class-8-a', subjects: [{ ...subject, maxMarks: 20 }] },
    { classId: 'class-8', sectionId: 'class-8-b', subjects: [{ ...subject, maxMarks: 100 }] },
  ];
  const before = JSON.stringify(state);
  draft.columns[0].maximum = '20';
  draft.rows[0].cells[0] = '10';
  expect(() => saveMarksSheet(state, exam.id, 'class-8-a', draft.columns, draft.rows)).toThrow(
    'reconcile',
  );
  expect(JSON.stringify(state)).toBe(before);
  const changed = updateTest(state, exam.id, {
    ...exam,
    subjectMaximums: [{ classId: 'class-8', subjectId: subject.subjectId, maxMarks: 100 }],
  });
  expect(changed.exams[0].sheets?.flatMap((s) => s.subjects.map((v) => v.maxMarks))).toEqual([
    100, 100,
  ]);
});
it('ranks true ties with competition ranks, and keeps close scores distinct before rounding', () => {
  let state = fixture();
  const exam = state.exams[0],
    d = sheetDraft(state, exam, 'class-8-a');
  d.columns[0].maximum = '100';
  ['100', '90', '90', '89.9999999999', 'A', '0'].forEach((v, i) => {
    d.rows[i].cells[0] = v;
  });
  state = saveMarksSheet(state, exam.id, 'class-8-a', d.columns, d.rows);
  const ranks = overallLeaderboard(state, testRoster(state, state.exams[0]), state.exams);
  expect(ranks.map((v) => v.rank)).toEqual([1, 2, 2, 4, 5]);
  expect(ranks.at(-1)?.percentage).toBe(0);
  expect(ranks.some((r) => r.enrollment.id === d.rows[4].enrollmentId)).toBe(false);
  expect(
    resultSummary(state.results.find((r) => r.enrollmentId === d.rows[3].enrollmentId)!).percentage,
  ).toBe(89.9999999999);
  const summary = subjectResults(
    state,
    state.exams[0],
    'class-8-a',
    state.exams[0].sheets![0].subjects[0],
  );
  expect(summary.absent).toBe(1);
  expect(summary.average).toBeGreaterThan(70);
});
it('matches alphanumeric rolls per section using admission identifiers, previews all row errors, and never commits implicitly', () => {
  const state = fixture(),
    exam = state.exams[0];
  const students = testRoster(state, exam).slice(0, 2);
  students[0].enrollment.rollNumber = 'SH-12';
  students[1].enrollment.rollNumber = 'AB-12';
  students[1].enrollment.sectionId = 'class-8-b';
  students[1].sectionName = 'B';
  students[1].student.name = students[0].student.name;
  const columns = [{ subjectId: 'math', name: 'Mathematics', maximum: '20' }];
  const rows = students.map((s) => ({ enrollmentId: s.enrollment.id, cells: [''] }));
  const grid = sheetTemplate(columns, students);
  grid[2][5] = '18';
  grid[3][5] = 'A';
  const preview = previewSheetImport(columns, rows, students, grid);
  expect(preview.issues).toEqual([]);
  expect(preview.changes).toHaveLength(2);
  expect(rows.every((r) => r.cells[0] === '')).toBe(true);
  grid.push([...grid[2]]);
  grid[3][5] = '21';
  const bad = previewSheetImport(columns, rows, students, grid);
  expect(bad.issues.map((v) => v.row)).toEqual([4, 5]);
});
it('sorts section-first and falls back to names for an ambiguous or missing-roll section', () => {
  const state = fixture(),
    rows = testRoster(state, state.exams[0]).slice(0, 3);
  rows.forEach((r) => {
    r.enrollment.rollNumber = '';
  });
  rows[0].student.name = 'Zed';
  rows[1].student.name = 'Amy';
  rows[2].student.name = 'Max';
  expect(sortMarksRoster(rows).map((r) => r.student.name)).toEqual(['Amy', 'Max', 'Zed']);
  expect(rows.map((r) => r.enrollment.rollNumber)).toEqual(['', '', '']);
});

it('orders valid prefixed rolls by their numeric identity within a section', () => {
  const state = fixture(),
    rows = testRoster(state, state.exams[0])
      .filter((r) => r.enrollment.sectionId === 'class-8-a')
      .slice(0, 2);
  rows[0].enrollment.rollNumber = 'AB-12';
  rows[1].enrollment.rollNumber = 'SH-2';
  expect(sortMarksRoster(rows).map((r) => r.enrollment.rollNumber)).toEqual(['SH-2', 'AB-12']);
});

it('keeps explicitly selected subjects pending across sections instead of excluding their blank marks', () => {
  const initial = fixture(),
    draft = sheetDraft(initial, initial.exams[0], 'class-8-a');
  const selected = draft.columns.slice(0, 2);
  let state = updateTest(initial, initial.exams[0].id, {
    ...initial.exams[0],
    subjectSelections: [{ classId: 'class-8', subjectIds: selected.map((c) => c.subjectId) }],
    subjectMaximums: selected.map((c) => ({
      classId: 'class-8',
      subjectId: c.subjectId,
      maxMarks: 20,
    })),
  });
  const sheet = sheetDraft(state, state.exams[0], 'class-8-a');
  sheet.rows[0].cells[0] = '0';
  state = saveMarksSheet(state, state.exams[0].id, 'class-8-a', sheet.columns, sheet.rows);
  expect(state.results[0].subjects).toHaveLength(2);
  expect(state.results[0].subjects[1].pending).toBe(true);
  expect(resultSummary(state.results[0])).toMatchObject({ marks: 0, maximum: 20 });
  const other = subjectResults(state, state.exams[0], 'class-8-b', {
    subjectId: selected[1].subjectId,
    name: selected[1].name,
    maxMarks: 20,
  });
  expect(other.rows.every((r) => r.applicable && r.pending && r.percentage === null)).toBe(true);
});

it('binds new Excel rows to their assessment, school, year and class while identifying unreferenced older templates', () => {
  const state = fixture(),
    draft = sheetDraft(state, state.exams[0], 'class-8-a');
  draft.columns[0].maximum = '20';
  const scope = {
    schoolId: state.school.id,
    academicYearId: state.academicYear.id,
    examId: state.exams[0].id,
    classId: 'class-8',
  };
  const grid = sheetTemplate(draft.columns, draft.students, scope);
  grid[2][5] = '18';
  expect(previewSheetImport(draft.columns, draft.rows, draft.students, grid, scope)).toMatchObject({
    assessmentVerified: true,
    issues: [],
  });
  for (const key of ['schoolId', 'academicYearId', 'examId', 'classId'] as const) {
    const invalid = previewSheetImport(draft.columns, draft.rows, draft.students, grid, {
      ...scope,
      [key]: 'different',
    });
    expect(invalid.issues.length).toBeGreaterThan(0);
    expect(invalid.changes).toHaveLength(0);
  }
  const older = sheetTemplate(draft.columns, draft.students);
  older[2][5] = '18';
  expect(
    previewSheetImport(draft.columns, draft.rows, draft.students, older, scope).assessmentVerified,
  ).toBe(false);
});
