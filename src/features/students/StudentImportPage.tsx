import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useSchool } from '../../app/useSchool';
import { EmptyState } from '../../components/ui/Primitives';
import StudentImportDialog from '../settings/StudentImportDialog';

export default function StudentImportPage() {
  const [params] = useSearchParams();
  const state = useSchool(),
    navigate = useNavigate();
  const schoolClass = state.classes.find(
    (item) => item.schoolId === state.school.id && item.id === params.get('classId'),
  );
  const requested = params.get('returnTo');
  const destination =
    requested && /^\/(settings|students)(\?|$)/.test(requested) ? requested : '/students';
  if (!schoolClass)
    return (
      <EmptyState
        title="Choose a class to import students"
        description="Open the class Students tab to download its sample and import all sections together."
        action={
          <Link
            className="button secondary"
            to="/settings?tab=Classes%2C+Sections+%26+Grades&section=students"
          >
            Open class students
          </Link>
        }
      />
    );
  return (
    <StudentImportDialog
      classId={schoolClass.id}
      presentation="page"
      onClose={() => navigate(destination, { replace: true })}
    />
  );
}
