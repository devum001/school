import { useNavigate, useSearchParams } from 'react-router-dom';
import StudentDialog from './StudentDialog';

export default function StudentCreatePage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const requested = params.get('returnTo');
  const destination =
    requested && /^\/(settings|students)(\?|$)/.test(requested) ? requested : '/students';
  return (
    <StudentDialog
      presentation="page"
      initialClassId={params.get('classId') || undefined}
      initialSectionId={params.get('sectionId') || undefined}
      onClose={() => navigate(destination, { replace: true })}
    />
  );
}
