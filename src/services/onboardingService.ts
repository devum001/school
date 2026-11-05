import { titleCase } from '../lib/displayFormat';
import { z } from 'zod';
import { apiService, ApiError } from './apiService';
import { yearSchema, classSchema, childSchema, scoped } from './schoolSetupService';
const id = z.string().regex(/^[a-f\d]{24}$/i);
export type RosterKind = 'staff' | 'students';
export type StructureKind = 'classes' | 'sections' | 'subjects';
export type StructureRow = {
  id?: string;
  revision?: number;
  classId?: string;
  name: string;
  grade?: string;
  status: 'active' | 'archived';
  optional?: boolean;
  teacherId?: string | null;
};
const catalogSchema = z.object({
  version: z.string(),
  title: z.string(),
  description: z.string(),
  grades: z.array(z.object({ code: z.string(), name: z.string(), subjects: z.array(z.string()) })),
  seniorOptions: z.array(z.string()),
});
export type SchoolCatalog = z.infer<typeof catalogSchema>;
export const personSchema = z.object({
  id,
  schoolId: id,
  code: z.string(),
  name: z.string().transform(titleCase),
  status: z.enum(['active', 'inactive', 'archived']),
  revision: z.number(),
  attendanceStatus: z.string().optional(),
  teaching: z.boolean().optional(),
  userId: id.optional(),
  department: z.string().transform(titleCase).optional(),
  designation: z.string().transform(titleCase).optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  joinedOn: z.string().optional(),
  qualification: z.string().transform(titleCase).optional(),
  photoDataUrl: z.string().optional(),
  birthDate: z.string().optional(),
  guardianName: z.string().transform(titleCase).optional(),
  guardianRelation: z.string().transform(titleCase).optional(),
  guardianPhone: z.string().optional(),
  address: z.string().transform(titleCase).optional(),
});
export type Person = z.infer<typeof personSchema>;
const summarySchema = z.object({
  id,
  schoolId: id,
  academicYearId: id,
  kind: z.enum(['staff', 'students']),
  mode: z.enum(['create', 'update']),
  status: z.enum([
    'validating',
    'draft',
    'queued',
    'processing',
    'completed',
    'paused',
    'cancelled',
  ]),
  revision: z.number(),
  total: z.number(),
  checked: z.number(),
  processed: z.number(),
  invalid: z.number(),
  counts: z.object({
    created: z.number(),
    updated: z.number(),
    skipped: z.number(),
    failed: z.number(),
    pending: z.number(),
  }),
  message: z.string(),
  createdAt: z.string(),
});
export type ImportSummary = z.infer<typeof summarySchema>;
const detailSchema = summarySchema.extend({
  columns: z.array(z.string()),
  offset: z.number(),
  nextOffset: z.number().nullable(),
  rows: z.array(
    z.object({
      number: z.number(),
      cells: z.array(z.string()),
      errors: z.array(z.string()),
      outcome: z.enum(['pending', 'created', 'updated', 'skipped', 'failed']),
      existing: z.boolean(),
    }),
  ),
});
export type ImportDetail = z.infer<typeof detailSchema>;
const relationSchema = z.object({
  classId: z.string().optional(),
  sectionId: z.string().optional(),
  subjectId: z.string().optional(),
  id,
  schoolId: id,
  academicYearId: id,
  personId: id,
  name: z.string().transform(titleCase),
  code: z.string(),
  className: z.string(),
  sectionName: z.string(),
  subjectName: z.string(),
  rollNumber: z.union([z.number(), z.string()]).nullable(),
  status: z.enum(['active', 'archived', 'withdrawn']),
  revision: z.number(),
});
export type Relation = z.infer<typeof relationSchema>;
export type RelationKind = 'enrollments' | 'teaching-assignments';
const root = (schoolId: string) => `/schools/${encodeURIComponent(schoolId)}`;
function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success)
    throw new ApiError(
      0,
      'INVALID_RESPONSE',
      'The onboarding response could not be read. Reload and retry.',
    );
  return result.data;
}
export const onboardingApi = {
  assignBatch(
    schoolId: string,
    yearId: string,
    items: {
      staffId: string;
      classId: string;
      sectionId: string;
      subjectId: string;
      replaceId?: string;
      revision?: number;
    }[],
  ) {
    return apiService.request(
      `${root(schoolId)}/academic-years/${yearId}/teaching-assignments-batch`,
      { method: 'POST', body: { items } },
    );
  },
  async staffDirectory(
    schoolId: string,
    signal: AbortSignal,
    after: string | undefined,
    search: string,
    teaching: boolean,
    status: string,
  ) {
    const query = new URLSearchParams({
      kind: teaching ? 'teachers' : 'all-staff',
      search,
      status,
      offset: after || '0',
    });
    const data = parse(
      z.object({ items: z.array(personSchema), nextOffset: z.number().nullable() }),
      await apiService.request(`${root(schoolId)}/staff-directory?${query}`, {
        signal,
        fresh: true,
      }),
    );
    data.items.forEach((item) => scoped(item, schoolId));
    return {
      items: data.items,
      nextCursor: data.nextOffset == null ? null : String(data.nextOffset),
    };
  },
  async relations(
    schoolId: string,
    yearId: string,
    kind: RelationKind,
    signal?: AbortSignal,
    after?: string,
    filters: Record<string, string> = {},
  ) {
    const data = parse(
      z.object({ items: z.array(relationSchema), nextCursor: id.nullable(), year: yearSchema }),
      await apiService.request(
        `${root(schoolId)}/academic-years/${yearId}/${kind}?${new URLSearchParams({ ...filters, ...(after ? { after } : {}) })}`,
        { signal },
      ),
    );
    scoped(data.year, schoolId);
    data.items.forEach((item) => scoped(item, schoolId, yearId));
    return data;
  },
  async endRelation(
    schoolId: string,
    yearId: string,
    kind: RelationKind,
    record: Pick<Relation, 'id' | 'revision'>,
  ) {
    return apiService.request(
      `${root(schoolId)}/academic-years/${yearId}/${kind}/${record.id}/end`,
      { method: 'POST', body: { revision: record.revision } },
    );
  },
  async assign(
    schoolId: string,
    yearId: string,
    input: { staffId: string; classId: string; sectionId: string; subjectId: string },
  ) {
    return apiService.request(`${root(schoolId)}/academic-years/${yearId}/teaching-assignments`, {
      method: 'POST',
      body: input,
    });
  },

  async catalog(schoolId: string, signal?: AbortSignal) {
    return parse(
      catalogSchema,
      await apiService.request(`${root(schoolId)}/setup/catalog`, { signal }),
    );
  },
  async structure(schoolId: string, yearId: string, kind: StructureKind, signal?: AbortSignal) {
    const result = parse(
      z.object({
        year: yearSchema,
        classes: z.array(classSchema),
        children: z.array(childSchema),
        truncated: z.boolean(),
      }),
      await apiService.request(
        `${root(schoolId)}/academic-years/${yearId}/structure?kind=${kind}`,
        { signal },
      ),
    );
    scoped(result.year, schoolId);
    if (result.year.id !== yearId)
      throw new ApiError(0, 'INVALID_RESPONSE', 'Academic year response does not match.');
    result.classes.forEach((item) => scoped(item, schoolId, yearId));
    result.children.forEach((item) => scoped(item, schoolId, yearId));
    return result;
  },
  async saveStructure(
    schoolId: string,
    yearId: string,
    kind: StructureKind,
    rows: StructureRow[],
    includeDefaultSubjects = false,
  ) {
    return parse(
      z.object({ saved: z.number() }),
      await apiService.request(`${root(schoolId)}/academic-years/${yearId}/structure-batch`, {
        method: 'POST',
        body: { kind, rows, includeDefaultSubjects },
      }),
    );
  },
  async people(
    schoolId: string,
    kind: RosterKind,
    signal?: AbortSignal,
    after?: string,
    search = '',
    teaching = false,
  ) {
    const query = new URLSearchParams();
    if (after) query.set('after', after);
    if (search) query.set('search', search);
    if (teaching) query.set('teaching', 'true');
    const data = parse(
      z.object({ items: z.array(personSchema), nextCursor: id.nullable() }),
      await apiService.request(`${root(schoolId)}/people/${kind}?${query}`, { signal }),
    );
    data.items.forEach((item) => scoped(item, schoolId));
    return data;
  },
  async changeStatus(
    schoolId: string,
    kind: RosterKind,
    person: Person,
    targetStatus?: 'active' | 'inactive' | 'archived',
  ) {
    return scoped(
      parse(
        personSchema,
        await apiService.request(`${root(schoolId)}/people/${kind}/${person.id}`, {
          method: 'PATCH',
          body: {
            revision: person.revision,
            status: targetStatus ?? (person.status === 'active' ? 'archived' : 'active'),
          },
        }),
      ),
      schoolId,
    );
  },
  async jobs(schoolId: string, kind: RosterKind, signal?: AbortSignal, after?: string) {
    const data = parse(
      z.object({ items: z.array(summarySchema), nextCursor: id.nullable() }),
      await apiService.request(
        `${root(schoolId)}/imports?kind=${kind}${after ? `&after=${after}` : ''}`,
        { signal },
      ),
    );
    data.items.forEach((item) => scoped(item, schoolId));
    return data;
  },
  async job(schoolId: string, jobId: string, offset = 0, signal?: AbortSignal) {
    const data = scoped(
      parse(
        detailSchema,
        await apiService.request(`${root(schoolId)}/imports/${jobId}?offset=${offset}`, {
          signal,
          fresh: true,
        }),
      ),
      schoolId,
    );
    if (data.id !== jobId)
      throw new ApiError(0, 'INVALID_RESPONSE', 'Import response does not match.');
    return data;
  },
  async preview(
    schoolId: string,
    yearId: string,
    kind: RosterKind,
    mode: 'create' | 'update',
    grid: string[][],
    template?: { format: 'demo-students-v1' | 'school-students-v2'; classId?: string },
  ) {
    return scoped(
      parse(
        summarySchema,
        await apiService.request(`${root(schoolId)}/imports`, {
          method: 'POST',
          body: { academicYearId: yearId, kind, mode, grid, ...template },
        }),
      ),
      schoolId,
    );
  },
  async correct(schoolId: string, job: ImportDetail, number: number, cells: string[]) {
    return parse(
      summarySchema,
      await apiService.request(`${root(schoolId)}/imports/${job.id}/rows`, {
        method: 'PATCH',
        body: { revision: job.revision, number, cells },
      }),
    );
  },
  async action(schoolId: string, job: ImportDetail, action: 'confirm' | 'cancel' | 'retry') {
    return parse(
      summarySchema,
      await apiService.request(`${root(schoolId)}/imports/${job.id}/${action}`, {
        method: 'POST',
        body: { revision: job.revision },
      }),
    );
  },
  async results(schoolId: string, jobId: string) {
    return parse(
      z.object({ csv: z.string() }),
      await apiService.request(`${root(schoolId)}/imports/${jobId}/results`, { fresh: true }),
    );
  },
};
