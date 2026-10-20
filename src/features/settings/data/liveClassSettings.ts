import { z } from 'zod';
import { apiService, ApiError } from '../../../services/apiService';
import { onboardingApi, type StructureRow } from '../../../services/onboardingService';
import { productApi } from '../../../services/productService';
import type { SchoolAccess } from '../../../services/schoolAccessService';
import { scoped } from '../../../services/schoolSetupService';
import { orderedClasses } from '../../../lib/schoolLabels';
import type { ClassSettingsSource } from './contracts';
const defaultsSchema = z.object({
  schoolId: z.string(),
  academicYearId: z.string(),
  classId: z.string(),
  names: z.array(z.string()),
});
export function liveClassSource(access: SchoolAccess, yearId: string): ClassSettingsSource {
  const schoolId = access.schoolId;
  const can = (p: string) => access.permissions.includes(p);
  const path = `/schools/${encodeURIComponent(schoolId)}/academic-years/${encodeURIComponent(yearId)}/classes`;
  type Snapshot = Awaited<ReturnType<typeof onboardingApi.structure>>;
  const subjectSnapshots = new Map<string, Snapshot>();
  return {
    async setupClasses(rows) {
      const result = await apiService.request(`${path}/setup`, {
        method: 'POST',
        body: { rows, includeDefaultSubjects: can('subjects.manage') },
      });
      if (!z.object({ saved: z.literal(rows.length) }).safeParse(result).success)
        throw new ApiError(
          0,
          'INVALID_RESPONSE',
          'Reload class settings to confirm the saved setup.',
        );
    },
    async load(signal) {
      const snapshot = await onboardingApi.structure(
        schoolId,
        yearId,
        can('sections.view') ? 'sections' : 'classes',
        signal,
      );
      if (snapshot.truncated)
        throw new Error(
          'The class list exceeds the supported view size. No partial list will be used for editing.',
        );
      const counts = can('students.view') ? await productApi.counts(schoolId, yearId, signal) : [];
      const teachers: { id: string; name: string }[] = [];
      if (can('staff.view')) {
        let after: string | undefined;
        do {
          const page = await onboardingApi.people(schoolId, 'staff', signal, after);
          teachers.push(...page.items.filter((p) => p.teaching && p.status === 'active'));
          after = page.nextCursor ?? undefined;
        } while (after);
      }
      return {
        classes: orderedClasses(snapshot.classes.filter((c) => c.status === 'active')),
        sections: snapshot.children.filter(
          (c) => c.status === 'active' || counts.some((n) => n.sectionId === c.id && n.count > 0),
        ),
        teachers,
        counts,
        countsKnown: can('students.view'),
        writable: snapshot.year.status !== 'closed',
      };
    },
    async save(kind, draft, existing, classId) {
      const row: StructureRow = {
        name: draft.name,
        status: 'active',
        ...(existing ? { id: existing.id, revision: existing.revision } : {}),
      };
      if (kind === 'class') row.grade = draft.grade;
      else {
        row.classId = existing?.classId ?? classId;
        row.teacherId = draft.teacherId || null;
      }
      await onboardingApi.saveStructure(
        schoolId,
        yearId,
        kind === 'class' ? 'classes' : 'sections',
        [row],
        kind === 'class' && !existing && can('subjects.manage'),
      );
    },
    async remove(kind, record) {
      const url =
        kind === 'class'
          ? `${path}/${record.id}`
          : `${path}/${record.classId}/sections/${record.id}`;
      const result = z
        .object({ id: z.literal(record.id) })
        .safeParse(
          await apiService.request(url, { method: 'DELETE', body: { revision: record.revision } }),
        );
      if (!result.success)
        throw new ApiError(
          0,
          'INVALID_RESPONSE',
          'Reload to confirm whether the record was deleted.',
        );
    },
    async subjects(classId, signal) {
      const snapshot = await onboardingApi.structure(schoolId, yearId, 'subjects', signal);
      if (snapshot.truncated)
        throw new Error('The subject list is incomplete. Editing is unavailable.');
      const parent = snapshot.classes.find((c) => c.id === classId);
      if (!parent) throw new Error('Class unavailable.');
      subjectSnapshots.set(classId, snapshot);
      const records = snapshot.children.filter((c) => c.classId === classId);
      if (!records.length && !parent.subjectCatalogVersion) {
        const defaults = defaultsSchema.parse(
          await apiService.request(`${path}/${classId}/subject-defaults`, { signal }),
        );
        scoped(defaults, schoolId, yearId, classId);
        return defaults.names.map((name, i) => ({ id: `default-${i}`, name }));
      }
      return records.map((c) => ({ id: c.id, name: c.name, archived: c.status === 'archived' }));
    },
    async saveSubjects(classId, subjects) {
      if (
        !subjects.length ||
        subjects.length > 30 ||
        subjects.some((s) => !s.name.trim() || s.name.trim().length > 60) ||
        new Set(subjects.map((s) => s.name.trim().toLowerCase())).size !== subjects.length
      )
        throw new Error('Keep 1–30 subjects with different names, up to 60 characters each.');
      const snapshot = subjectSnapshots.get(classId);
      if (!snapshot || snapshot.year.status === 'closed')
        throw new Error('Reload this class before saving subjects.');
      const configured = snapshot.children.filter((c) => c.classId === classId);
      const rows: StructureRow[] = subjects.map((s) => {
        const old = configured.find((c) => c.id === s.id);
        return {
          name: s.name,
          classId,
          status: 'active',
          optional: old?.optional ?? false,
          ...(old ? { id: old.id, revision: old.revision } : {}),
        };
      });
      for (const old of configured.filter(
        (c) => c.status === 'active' && !subjects.some((s) => s.id === c.id),
      ))
        rows.push({
          id: old.id,
          revision: old.revision,
          name: old.name,
          classId,
          status: 'archived',
          optional: old.optional,
        });
      await onboardingApi.saveStructure(schoolId, yearId, 'subjects', rows);
      const saved = await onboardingApi.structure(schoolId, yearId, 'subjects');
      subjectSnapshots.set(classId, saved);
      return saved.children
        .filter((c) => c.classId === classId && c.status === 'active')
        .map((c) => ({ id: c.id, name: c.name }));
    },
  };
}
