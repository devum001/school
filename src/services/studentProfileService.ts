import { z } from 'zod';
import { snapshotSchema } from './learningService';
import { studentRow } from './productService';
import { apiService, ApiError } from './apiService';
import type { StoredDocument } from '../types/ledger';
const id = z.string().regex(/^[a-f\d]{24}$/i);
const schema = z.object({
  schoolId: id,
  yearId: id,
  row: studentRow,
  snapshot: snapshotSchema,
  capabilities: z.object({
    attendance: z.boolean(),
    academics: z.boolean(),
    fees: z.boolean(),
    manage: z.boolean(),
    manageMarks: z.boolean(),
  }),
  feeSummary: z
    .object({
      outstanding: z.number(),
      paid: z.number(),
      paymentCount: z.number(),
      configured: z.boolean(),
      transportActive: z.boolean().optional(),
      transportRoute: z.string().optional(),
      hostelActive: z.boolean().optional(),
      hostelRoom: z.string().optional(),
    })
    .nullable(),
  facilities: z
    .object({
      bus: z.boolean(),
      busRoute: z.string().optional(),
      hostel: z.boolean(),
      hostelRoom: z.string().optional(),
    })
    .optional(),
});
export type StudentProfile = z.infer<typeof schema>;
const documentsSchema = z.object({
  schoolId: id,
  items: z.array(
    z.object({
      id,
      schoolId: id,
      ownerId: id,
      ownerKind: z.literal('student'),
      category: z.string(),
      fileName: z.string(),
      mimeType: z.enum(['application/pdf', 'image/png', 'image/jpeg', 'image/webp']),
      size: z.number(),
      uploadedAt: z.string(),
      uploadedBy: z.string(),
      dataUrl: z.string().default(''),
    }),
  ),
});
export async function loadStudentProfile(
  schoolId: string,
  yearId: string,
  studentId: string,
  signal?: AbortSignal,
) {
  const data = schema.parse(
    await apiService.request(
      `/schools/${schoolId}/academic-years/${yearId}/students/${studentId}/profile`,
      { signal },
    ),
  );
  const state = data.snapshot.state;
  if (
    data.schoolId !== schoolId ||
    data.yearId !== yearId ||
    data.row.student.id !== studentId ||
    data.row.schoolId !== schoolId ||
    state.school.id !== schoolId ||
    state.academicYear.id !== yearId ||
    state.students.some((s) => s.id !== studentId || s.schoolId !== schoolId) ||
    [
      ...state.classes,
      ...state.sections,
      ...state.enrollments,
      ...state.attendance,
      ...state.exams,
      ...state.results,
    ].some((s) => s.schoolId !== schoolId)
  )
    throw new ApiError(0, 'INVALID_RESPONSE', 'Unable to verify student profile.');
  return data;
}
const root = (school: string, student: string) =>
  `/schools/${school}/students/${student}/documents`;
export const studentDocumentApi = {
  async list(school: string, student: string, signal?: AbortSignal, documentId = '') {
    const result = documentsSchema.parse(
      await apiService.request(`${root(school, student)}${documentId ? '/' + documentId : ''}`, {
        signal,
      }),
    );
    if (
      result.schoolId !== school ||
      result.items.some((d) => d.schoolId !== school || d.ownerId !== student)
    )
      throw new ApiError(0, 'INVALID_RESPONSE', 'Unable to verify documents.');
    return result.items;
  },
  save: (
    school: string,
    student: string,
    input: Pick<StoredDocument, 'category' | 'fileName' | 'mimeType' | 'size' | 'dataUrl'>,
  ) =>
    apiService.request(root(school, student), {
      method: 'POST',
      body: {
        category: input.category,
        fileName: input.fileName,
        mimeType: input.mimeType,
        size: input.size,
        dataUrl: input.dataUrl,
      },
    }),
  remove: (school: string, student: string, id: string) =>
    apiService.request(`${root(school, student)}/${id}`, { method: 'DELETE' }),
};
