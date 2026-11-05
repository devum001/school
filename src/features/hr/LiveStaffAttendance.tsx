import { useSearchParams } from 'react-router-dom';
import { PageHeading } from '../../components/ui/Primitives';
import AttendanceTabs from '../../components/shared/AttendanceTabs';
import { useToday } from '../../app/useToday';
import { useLiveSchool } from '../live/schoolContext';
import { portalAccess } from '../live/portalAccess';
import LiveHrWorkspace from './HrWorkspace';
export default function LiveStaffAttendance() {
  const { access, status } = useLiveSchool();
  const [params, setParams] = useSearchParams();
  const today = useToday();
  const requested = params.get('date') || '';
  const date = /^\d{4}-\d{2}-\d{2}$/.test(requested) ? requested : today;
  const requestedMonth = params.get('month') || date.slice(0, 7);
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(requestedMonth) ? requestedMonth : today.slice(0, 7);
  const routes = portalAccess(access.permissions, {
    selfLinked: status.selfTeaching,
    teacherScoped: !access.owner && status.selfTeaching,
  });
  return (
    <div className="ledger-stack">
      <PageHeading
        title="Attendance register"
        description="Review staff attendance or record a missing punch on their behalf."
      />
      <AttendanceTabs
        date={date}
        value="staff"
        studentsVisible={routes.allowed('/attendance')}
        staffVisible={routes.allowed('/attendance/staff')}
      />
      <LiveHrWorkspace
        section="attendance"
        hideNavigation
        month={month}
        onMonthChange={(value) =>
          setParams((prev) => {
            const next = new URLSearchParams(prev);
            next.set('month', value);
            next.set('date', value === today.slice(0, 7) ? today : `${value}-01`);
            return next;
          })
        }
      />
    </div>
  );
}
