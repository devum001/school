import { useLocation } from 'react-router-dom';
import { useSchoolFeature } from '../../app/schoolFeatureContext';
import SectionNavigation from './SectionNavigation';
import '../../styles/admin-settings.css';

export default function AttendanceTabs({
  date,
  value,
  onChange,
  studentsVisible = true,
  staffVisible,
}: {
  date: string;
  value?: 'student' | 'staff';
  onChange?: (tab: 'student' | 'staff') => void;
  studentsVisible?: boolean;
  staffVisible?: boolean;
}) {
  const location = useLocation();
  const feature = useSchoolFeature();
  const showStaff =
    staffVisible ??
    (!feature || (!feature.teacherScoped && feature.routeAllowed?.('/attendance/staff') !== false));
  const staff = location.pathname.endsWith('/staff');
  const activeValue = value ?? (staff ? 'staff' : 'student');
  const items = [
    ...(studentsVisible
      ? [
          {
            id: 'student',
            label: 'Student Attendance',
            icon: 'student' as const,
            to: onChange ? undefined : `/attendance?date=${date}`,
          },
        ]
      : []),
    ...(showStaff
      ? [
          {
            id: 'staff',
            label: 'Staff Attendance',
            icon: 'staff' as const,
            to: onChange ? undefined : `/attendance/staff?date=${date}`,
          },
        ]
      : []),
  ];
  return (
    <SectionNavigation
      label="Attendance registers"
      value={activeValue}
      onChange={onChange ? (id) => onChange(id as 'student' | 'staff') : undefined}
      items={items}
    />
  );
}
