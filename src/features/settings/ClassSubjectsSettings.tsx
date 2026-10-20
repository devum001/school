import { useSchool } from '../../app/useSchool';
import { classSubjects } from '../../lib/classSubjects';
import { repository } from '../../lib/repository';
import SubjectEditor from './SubjectEditor';
export default function ClassSubjectsSettings({
  classId,
  onDirtyChange,
}: {
  classId: string;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const state = useSchool();
  return (
    <SubjectEditor
      name={state.classes.find((c) => c.id === classId)?.name ?? ''}
      configured={classSubjects(state, classId)}
      onDirtyChange={onDirtyChange}
      save={(subjects) => {
        repository.saveClassSubjects(classId, subjects);
        return classSubjects(repository.getSnapshot(), classId).filter((s) => !s.archived);
      }}
    />
  );
}
