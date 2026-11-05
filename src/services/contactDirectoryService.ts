import { z } from 'zod';
import { apiService } from './apiService';
import { titleCase } from '../lib/displayFormat';
const contact = z.object({
  id: z.string(),
  name: z.string().transform(titleCase),
  code: z.string(),
  phone: z.string().default(''),
  detail: z.string().transform(titleCase),
  contactName: z.string().optional(),
  relationship: z.string().optional(),
  attendanceStatus: z.string(),
  profileUrl: z.string(),
  classId: z.string().optional(),
  sectionId: z.string().optional(),
});
const directory = z.object({
  items: z.array(contact),
  counts: z.record(z.string(), z.number()),
  date: z.string(),
  total: z.number(),
  nextOffset: z.number().nullable(),
});
export type ContactRow = z.infer<typeof contact>;
export type ContactDirectory = z.infer<typeof directory>;
export type ContactQuery = {
  kind: string;
  search: string;
  status: string;
  offset: number;
  yearId?: string;
};
export async function readContacts(schoolId: string, query: ContactQuery, signal: AbortSignal) {
  const params = new URLSearchParams(
    Object.entries(query)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => [k, String(v)]),
  );
  return directory.parse(
    await apiService.request(`/schools/${schoolId}/contacts?${params}`, { signal, fresh: true }),
  );
}
