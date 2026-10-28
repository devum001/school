import { z } from 'zod';
import { apiService, ApiError } from './apiService';
import { examinationSchema, examResultSchema } from '../lib/academics';
const id = z.string(),
  tenant = { schoolId: id };
const person = { id, ...tenant, name: z.string(), status: z.enum(['active', 'inactive']) };
const stateSchema = z.object({
  version: z.literal(1),
  school: z.object({
    id,
    name: z.string(),
    timezone: z.string().optional(),
    city: z.string(),
    motto: z.string(),
    code: z.string().optional(),
    board: z.string().optional(),
  }),
  academicYear: z.object({ id, ...tenant, name: z.string(), start: z.string(), end: z.string() }),
  schoolHours: z
    .object({
      start: z.string(),
      end: z.string(),
      days: z.array(
        z.enum(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']),
      ),
    })
    .optional(),
  classes: z.array(
    z.object({
      id,
      ...tenant,
      name: z.string(),
      grade: z.string().optional(),
      studentCount: z.number().optional(),
      subjects: z.array(z.object({ id, name: z.string(), archived: z.boolean() })),
    }),
  ),
  sections: z.array(
    z.object({
      id,
      ...tenant,
      classId: id,
      name: z.string(),
      teacherId: id,
      studentCount: z.number().optional(),
    }),
  ),
  students: z.array(
    z.object({
      ...person,
      admissionNumber: z.string(),
      birthDate: z.string(),
      address: z.string(),
      guardian: z.object({
        name: z.string(),
        relation: z.string(),
        contact: z.string().nullable(),
      }),
    }),
  ),
  teachers: z.array(
    z.object({
      ...person,
      subject: z.string(),
      staffId: id,
      email: z.string(),
      phone: z.string(),
      qualification: z.string(),
      joinedOn: z.string(),
    }),
  ),
  staffMembers: z.array(
    z.object({
      ...person,
      departmentId: z.string(),
      designation: z.string(),
      email: z.string(),
      phone: z.string(),
      joinedOn: z.string(),
      isTeachingStaff: z.boolean(),
      teacherId: id.optional(),
    }),
  ),
  enrollments: z.array(
    z.object({
      id,
      ...tenant,
      academicYearId: id,
      studentId: id,
      classId: id,
      sectionId: id,
      rollNumber: z.union([z.string(), z.number()]),
    }),
  ),
  attendance: z.array(
    z.object({
      ...tenant,
      enrollmentId: id,
      date: z.string(),
      status: z.enum(['present', 'absent', 'late', 'half-day', 'unmarked']),
    }),
  ),
  staffAttendance: z.array(
    z.object({
      ...tenant,
      staffId: id,
      date: z.string(),
      status: z.enum(['present', 'absent', 'late', 'half-day', 'unmarked']),
    }),
  ),
  exams: z.array(
    examinationSchema.extend({ revision: z.number(), canEditDefinition: z.boolean().optional() }),
  ),
  results: z.array(examResultSchema),
  obligations: z.array(z.never()),
  payments: z.array(z.never()),
  notifications: z.array(z.never()),
  activities: z.array(z.never()),
});
export const snapshotSchema = z.object({
  teacherScoped: z.boolean().optional(),
  staffAttendanceSummary: z
    .object({
      onDuty: z.number(),
      late: z.number(),
      invalid: z.number(),
      pendingRequests: z.number(),
    })
    .optional(),
  attendanceGate: z
    .object({ required: z.boolean(), active: z.boolean(), onLeave: z.boolean().optional() })
    .optional(),
  state: stateSchema,
  today: z.string(),
  timezone: z.string(),
  canManage: z.boolean(),
  unavailable: z.array(z.string()),
  attendanceRevisions: z.record(z.string(), z.number()),
  assignments: z.array(z.object({ classId: id, sectionId: id, subjectId: id.optional() })),
});
export type LearningSnapshot = z.infer<typeof snapshotSchema>;
export type LearningArea = 'overview' | 'classes' | 'attendance' | 'academics';
export const learningRoot = (schoolId: string, yearId: string) =>
  `/schools/${encodeURIComponent(schoolId)}/academic-years/${encodeURIComponent(yearId)}/learning`;
export async function loadLearning(
  schoolId: string,
  yearId: string,
  area: LearningArea,
  date?: string,
  signal?: AbortSignal,
) {
  const path = `${learningRoot(schoolId, yearId)}?${new URLSearchParams({ area, ...(date ? { date } : {}) })}`;
  const data = snapshotSchema.safeParse(await apiService.request(path, { signal, fresh: true }));
  if (!data.success) throw new ApiError(0, 'INVALID_RESPONSE', 'Unable to read school records.');
  const value = data.data;
  if (
    value.state.school.id !== schoolId ||
    value.state.academicYear.id !== yearId ||
    [
      ...value.state.classes,
      ...value.state.sections,
      ...value.state.students,
      ...value.state.teachers,
      ...value.state.enrollments,
      ...value.state.exams,
      ...value.state.results,
      ...value.state.attendance,
      ...value.state.staffAttendance,
    ].some((row) => row.schoolId !== schoolId)
  )
    throw new ApiError(0, 'INVALID_RESPONSE', 'Wrong school response.');
  value.state.school.timezone = value.timezone;
  return value;
}
