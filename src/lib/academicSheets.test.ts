import { excelColumnName } from './xlsx';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSeed } from '../mocks/seed';
import { createTest, examinationSchema, examResultSchema, updateTest } from './academics';
import {
  examIncludes,
  marksAdded,
  overallLeaderboard,
  savedSubjects,
  saveMarksSheet,
  sheetDraft,
  subjectResults,
} from './academicSheets';
import { classSubjects, resolvedResult, saveClassSubjects } from './classSubjects';
import { resultSummary, roster } from './selectors';
import { restoreSchoolState } from '../mocks/restore';
import { previewSheetImport, sheetTemplate } from './sheetImport';
import { studentReportMessage } from './reportShare';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-15T06:30:00Z'));
});
afterEach(() => vi.useRealTimers());
function setup() {
  const fresh = createSeed('2026-10-15');
  fresh.exams = [];
  fresh.results = [];
  const state = createTest(fresh, {
    name: 'Daily Practice',
    kind: 'Weekly Practice — custom',
    date: '2026-10-15',
    classId: 'class-8',
    sectionIds: ['class-8-a', 'class-8-b'],
  });
  const exam = state.exams.at(-1)!;
  const draft = sheetDraft(state, exam, 'class-8-a');
  draft.columns.forEach((c) => {
    if (c.name === 'Mathematics') c.maximum = '20';
    if (c.name === 'English') c.maximum = '50';
  });
  return {
    state,
    exam,
    draft,
    math: draft.columns.findIndex((c) => c.name === 'Mathematics'),
    english: draft.columns.findIndex((c) => c.name === 'English'),
  };
}
describe('new Academics flow', () => {
  it('creates metadata-only tests with free text type and multiple sections', () => {
    const { state, exam } = setup();
    expect(exam.subjects).toEqual([]);
    expect(exam.kind).toContain('custom');
    expect(examIncludes(exam, 'class-8', 'class-8-a')).toBe(true);
    expect(examIncludes(exam, 'class-8', 'class-8-b')).toBe(true);
    expect(examIncludes(exam, 'class-8', 'class-8-c')).toBe(false);
    expect(marksAdded(state, exam)).toBe(false);
    for (const sectionIds of [[], ['class-7-a'], ['class-8-a', 'class-8-a']])
      expect(() => createTest(state, { ...exam, sectionIds })).toThrow();
  });
  it('distinguishes excluded columns, pending cells, zero and subject-level absence', () => {
    const { state, exam, draft, math, english } = setup();
    draft.rows[0].cells[math] = '18';
    draft.rows[1].cells[math] = 'A';
    draft.rows[1].cells[english] = '45';
    draft.rows[2].cells[math] = '0';
    const next = saveMarksSheet(state, exam.id, 'class-8-a', draft.columns, draft.rows),
      current = next.exams[0];
    expect(savedSubjects(next, current, 'class-8-a').map((s) => s.name)).toEqual([
      'Mathematics',
      'English',
    ]);
    const first = next.results.find((r) => r.enrollmentId === draft.rows[0].enrollmentId)!;
    expect(first.subjects[1].pending).toBe(true);
    expect(resultSummary(first)).toMatchObject({ marks: 18, maximum: 20, percentage: 90 });
    const second = next.results.find((r) => r.enrollmentId === draft.rows[1].enrollmentId)!;
    expect(second.absent).toBe(false);
    expect(second.subjects[0].absent).toBe(true);
    expect(resultSummary(second)).toMatchObject({ marks: 45, maximum: 50 });
    const maths = subjectResults(
      next,
      current,
      'class-8-a',
      savedSubjects(next, current, 'class-8-a')[0],
    );
    expect(maths.absent).toBe(1);
    expect(maths.pending).toBe(9);
    expect(maths.highest).toBe(18);
    expect(maths.average).toBe(45);
    expect(maths.rows.find((r) => r.enrollment.id === draft.rows[2].enrollmentId)?.percentage).toBe(
      0,
    );
    expect(maths.rows.find((r) => r.absent)?.rank).toBe(0);
    expect(marksAdded(next, current, 'class-8-a')).toBe(true);
    expect(marksAdded(next, current, 'class-8-b')).toBe(false);
  });
  it('keeps sections independent and can remove a whole subject or clear a sheet', () => {
    const { state, exam, draft, math } = setup();
    draft.rows[0].cells[math] = '18';
    let next = saveMarksSheet(state, exam.id, 'class-8-a', draft.columns, draft.rows);
    const b = sheetDraft(next, next.exams[0], 'class-8-b');
    expect(b.columns[math].maximum).toBe('20');
    b.rows[0].cells[math] = '16';
    next = saveMarksSheet(next, exam.id, 'class-8-b', b.columns, b.rows);
    const before = next.results.filter((r) =>
      b.rows.some((row) => row.enrollmentId === r.enrollmentId),
    );
    const a = sheetDraft(next, next.exams[0], 'class-8-a');
    a.rows.forEach((r) => r.cells.fill(''));
    next = saveMarksSheet(next, exam.id, 'class-8-a', a.columns, a.rows);
    expect(savedSubjects(next, next.exams[0], 'class-8-a')).toEqual([]);
    expect(next.results).toEqual(before);
    expect(marksAdded(next, next.exams[0], 'class-8-a')).toBe(false);
  });
  it('rejects invalid marks and maximums without mutating state', () => {
    const { state, exam, draft, math } = setup();
    const before = JSON.stringify(state);
    for (const mark of ['21', '-1', 'NaN', 'Infinity', '=10+1', '1e2']) {
      draft.rows[0].cells[math] = mark;
      expect(() =>
        saveMarksSheet(state, exam.id, 'class-8-a', draft.columns, draft.rows),
      ).toThrow();
    }
    draft.rows[0].cells[math] = '10';
    draft.columns[math].maximum = '';
    expect(() => saveMarksSheet(state, exam.id, 'class-8-a', draft.columns, draft.rows)).toThrow(
      /maximum/,
    );
    expect(JSON.stringify(state)).toBe(before);
  });
  it('calculates cumulative weighted scores with absent and pending excluded, even on incomplete tests', () => {
    const { state, exam, draft, math } = setup();
    draft.rows[0].cells[math] = '18';
    draft.rows[1].cells[math] = 'A';
    let next = saveMarksSheet(state, exam.id, 'class-8-a', draft.columns, draft.rows);
    next = createTest(next, {
      name: 'Exam two',
      kind: 'Term Assessment',
      date: '2026-10-01',
      classId: 'class-8',
      sectionIds: ['class-8-a'],
    });
    const other = next.exams[1],
      otherDraft = sheetDraft(next, other, 'class-8-a');
    otherDraft.columns[math].maximum = '50';
    otherDraft.rows[0].cells[math] = '42';
    next = saveMarksSheet(next, other.id, 'class-8-a', otherDraft.columns, otherDraft.rows);
    const ranks = overallLeaderboard(
      next,
      roster(next).filter((r) => r.enrollment.classId === 'class-8'),
      next.exams,
    );
    expect(ranks[0]).toMatchObject({
      marks: 60,
      maximum: 70,
      count: 2,
      percentage: (60 / 70) * 100,
      rank: 1,
    });
    expect(ranks).toHaveLength(1);
    next.exams[1].date = '2026-10-16';
    expect(overallLeaderboard(next, roster(next), next.exams)[0].count).toBe(1);
  });
  it('renames subjects everywhere and archives removals without losing historical marks', () => {
    const { state, exam, draft, math } = setup();
    draft.rows[0].cells[math] = '18';
    let next = saveMarksSheet(state, exam.id, 'class-8-a', draft.columns, draft.rows);
    next = saveClassSubjects(
      next,
      'class-8',
      classSubjects(next, 'class-8').map((s) =>
        s.name === 'Mathematics' ? { ...s, name: 'Applied Mathematics' } : s,
      ),
    );
    expect(sheetDraft(next, next.exams[0], 'class-8-a').columns[math].name).toBe(
      'Applied Mathematics',
    );
    expect(savedSubjects(next, next.exams[0], 'class-8-a')[0].name).toBe('Applied Mathematics');
    expect(resolvedResult(next, next.results[0]).subjects[0].name).toBe('Applied Mathematics');
    expect(
      studentReportMessage(
        next,
        roster(next).find((r) => r.enrollment.id === draft.rows[0].enrollmentId)!,
        next.exams,
      ),
    ).toContain('Applied Mathematics');
    next = saveClassSubjects(
      next,
      'class-8',
      classSubjects(next, 'class-8').filter((s) => s.name !== 'Applied Mathematics'),
    );
    expect(resultSummary(next.results[0]).marks).toBe(18);
    expect(
      sheetDraft(next, next.exams[0], 'class-8-a').columns.some(
        (s) => s.name === 'Applied Mathematics',
      ),
    ).toBe(true);
    next = createTest(next, {
      name: 'New',
      kind: 'Practice',
      date: exam.date,
      classId: 'class-8',
      sectionIds: ['class-8-a'],
    });
    expect(
      sheetDraft(next, next.exams[1], 'class-8-a').columns.some(
        (s) => s.name === 'Applied Mathematics',
      ),
    ).toBe(false);
  });
  it('roundtrips new sheet flags and subject configuration alongside old records', () => {
    const { state, exam, draft, math } = setup();
    draft.rows[0].cells[math] = 'A';
    let next = saveMarksSheet(state, exam.id, 'class-8-a', draft.columns, draft.rows);
    next = saveClassSubjects(next, 'class-8', classSubjects(next, 'class-8'));
    const restored = restoreSchoolState(createSeed(), structuredClone(next));
    expect(examinationSchema.parse(restored.exams[0])).toEqual(next.exams[0]);
    expect(examResultSchema.parse(restored.results[0])).toEqual(next.results[0]);
    expect(restored.classes).toEqual(next.classes);
    expect(() => examinationSchema.parse(createSeed().exams[0])).not.toThrow();
  });
  it('allows metadata corrections and adding sections but protects recorded student scopes', () => {
    const { state, exam, draft, math } = setup();
    draft.rows[0].cells[math] = '18';
    const next = saveMarksSheet(state, exam.id, 'class-8-a', draft.columns, draft.rows);
    const edited = updateTest(next, exam.id, {
      name: 'Renamed',
      kind: 'Custom type',
      date: exam.date,
      classId: exam.classId,
      sectionIds: exam.sectionIds,
    });
    expect(edited.results).toEqual(next.results);
    expect(edited.exams[0].sheets).toEqual(next.exams[0].sheets);
    expect(() =>
      updateTest(next, exam.id, {
        name: 'Renamed',
        kind: 'Custom type',
        date: exam.date,
        classId: exam.classId,
        sectionIds: ['class-8-b'],
      }),
    ).toThrow(/saved marks/);
  });
  it('previews bulk marks using roll number/name, A and pending cells; rejects stale names, duplicates, formulas and overflow', () => {
    const { draft, math, english } = setup();
    const grid = sheetTemplate(draft.columns, draft.students);
    grid[2][math + 5] = 'A';
    grid[2][english + 5] = '45';
    const preview = previewSheetImport(draft.columns, draft.rows, draft.students, grid);
    expect(preview.changes).toHaveLength(1);
    expect(preview.rows[0].cells[math]).toBe('A');
    expect(preview.rows[1]).toEqual(draft.rows[1]);
    for (const mutate of [
      (g: typeof grid) => {
        g[2][1] = 'Wrong';
      },
      (g: typeof grid) => {
        g.push(g[2]);
      },
      (g: typeof grid) => {
        g[2][math + 5] = '=10';
      },
      (g: typeof grid) => {
        g[2][math + 5] = '21';
      },
    ]) {
      const bad = structuredClone(grid);
      mutate(bad);
      expect(
        previewSheetImport(draft.columns, draft.rows, draft.students, bad).issues.length,
      ).toBeGreaterThan(0);
    }
  });
});

it('supports wide Excel templates beyond column Z', () => {
  expect([0, 25, 26, 31, 51, 52].map(excelColumnName)).toEqual(['A', 'Z', 'AA', 'AF', 'AZ', 'BA']);
});
it('resolves renamed legacy subject names within their own class', () => {
  const before = createSeed('2026-10-15');
  const original = before.results.find(
    (r) =>
      r.examId === 'exam-daily' &&
      before.enrollments.some((e) => e.id === r.enrollmentId && e.classId === 'class-8'),
  )!;
  const next = saveClassSubjects(
    before,
    'class-8',
    classSubjects(before, 'class-8').map((s) =>
      s.name === 'Mathematics' ? { ...s, name: 'Maths' } : s,
    ),
  );
  expect(resolvedResult(next, original).subjects[0].name).toBe('Maths');
  expect(
    subjectResults(
      next,
      next.exams.find((e) => e.id === 'exam-daily')!,
      'class-8-a',
      savedSubjects(
        next,
        next.exams.find((e) => e.id === 'exam-daily')!,
        'class-8-a',
      )[0],
    ).rows.some((r) => !r.pending),
  ).toBe(true);
  expect(next.results).toEqual(before.results);
});
