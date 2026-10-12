import { Suspense } from 'react';
import { Outlet, useRouteError } from 'react-router-dom';
export function RouteError() {
  const error = useRouteError();
  return (
    <div className="empty-state">
      <h1>Something interrupted this page</h1>
      <p>
        {error instanceof Error ? error.message : 'Please return to the overview and try again.'}
      </p>
      <a className="button primary" href="/">
        Reload workspace
      </a>
    </div>
  );
}
export function LazyBoundary() {
  return (
    <Suspense
      fallback={
        <div className="loading-state" role="status">
          <span className="spinner" />
          Opening your workspace…
        </div>
      }
    >
      <Outlet />
    </Suspense>
  );
}
