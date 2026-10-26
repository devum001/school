import { z } from 'zod';
import { apiService, ApiError } from './apiService';
const id = z.string().regex(/^[a-f\d]{24}$/i);
export const yearSchema = z.object({
  id,
  schoolId: id,
  name: z.string(),
  start: z.string(),
  end: z.string(),
  status: z.enum(['draft', 'active', 'closed']),
  revision: z.number().int().nonnegative(),
});
export const classSchema = z.object({
  id,
  schoolId: id,
  academicYearId: id,
  name: z.string(),
  grade: z.string(),
  subjectCatalogVersion: z.string().nullable().optional(),
  status: z.enum(['active', 'archived']),
  revision: z.number().int().nonnegative(),
});
export const childSchema = classSchema
  .omit({ grade: true })
  .extend({ classId: id, optional: z.boolean().optional(), teacherId: id.nullable().optional() });
const statusSchema = z.object({
  selfLinked: z.boolean().optional(),
  schoolId: id,
  ready: z.boolean(),
  currentAcademicYearId: id.nullable(),
  academicRevision: z.number().int().nonnegative(),
  counts: z.object({
    classes: z.number(),
    sections: z.number().optional(),
    subjects: z.number().optional(),
    staff: z.number().optional(),
    teachers: z.number().optional(),
    students: z.number().optional(),
    enrollments: z.number().optional(),
    assignments: z.number().optional(),
    withoutSections: z.number(),
    withoutSubjects: z.number(),
  }),
  steps: z.array(
    z.object({
      key: z.enum([
        'profile',
        'years',
        'structure',
        'sections',
        'subjects',
        'staff',
        'students',
        'branding',
      ]),
      label: z.string(),
      required: z.boolean(),
      status: z.enum(['complete', 'incomplete', 'attention', 'optional']),
      detail: z.string(),
      permission: z.string(),
    }),
  ),
});
export type AcademicYear = z.infer<typeof yearSchema>;
export type AcademicClass = z.infer<typeof classSchema>;
export type AcademicChild = z.infer<typeof childSchema>;
export type SetupStatus = z.infer<typeof statusSchema>;
export type Page<T> = { items: T[]; nextCursor: string | null; total?: number };
export type ChildKind = 'sections' | 'subjects';
export type YearInput = Pick<AcademicYear, 'name' | 'start' | 'end'>;
const root = (schoolId: string) => `/schools/${encodeURIComponent(schoolId)}`;
const years = (schoolId: string) => `${root(schoolId)}/academic-years`;
const classes = (schoolId: string, yearId: string) =>
  `${years(schoolId)}/${encodeURIComponent(yearId)}/classes`;
const children = (schoolId: string, yearId: string, classId: string, kind: ChildKind) =>
  `${classes(schoolId, yearId)}/${encodeURIComponent(classId)}/${kind}`;
function parse<T>(schema: z.ZodType<T>, raw: unknown): T {
  const result = schema.safeParse(raw);
  if (!result.success)
    throw new ApiError(
      0,
      'INVALID_RESPONSE',
      'The setup response could not be read. Reload and try again.',
    );
  return result.data;
}
export function scoped<T extends { schoolId: string; academicYearId?: string; classId?: string }>(
  record: T,
  schoolId: string,
  yearId?: string,
  classId?: string,
): T {
  if (
    record.schoolId !== schoolId ||
    (yearId && record.academicYearId !== yearId) ||
    (classId && record.classId !== classId)
  )
    throw new ApiError(
      0,
      'INVALID_RESPONSE',
      'The setup response does not belong to this workspace.',
    );
  return record;
}
async function list<T extends { schoolId: string; academicYearId?: string; classId?: string }>(
  path: string,
  schema: z.ZodType<T>,
  schoolId: string,
  yearId?: string,
  classId?: string,
  signal?: AbortSignal,
  after?: string,
) {
  const result = parse(
    z.object({ items: z.array(schema), nextCursor: id.nullable() }),
    await apiService.request(`${path}${after ? `?after=${encodeURIComponent(after)}` : ''}`, {
      signal,
    }),
  );
  result.items.forEach((item) => scoped(item, schoolId, yearId, classId));
  return result;
}
export const setupApi = {
  async year(schoolId: string, yearId: string, signal?: AbortSignal) {
    return scoped(
      parse(
        yearSchema,
        await apiService.request(`${years(schoolId)}/${encodeURIComponent(yearId)}`, { signal }),
      ),
      schoolId,
    );
  },
  async status(schoolId: string, signal?: AbortSignal) {
    return scoped(
      parse(
        statusSchema,
        await apiService.request(`${root(schoolId)}/onboarding`, { signal, fresh: true }),
      ),
      schoolId,
    );
  },
  years: (schoolId: string, signal?: AbortSignal, after?: string) =>
    list(years(schoolId), yearSchema, schoolId, undefined, undefined, signal, after),
  async saveYear(schoolId: string, input: YearInput, year?: AcademicYear) {
    return scoped(
      parse(
        yearSchema,
        await apiService.request(`${years(schoolId)}${year ? `/${year.id}` : ''}`, {
          method: year ? 'PATCH' : 'POST',
          body: { ...input, ...(year ? { revision: year.revision } : {}) },
        }),
      ),
      schoolId,
    );
  },
  async selectYear(schoolId: string, yearId: string, revision: number) {
    return parse(
      z.object({ currentAcademicYearId: z.literal(yearId), academicRevision: z.number() }),
      await apiService.request(`${years(schoolId)}/${yearId}/select`, {
        method: 'POST',
        body: { revision },
      }),
    );
  },
  async closeYear(schoolId: string, year: AcademicYear) {
    return scoped(
      parse(
        yearSchema,
        await apiService.request(`${years(schoolId)}/${year.id}/close`, {
          method: 'POST',
          body: { revision: year.revision },
        }),
      ),
      schoolId,
    );
  },
  classes: (schoolId: string, yearId: string, signal?: AbortSignal, after?: string) =>
    list(classes(schoolId, yearId), classSchema, schoolId, yearId, undefined, signal, after),
  async saveClass(
    schoolId: string,
    yearId: string,
    input: { name: string; grade: string; status?: 'active' | 'archived' },
    record?: AcademicClass,
  ) {
    return scoped(
      parse(
        classSchema,
        await apiService.request(`${classes(schoolId, yearId)}${record ? `/${record.id}` : ''}`, {
          method: record ? 'PATCH' : 'POST',
          body: {
            ...input,
            ...(record ? { revision: record.revision, status: input.status ?? record.status } : {}),
          },
        }),
      ),
      schoolId,
      yearId,
    );
  },
  children: (
    kind: ChildKind,
    schoolId: string,
    yearId: string,
    classId: string,
    signal?: AbortSignal,
    after?: string,
  ) =>
    list(
      children(schoolId, yearId, classId, kind),
      childSchema,
      schoolId,
      yearId,
      classId,
      signal,
      after,
    ),
  async saveChild(
    kind: ChildKind,
    schoolId: string,
    yearId: string,
    classId: string,
    input: { name: string; status?: 'active' | 'archived' },
    record?: AcademicChild,
  ) {
    return scoped(
      parse(
        childSchema,
        await apiService.request(
          `${children(schoolId, yearId, classId, kind)}${record ? `/${record.id}` : ''}`,
          {
            method: record ? 'PATCH' : 'POST',
            body: {
              ...input,
              ...(record
                ? { revision: record.revision, status: input.status ?? record.status }
                : {}),
            },
          },
        ),
      ),
      schoolId,
      yearId,
      classId,
    );
  },
};
export function yearValidation(input: YearInput) {
  const valid = (date: string) =>
    /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    Number.isFinite(Date.parse(date)) &&
    new Date(date).toISOString().slice(0, 10) === date;
  return {
    name: input.name.trim() ? '' : 'Enter a year name.',
    start: valid(input.start) ? '' : 'Enter a valid start date.',
    end: !valid(input.end)
      ? 'Enter a valid end date.'
      : input.end <= input.start
        ? 'End date must be after the start date.'
        : '',
  };
}
