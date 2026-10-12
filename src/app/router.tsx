import { lazy } from 'react';
import { createBrowserRouter, Link } from 'react-router-dom';
import AppShell from '../components/layout/AppShell';
import { LazyBoundary, RouteError } from './RouteBoundaries';
const Dashboard = lazy(() => import('../features/dashboard/DashboardPage'));
const Students = lazy(() => import('../features/students/StudentsPage'));
const Profile = lazy(() => import('../features/students/StudentProfilePage'));
const Teachers = lazy(() => import('../features/teachers/TeachersPage'));
const Classes = lazy(() => import('../features/classes/ClassesPage'));
const Attendance = lazy(() => import('../features/attendance/AttendancePage'));
const Fees = lazy(() => import('../features/fees/FeesPage'));
const Academics = lazy(() => import('../features/academics/AcademicsPage'));
const Notifications = lazy(() => import('../features/notifications/NotificationsPage'));
const Settings = lazy(() => import('../features/settings/SettingsPage'));
export const router = createBrowserRouter([
  {
    element: <AppShell />,
    errorElement: <RouteError />,
    children: [
      {
        element: <LazyBoundary />,
        children: [
          { index: true, element: <Dashboard /> },
          { path: 'students', element: <Students /> },
          { path: 'students/:studentId', element: <Profile /> },
          { path: 'classes', element: <Classes /> },
          { path: 'teachers', element: <Teachers /> },
          { path: 'attendance', element: <Attendance /> },
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
