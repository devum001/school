import { portalAccess } from './portalAccess';
import TopbarControls from '../../components/layout/TopbarControls';
import { useCallback, useState } from 'react';
import { flushSync } from 'react-dom';
import { Link, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ChevronsUpDown, LogOut } from 'lucide-react';
import AppShell from '../../components/layout/AppShell';
import { Button, LoadingOverlay, Modal, PageHeading, Panel } from '../../components/ui/Primitives';
import { getSchoolProfile } from '../../services/schoolProfileService';
import { schoolAccessService } from '../../services/schoolAccessService';
import { setupApi } from '../../services/schoolSetupService';
import { useSession } from '../auth/useSession';
import { sessionStore } from '../auth/sessionStore';
import { SchoolContext, type SchoolContextValue } from './schoolContext';
import { useRemote } from './useRemote';
import LiveAccount from './LiveAccount';
import '../../components/layout/topbar-controls.css';
export default function LiveSchoolWorkspace({ schoolId }: { schoolId: string | null }) {
  if (!schoolId)
    return (
      <Panel title="School access">
        <p>No active school membership is available. Contact your administrator.</p>
        <LiveAccount />
      </Panel>
    );
  return <VerifiedSchool key={schoolId} schoolId={schoolId} />;
}
function VerifiedSchool({ schoolId }: { schoolId: string }) {
  const { session } = useSession();
  const location = useLocation();
  const load = useCallback(
    async (signal: AbortSignal) => {
      const access = await schoolAccessService.context(schoolId, signal);
      const [profile, status] = await Promise.all([
        access.permissions.includes('school.profile.view')
          ? getSchoolProfile(schoolId, signal)
          : null,
        setupApi.status(schoolId, signal),
      ]);
      return { access, profile, status };
    },
    [schoolId],
  );
  const state = useRemote(load);
  if (state.error)
    return (
      <main className="live-login">
        <Panel>
          <h2>School profile unavailable</h2>
          <p role="alert">{state.error}</p>
          <Button onClick={state.reload}>Retry school profile</Button>
        </Panel>
      </main>
    );
  if (!session) return null;
  const fallbackSchoolName =
    session.memberships.find((m) => m.schoolId === schoolId)?.schoolName ?? 'School workspace';
  if (!state.data) {
    return (
      <AppShell
        school={{ name: fallbackSchoolName }}
        user={{ name: session.user.name, detail: session.user.email }}
        preferences={{ language: 'English', landingPage: 'Dashboard' }}
        attentionCount={null}
        studentSearchUrl={(query) => `/students?studentSearch=${encodeURIComponent(query)}`}
        schoolPicker={<SchoolPicker name={fallbackSchoolName} schoolId={schoolId} />}
        topbar={null}
      >
        <LoadingOverlay
          loading
          size="xl"
          label="Loading your school workspace…"
          message="Loading your school workspace…"
        >
          <PageHeading title="A good day starts with clarity." />
          <Panel
            title={fallbackSchoolName}
            subtitle="Loading saved school configuration and records."
          >
            <div style={{ minHeight: 240 }} />
          </Panel>
        </LoadingOverlay>
      </AppShell>
    );
  }
  const { profile, access, status } = state.data;
  const schoolName = profile?.school.name ?? fallbackSchoolName;
  const navigation = portalAccess(access.permissions, { selfLinked: status.selfLinked });
  const context = { schoolId, access, profile, status, reload: state.reload };
  return (
    <SchoolContext.Provider value={context}>
      <AppShell
        visibleRoute={navigation.allowed}
        school={{ name: schoolName, logo: profile?.school.logoDataUrl }}
        user={{ name: session.user.name, detail: session.user.email }}
        preferences={{ language: 'English', landingPage: 'Dashboard' }}
        attentionCount={null}
        studentSearchUrl={(query) => `/students?studentSearch=${encodeURIComponent(query)}`}
        schoolPicker={
          <SchoolPicker name={schoolName} logo={profile?.school.logoDataUrl} schoolId={schoolId} />
        }
        topbar={<SessionControls context={context} />}
        extraNavigation={
          <>
            {access.permissions.includes('attendance.self') && status.selfLinked && (
              <Link className="nav-link" to="/staff/self">
                My attendance & salary
              </Link>
            )}
            {session.user.platformRole === 'super_admin' && (
              <Link className="nav-link" to="/platform">
                Super Admin
              </Link>
            )}
          </>
        }
      >
        {navigation.allowed(location.pathname) ? (
          <Outlet />
        ) : (
          <Navigate to={navigation.home} replace />
        )}
      </AppShell>
    </SchoolContext.Provider>
  );
}
function SchoolPicker({ name, logo, schoolId }: { name: string; logo?: string; schoolId: string }) {
  const { session } = useSession(),
    navigate = useNavigate(),
    location = useLocation();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        className="school-switch"
        onClick={() => (session!.memberships.length > 1 ? setOpen(true) : navigate('/settings'))}
      >
        <span className="school-initial">
          {logo ? <img src={logo} alt="Workspace school logo" /> : name[0]}
        </span>
        <span>
          <strong>{name}</strong>
          <small>School workspace</small>
        </span>
        <ChevronsUpDown size={14} />
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="School workspace"
        description="Choose a school you have access to."
      >
        <label className="field">
          School workspace
          <select
            aria-label="Select school"
            value={schoolId}
            onChange={(event) => {
              const next = event.target.value;
              if (
                next === schoolId ||
                (document.querySelector('[data-unsaved="true"]') &&
                  !window.confirm('Discard unsaved changes and switch schools?'))
              )
                return;
              const params = new URLSearchParams(location.search);
              for (const key of [...params.keys()])
                if (!['tab', 'section'].includes(key)) params.delete(key);
              const pathname = /^\/(students|teachers)\//.test(location.pathname)
                ? location.pathname.split('/').slice(0, 2).join('/')
                : location.pathname;
              flushSync(() => sessionStore.selectSchool(next));
              navigate({ pathname, search: params.toString() }, { replace: true });
            }}
          >
            {session!.memberships.map((m) => (
              <option key={m.id} value={m.schoolId}>
                {m.schoolName}
              </option>
            ))}
          </select>
        </label>
      </Modal>
    </>
  );
}
function SessionControls({ context }: { context: SchoolContextValue }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  return (
    <>
      {context.access.permissions.includes('academic-years.view') && (
        <TopbarControls academicYear={context.profile?.academicYear} showNotifications={false} />
      )}
      <Button
        variant="secondary"
        disabled={busy}
        className="session-signout"
        aria-busy={busy}
        onClick={async () => {
          if (
            document.querySelector('[data-unsaved="true"]') &&
            !window.confirm('Discard unsaved changes and sign out?')
          )
            return;
          setBusy(true);
          setError('');
          try {
            await sessionStore.logout();
          } catch (e) {
            setError(e instanceof Error ? e.message : 'Unable to sign out.');
          } finally {
            setBusy(false);
          }
        }}
      >
        <LogOut size={15} aria-hidden="true" /> {busy ? 'Signing out…' : 'Sign out'}
      </Button>
      {error && <span role="alert">{error}</span>}
    </>
  );
}
