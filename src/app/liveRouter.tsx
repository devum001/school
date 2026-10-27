import { lazy, Suspense } from 'react';
const LiveFinanceWorkspace = lazy(() => import('../features/fees/LiveFinanceWorkspace'));
import LiveLearning from '../features/live/LiveLearning';
import LiveHrWorkspace from '../features/hr/HrWorkspace';
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
      { path: 'overview', element: <Navigate to="/" replace /> },
      { path: 'login', element: <Navigate to="/settings" replace /> },
      { path: 'settings', element: <LiveSchoolSettings /> },
      ...[
        'students',
        'students/new',
        'students/import',
        'students/:studentId',
        'teachers',
        'teachers/:teacherId',
        'staff',
      ].map((path) => ({ path, element: <ExistingPeopleRoute /> })),
      { path: 'attendance', element: <LiveLearning area="attendance" /> },
      { path: 'classes', element: <LiveLearning area="classes" /> },
      { path: 'academics', element: <LiveLearning area="academics" /> },
      { path: 'attendance/staff', element: <Navigate replace to="/attendance?register=staff" /> },
      {
        path: 'fees',
        element: (
          <Suspense fallback={<p role="status">Loading finance…</p>}>
            <LiveFinanceWorkspace />
          </Suspense>
        ),
      },
      { path: 'staff/self', element: <LiveHrWorkspace section="self" /> },
      ...[{ path: 'notifications', title: 'Notifications' }].map(({ path, title }) => ({
        path,
        element: <PendingSchoolRoute title={title} />,
      })),
      { path: 'platform', element: null },
      { path: '*', element: <PendingSchoolRoute title="Page not found" /> },
    ],
  },
]);
