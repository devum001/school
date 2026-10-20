import { repository } from '../../../lib/repository';
import { roster } from '../../../lib/selectors';
import { orderedClasses } from '../../../lib/schoolLabels';
import { classSubjects } from '../../../lib/classSubjects';
import { schoolProfileSchema } from '../../../lib/settings';
import type { ClassSettingsSource, ProfileSource } from './contracts';
export const demoProfileSource: ProfileSource = {
  validate(school) {
    const parsed = schoolProfileSchema.safeParse(school);
    return parsed.success
      ? {}
      : Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message]));
  },
  save(school, hours) {
    repository.saveSchoolDetails(schoolProfileSchema.parse(school), hours);
  },
};
export const demoClassSource: ClassSettingsSource = {
  subscribe: repository.subscribe,
  async setupClasses(rows) {
    repository.setupClasses(rows);
  },
  async load() {
    const state = repository.getSnapshot();
    return {
      classes: orderedClasses(state.classes.filter((c) => c.schoolId === state.school.id)),
      sections: state.sections.filter((s) => s.schoolId === state.school.id),
      teachers: state.teachers.filter((t) => t.schoolId === state.school.id),
      counts: roster(state, true).map((r) => ({
        classId: r.enrollment.classId,
        sectionId: r.enrollment.sectionId,
        count: 1,
      })),
      writable: true,
    };
  },
  async save(kind, draft, existing, classId) {
    if (kind === 'class')
      repository.saveSchoolClass({ name: draft.name, grade: draft.grade }, existing?.id);
    else
      repository.saveSchoolSection(
        {
          name: draft.name,
          teacherId: draft.teacherId,
          classId: existing?.classId ?? classId ?? '',
        },
        existing?.id,
      );
  },
  async remove(kind, record) {
    if (kind === 'class') repository.deleteSchoolClass(record.id);
    else repository.deleteSchoolSection(record.id);
  },
  async subjects(classId) {
    return classSubjects(repository.getSnapshot(), classId);
  },
  async saveSubjects(classId, subjects) {
    repository.saveClassSubjects(classId, subjects);
    return classSubjects(repository.getSnapshot(), classId).filter((s) => !s.archived);
  },
};
