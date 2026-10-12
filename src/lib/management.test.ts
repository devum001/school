import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { createSeed } from '../mocks/seed';
import { restoreSchoolState } from '../mocks/restore';
import {
  saveStudent,
  deleteStudent,
  saveTeacher,
  deleteTeacher,
  type StudentInput,
  type TeacherInput,
} from './management';
import { updateTest, deleteTest } from './academics';
import { feeSummary, resultSummary, roster } from './selectors';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-11T06:30:00Z'));
});
afterEach(() => vi.useRealTimers());
const student: StudentInput = {
  name: 'Aditi Verma',
  admissionNumber: 'VN-NEW-001',
  status: 'active',
  birthDate: '2015-04-12',
  guardian: { name: 'Ravi Verma', relation: 'Father', contact: null },
  address: '',
  classId: 'class-5',
  sectionId: 'class-5-a',
  rollNumber: 13,
};
const teacher: TeacherInput = {
  name: 'Kavya Desai',
  staffId: 'VN-T100',
  subject: 'Mathematics',
  status: 'active',
  email: 'kavya@example.test',
  phone: '',
  qualification: 'M.Sc., B.Ed.',
  joinedOn: '2026-10-11',
  sectionIds: ['class-5-a'],
};
it('adds and edits students with unique admission/roll numbers and keeps data immutable', () => {
  const original = createSeed();
  let state = saveStudent(original, student);
  expect(roster(state)).toHaveLength(144);
  expect(original.students).toHaveLength(144);
  const added = state.students.at(-1)!;
  expect(() => saveStudent(state, student)).toThrow(/admission number/);
  expect(() => saveStudent(state, { ...student, admissionNumber: 'OTHER' })).toThrow(/roll number/);
  state = saveStudent(state, { ...student, name: 'Aditi Mehta', status: 'inactive' }, added.id);
  expect(roster(state)).toHaveLength(143);
  expect(state.students.at(-1)?.name).toBe('Aditi Mehta');
});
it('validates student scope, parent numbers and historical enrollment moves', () => {
  const state = createSeed();
  const row = roster(state)[0];
  expect(() => saveStudent(state, { ...student, sectionId: 'class-6-a' })).toThrow();
  expect(() =>
    saveStudent(state, { ...student, guardian: { ...student.guardian, contact: 'not-a-number' } }),
  ).toThrow();
  expect(() => saveStudent(state, student, 'foreign-student')).toThrow();
  expect(() =>
    saveStudent(
      state,
      { ...row.student, classId: 'class-10', sectionId: 'class-10-b', rollNumber: 99 },
      row.student.id,
    ),
  ).toThrow(/saved records/);
});
it('deletes student-linked records permanently without resurrecting them on restoration', () => {
  const original = createSeed();
  const ids = new Set(
    original.enrollments.filter((e) => e.studentId === 'stu-001').map((e) => e.id),
  );
  const state = deleteStudent(original, 'stu-001');
  const restored = restoreSchoolState(createSeed('2026-10-12'), state);
  expect(restored.students.some((s) => s.id === 'stu-001')).toBe(false);
  for (const records of [
    restored.attendance,
    restored.results,
    restored.payments,
    restored.obligations,
    restored.notifications,
  ])
    expect(records.some((r) => ids.has(r.enrollmentId))).toBe(false);
  expect(restored.enrollments.some((e) => ids.has(e.id))).toBe(false);
  expect(feeSummary(restored).total).toBeLessThan(feeSummary(original).total);
  expect(original.students).toHaveLength(144);
});
it('assigns and deactivates teachers without deleting classes or student records', () => {
  let state = saveTeacher(createSeed(), teacher);
  const id = state.teachers.at(-1)!.id;
  expect(state.sections.find((s) => s.id === 'class-5-a')?.teacherId).toBe(id);
  expect(() => saveTeacher(state, teacher)).toThrow(/staff ID/);
  expect(() => saveTeacher(state, { ...teacher, status: 'inactive' }, id)).toThrow(/Inactive/);
  state = saveTeacher(state, { ...teacher, status: 'inactive', sectionIds: [] }, id);
  expect(state.sections.find((s) => s.id === 'class-5-a')?.teacherId).toBe('');
  const restored = restoreSchoolState(createSeed(), state);
  expect(restored.teachers.at(-1)?.status).toBe('inactive');
  expect(restored.sections.find((s) => s.id === 'class-5-a')?.teacherId).toBe('');
  const deleted = deleteTeacher(restored, id);
  expect(deleted.teachers.some((t) => t.id === id)).toBe(false);
  expect(deleted.students).toEqual(state.students);
  expect(deleted.sections).toHaveLength(12);
});
it('validates teacher contacts, assignments and cross-school identifiers', () => {
  const state = createSeed();
  expect(() => saveTeacher(state, { ...teacher, email: 'invalid' })).toThrow();
  expect(() => saveTeacher(state, { ...teacher, sectionIds: ['foreign-section'] })).toThrow();
  expect(() => saveTeacher(state, teacher, 'foreign-teacher')).toThrow();
  expect(() => deleteTeacher(state, 'foreign-teacher')).toThrow();
});
it('updates test metadata and maxima consistently without losing marks', () => {
  const state = createSeed();
  const exam = state.exams.find((e) => e.id === 'exam-daily')!;
  const next = updateTest(state, exam.id, {
    ...exam,
    name: 'Revised daily test',
    subjects: [{ name: 'Maths', maxMarks: 40 }],
  });
  const before = state.results.find((r) => r.examId === exam.id)!;
  const after = next.results.find((r) => r.examId === exam.id)!;
  expect(after.subjects[0].marks).toBe(before.subjects[0].marks);
  expect(resultSummary(after).percentage).toBe(resultSummary(before).percentage / 2);
  expect(after.subjects[0].name).toBe('Maths');
  expect(() =>
    updateTest(state, exam.id, { ...exam, subjects: [{ name: 'Maths', maxMarks: 1 }] }),
  ).toThrow(/maximum/);
  expect(() => updateTest(state, exam.id, { ...exam, classId: 'class-5' })).toThrow(/unchanged/);
  expect(() =>
    updateTest(state, exam.id, {
      ...exam,
      subjects: [...exam.subjects, { name: 'Science', maxMarks: 20 }],
    }),
  ).toThrow(/unchanged/);
});
it('deletes tests and their results and preserves an empty exam history on reload', () => {
  let state = createSeed();
  for (const exam of state.exams) state = deleteTest(state, exam.id);
  const restored = restoreSchoolState(createSeed(), state);
  expect(restored.exams).toEqual([]);
  expect(restored.results).toEqual([]);
  expect(restored.students).toHaveLength(144);
});
