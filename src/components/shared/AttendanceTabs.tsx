import { useLocation } from 'react-router-dom';
import SectionNavigation from './SectionNavigation';
import '../../styles/admin-settings.css';

export default function AttendanceTabs({
  date,
  value,
  onChange,
}: {
  date: string;
  value?: 'student' | 'staff';
  onChange?: (tab: 'student' | 'staff') => void;
}) {
  const location = useLocation();
  const staff = location.pathname.endsWith('/staff');
  const activeValue = value ?? (staff ? 'staff' : 'student');

  return (
    <SectionNavigation
      label="Attendance registers"
      value={activeValue}
      onChange={onChange ? (id) => onChange(id as 'student' | 'staff') : undefined}
      items={[
        {
          id: 'student',
          label: 'Student Attendance',
          icon: 'student',
          to: onChange ? undefined : `/attendance?date=${date}`,
        },
        {
          id: 'staff',
          label: 'Staff Attendance',
          icon: 'staff',
          to: onChange ? undefined : `/attendance/staff?date=${date}`,
        },
      ]}
    />
  );
}
