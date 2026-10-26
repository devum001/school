import { z } from 'zod';
import { apiService, ApiError } from './apiService';
const id = z.string().regex(/^[a-f\d]{24}$/i);
const row = z.object({
  id,
  schoolId: id,
  jobId: id,
  studentId: id,
  classId: id,
  sectionId: z.string(),
  name: z.string(),
  code: z.string(),
  configured: z.boolean(),
  revision: z.number(),
  baseFee: z.number(),
  concession: z.number(),
  scholarship: z.number(),
  openingPaid: z.number(),
  oldDues: z.number(),
  existingOldDues: z.number(),
  count: z.number(),
  interval: z.number(),
  dueDate: z.string(),
  reason: z.string(),
  outcome: z.string(),
  error: z.string(),
});
const job = z.object({
  id,
  schoolId: id,
  academicYearId: id,
  status: z.enum([
    'preparing',
    'draft',
    'validating',
    'ready',
    'processing',
    'completed',
    'paused',
    'cancelled',
  ]),
  phase: z.string(),
  revision: z.number(),
  active: z.boolean(),
  checked: z.number(),
  message: z.string(),
  sheetErrors: z.array(z.string()),
  dueDate: z.string(),
  asOf: z.string(),
  oldStart: z.string(),
  oldEnd: z.string(),
  oldName: z.string(),
});
const summary = z.object({
  schoolId: id,
  job,
  totals: z.object({
    total: z.number(),
    skipped: z.number(),
    saved: z.number(),
    errors: z.number(),
    needsSetup: z.number(),
    net: z.number(),
    alreadyPaid: z.number(),
    oldDues: z.number(),
  }),
});
const pageSchema = z.object({
  schoolId: id,
  jobId: id,
  revision: z.number(),
  page: z.number(),
  pageSize: z.number(),
  total: z.number(),
  items: z.array(row),
});
export type FeeDraftRow = z.infer<typeof row>;
export type FeeDraftSummary = z.infer<typeof summary>;
export type FeeDraftPage = z.infer<typeof pageSchema>;
export type FeeDraftValues = Partial<
  Pick<
    FeeDraftRow,
    | 'baseFee'
    | 'concession'
    | 'scholarship'
    | 'openingPaid'
    | 'oldDues'
    | 'count'
    | 'interval'
    | 'dueDate'
    | 'reason'
  >
>;
export type FeeDraftFilters = {
  classId: string;
  sectionId: string;
  search: string;
  filter: string;
  page: number;
};
const root = (school: string) => `/schools/${school}/fees/onboarding`;
function checked<T extends { schoolId: string }>(
  schema: z.ZodType<T>,
  value: unknown,
  school: string,
): T {
  const data = schema.parse(value);
  if (data.schoolId !== school)
    throw new ApiError(0, 'INVALID_RESPONSE', 'Unable to verify this fee draft.');
  return data;
}
export const feeOnboardingApi = {
  async list(school: string, yearId: string) {
    return checked(
      z.object({
        schoolId: id,
        items: z.array(
          z.object({ id, status: z.string(), revision: z.number(), active: z.boolean() }),
        ),
      }),
      await apiService.request(`${root(school)}?yearId=${yearId}`, { fresh: true }),
      school,
    ).items;
  },
  create: (school: string, yearId: string) =>
    apiService.request<{ id: string }>(root(school), { method: 'POST', body: { yearId } }),
  async summary(school: string, draft: string, signal?: AbortSignal) {
    const result = checked(
      summary,
      await apiService.request(`${root(school)}/${draft}`, { fresh: true, signal }),
      school,
    );
    if (result.job.id !== draft || result.job.schoolId !== school)
      throw new ApiError(0, 'INVALID_RESPONSE', 'Unable to verify this fee draft.');
    return result;
  },
  async rows(
    school: string,
    draft: string,
    filters: Partial<FeeDraftFilters> & { export?: boolean },
    signal?: AbortSignal,
  ) {
    const query = new URLSearchParams(Object.entries(filters).map(([k, v]) => [k, String(v)]));
    const result = checked(
      pageSchema,
      await apiService.request(`${root(school)}/${draft}/rows?${query}`, { fresh: true, signal }),
      school,
    );
    if (
      result.jobId !== draft ||
      result.items.some((r) => r.schoolId !== school || r.jobId !== draft)
    )
      throw new ApiError(0, 'INVALID_RESPONSE', 'Unable to verify draft students.');
    return result;
  },
  change: (school: string, draft: string, action: string, body: object) =>
    apiService.request<{ revision: number; errors?: string[]; applied?: number }>(
      `${root(school)}/${draft}/${action}`,
      { method: 'POST', body },
    ),
};
