import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSeed } from '../mocks/seed';
import { createTest, examinationSchema, updateTest, type NewTest } from './academics';
import { savedSubjects, saveMarksSheet, sheetDraft } from './academicSheets';
import { classSubjects, saveClassSubjects } from './classSubjects';
import { defaultTestSubjectIds } from './testSubjects';
import { previewSheetImport, sheetTemplate } from './sheetImport';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-15T06:30:00Z'));
});
afterEach(() => vi.useRealTimers());
function setup() {
  const state = createSeed('2026-10-15');
  state.exams = [];
  state.results = [];
  const hindi = classSubjects(state, 'class-8').find((s) => s.name === 'Hindi')!.id;
  const math = classSubjects(state, 'class-9').find((s) => s.name === 'Mathematics')!.id;
  const input: NewTest = {
    name: 'Weekly assessment',
    date: '2026-10-15',
    classId: '',
    classIds: ['class-8', 'class-9'],
    sectionIds: ['class-8-a', 'class-9-b'],
    subjectSelections: [
      { classId: 'class-8', subjectIds: [hindi] },
      { classId: 'class-9', subjectIds: [math] },
    ],
  };
  return { state, input, hindi, math };
}
describe('test subject assignments', () => {
  it('creates without a test type and scopes each class sheet and import template', () => {
    const { state, input } = setup();
    const next = createTest(state, input),
      exam = next.exams[0];
    expect(exam.kind).toBe('');
    for (const [section, subject] of [
      ['class-8-a', 'Hindi'],
      ['class-9-b', 'Mathematics'],
    ]) {
      const draft = sheetDraft(next, exam, section);
      expect(draft.columns.map((c) => c.name)).toEqual([subject]);
      const grid = sheetTemplate(draft.columns, draft.students);
      expect(grid[0]).toEqual(['Roll No.', 'Student Name', 'Class', 'Section', subject]);
      grid[1][4] = '20';
      grid[2][4] = '18';
      const imported = previewSheetImport(draft.columns, draft.rows, draft.students, grid);
      expect(imported.columns.map((c) => c.name)).toEqual([subject]);
      const wrong = structuredClone(grid);
      wrong[0].push('Science');
      expect(() => previewSheetImport(draft.columns, draft.rows, draft.students, wrong)).toThrow(
        'template',
      );
    }
    expect(examinationSchema.parse(exam).subjectSelections).toEqual(input.subjectSelections);
  });
  it('rejects empty, foreign, duplicated or missing subject assignments', () => {
    const { state, input, hindi, math } = setup();
    for (const subjectSelections of [
      [
        { classId: 'class-8', subjectIds: [] },
        { classId: 'class-9', subjectIds: [math] },
      ],
      [
        { classId: 'class-8', subjectIds: [math] },
        { classId: 'class-9', subjectIds: [math] },
      ],
      [
        { classId: 'class-8', subjectIds: [hindi, hindi] },
        { classId: 'class-9', subjectIds: [math] },
      ],
      [{ classId: 'class-8', subjectIds: [hindi] }],
      [
        { classId: 'class-8', subjectIds: [hindi] },
        { classId: 'class-8', subjectIds: [hindi] },
      ],
      [
        { classId: 'class-8', subjectIds: [hindi] },
        { classId: 'foreign', subjectIds: [math] },
      ],
    ])
      expect(() => createTest(state, { ...input, subjectSelections })).toThrow(/subject/i);
  });
  it.each(['0', 'A', '18'])('preserves %s marks and blocks removing their subject', (value) => {
    const { state, input, hindi } = setup();
    let next = createTest(state, input);
    const exam = next.exams[0];
    const draft = sheetDraft(next, exam, 'class-8-a');
    draft.columns[0].maximum = '20';
    draft.rows[0].cells[0] = value;
    next = saveMarksSheet(next, exam.id, 'class-8-a', draft.columns, draft.rows);
    const before = structuredClone(next.results);
    const english = classSubjects(next, 'class-8').find((s) => s.name === 'English')!.id;
    expect(() =>
      updateTest(next, exam.id, {
        ...input,
        subjectSelections: [
          { classId: 'class-8', subjectIds: [english] },
          input.subjectSelections![1],
        ],
      }),
    ).toThrow('saved marks');
    next = updateTest(next, exam.id, { ...input, name: 'Renamed test' });
    expect(next.results).toEqual(before);
    expect(defaultTestSubjectIds(next, next.exams[0], 'class-8')).toEqual([hindi]);
  });
  it('retains selected subjects and saved marks across rename and archive', () => {
    const { state, input, hindi } = setup();
    let next = createTest(state, input);
    const exam = next.exams[0],
      draft = sheetDraft(next, exam, 'class-8-a');
    draft.columns[0].maximum = '20';
    draft.rows[0].cells[0] = '17';
    next = saveMarksSheet(next, exam.id, 'class-8-a', draft.columns, draft.rows);
    next = saveClassSubjects(
      next,
      'class-8',
      classSubjects(next, 'class-8').map((s) =>
        s.id === hindi ? { ...s, name: 'Hindi Language' } : s,
      ),
    );
    next = saveClassSubjects(
      next,
      'class-8',
      classSubjects(next, 'class-8').filter((s) => s.id !== hindi),
    );
    const reopened = sheetDraft(next, next.exams[0], 'class-8-a');
    expect(reopened.columns).toEqual([{ subjectId: hindi, name: 'Hindi Language', maximum: '20' }]);
    expect(reopened.rows[0].cells).toEqual(['17']);
    expect(() => updateTest(next, exam.id, input)).not.toThrow();
  });
  it('removes a pending legacy subject from result columns without changing recorded marks', () => {
    const { state } = setup();
    let next = createTest(state, {
      name: 'Legacy test',
      date: '2026-10-15',
      classId: 'class-8',
      sectionId: 'class-8-a',
      subjects: [
        { name: 'Mathematics', maxMarks: 20 },
        { name: 'Hindi', maxMarks: 20 },
      ],
    });
    const exam = next.exams[0],
      math = classSubjects(next, 'class-8')[0];
    next.results.push({
      schoolId: next.school.id,
      enrollmentId: 'enr-073',
      examId: exam.id,
      subjects: [
        { name: 'Mathematics', maxMarks: 20, marks: 16 },
        { name: 'Hindi', maxMarks: 20, marks: 0, pending: true },
      ],
    });
    expect(next.enrollments.find((e) => e.id === 'enr-073')?.classId).toBe('class-8');
    next = updateTest(next, exam.id, {
      ...exam,
      subjectSelections: [{ classId: 'class-8', subjectIds: [math.id] }],
    });
    expect(savedSubjects(next, next.exams[0], 'class-8-a').map((s) => s.name)).toEqual([
      'Mathematics',
    ]);
    expect(next.results[0].subjects).toEqual([{ name: 'Mathematics', maxMarks: 20, marks: 16 }]);
  });
  it('preserves legacy tests and infers their existing subject selections', () => {
    const { state } = setup();
    let next = createTest(state, {
      name: 'Old test',
      kind: 'Daily test',
      date: '2026-10-15',
      classId: 'class-8',
      sectionId: 'class-8-a',
      subjects: [{ name: 'Mathematics', maxMarks: 20 }],
    });
    const exam = next.exams[0],
      draft = sheetDraft(next, exam, 'class-8-a');
    draft.rows[0].cells[0] = '16';
    next = saveMarksSheet(next, exam.id, 'class-8-a', draft.columns, draft.rows);
    const ids = defaultTestSubjectIds(next, next.exams[0], 'class-8');
    expect(ids).toEqual([classSubjects(next, 'class-8')[0].id]);
    const before = structuredClone(next.results);
    next = updateTest(next, exam.id, {
      ...exam,
      subjectSelections: [{ classId: 'class-8', subjectIds: ids }],
    });
    expect(next.results).toEqual(before);
    expect(sheetDraft(next, next.exams[0], 'class-8-a').columns.map((c) => c.name)).toEqual([
      'Mathematics',
    ]);
  });
});
