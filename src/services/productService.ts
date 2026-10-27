import { orderedClasses } from '../lib/schoolLabels';
import { z } from 'zod';
import { apiService, ApiError } from './apiService';
import { scoped, yearSchema, classSchema, childSchema } from './schoolSetupService';
import { personSchema, type Person } from './onboardingService';
const id = z.string().regex(/^[a-f\d]{24}$/i);
export const studentRow = z.object({
  id,
  schoolId: id,
  academicYearId: id,
  classId: id,
  sectionId: id.or(z.literal('')),
  className: z.string(),
  sectionName: z.string(),
  rollNumber: z.union([z.number(), z.string()]).nullable(),
  status: z.enum(['active', 'withdrawn']),
  revision: z.number(),
  student: personSchema,
});
export type StudentRow = z.infer<typeof studentRow>;
function read<T>(schema: z.ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success)
    throw new ApiError(0, 'INVALID_RESPONSE', 'The school response could not be read.');
  return result.data;
}
const root = (schoolId: string) => `/schools/${encodeURIComponent(schoolId)}`;
export const productApi = {
  async studentContext(schoolId: string, yearId: string, signal: AbortSignal) {
    const data = read(
      z.object({
        year: yearSchema,
        classes: z.array(classSchema),
        children: z.array(childSchema),
        truncated: z.boolean(),
      }),
      await apiService.request(`${root(schoolId)}/academic-years/${yearId}/student-context`, {
        signal,
      }),
    );
    scoped(data.year, schoolId);
    if (data.year.id !== yearId) throw new ApiError(0, 'INVALID_RESPONSE', 'Wrong academic year.');
    data.classes = orderedClasses(data.classes);
    data.classes.forEach((c) => scoped(c, schoolId, yearId));
    data.children.forEach((c) => scoped(c, schoolId, yearId));
    return data;
  },
  async students(
    schoolId: string,
    yearId: string,
    signal: AbortSignal,
    filters: {
      after?: string;
      classId?: string;
      sectionId?: string;
      search?: string;
      studentId?: string;
    } = {},
  ) {
    const query = new URLSearchParams(
      Object.entries(filters).filter(([, v]) => !!v) as [string, string][],
    );
    const result = read(
      z.object({ items: z.array(studentRow), nextCursor: id.nullable(), total: z.number() }),
      await apiService.request(
        `${root(schoolId)}/academic-years/${yearId}/student-roster?${query}`,
        { signal },
      ),
    );
    result.items.forEach((row) => {
      scoped(row, schoolId, yearId);
      scoped(row.student, schoolId);
    });
    return result;
  },
  async counts(schoolId: string, yearId: string, signal: AbortSignal) {
    return read(
      z.array(z.object({ classId: id, sectionId: id.or(z.literal('')), count: z.number() })),
      await apiService.request(`${root(schoolId)}/academic-years/${yearId}/student-counts`, {
        signal,
      }),
    );
  },
  async saveStudent(
    schoolId: string,
    yearId: string,
    classId: string,
    cells: string[],
    existing?: Person,
    options: { status?: 'active' | 'inactive'; enrollmentRevision?: number } = {},
  ) {
    return scoped(
      read(
        personSchema,
        await apiService.request(
          `${root(schoolId)}/academic-years/${yearId}/students${existing ? `/${existing.id}` : ''}`,
          {
            method: existing ? 'PATCH' : 'POST',
            body: {
              classId,
              cells,
              ...options,
              ...(existing ? { revision: existing.revision } : {}),
            },
          },
        ),
      ),
      schoolId,
    );
  },
  async deleteStudent(schoolId: string, yearId: string, student: Person) {
    return apiService.request(`${root(schoolId)}/academic-years/${yearId}/students/${student.id}`, {
      method: 'DELETE',
      body: { revision: student.revision },
    });
  },
  async saveStaff(schoolId: string, cells: string[], existing?: Person, photoDataUrl?: string) {
    return scoped(
      read(
        personSchema,
        await apiService.request(
          `${root(schoolId)}/people/staff${existing ? `/${existing.id}/details` : ''}`,
          {
            method: existing ? 'PATCH' : 'POST',
            body: { cells, photoDataUrl, ...(existing ? { revision: existing.revision } : {}) },
          },
        ),
      ),
      schoolId,
    );
  },
  async defaults(schoolId: string, yearId: string, classId: string) {
    return read(
      z.object({ created: z.number(), version: z.string() }),
      await apiService.request(
        `${root(schoolId)}/academic-years/${yearId}/classes/${classId}/subject-defaults`,
        { method: 'POST' },
      ),
    );
  },
};
