import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { createSeed } from '../mocks/seed';
import { restoreSchoolState } from '../mocks/restore';
import {
  createTest,
  saveTestMarks,
  rankResults,
  testRoster,
  testParticipation,
  type NewTest,
} from './academics';
import { resultSummary } from './selectors';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-11T06:30:00Z'));
});
afterEach(() => vi.useRealTimers());
const input: NewTest = {
  name: 'Chapter practice',
  kind: 'Daily test',
  date: '2026-10-11',
  classId: 'class-5',
  sectionId: 'class-5-a',
  subjects: [{ name: 'Mathematics', maxMarks: 20 }],
};
describe('test creation and marks entry', () => {
  it('creates a class/section test with its own maximum, leaving marks pending', () => {
    const next = createTest(createSeed(), input);
    const exam = next.exams.at(-1)!;
    expect(testRoster(next, exam)).toHaveLength(12);
    expect(exam.subjects[0].maxMarks).toBe(20);
    expect(next.results.some((r) => r.examId === exam.id)).toBe(false);
  });
  it('validates maxima, dates, subjects, classes and sections', () => {
    const state = createSeed();
    for (const invalid of [
      { ...input, subjects: [{ name: 'Maths', maxMarks: 0 }] },
      {
        ...input,
        subjects: [
          { name: 'Maths', maxMarks: 20 },
          { name: ' maths ', maxMarks: 30 },
        ],
      },
      { ...input, sectionId: 'class-6-a' },
      { ...input, classId: 'other-school-class' },
      { ...input, date: '2026-10-12' },
      { ...input, date: '2025-10-11' },
    ])
      expect(() => createTest(state, invalid)).toThrow();
  });
  it('rejects overflow, negative and nonfinite marks and students outside the test', () => {
    const state = createTest(createSeed(), input);
    const exam = state.exams.at(-1)!;
    for (const marks of [[21], [-1], [NaN], [], [10, 10]])
      expect(() =>
        saveTestMarks(state, exam.id, [{ enrollmentId: 'enr-001', marks, absent: false }]),
      ).toThrow();
    expect(() =>
      saveTestMarks(state, exam.id, [{ enrollmentId: 'enr-025', marks: [18], absent: false }]),
    ).toThrow();
  });
  it('distinguishes zero, absent and pending and updates a saved result without duplicates', () => {
    let state = createTest(createSeed(), input);
    const exam = state.exams.at(-1)!;
    state = saveTestMarks(state, exam.id, [
      { enrollmentId: 'enr-001', marks: [0], absent: false },
      { enrollmentId: 'enr-002', marks: null, absent: true },
      { enrollmentId: 'enr-003', marks: null, absent: false },
    ]);
    const results = state.results.filter((r) => r.examId === exam.id);
    expect(results).toHaveLength(2);
    expect(results[1].absent).toBe(true);
    expect(resultSummary(results[1])).toMatchObject({ marks: 0, maximum: 0 });
    state = saveTestMarks(state, exam.id, [
      { enrollmentId: 'enr-001', marks: [18.5], absent: false },
    ]);
    expect(state.results.filter((r) => r.examId === exam.id)).toHaveLength(2);
    expect(
      state.results.find((r) => r.examId === exam.id && r.enrollmentId === 'enr-001')?.subjects[0]
        .marks,
    ).toBe(18.5);
    state = saveTestMarks(state, exam.id, [
      { enrollmentId: 'enr-001', marks: null, absent: false },
    ]);
    expect(state.results.filter((r) => r.examId === exam.id)).toHaveLength(1);
  });
});
describe('combined class rankings', () => {
  it('weights 20, 30 and 200 mark tests by their actual maxima, shares ties, and excludes incomplete tests', () => {
    let state = createSeed();
    state.exams = [];
    state.results = [];
    const scores = [
      [18, 18, 20],
      [24, 24, 30],
      [180, 180, 160],
    ];
    [20, 30, 200].forEach((maxMarks, i) => {
      state = createTest(state, {
        ...input,
        name: `Test ${i}`,
        subjects: [{ name: 'Mathematics', maxMarks }],
      });
      const exam = state.exams.at(-1)!;
      state = saveTestMarks(
        state,
        exam.id,
        testRoster(state, exam).map((r, j) => ({
          enrollmentId: r.enrollment.id,
          marks: [scores[i][j] ?? 0],
          absent: j > 2,
        })),
      );
    });
    const students = testRoster(state, state.exams[0]);
    const ranks = rankResults(state, students, state.exams);
    expect(ranks.rows[0]).toMatchObject({ marks: 222, maximum: 250, percentage: 88.8, rank: 1 });
    expect(ranks.rows[1].rank).toBe(1);
    expect(ranks.rows[2]).toMatchObject({ marks: 210, percentage: 84, rank: 3 });
    state = createTest(state, input);
    state = saveTestMarks(state, state.exams.at(-1)!.id, [
      { enrollmentId: 'enr-003', marks: [20], absent: false },
    ]);
    expect(rankResults(state, students, state.exams).included).toHaveLength(3);
    expect(rankResults(state, students, state.exams).rows[0].marks).toBe(222);
  });
  it('does not pool tests taken by a different section into class-wide rankings', () => {
    let state = createTest(createSeed(), input);
    const exam = state.exams.at(-1)!;
    state = saveTestMarks(
      state,
      exam.id,
      testRoster(state, exam).map((r) => ({
        enrollmentId: r.enrollment.id,
        marks: [20],
        absent: false,
      })),
    );
    const allClass = testRoster(state, { ...exam, sectionId: '' });
    expect(rankResults(state, allClass, [exam]).included).toHaveLength(0);
    expect(rankResults(state, testRoster(state, exam), [exam]).included).toHaveLength(1);
  });
  it('preserves added tests and modified marks when restoring saved browser data', () => {
    let saved = createTest(createSeed(), input);
    const exam = saved.exams.at(-1)!;
    saved = saveTestMarks(saved, exam.id, [
      { enrollmentId: 'enr-001', marks: [19], absent: false },
    ]);
    const restored = restoreSchoolState(createSeed('2026-10-12'), saved);
    expect(restored.exams).toEqual(saved.exams);
    expect(restored.results).toEqual(saved.results);
    expect(restored.payments).toEqual(saved.payments);
    const legacy = {
      version: saved.version,
      attendance: saved.attendance,
      payments: saved.payments,
      notifications: saved.notifications,
      activities: saved.activities,
    };
    expect(restoreSchoolState(createSeed(), legacy).exams).toHaveLength(5);
  });
});

describe('test absence tracking', () => {
  it('keeps absent and pending students out of participation and averages for every test type', () => {
    for (const kind of ['Daily test', 'Monthly test', 'Pre-board', 'Term exam'] as const) {
      let state = createTest(createSeed(), { ...input, kind });
      const exam = state.exams.at(-1)!;
      state = saveTestMarks(state, exam.id, [
        { enrollmentId: 'enr-001', marks: [0], absent: false },
        { enrollmentId: 'enr-002', marks: [20], absent: false },
        { enrollmentId: 'enr-003', marks: null, absent: true },
      ]);
      const students = testRoster(state, exam);
      expect(testParticipation(state, exam, students)).toEqual({
        total: 12,
        recorded: 3,
        taken: 2,
        absent: 1,
        pending: 9,
        average: 50,
      });
      const ranked = rankResults(state, students, [exam], false).rows;
      expect(ranked.map((r) => r.enrollment.id)).toEqual(['enr-002', 'enr-001']);
      state = saveTestMarks(state, exam.id, [
        { enrollmentId: 'enr-003', marks: [10], absent: false },
      ]);
      expect(testParticipation(state, exam)).toMatchObject({
        taken: 3,
        absent: 0,
        pending: 9,
        average: 50,
      });
    }
  });
  it('shows no average or per-test ranks when everyone is absent, but the register is complete', () => {
    let state = createTest(createSeed(), input);
    const exam = state.exams.at(-1)!;
    state = saveTestMarks(
      state,
      exam.id,
      testRoster(state, exam).map((r) => ({
        enrollmentId: r.enrollment.id,
        marks: null,
        absent: true,
      })),
    );
    expect(testParticipation(state, exam)).toEqual({
      total: 12,
      recorded: 12,
      taken: 0,
      absent: 12,
      pending: 0,
      average: null,
    });
    expect(rankResults(state, testRoster(state, exam), [exam], false).rows).toHaveLength(0);
  });
});
