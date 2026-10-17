import { Link, useLocation, useNavigate } from 'react-router-dom';
import '../../styles/admin-settings.css';
export default function AttendanceTabs({ date }: { date: string }) {
  const location = useLocation(),
    navigate = useNavigate();
  const staff = location.pathname.endsWith('/staff');
  return (
    <div className="hr-tabs" role="tablist" aria-label="Attendance registers">
      {[
        ['Student Attendance', `/attendance?date=${date}`],
        ['Staff Attendance', `/attendance/staff?date=${date}`],
      ].map(([label, to], index) => (
        <Link
          key={label}
          role="tab"
          aria-selected={staff === !!index}
          tabIndex={staff === !!index ? 0 : -1}
          aria-controls="attendance-register-content"
          to={to}
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
              e.preventDefault();
              navigate(index ? `/attendance?date=${date}` : `/attendance/staff?date=${date}`);
            }
          }}
        >
          {label}
        </Link>
      ))}
    </div>
  );
}
