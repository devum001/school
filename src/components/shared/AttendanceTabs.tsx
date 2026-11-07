import { useLocation, useSearchParams } from 'react-router-dom';
import { useSchoolFeature } from '../../app/schoolFeatureContext';
import SectionNavigation from './SectionNavigation';
import '../../styles/admin-settings.css';

export type AttendanceTabType = 'student' | 'staff' | 'self' | 'ars';

export default function AttendanceTabs({
  date,
  value,
  onChange,
  studentsVisible = true,
  staffVisible,
}: {
  date: string;
  value?: AttendanceTabType;
  onChange?: (tab: AttendanceTabType) => void;
  studentsVisible?: boolean;
  staffVisible?: boolean;
}) {
  const location = useLocation();
  const [params] = useSearchParams();
  const feature = useSchoolFeature();
  const isTeacher = Boolean(feature?.teacherScoped);
  const showStaff =
    staffVisible ??
    (!feature || (!feature.teacherScoped && feature.routeAllowed?.('/attendance/staff') !== false));

  const registerParam = params.get('register');
  const viewParam = params.get('view');
  const isStaffPath = location.pathname.endsWith('/staff');

  const activeValue: AttendanceTabType =
    value ??
    (registerParam === 'ars' || viewParam === 'requests'
      ? 'ars'
      : isTeacher && (registerParam === 'self' || viewParam === 'attendance')
        ? 'self'
        : isStaffPath || registerParam === 'staff'
          ? 'staff'
          : 'student');

  const items = [
    ...(studentsVisible
      ? [
          {
            id: 'student' as const,
            label: 'Student Attendance',
            icon: 'student' as const,
            to: onChange ? undefined : `/attendance?date=${date}`,
          },
        ]
      : []),
    ...(showStaff
      ? [
          {
            id: 'staff' as const,
            label: 'Staff Attendance',
            icon: 'staff' as const,
            to: onChange ? undefined : `/attendance/staff?date=${date}`,
          },
        ]
      : []),
    ...(isTeacher
      ? [
          {
            id: 'self' as const,
            label: 'My attendance',
            icon: 'attendance' as const,
            to: onChange ? undefined : `/attendance?register=self&view=attendance`,
          },
          {
            id: 'ars' as const,
            label: 'ARS',
            icon: 'document' as const,
            to: onChange ? undefined : `/attendance?register=ars&view=requests`,
          },
        ]
      : []),
  ];

  return (
    <SectionNavigation
      label="Attendance registers"
      value={activeValue}
      onChange={onChange ? (id) => onChange(id as AttendanceTabType) : undefined}
      items={items}
    />
  );
}
