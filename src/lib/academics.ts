import { examIncludes, validateTestScope } from './testScope';
import { z } from 'zod';
import type { DemoState, Examination, ExamResult, RosterEntry } from '../types/domain';
import { roster, resultSummary } from './selectors';
import { getSchoolDate } from './dates';
import { isTestSubjectSelected, validateTestSubjects } from './testSubjects';

import { reconcileMaximums, validateMaximums } from './assessmentMaximums';
export const testKinds = [
  'Daily test',
  'Monthly test',
  'Half-Yearly Examination',
  'Pre-Board Examination',
  'Pre-board',
  'Yearly Examination',
  'Term exam',
] as const;
const subjectSchema = z.object({
  subjectId: z.string().optional(),
  name: z.string().trim().min(1).max(60),
  maxMarks: z.number().finite().positive().max(10000),
});
export const examinationSchema = z.object({
  id: z.string(),
  schoolId: z.string(),
  academicYearId: z.string(),
  name: z.string().trim().min(1).max(100),
  date: z.iso.date(),
  kind: z.string().trim().max(60).default(''),
  classId: z.string(),
  sectionId: z.string(),
  classIds: z.array(z.string()).optional(),
  sectionIds: z.array(z.string()).optional(),
  sectionlessClassIds: z.array(z.string()).optional(),
  subjectSelections: z
    .array(z.object({ classId: z.string(), subjectIds: z.array(z.string()).max(30) }))
    .optional(),
  subjectMaximums: z
    .array(
      z.object({
        classId: z.string(),
        subjectId: z.string(),
        maxMarks: z.number().finite().positive().max(10000),
      }),
    )
    .optional(),
  sheets: z
    .array(
      z.object({
        classId: z.string().optional(),
        sectionId: z.string(),
        subjects: z.array(subjectSchema),
      }),
    )
    .optional(),
  subjects: z.array(subjectSchema).max(30),
});
export const examResultSchema = z.object({
  schoolId: z.string(),
  enrollmentId: z.string(),
  examId: z.string(),
  absent: z.boolean().optional(),
  subjects: z
    .array(
      subjectSchema
        .extend({
          marks: z.number().finite().nonnegative(),
          absent: z.boolean().optional(),
          pending: z.boolean().optional(),
        })
        .refine((s) => s.marks <= s.maxMarks),
    )
    .min(1),
});
export type NewTest = Omit<
  Examination,
  'id' | 'schoolId' | 'academicYearId' | 'subjects' | 'sectionId' | 'kind'
> & { subjects?: Examination['subjects']; sectionId?: string; kind?: string };
export type MarksEntry = { enrollmentId: string; marks: number[] | null; absent: boolean };

export function testRoster(state: DemoState, exam: Examination): RosterEntry[] {
  if (exam.schoolId !== state.school.id || exam.academicYearId !== state.academicYear.id) return [];
  return roster(state).filter((r) =>
    examIncludes(exam, r.enrollment.classId, r.enrollment.sectionId),
  );
}
export function testResults(
  state: DemoState,
  exam: Examination,
  students = testRoster(state, exam),
) {
  const ids = new Set(students.map((r) => r.enrollment.id));
  return state.results.filter(
    (r) => r.schoolId === state.school.id && r.examId === exam.id && ids.has(r.enrollmentId),
  );
}
export function testParticipation(
  state: DemoState,
  exam: Examination,
  students = testRoster(state, exam),
) {
  const results = testResults(state, exam, students);
  const taken = results.filter((result) => !result.absent);
  const absent = results.filter((result) => result.absent);
  return {
    total: students.length,
    recorded: results.length,
    taken: taken.length,
    absent: absent.length,
    pending: students.length - results.length,
    average: taken.length
      ? taken.reduce((sum, result) => sum + resultSummary(result).percentage, 0) / taken.length
      : null,
  };
}

export function createTest(state: DemoState, input: NewTest): DemoState {
  const parsed = examinationSchema.safeParse({
    subjects: [],
    sectionId: '',
    ...input,
    id: crypto.randomUUID(),
    schoolId: state.school.id,
    academicYearId: state.academicYear.id,
  });
  if (!parsed.success)
    throw new Error('Enter a test name, a valid date, and a positive maximum for each subject.');
  const exam = parsed.data.classIds
    ? {
        ...parsed.data,
        classId: parsed.data.classIds.length === 1 ? parsed.data.classIds[0] : '',
        sectionId: '',
      }
    : parsed.data;
  validateTestScope(state, exam, true);
  validateTestSubjects(state, exam);
  validateMaximums(state, exam, input.subjectMaximums !== undefined);
  if (
    exam.date < state.academicYear.start ||
    exam.date > state.academicYear.end ||
    exam.date > getSchoolDate(new Date(), state.school.timezone)
  )
    throw new Error('Choose a date in this academic year, up to today.');
  if (new Set(exam.subjects.map((s) => s.name.toLowerCase())).size !== exam.subjects.length)
    throw new Error('Each subject should have a different name.');
  if (!testRoster(state, exam).length) throw new Error('This class has no active students.');
  return { ...state, exams: [...state.exams, exam] };
}
export function saveTestMarks(state: DemoState, examId: string, entries: MarksEntry[]): DemoState {
  const exam = state.exams.find(
    (e) =>
      e.id === examId &&
      e.schoolId === state.school.id &&
      e.academicYearId === state.academicYear.id,
  );
  if (!exam) throw new Error('Test not found.');
  const ids = new Set(testRoster(state, exam).map((r) => r.enrollment.id));
  if (
    !entries.length ||
    new Set(entries.map((e) => e.enrollmentId)).size !== entries.length ||
    entries.some((e) => !ids.has(e.enrollmentId))
  )
    throw new Error('Choose students from this test’s class.');
  const results: ExamResult[] = [];
  for (const entry of entries) {
    if (entry.marks === null && !entry.absent) continue;
    if (
      !entry.absent &&
      (entry.marks?.length !== exam.subjects.length ||
        entry.marks.some(
          (mark, i) => !Number.isFinite(mark) || mark < 0 || mark > exam.subjects[i].maxMarks,
        ))
    )
      throw new Error(
        'Marks must be between zero and the subject maximum. Complete every subject for a student, or leave their whole row blank.',
      );
    results.push({
      schoolId: state.school.id,
      examId,
      enrollmentId: entry.enrollmentId,
      absent: entry.absent,
      subjects: exam.subjects.map((s, i) => ({ ...s, marks: entry.absent ? 0 : entry.marks![i] })),
    });
  }
  const changed = new Set(entries.map((e) => e.enrollmentId));
  return {
    ...state,
    results: [
      ...state.results.filter(
        (r) =>
          !(r.schoolId === state.school.id && r.examId === examId && changed.has(r.enrollmentId)),
      ),
      ...results,
    ],
  };
}

export function rankResults(
  state: DemoState,
  students: RosterEntry[],
  exams: Examination[],
  requireComplete = true,
) {
  // Every ranked student is compared across the same fully recorded tests.
  const included = exams.filter((exam) => {
    const eligible = testRoster(state, exam).filter((r) =>
      students.some((s) => s.enrollment.id === r.enrollment.id),
    );
    return (
      eligible.length > 0 &&
      (!requireComplete ||
        (eligible.length === students.length &&
          testResults(state, exam, eligible).length === eligible.length))
    );
  });
  const rows = students
    .map((student) => {
      const results = included
        .flatMap((e) => testResults(state, e, [student]))
        .filter((result) => resultSummary(result).maximum > 0);
      const marks = results.reduce((n, r) => n + resultSummary(r).marks, 0);
      const maximum = results.reduce((n, r) => n + resultSummary(r).maximum, 0);
      return {
        ...student,
        marks,
        maximum,
        count: results.length,
        percentage: maximum ? (marks / maximum) * 100 : 0,
        rank: 0,
      };
    })
    .filter((r) => r.count > 0)
    .sort((a, b) => b.percentage - a.percentage || a.student.name.localeCompare(b.student.name));
  rows.forEach((row, i) => {
    row.rank =
      i > 0 && row.marks * rows[i - 1].maximum === rows[i - 1].marks * row.maximum
        ? rows[i - 1].rank
        : i + 1;
  });
  return { rows, included };
}

export function updateTest(state: DemoState, examId: string, input: NewTest): DemoState {
  const existing = state.exams.find(
    (e) =>
      e.id === examId &&
      e.schoolId === state.school.id &&
      e.academicYearId === state.academicYear.id,
  );
  if (!existing) throw new Error('Test not found.');
  const parsed = examinationSchema.safeParse({
    ...existing,
    ...input,
    id: existing.id,
    schoolId: state.school.id,
    academicYearId: state.academicYear.id,
  });
  if (!parsed.success) throw new Error('Enter valid test details and positive maximum marks.');
  const exam = parsed.data.classIds
    ? {
        ...parsed.data,
        classId: parsed.data.classIds.length === 1 ? parsed.data.classIds[0] : '',
        sectionId: '',
      }
    : parsed.data;
  validateTestScope(state, exam, false);
  validateTestSubjects(state, exam);
  if (
    exam.date < state.academicYear.start ||
    exam.date > state.academicYear.end ||
    exam.date > getSchoolDate(new Date(), state.school.timezone)
  )
    throw new Error('Choose a date in this academic year, up to today.');
  if (new Set(exam.subjects.map((s) => s.name.toLowerCase())).size !== exam.subjects.length)
    throw new Error('Each subject should have a different name.');
  const recorded = state.results.filter(
    (r) => r.schoolId === state.school.id && r.examId === examId,
  );
  const allowed = new Set(
    state.enrollments
      .filter(
        (e) =>
          e.schoolId === state.school.id &&
          e.academicYearId === state.academicYear.id &&
          examIncludes(exam, e.classId, e.sectionId),
      )
      .map((e) => e.id),
  );
  if (
    exam.subjectSelections &&
    recorded.some((result) => {
      const classId =
        state.enrollments.find((enrollment) => enrollment.id === result.enrollmentId)?.classId ??
        '';
      return result.subjects.some(
        (subject) => !subject.pending && !isTestSubjectSelected(state, exam, classId, subject),
      );
    })
  )
    throw new Error(
      'Keep subjects with saved marks selected. Clear their marks in the marks sheet before removing them.',
    );
  if (input.subjects && recorded.length && exam.subjects.length !== existing.subjects.length)
    throw new Error('Keep the legacy subject count unchanged after marks are recorded.');
  if (recorded.some((r) => !allowed.has(r.enrollmentId) && r.subjects.some((s) => !s.pending)))
    throw new Error(
      'This change would remove students with saved marks. Keep their class and sections unchanged, or clear those marks first.',
    );
  if (
    input.subjects &&
    recorded.some((r) =>
      r.subjects.some(
        (subject, i) => exam.subjects[i] && subject.marks > exam.subjects[i].maxMarks,
      ),
    )
  )
    throw new Error('A maximum cannot be lower than marks already recorded.');
  if (input.subjectMaximums === undefined && exam.subjectMaximums) {
    exam.subjectMaximums = exam.subjectMaximums.filter((m) =>
      isTestSubjectSelected(state, exam, m.classId, { subjectId: m.subjectId, name: '' }),
    );
  }
  validateMaximums(state, exam, input.subjectMaximums !== undefined);
  return reconcileMaximums(
    {
      ...state,
      exams: state.exams.map((e) =>
        e.id === examId
          ? {
              ...exam,
              sheets: exam.sheets?.map((sheet) => ({
                ...sheet,
                subjects: sheet.subjects.filter((subject) =>
                  isTestSubjectSelected(
                    state,
                    exam,
                    sheet.classId ??
                      state.sections.find((section) => section.id === sheet.sectionId)?.classId ??
                      exam.classId,
                    subject,
                  ),
                ),
              })),
            }
          : e,
      ),
      results: state.results
        .map((r) =>
          r.schoolId === state.school.id && r.examId === examId
            ? {
                ...r,
                subjects: r.subjects
                  .map((s, i) => ({
                    ...s,
                    ...(input.subjects ? exam.subjects[i] : {}),
                  }))
                  .filter((subject) =>
                    isTestSubjectSelected(
                      state,
                      exam,
                      state.enrollments.find((enrollment) => enrollment.id === r.enrollmentId)
                        ?.classId ?? '',
                      subject,
                    ),
                  ),
              }
            : r,
        )
        .filter(
          (result) =>
            result.subjects.length > 0 &&
            (result.examId !== examId || allowed.has(result.enrollmentId)),
        ),
    },
    exam,
  );
}
export function deleteTest(state: DemoState, examId: string): DemoState {
  if (!state.exams.some((e) => e.id === examId && e.schoolId === state.school.id))
    throw new Error('Test not found.');
  return {
    ...state,
    exams: state.exams.filter((e) => e.id !== examId || e.schoolId !== state.school.id),
    results: state.results.filter((r) => r.examId !== examId || r.schoolId !== state.school.id),
  };
}
