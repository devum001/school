import { lazy } from 'react';
import { createBrowserRouter, Link } from 'react-router-dom';
import AppShell from '../components/layout/DemoAppShell';
import { LazyBoundary, RouteError } from './RouteBoundaries';
const Dashboard = lazy(() => import('../features/dashboard/DashboardPage'));
const Students = lazy(() => import('../features/students/StudentsPage'));
const StudentImport = lazy(() => import('../features/students/StudentImportPage'));
const StudentCreate = lazy(() => import('../features/students/StudentCreatePage'));
const Profile = lazy(() => import('../features/students/StudentProfilePage'));
const Teachers = lazy(() => import('../features/teachers/TeachersPage'));
const TeacherProfile = lazy(() => import('../features/teachers/TeacherProfilePage'));
const Staff = lazy(() => import('../features/teachers/StaffHRPage'));
const Classes = lazy(() => import('../features/classes/ClassesPage'));
const Attendance = lazy(() => import('../features/attendance/AttendancePage'));
const StaffAttendance = lazy(() => import('../features/attendance/StaffAttendancePage'));
const Fees = lazy(() => import('../features/fees/FinanceWorkspace'));
const Academics = lazy(() => import('../features/academics/AcademicsPage'));
const Notifications = lazy(() => import('../features/notifications/CommunicationWorkspace'));
const Settings = lazy(() => import('../features/settings/DemoSettingsPage'));
export const demoRouter = createBrowserRouter([
  {
    element: <AppShell />,
    errorElement: <RouteError />,
    children: [
      {
        element: <LazyBoundary />,
        children: [
          { index: true, element: <Dashboard /> },
          { path: 'students', element: <Students /> },
          { path: 'students/new', element: <StudentCreate /> },
          { path: 'students/import', element: <StudentImport /> },
          { path: 'students/:studentId', element: <Profile /> },
          { path: 'classes', element: <Classes /> },
          { path: 'teachers', element: <Teachers /> },
          { path: 'teachers/:teacherId', element: <TeacherProfile /> },
          { path: 'staff', element: <Staff /> },
          { path: 'attendance', element: <Attendance /> },
          { path: 'attendance/staff', element: <StaffAttendance /> },
          { path: 'fees', element: <Fees /> },
          { path: 'academics', element: <Academics /> },
          { path: 'notifications', element: <Notifications /> },
          { path: 'settings', element: <Settings /> },
          {
            path: '*',
            element: (
              <div className="empty-state">
                <h1>Page not found</h1>
                <Link to="/">Return to overview</Link>
              </div>
            ),
          },
        ],
      },
    ],
  },
]);
