import LiveQuickConnect from '../features/contacts/QuickConnect';
import { lazy, Suspense } from 'react';
const LiveFinanceWorkspace = lazy(() => import('../features/fees/LiveFinanceWorkspace'));
const LiveNotificationsWorkspace = lazy(
  () => import('../features/notifications/LiveNotificationsWorkspace'),
);
import LiveLearning from '../features/live/LiveLearning';
import TeacherPunchPage from '../features/hr/TeacherPunchPage';
import LiveHrWorkspace from '../features/hr/HrWorkspace';
import LiveStaffAttendance from '../features/hr/LiveStaffAttendance';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import LiveApp from '../features/live/LiveApp';
import LiveSchoolSettings from '../features/live/LiveSchoolSettings';
import { ExistingPeopleRoute, PendingSchoolRoute } from '../features/live/LiveRouteContent';
import { RouteError } from './RouteBoundaries';
export const liveRouter = createBrowserRouter([
  {
    element: <LiveApp />,
    errorElement: <RouteError />,
    children: [
      { index: true, element: <LiveLearning area="overview" /> },
      { path: 'overview', element: <LiveLearning area="overview" /> },
      { path: 'login', element: <Navigate to="/" replace /> },
      { path: 'contacts', element: <LiveQuickConnect /> },
      { path: 'settings', element: <LiveSchoolSettings /> },
      ...[
        'students',
        'students/new',
        'students/import',
        'students/:studentId',
        'teachers',
        'teachers/:teacherId',
        'staff',
        'staff/:staffId',
      ].map((path) => ({ path, element: <ExistingPeopleRoute /> })),
      { path: 'attendance', element: <LiveLearning area="attendance" /> },
      { path: 'classes', element: <LiveLearning area="classes" /> },
      { path: 'academics', element: <LiveLearning area="academics" /> },
      { path: 'attendance/staff', element: <LiveStaffAttendance /> },
      {
        path: 'fees',
        element: (
          <Suspense fallback={<p role="status">Loading finance…</p>}>
            <LiveFinanceWorkspace />
          </Suspense>
        ),
      },
      { path: 'staff/punch', element: <TeacherPunchPage /> },
      { path: 'staff/self', element: <LiveHrWorkspace section="self" /> },
      {
        path: 'notifications',
        element: (
          <Suspense fallback={<p role="status">Loading notifications…</p>}>
            <LiveNotificationsWorkspace />
          </Suspense>
        ),
      },
      { path: 'platform', element: null },
      { path: '*', element: <PendingSchoolRoute title="Page not found" /> },
    ],
  },
]);
