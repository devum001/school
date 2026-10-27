import { useLocation } from 'react-router-dom';
import SectionNavigation from './SectionNavigation';
import '../../styles/admin-settings.css';

export default function AttendanceTabs({ date }: { date: string }) {
  const location = useLocation();
  const staff = location.pathname.endsWith('/staff');

  return (
    <SectionNavigation
      label="Attendance registers"
      value={staff ? 'staff' : 'student'}
      items={[
        { id: 'student', label: 'Student Attendance', icon: 'student', to: `/attendance?date=${date}` },
        { id: 'staff', label: 'Staff Attendance', icon: 'staff', to: `/attendance/staff?date=${date}` },
      ]}
    />
  );
}
