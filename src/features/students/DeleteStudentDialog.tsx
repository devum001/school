import { useSchool } from '../../app/useSchool';
import { useFeedback } from '../../app/useFeedback';
import DeleteDialog from '../../components/shared/DeleteDialog';
import { studentRecordCounts } from '../../lib/management';
import { repository } from '../../lib/repository';
export default function DeleteStudentDialog({
  studentId,
  onClose,
  onDeleted,
}: {
  studentId: string;
  onClose: () => void;
  onDeleted?: () => void;
}) {
  const state = useSchool();
  const notify = useFeedback();
  const student = state.students.find((s) => s.id === studentId);
  if (!student) return null;
  const counts = studentRecordCounts(state, studentId);
  return (
    <DeleteDialog
      title={`Delete ${student.name}?`}
      description="This permanently removes the student, their enrollment and all linked attendance, results, fees, payments and notifications."
      detail={`${counts.attendance} attendance records · ${counts.results} test results · ${counts.obligations} fee obligations · ${counts.payments} payments · ${counts.notifications} notifications. To retain this history, cancel and change their status to Inactive instead.`}
      onClose={onClose}
      onDelete={() => {
        repository.deleteStudent(studentId);
        notify('Student and linked records deleted.');
        onDeleted?.();
      }}
    />
  );
}
