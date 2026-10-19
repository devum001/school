import { examIncludes } from './testScope';
import type { DemoState, Examination, ExamResult, RosterEntry, TestSubject } from '../types/domain';
import { testRoster, testResults } from './academics';
import { classSubjects, subjectName } from './classSubjects';
import { resultSummary } from './selectors';
import { getSchoolDate } from './dates';
import { isTestSubjectSelected } from './testSubjects';

export type SheetColumn = { subjectId: string; name: string; maximum: string };
export type SheetRow = { enrollmentId: string; cells: string[] };
export { examIncludes } from './testScope';
export function examSections(state: DemoState, exam: Examination, classId = exam.classId) {
  return state.sections.filter(
    (s) =>
      s.schoolId === state.school.id &&
      (!classId || s.classId === classId) &&
      examIncludes(exam, s.classId, s.id),
  );
}
export function savedSubjects(
  state: DemoState,
  exam: Examination,
  sectionId: string,
): TestSubject[] {
  const sheet = exam.sheets?.find((s) => s.sectionId === sectionId);
  const classId =
    state.sections.find((section) => section.id === sectionId)?.classId ?? exam.classId;
  return (sheet ? sheet.subjects : exam.subjects)
    .filter((s) => isTestSubjectSelected(state, exam, classId, s))
    .map((s) => ({
      ...s,
      name: subjectName(
        state,
        state.sections.find((section) => section.id === sectionId)?.classId ?? exam.classId,
        s,
      ),
    }));
}
export function sheetDraft(state: DemoState, exam: Examination, sectionId: string) {
  const students = testRoster(state, exam)
    .filter((r) => r.enrollment.sectionId === sectionId)
    .sort((a, b) => a.enrollment.rollNumber - b.enrollment.rollNumber);
  const classId = state.sections.find((s) => s.id === sectionId)?.classId ?? exam.classId;
  const saved = savedSubjects(state, exam, sectionId);
  const configured = classSubjects(state, classId);
  const subjects = [
    ...configured.filter(
      (s) =>
        isTestSubjectSelected(state, exam, classId, { subjectId: s.id, name: s.name }) &&
        (!s.archived ||
          exam.subjectSelections?.some(
            (selection) => selection.classId === classId && selection.subjectIds.includes(s.id),
          ) ||
          saved.some((p) => p.subjectId === s.id || p.name === s.name)),
    ),
  ];
  for (const s of saved)
    if (
      isTestSubjectSelected(state, exam, classId, s) &&
      !subjects.some(
        (p) => p.id === s.subjectId || p.name === s.name || p.aliases?.includes(s.name),
      )
    )
      subjects.push({ id: s.subjectId ?? `${classId}:legacy:${s.name}`, name: s.name });
  const columns: SheetColumn[] = subjects.map((s) => ({
    subjectId: s.id,
    name: s.name,
    maximum: String(
      saved.find((p) => p.subjectId === s.id || p.name === s.name || s.aliases?.includes(p.name))
        ?.maxMarks ?? '',
    ),
  }));
  const rows: SheetRow[] = students.map((student) => {
    const result = state.results.find(
      (r) =>
        r.schoolId === state.school.id &&
        r.examId === exam.id &&
        r.enrollmentId === student.enrollment.id,
    );
    return {
      enrollmentId: student.enrollment.id,
      cells: columns.map((c) => {
        const mark = result?.subjects.find(
          (s) => s.subjectId === c.subjectId || subjectName(state, classId, s) === c.name,
        );
        return !mark || mark.pending
          ? ''
          : result?.absent || mark.absent
            ? 'A'
            : String(mark.marks);
      }),
    };
  });
  return { students, columns, rows };
}

export function saveMarksSheet(
  state: DemoState,
  examId: string,
  sectionId: string,
  columns: SheetColumn[],
  rows: SheetRow[],
): DemoState {
  const exam = state.exams.find(
    (e) =>
      e.id === examId &&
      e.schoolId === state.school.id &&
      e.academicYearId === state.academicYear.id,
  );
  if (!exam || !examSections(state, exam).some((s) => s.id === sectionId))
    throw new Error('Choose a section assigned to this test.');
  const draft = sheetDraft(state, exam, sectionId);
  if (
    rows.length !== draft.students.length ||
    new Set(rows.map((r) => r.enrollmentId)).size !== rows.length ||
    rows.some((r) => !draft.students.some((s) => s.enrollment.id === r.enrollmentId))
  )
    throw new Error('The class roster changed. Reopen the sheet before saving.');
  if (
    !columns.length ||
    new Set(columns.map((c) => c.subjectId)).size !== columns.length ||
    columns.some((c) => !draft.columns.some((d) => d.subjectId === c.subjectId)) ||
    rows.some((r) => r.cells.length !== columns.length)
  )
    throw new Error('The subject setup changed. Reopen the marks sheet.');
  const included = columns
    .map((c, index) => ({ ...c, index }))
    .filter((c) => rows.some((r) => r.cells[c.index].trim() !== ''));
  for (const c of included) {
    if (
      !/^\d+(?:\.\d+)?$/.test(c.maximum.trim()) ||
      Number(c.maximum) <= 0 ||
      Number(c.maximum) > 10000
    )
      throw new Error(`Enter maximum marks for ${c.name} (greater than 0, up to 10,000).`);
    for (const row of rows) {
      const value = row.cells[c.index].trim().toUpperCase();
      if (
        value &&
        value !== 'A' &&
        (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(value) ||
          !Number.isFinite(Number(value)) ||
          Number(value) > Number(c.maximum))
      )
        throw new Error(
          `${draft.students.find((s) => s.enrollment.id === row.enrollmentId)?.student.name} · ${c.name}: enter 0–${c.maximum}, A, or leave blank.`,
        );
    }
  }
  const results: ExamResult[] = included.length
    ? rows.map((row) => ({
        schoolId: state.school.id,
        examId,
        enrollmentId: row.enrollmentId,
        absent: included.every((c) => row.cells[c.index].trim().toUpperCase() === 'A'),
        subjects: included.map((c) => {
          const value = row.cells[c.index].trim().toUpperCase();
          return {
            subjectId: c.subjectId,
            name: c.name,
            maxMarks: Number(c.maximum),
            marks: value && value !== 'A' ? Number(value) : 0,
            absent: value === 'A',
            pending: value === '',
          };
        }),
      }))
    : [];
  const ids = new Set(rows.map((r) => r.enrollmentId));
  return {
    ...state,
    exams: state.exams.map((e) =>
      e.id === examId
        ? {
            ...e,
            sheets: [
              ...(e.sheets ?? []).filter((s) => s.sectionId !== sectionId),
              {
                sectionId,
                subjects: included.map((c) => ({
                  subjectId: c.subjectId,
                  name: c.name,
                  maxMarks: Number(c.maximum),
                })),
              },
            ],
          }
        : e,
    ),
    results: [
      ...state.results.filter(
        (r) => !(r.schoolId === state.school.id && r.examId === examId && ids.has(r.enrollmentId)),
      ),
      ...results,
    ],
  };
}

export function marksAdded(state: DemoState, exam: Examination, sectionId?: string) {
  return testResults(state, exam).some(
    (r) =>
      (!sectionId ||
        state.enrollments.some((e) => e.id === r.enrollmentId && e.sectionId === sectionId)) &&
      r.subjects.some((s) => !s.pending),
  );
}
export function sectionStats(state: DemoState, exam: Examination, sectionId: string) {
  const students = testRoster(state, exam).filter((s) => s.enrollment.sectionId === sectionId);
  const results = testResults(state, exam, students);
  const scored = results.filter((r) => r.subjects.some((s) => !s.pending));
  const summaries = scored.map(resultSummary);
  return {
    students: students.length,
    absent: results.filter((r) => r.absent || r.subjects.some((s) => s.absent)).length,
    pending: students.length - results.filter((r) => r.subjects.every((s) => !s.pending)).length,
    average: summaries.length
      ? summaries.reduce((n, s) => n + s.percentage, 0) / summaries.length
      : null,
  };
}
export function overallLeaderboard(
  state: DemoState,
  students: RosterEntry[],
  exams: Examination[],
) {
  const eligible = exams.filter(
    (e) =>
      e.schoolId === state.school.id &&
      e.academicYearId === state.academicYear.id &&
      e.date <= getSchoolDate() &&
      marksAdded(state, e),
  );
  const rows = students
    .map((student) => {
      const results = eligible
        .flatMap((e) => testResults(state, e, [student]))
        .filter((r) => resultSummary(r).maximum > 0);
      const marks = results.reduce((n, r) => n + resultSummary(r).marks, 0),
        maximum = results.reduce((n, r) => n + resultSummary(r).maximum, 0);
      return {
        ...student,
        marks,
        maximum,
        count: results.length,
        percentage: maximum ? (marks / maximum) * 100 : 0,
        rank: 0,
      };
    })
    .filter((r) => r.count)
    .sort((a, b) => b.percentage - a.percentage || a.student.name.localeCompare(b.student.name));
  rows.forEach((r, i) => {
    r.rank = i && Math.abs(r.percentage - rows[i - 1].percentage) < 1e-9 ? rows[i - 1].rank : i + 1;
  });
  return rows;
}

export function subjectResults(
  state: DemoState,
  exam: Examination,
  sectionId: string,
  subject: TestSubject,
) {
  const rows = testRoster(state, exam)
    .filter((s) => s.enrollment.sectionId === sectionId)
    .map((student) => {
      const result = state.results.find(
        (r) =>
          r.schoolId === state.school.id &&
          r.examId === exam.id &&
          r.enrollmentId === student.enrollment.id,
      );
      const cell = result?.subjects.find((s) =>
        subject.subjectId
          ? s.subjectId === subject.subjectId
          : subjectName(state, student.enrollment.classId, s) === subject.name,
      );
      const absent = Boolean(result?.absent || cell?.absent),
        pending = !cell || Boolean(cell.pending);
      return {
        ...student,
        cell,
        absent,
        pending,
        percentage: !pending && !absent ? (cell!.marks / subject.maxMarks) * 100 : null,
        rank: 0,
      };
    })
    .sort(
      (a, b) =>
        (b.percentage ?? -1) - (a.percentage ?? -1) || a.student.name.localeCompare(b.student.name),
    );
  let position = 0;
  rows.forEach((r, i) => {
    if (r.percentage !== null) {
      position++;
      r.rank = i && r.percentage === rows[i - 1].percentage ? rows[i - 1].rank : position;
    }
  });
  const recorded = rows.filter((r) => !r.pending),
    present = rows.filter((r) => !r.pending && !r.absent);
  return {
    rows,
    absent: recorded.filter((r) => r.absent).length,
    pending: rows.filter((r) => r.pending).length,
    average: recorded.length
      ? recorded.reduce((n, r) => n + (r.absent ? 0 : r.percentage!), 0) / recorded.length
      : null,
    highest: present.length ? Math.max(...present.map((r) => r.cell!.marks)) : null,
  };
}
