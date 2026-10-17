import { z } from 'zod';
import type { DemoState, Student, Teacher } from '../types/domain';
import { getSchoolDate } from './dates';
import { whatsappPhone } from './reportShare';
import { saveFeePlan } from './feePlans';
import type { FeePlanInput } from '../types/ledger';
import { imageDataSchema } from './ledgerSchemas';
import {
  admissionSequenceKey,
  nextAdmissionNumber,
  renumberStudentRolls,
} from './studentNumbering';

const text = z.string().trim().min(1).max(100);
export const studentSchema = z.object({
  id: z.string(),
  schoolId: z.string(),
  name: text,
  admissionNumber: text,
  status: z.enum(['active', 'inactive']),
  birthDate: z.iso.date(),
  guardian: z.object({ name: text, relation: text, contact: z.string().nullable() }),
  address: z.string().max(500),
});
export const enrollmentSchema = z.object({
  id: z.string(),
  schoolId: z.string(),
  studentId: z.string(),
  academicYearId: z.string(),
  classId: z.string(),
  sectionId: z.string(),
  rollNumber: z.number().int().positive(),
});
export const teacherSchema = z.object({
  id: z.string(),
  schoolId: z.string(),
  name: text,
  subject: z.string().max(100),
  staffId: text,
  status: z.enum(['active', 'inactive']),
  email: z.string(),
  phone: z.string(),
  qualification: z.string().max(150),
  joinedOn: z.iso.date(),
  photoDataUrl: imageDataSchema.optional(),
});
export const sectionSchema = z.object({
  id: z.string(),
  schoolId: z.string(),
  classId: z.string(),
  name: z.string(),
  teacherId: z.string(),
});
export const obligationSchema = z.object({
  id: z.string(),
  schoolId: z.string(),
  enrollmentId: z.string(),
  label: z.string(),
  dueDate: z.iso.date(),
  amount: z.number().int(),
  adjustment: z.number().int(),
  installmentNumber: z.number().int().positive().optional(),
  installmentCount: z.number().int().positive().optional(),
  feeKind: z.enum(['One Time', 'Installments']).optional(),
});
export type StudentInput = Omit<Student, 'id' | 'schoolId'> & {
  classId: string;
  sectionId: string;
  rollNumber: number;
  feePlan?: FeePlanInput;
};
export type TeacherInput = Omit<Teacher, 'id' | 'schoolId'> & { sectionIds: string[] };

export function studentRecordCounts(state: DemoState, studentId: string) {
  const ids = new Set(
    state.enrollments
      .filter((e) => e.schoolId === state.school.id && e.studentId === studentId)
      .map((e) => e.id),
  );
  return {
    attendance: state.attendance.filter((r) => ids.has(r.enrollmentId)).length,
    results: state.results.filter((r) => ids.has(r.enrollmentId)).length,
    payments: state.payments.filter((r) => ids.has(r.enrollmentId)).length,
    obligations: state.obligations.filter((r) => ids.has(r.enrollmentId)).length,
    notifications: state.notifications.filter((r) => ids.has(r.enrollmentId)).length,
  };
}
export function saveStudent(state: DemoState, input: StudentInput, studentId?: string): DemoState {
  const existing = studentId
    ? state.students.find((s) => s.id === studentId && s.schoolId === state.school.id)
    : undefined;
  if (studentId && !existing) throw new Error('Student not found.');
  const parsed = studentSchema.safeParse({
    ...input,
    admissionNumber:
      existing?.admissionNumber ?? (input.admissionNumber.trim() || nextAdmissionNumber(state)),
    id: existing?.id ?? crypto.randomUUID(),
    schoolId: state.school.id,
  });
  if (!parsed.success)
    throw new Error(
      'Complete the student name, admission number, birth date and guardian details.',
    );
  const student = parsed.data;
  if (student.birthDate > getSchoolDate()) throw new Error('Birth date cannot be in the future.');
  if (
    state.students.some(
      (s) =>
        s.schoolId === state.school.id &&
        s.id !== student.id &&
        s.admissionNumber.toLowerCase() === student.admissionNumber.toLowerCase(),
    )
  )
    throw new Error('This admission number is already in use.');
  if (
    student.guardian.contact &&
    student.guardian.contact !== existing?.guardian.contact &&
    !whatsappPhone(student.guardian.contact)
  )
    throw new Error('Enter a valid parent mobile number or leave it blank.');
  const section = state.sections.find(
    (s) =>
      s.id === input.sectionId && s.classId === input.classId && s.schoolId === state.school.id,
  );
  if (
    !section ||
    !state.classes.some((c) => c.id === input.classId && c.schoolId === state.school.id)
  )
    throw new Error('Choose a valid class and section.');
  const enrollment = state.enrollments.find(
    (e) =>
      e.studentId === student.id &&
      e.schoolId === state.school.id &&
      e.academicYearId === state.academicYear.id,
  );
  if (
    enrollment &&
    (enrollment.classId !== input.classId || enrollment.sectionId !== input.sectionId) &&
    Object.values(studentRecordCounts(state, student.id)).some(Boolean)
  )
    throw new Error(
      'This enrollment has saved records. Its class and section must stay unchanged to preserve history.',
    );
  const nextEnrollment = {
    id: enrollment?.id ?? crypto.randomUUID(),
    schoolId: state.school.id,
    studentId: student.id,
    academicYearId: state.academicYear.id,
    classId: input.classId,
    sectionId: section.id,
    rollNumber: 1,
  };
  const next: DemoState = {
    ...state,
    studentAdmissionSequences: {
      ...state.studentAdmissionSequences,
      [admissionSequenceKey(state)]: Math.max(
        state.studentAdmissionSequences?.[admissionSequenceKey(state)] ?? 0,
        Number(nextAdmissionNumber(state).split('-').at(-1)) - (existing ? 1 : 0),
      ),
    },
    students: existing
      ? state.students.map((s) => (s.id === student.id ? student : s))
      : [...state.students, student],
    enrollments: enrollment
      ? state.enrollments.map((e) => (e.id === enrollment.id ? nextEnrollment : e))
      : [...state.enrollments, nextEnrollment],
  };
  const numbered = renumberStudentRolls(next);
  return input.feePlan ? saveFeePlan(numbered, nextEnrollment.id, input.feePlan) : numbered;
}
export function deleteStudent(state: DemoState, studentId: string): DemoState {
  if (!state.students.some((s) => s.schoolId === state.school.id && s.id === studentId))
    throw new Error('Student not found.');
  const ids = new Set(
    state.enrollments
      .filter((e) => e.schoolId === state.school.id && e.studentId === studentId)
      .map((e) => e.id),
  );
  if (
    state.payments.some(
      (payment) =>
        payment.schoolId === state.school.id &&
        ids.has(payment.enrollmentId) &&
        payment.receiptNumber,
    )
  )
    throw new Error(
      'This student has recorded receipts. Mark the student inactive to keep payment history.',
    );
  const retained = <T extends { schoolId: string; enrollmentId: string }>(records: T[]) =>
    records.filter((r) => r.schoolId !== state.school.id || !ids.has(r.enrollmentId));
  return renumberStudentRolls({
    ...state,
    students: state.students.filter((s) => s.id !== studentId || s.schoolId !== state.school.id),
    enrollments: state.enrollments.filter((e) => !ids.has(e.id)),
    attendance: retained(state.attendance),
    results: retained(state.results),
    obligations: retained(state.obligations),
    payments: retained(state.payments),
    feePlans: state.feePlans?.filter(
      (plan) => plan.schoolId !== state.school.id || !ids.has(plan.enrollmentId),
    ),
    documents: state.documents?.filter(
      (document) =>
        document.schoolId !== state.school.id ||
        document.ownerKind !== 'student' ||
        document.ownerId !== studentId,
    ),
    notifications: retained(state.notifications),
  });
}
export function saveTeacher(state: DemoState, input: TeacherInput, teacherId?: string): DemoState {
  const existing = teacherId
    ? state.teachers.find((t) => t.id === teacherId && t.schoolId === state.school.id)
    : undefined;
  if (teacherId && !existing) throw new Error('Teacher not found.');
  const parsed = teacherSchema.safeParse({
    ...input,
    id: existing?.id ?? crypto.randomUUID(),
    schoolId: state.school.id,
  });
  if (!parsed.success)
    throw new Error('Complete the teacher name, staff ID, subject and joining date.');
  const teacher = parsed.data;
  if (teacher.joinedOn > getSchoolDate()) throw new Error('Joining date cannot be in the future.');
  if (teacher.email && !z.email().safeParse(teacher.email).success)
    throw new Error('Enter a valid email address or leave it blank.');
  if (teacher.phone && !whatsappPhone(teacher.phone))
    throw new Error('Enter a valid mobile number or leave it blank.');
  if (
    state.teachers.some(
      (t) =>
        t.schoolId === state.school.id &&
        t.id !== teacher.id &&
        t.staffId.toLowerCase() === teacher.staffId.toLowerCase(),
    )
  )
    throw new Error('This staff ID is already in use.');
  const ids = new Set(input.sectionIds);
  if (
    ids.size !== input.sectionIds.length ||
    input.sectionIds.some(
      (id) => !state.sections.some((s) => s.schoolId === state.school.id && s.id === id),
    )
  )
    throw new Error('Choose valid class sections.');
  if (teacher.status === 'inactive' && ids.size)
    throw new Error('Inactive teachers cannot hold class-teacher assignments.');
  return {
    ...state,
    teachers: existing
      ? state.teachers.map((t) => (t.id === teacher.id ? teacher : t))
      : [...state.teachers, teacher],
    sections: state.sections.map((s) =>
      s.schoolId !== state.school.id
        ? s
        : ids.has(s.id)
          ? { ...s, teacherId: teacher.id }
          : s.teacherId === teacher.id
            ? { ...s, teacherId: '' }
            : s,
    ),
  };
}
export function deleteTeacher(state: DemoState, teacherId: string): DemoState {
  if (!state.teachers.some((t) => t.id === teacherId && t.schoolId === state.school.id))
    throw new Error('Teacher not found.');
  return {
    ...state,
    teachers: state.teachers.filter((t) => t.id !== teacherId || t.schoolId !== state.school.id),
    sections: state.sections.map((s) =>
      s.schoolId === state.school.id && s.teacherId === teacherId ? { ...s, teacherId: '' } : s,
    ),
  };
}
