import { useSchoolFeature } from '../../app/schoolFeatureContext';
import TabRail from '../ui/TabRail';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AppIcon } from '../ui/Primitives';
import '../../styles/admin-settings.css';
export default function AttendanceTabs({ date }: { date: string }) {
  const location = useLocation(),
    navigate = useNavigate();
  const staff = location.pathname.endsWith('/staff');
  const feature = useSchoolFeature();
  const showStaff =
    !feature || (!feature.teacherScoped && feature.routeAllowed?.('/attendance/staff'));
  return (
    <TabRail className="hr-tabs" role="tablist" aria-label="Attendance registers">
      {[
        { label: 'Student Attendance', to: `/attendance?date=${date}`, icon: 'student' as const },
        { label: 'Staff Attendance', to: `/attendance/staff?date=${date}`, icon: 'staff' as const },
      ]
        .filter((item) => showStaff || item.icon !== 'staff')
        .map((item, index) => (
          <Link
            key={item.label}
            role="tab"
            aria-selected={staff === !!index}
            tabIndex={staff === !!index ? 0 : -1}
            aria-controls="attendance-register-content"
            to={item.to}
            onKeyDown={(e) => {
              if (showStaff && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
                e.preventDefault();
                navigate(index ? `/attendance?date=${date}` : `/attendance/staff?date=${date}`);
              }
            }}
          >
            <AppIcon name={item.icon} size={16} />
            {item.label}
          </Link>
        ))}
    </TabRail>
  );
}
