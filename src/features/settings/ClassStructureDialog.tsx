import { useSchool } from '../../app/useSchool';
import { repository } from '../../lib/repository';
import ClassStructureForm from './ClassStructureForm';
export default function ClassStructureDialog({
  kind,
  id,
  classId,
  onClose,
}: {
  kind: 'class' | 'section';
  id?: string;
  classId?: string;
  onClose: () => void;
}) {
  const state = useSchool();
  const schoolClass = state.classes.find((c) => c.id === id),
    section = state.sections.find((s) => s.id === id);
  return (
    <ClassStructureForm
      kind={kind}
      id={id}
      onClose={onClose}
      initial={{
        name: (kind === 'class' ? schoolClass : section)?.name ?? '',
        grade: schoolClass?.grade ?? '',
        teacherId: section?.teacherId ?? '',
      }}
      teachers={state.teachers.filter(
        (t) =>
          t.schoolId === state.school.id && (t.status === 'active' || t.id === section?.teacherId),
      )}
      save={(draft) => {
        if (kind === 'class')
          repository.saveSchoolClass({ name: draft.name, grade: draft.grade }, id);
        else
          repository.saveSchoolSection(
            {
              name: draft.name,
              teacherId: draft.teacherId,
              classId: section?.classId ?? classId ?? '',
            },
            id,
          );
      }}
    />
  );
}
