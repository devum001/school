import { z } from 'zod';
import type { AttendanceStatus, DemoState, Payment } from '../types/domain';
import { createSeed } from '../mocks/seed';
import { mergeAttendance, restoreSchoolState } from '../mocks/restore';
import { getSchoolDate } from './dates';
import {
  createTest,
  updateTest,
  deleteTest,
  saveTestMarks,
  examinationSchema,
  examResultSchema,
  type NewTest,
  type MarksEntry,
} from './academics';
import {
  saveStudent,
  deleteStudent,
  saveTeacher,
  deleteTeacher,
  studentSchema,
  teacherSchema,
  enrollmentSchema,
  sectionSchema,
  obligationSchema,
  type StudentInput,
  type TeacherInput,
} from './management';
import { STORAGE_KEY } from './config';
import { refreshPresentationCopy } from './presentation';
import {
  attendanceStatusSchema,
  dispatchNotifications,
  recordPayment,
  saveAttendance,
} from './operations';
const savedSchema = z.object({
  version: z.literal(1),
  students: z.array(studentSchema).optional(),
  enrollments: z.array(enrollmentSchema).optional(),
  teachers: z.array(teacherSchema).optional(),
  sections: z.array(sectionSchema).optional(),
  obligations: z.array(obligationSchema).optional(),
  exams: z.array(examinationSchema).optional(),
  results: z.array(examResultSchema).optional(),
  attendance: z.array(
    z.object({
      schoolId: z.string(),
      enrollmentId: z.string(),
      date: z.iso.date(),
      status: attendanceStatusSchema,
    }),
  ),
  payments: z.array(
    z.object({
      id: z.string(),
      schoolId: z.string(),
      enrollmentId: z.string(),
      amount: z.number().int().positive(),
      date: z.iso.date(),
      method: z.enum(['Bank transfer', 'Cash', 'UPI']),
      reference: z.string(),
    }),
  ),
  notifications: z.array(
    z.object({
      id: z.string(),
      schoolId: z.string(),
      enrollmentId: z.string(),
      date: z.iso.date(),
      attendanceDate: z.iso.date(),
      message: z.string(),
      status: z.enum(['simulated-success', 'simulated-failure']),
    }),
  ),
  activities: z.array(
    z.object({
      id: z.string(),
      text: z.string(),
      detail: z.string(),
      date: z.string(),
      kind: z.enum(['attendance', 'payment', 'notification']),
    }),
  ),
});
export interface SchoolRepository {
  getSnapshot: () => DemoState;
  subscribe: (listener: () => void) => () => void;
  saveAttendance: (
    date: string,
    sectionId: string,
    changes: Record<string, AttendanceStatus>,
  ) => void;
  recordPayment: (input: Omit<Payment, 'id' | 'schoolId'>) => void;
  dispatchNotifications: (ids: string[], date: string) => void;
  createTest: (input: NewTest) => string;
  saveTestMarks: (examId: string, entries: MarksEntry[]) => void;
  saveStudent: (input: StudentInput, studentId?: string) => void;
  deleteStudent: (studentId: string) => void;
  saveTeacher: (input: TeacherInput, teacherId?: string) => void;
  deleteTeacher: (teacherId: string) => void;
  updateTest: (examId: string, input: NewTest) => void;
  deleteTest: (examId: string) => void;
  reset: () => void;
}
let state = createSeed();
try {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw)
    state = refreshPresentationCopy(restoreSchoolState(state, savedSchema.parse(JSON.parse(raw))));
} catch {
  /* An unavailable or incompatible browser cache starts a fresh demo. */
}
const listeners = new Set<() => void>();
let seededDate = getSchoolDate();
let dayTimer: ReturnType<typeof setInterval> | undefined;
function refreshPresentationDay() {
  const today = getSchoolDate();
  if (today === seededDate) return;
  const fresh = createSeed(today);
  state = {
    ...state,
    attendance: mergeAttendance(fresh.attendance, state.attendance).filter((r) =>
      state.enrollments.some((e) => e.id === r.enrollmentId),
    ),
  };
  seededDate = today;
  listeners.forEach((listener) => listener());
}
function commit(next: DemoState) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      version: next.version,
      students: next.students,
      enrollments: next.enrollments,
      teachers: next.teachers,
      sections: next.sections,
      obligations: next.obligations,
      attendance: next.attendance,
      payments: next.payments,
      notifications: next.notifications,
      activities: next.activities,
      exams: next.exams,
      results: next.results,
    }),
  );
  state = next;
  listeners.forEach((l) => l());
}
export const repository: SchoolRepository = {
  getSnapshot: () => state,
  subscribe: (listener) => {
    listeners.add(listener);
    if (listeners.size === 1) {
      refreshPresentationDay();
      dayTimer = setInterval(refreshPresentationDay, 30_000);
      window.addEventListener('focus', refreshPresentationDay);
      document.addEventListener('visibilitychange', refreshPresentationDay);
    }
    return () => {
      listeners.delete(listener);
      if (listeners.size === 0) {
        clearInterval(dayTimer);
        window.removeEventListener('focus', refreshPresentationDay);
        document.removeEventListener('visibilitychange', refreshPresentationDay);
      }
    };
  },
  saveAttendance: (date, section, changes) => commit(saveAttendance(state, date, section, changes)),
  recordPayment: (input) => commit(recordPayment(state, input)),
  dispatchNotifications: (ids, date) => commit(dispatchNotifications(state, ids, date)),
  createTest: (input) => {
    const next = createTest(state, input);
    commit(next);
    return next.exams[next.exams.length - 1].id;
  },
  saveTestMarks: (examId, entries) => commit(saveTestMarks(state, examId, entries)),
  saveStudent: (input, id) => commit(saveStudent(state, input, id)),
  deleteStudent: (id) => commit(deleteStudent(state, id)),
  saveTeacher: (input, id) => commit(saveTeacher(state, input, id)),
  deleteTeacher: (id) => commit(deleteTeacher(state, id)),
  updateTest: (id, input) => commit(updateTest(state, id, input)),
  deleteTest: (id) => commit(deleteTest(state, id)),
  reset: () => commit(createSeed()),
};
