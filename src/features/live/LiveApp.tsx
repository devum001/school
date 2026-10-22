import LiveSchoolWorkspace from './LiveSchoolWorkspace';
import { FeedbackProvider } from '../../app/Feedback';
import { useCallback } from 'react';
import { useRemote } from './useRemote';
import { schoolAccessService } from '../../services/schoolAccessService';
import { AppIcon, AppLoader, Button, PageHeading, Panel } from '../../components/ui/Primitives';
import { useEffect, useState } from 'react';
import { GraduationCap, Settings, LogOut, Menu } from 'lucide-react';
import { flushSync } from 'react-dom';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import LoginScreen from '../auth/LoginScreen';
import { useSession } from '../auth/useSession';
import { sessionStore } from '../auth/sessionStore';
import LiveSettings from './LiveSettings';
import PlatformDashboard from '../platform/PlatformDashboard';
import '../settings/settings.css';
import './live.css';

export default function LiveApp() {
  const auth = useSession();
  const location = useLocation();
  useEffect(() => {
    if (!auth.session) return;
    const delay = new Date(auth.session.expiresAt).getTime() - Date.now();
    if (!Number.isFinite(delay)) return;
    const timer = window.setTimeout(
      () => void sessionStore.restore(),
      Math.max(0, Math.min(delay, 2147483647)),
    );
    return () => window.clearTimeout(timer);
  }, [auth.session]);
  useEffect(() => {
    void sessionStore.initialize();
  }, []);
  if (auth.status === 'loading')
    return (
      <main className="live-login">
        <Panel>
          <div className="loading-state">
            <AppLoader
              size="xl"
              label="Checking your session…"
              message="Checking your session…"
            />
          </div>
        </Panel>
      </main>
    );
  if (auth.status === 'error')
    return (
      <main className="live-login">
        <Panel>
          <h1>Unable to connect</h1>
          <p role="alert">{auth.error}</p>
          <Button onClick={() => void sessionStore.restore()}>Retry connection</Button>
        </Panel>
      </main>
    );
  if (auth.status === 'anonymous' || !auth.session) return <LoginScreen />;
  return (
    <FeedbackProvider>
      {location.pathname === '/platform' ||
      (auth.session.user.platformRole === 'super_admin' && !auth.session.memberships.length) ? (
        <LiveWorkspace key={auth.session.user.id} />
      ) : (
        <LiveSchoolWorkspace key={auth.session.user.id} schoolId={auth.schoolId} />
      )}
    </FeedbackProvider>
  );
}
function LiveWorkspace() {
  const { session, schoolId } = useSession();
  const location = useLocation(),
    navigate = useNavigate();
  const [mobile, setMobile] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!session) return;
    const expires = new Date(session.expiresAt).getTime() - Date.now();
    if (!Number.isFinite(expires)) return;
    const timer = window.setTimeout(
      () => void sessionStore.restore(),
      Math.max(0, Math.min(expires, 2147483647)),
    );
    return () => window.clearTimeout(timer);
  }, [session]);
  if (!session) return null;
  const superAdmin = session.user.platformRole === 'super_admin';
  if (location.pathname === '/' || location.pathname === '/login')
    return <Navigate to={superAdmin ? '/platform' : '/settings'} replace />;
  const platform = location.pathname === '/platform';
  const settings = location.pathname === '/settings';
  const schoolPage =
    settings ||
    ['/overview', '/staff'].includes(location.pathname) ||
    location.pathname.startsWith('/students') ||
    location.pathname.startsWith('/teachers');
  const pageTitle = settings
    ? 'School settings'
    : location.pathname.startsWith('/students')
      ? 'Students'
      : location.pathname.startsWith('/teachers')
        ? 'Teachers'
        : location.pathname === '/staff'
          ? 'Staff & HR'
          : 'Overview';
  if (platform && !superAdmin) return <Navigate to="/settings" replace />;
  if (superAdmin && !session.memberships.length && settings)
    return <Navigate to="/platform" replace />;
  return (
    <div className="app-shell live-workspace">
      {mobile && (
        <button
          className="sidebar-backdrop"
          aria-label="Close navigation"
          onClick={() => setMobile(false)}
        />
      )}
      <aside className={`sidebar ${mobile ? 'mobile-open' : ''}`}>
        <Link to={superAdmin ? '/platform' : '/settings'} className="brand">
          <span className="brand-mark">
            <GraduationCap size={23} />
          </span>
          schoolwell<span className="brand-dot">.</span>
        </Link>
        {(!superAdmin || session.memberships.length > 0) && (
          <label className="live-school-picker">
            School workspace
            <select
              aria-label="Select school"
              value={schoolId ?? ''}
              onChange={(event) => {
                if (
                  !document.querySelector('[data-unsaved="true"]') ||
                  window.confirm('Discard unsaved changes and switch schools?')
                ) {
                  const nextSchoolId = event.target.value;
                  if (nextSchoolId === schoolId) return;
                  const query = new URLSearchParams(location.search);
                  for (const key of [...query.keys()])
                    if (!['tab', 'section'].includes(key)) query.delete(key);
                  const pathname = location.pathname.startsWith('/students/')
                    ? '/students'
                    : location.pathname;
                  // Dispose the old school's draft blockers before changing its route context.
                  flushSync(() => sessionStore.selectSchool(nextSchoolId));
                  navigate({ pathname, search: query.toString() }, { replace: true });
                }
              }}
            >
              {!schoolId && <option value="">No active memberships</option>}
              {session.memberships.map((member, index) => (
                <option key={member.id} value={member.schoolId}>
                  {member.schoolName || `School ${index + 1}`}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="nav-label">WORKSPACE · LIVE</div>
        <nav aria-label="Administration">
          {superAdmin && (
            <Link
              className={`nav-link ${platform ? 'active' : ''}`}
              to="/platform"
              onClick={() => setMobile(false)}
            >
              <Settings size={19} />
              Super Admin
            </Link>
          )}
          {schoolId && (
            <SchoolLinks key={schoolId} schoolId={schoolId} close={() => setMobile(false)} />
          )}
          {(!superAdmin || session.memberships.length > 0) && (
            <Link
              className={`nav-link ${settings ? 'active' : ''}`}
              to="/settings"
              onClick={() => setMobile(false)}
            >
              <Settings size={19} />
              School settings
            </Link>
          )}
        </nav>
        <p className="live-sidebar-note">
          {superAdmin
            ? 'Platform administration is separate from school operations.'
            : 'Your school workspace. More operational modules will become available as they are connected.'}
        </p>
        <div className="sidebar-bottom">
          <div className="sidebar-user">
            <span>
              <strong>{session.user.name}</strong>
              <small>{session.user.email}</small>
            </span>
          </div>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-menu"
              aria-label="Open navigation"
              onClick={() => setMobile(true)}
            >
              <Menu size={21} />
            </button>
            <span>Workspace</span>
            <span className="slash">/</span>
            <strong>{platform ? 'Platform administration' : pageTitle}</strong>
          </div>
          <Button
            variant="secondary"
            disabled={busy}
            onClick={async () => {
              if (
                document.querySelector('form[data-unsaved="true"]') &&
                !window.confirm('Discard unsaved changes and sign out?')
              )
                return;
              setBusy(true);
              setError('');
              try {
                await sessionStore.logout();
              } catch (cause) {
                setError(cause instanceof Error ? cause.message : 'Unable to sign out.');
              } finally {
                setBusy(false);
              }
            }}
          >
            <LogOut size={16} />
            {busy ? 'Signing out…' : 'Sign out'}
          </Button>
        </header>
        <main>
          {error && (
            <p role="alert" className="form-error">
              {error} You are still signed in; retry signing out.
            </p>
          )}
          {platform ? (
            <PlatformDashboard />
          ) : schoolPage ? (
            <div className="school-settings">
              <PageHeading
                title={pageTitle}
                description={
                  settings
                    ? 'School identity, academic context, and workspace preferences.'
                    : 'Manage records for the selected school.'
                }
              />
              <LiveSettings
                key={`${schoolId ?? 'no-school'}:${location.pathname}`}
                schoolId={schoolId}
              />
            </div>
          ) : (
            <Panel>
              <h1>This module is not connected yet</h1>
              <p>
                Live access includes school settings, roles, members, activity, and account
                sessions.
              </p>
              <Link to="/settings">Open General settings</Link>
            </Panel>
          )}
        </main>
        <footer>
          <span>Schoolwell · Live workspace</span>
          <span>{platform ? 'Platform administration' : pageTitle}</span>
        </footer>
      </div>
    </div>
  );
}

function SchoolLinks({ schoolId, close }: { schoolId: string; close: () => void }) {
  const load = useCallback(
    (signal: AbortSignal) => schoolAccessService.context(schoolId, signal),
    [schoolId],
  );
  const state = useRemote(load),
    location = useLocation();
  if (!state.data || state.error) return null;
  const links = [
    {
      path: '/overview',
      label: 'Overview',
      icon: 'overview' as const,
      permission: 'school.profile.view',
    },
    { path: '/students', label: 'Students', icon: 'student' as const, permission: 'students.view' },
    { path: '/teachers', label: 'Teachers', icon: 'teacher' as const, permission: 'staff.view' },
    { path: '/staff', label: 'Staff & HR', icon: 'staff' as const, permission: 'staff.view' },
  ];
  return (
    <>
      {links
        .filter((l) => state.data!.permissions.includes(l.permission))
        .map((l) => (
          <Link
            key={l.path}
            className={`nav-link ${location.pathname.startsWith(l.path) ? 'active' : ''}`}
            to={l.path}
            onClick={close}
          >
            <AppIcon name={l.icon} size={19} />
            {l.label}
          </Link>
        ))}
    </>
  );
}
