import { sortMarksRoster } from './marksRoster';
import { assessmentMaximum } from './assessmentMaximums';
import { examIncludes } from './testScope';
import type { DemoState, Examination, ExamResult, RosterEntry, TestSubject } from '../types/domain';
import { testRoster, testResults } from './academics';
import { classSubjects, subjectName } from './classSubjects';
import { resultSummary } from './selectors';
import { getSchoolDate } from './dates';
import { isTestSubjectSelected } from './testSubjects';
import { examGroups, matchesAcademicScope } from './academicGroups';

export type SheetColumn = { subjectId: string; name: string; maximum: string };
export type SheetRow = { enrollmentId: string; cells: string[] };
const sameSubject = (a: TestSubject, b: TestSubject) =>
  a.subjectId && b.subjectId ? a.subjectId === b.subjectId : a.name === b.name;
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
  sectionId: string | undefined,
  classId = state.sections.find((s) => s.id === sectionId)?.classId ?? exam.classId,
): TestSubject[] {
  if (sectionId === undefined) {
    const subjects = examGroups(state, exam, classId).flatMap((g) =>
      savedSubjects(state, exam, g.sectionId, g.classId),
    );
    return subjects.filter(
      (subject, index) => subjects.findIndex((s) => sameSubject(s, subject)) === index,
    );
  }
  const sheet = exam.sheets?.find(
    (s) =>
      s.sectionId === sectionId &&
      (s.classId ? s.classId === classId : Boolean(sectionId) || exam.classId === classId),
  );
  const recorded = sheet ? sheet.subjects : exam.subjects;
  const configured = classSubjects(state, classId);
  const declared = exam.subjectSelections
    ? (exam.subjectMaximums ?? [])
        .filter((m) => m.classId === classId)
        .map((m) => ({
          subjectId: m.subjectId,
          name:
            configured.find((s) => s.id === m.subjectId)?.name ??
            recorded.find((s) => s.subjectId === m.subjectId)?.name ??
            '',
          maxMarks: m.maxMarks,
        }))
    : [];
  return [...recorded, ...declared.filter((s) => !recorded.some((r) => sameSubject(r, s)))]
    .filter((s) => isTestSubjectSelected(state, exam, classId, s))
    .map((s) => ({
      ...s,
      name: subjectName(state, classId, s),
    }));
}
export function sheetDraft(
  state: DemoState,
  exam: Examination,
  sectionId: string,
  classId = state.sections.find((s) => s.id === sectionId)?.classId ?? exam.classId,
) {
  const students = sortMarksRoster(
    testRoster(state, exam).filter((r) => matchesAcademicScope(r.enrollment, classId, sectionId)),
  );
  const saved = savedSubjects(state, exam, sectionId, classId);
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
      assessmentMaximum(state, exam, classId, { subjectId: s.id, name: s.name }) ??
        saved.find((p) => p.subjectId === s.id || p.name === s.name || s.aliases?.includes(p.name))
          ?.maxMarks ??
        '',
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
  classId?: string,
): DemoState {
  const exam = state.exams.find(
    (e) =>
      e.id === examId &&
      e.schoolId === state.school.id &&
      e.academicYearId === state.academicYear.id,
  );
  const scopeClass =
    classId ?? state.sections.find((s) => s.id === sectionId)?.classId ?? exam?.classId;
  if (
    !exam ||
    !scopeClass ||
    !examGroups(state, exam, scopeClass).some((s) => s.sectionId === sectionId)
  )
    throw new Error('Choose a class and student group assigned to this test.');
  const draft = sheetDraft(state, exam, sectionId, scopeClass);
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
    .filter(
      (c) =>
        rows.some((r) => r.cells[c.index].trim() !== '') ||
        (exam.subjectSelections &&
          exam.subjectMaximums?.some(
            (m) => m.classId === scopeClass && m.subjectId === c.subjectId,
          )),
    );
  const maximums = [...(exam.subjectMaximums ?? [])];
  for (const c of included) {
    const expected = assessmentMaximum(state, exam, scopeClass, c);
    const legacy = (exam.sheets ?? [])
      .filter(
        (s) =>
          (s.classId ??
            state.sections.find((v) => v.id === s.sectionId)?.classId ??
            exam.classId) === scopeClass,
      )
      .flatMap((s) => s.subjects.filter((v) => v.subjectId === c.subjectId).map((v) => v.maxMarks));
    if (
      (expected !== undefined && expected !== Number(c.maximum)) ||
      (expected === undefined && legacy.some((m) => m !== Number(c.maximum)))
    )
      throw new Error(
        'Maximum marks apply to every section. Use Edit Test to change or reconcile them before saving marks.',
      );
    if (!maximums.some((m) => m.classId === scopeClass && m.subjectId === c.subjectId))
      maximums.push({ classId: scopeClass, subjectId: c.subjectId, maxMarks: Number(c.maximum) });
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
            subjectMaximums: maximums,
            sheets: [
              ...(e.sheets ?? []).filter(
                (s) =>
                  s.sectionId !== sectionId ||
                  (s.classId ??
                    state.sections.find((section) => section.id === s.sectionId)?.classId ??
                    e.classId) !== scopeClass,
              ),
              {
                classId: scopeClass,
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

export function marksAdded(
  state: DemoState,
  exam: Examination,
  sectionId?: string,
  classId?: string,
) {
  return testResults(state, exam).some(
    (r) =>
      state.enrollments.some(
        (e) => e.id === r.enrollmentId && matchesAcademicScope(e, classId, sectionId),
      ) && r.subjects.some((s) => !s.pending),
  );
}
export function sectionStats(
  state: DemoState,
  exam: Examination,
  sectionId: string | undefined,
  classId?: string,
) {
  const students = testRoster(state, exam).filter((s) =>
    matchesAcademicScope(s.enrollment, classId, sectionId),
  );
  const results = testResults(state, exam, students);
  const scored = results.filter((r) => r.subjects.some((s) => !s.pending));
  const summaries = scored.map(resultSummary).filter((s) => s.maximum > 0);
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
      e.date <= getSchoolDate(new Date(), state.school.timezone) &&
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
    r.rank =
      i && r.marks * rows[i - 1].maximum === rows[i - 1].marks * r.maximum
        ? rows[i - 1].rank
        : i + 1;
  });
  return rows;
}

export function subjectResults(
  state: DemoState,
  exam: Examination,
  sectionId: string | undefined,
  subject: TestSubject,
  classId?: string,
) {
  const rows = testRoster(state, exam)
    .filter((s) => matchesAcademicScope(s.enrollment, classId, sectionId))
    .map((student) => {
      const result = state.results.find(
        (r) =>
          r.schoolId === state.school.id &&
          r.examId === exam.id &&
          r.enrollmentId === student.enrollment.id,
      );
      const cell = result?.subjects.find((s) =>
        subject.subjectId
          ? s.subjectId === subject.subjectId ||
            (!s.subjectId && subjectName(state, student.enrollment.classId, s) === subject.name)
          : subjectName(state, student.enrollment.classId, s) === subject.name,
      );
      const absent = Boolean(result?.absent || cell?.absent),
        applicable =
          Boolean(cell) ||
          savedSubjects(state, exam, student.enrollment.sectionId, student.enrollment.classId).some(
            (s) => sameSubject(s, subject),
          ),
        pending = applicable && (!cell || Boolean(cell.pending));
      return {
        ...student,
        cell,
        absent,
        applicable,
        pending,
        percentage: applicable && !pending && !absent ? (cell!.marks / cell!.maxMarks) * 100 : null,
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
  const recorded = rows.filter((r) => r.applicable && !r.pending),
    present = recorded.filter((r) => !r.absent);
  return {
    rows,
    absent: recorded.filter((r) => r.absent).length,
    pending: rows.filter((r) => r.pending).length,
    average: present.length
      ? present.reduce((n, r) => n + r.percentage!, 0) / present.length
      : null,
    highest: present.length ? Math.max(...present.map((r) => r.cell!.marks)) : null,
  };
}
