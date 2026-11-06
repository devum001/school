import { portalAccess } from './portalAccess';
import TopbarControls from '../../components/layout/TopbarControls';
import { useCallback, useState } from 'react';
import { flushSync } from 'react-dom';
import { NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ChevronsUpDown, LogOut } from 'lucide-react';
import AppShell from '../../components/layout/AppShell';
import { AppIcon, Button, LoadingOverlay, Modal, PageHeading, Panel } from '../../components/ui/Primitives';
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
  const profile = state.data?.profile ?? null;
  const access: SchoolContextValue['access'] = state.data?.access ?? {
    schoolId,
    membershipId: '',
    roleId: '',
    permissions: [],
    owner: false,
  };
  const status: SchoolContextValue['status'] = state.data?.status ?? {
    schoolId,
    currentAcademicYearId: null,
    academicRevision: 0,
    ready: false,
    selfLinked: false,
    counts: { classes: 0, withoutSections: 0, withoutSubjects: 0 },
    steps: [],
  };
  const schoolName = profile?.school.name ?? fallbackSchoolName;
  const navigation = state.data
    ? portalAccess(access.permissions, {
        selfLinked: status.selfLinked,
        teacherScoped: !access.owner && status.selfTeaching,
      })
    : { allowed: () => true, home: '/overview' };

  const isTeacherScoped = !access.owner && Boolean(status.selfTeaching || status.selfLinked);

  const isRouteAllowed = (path: string): boolean => {
    if (path === '/staff/punch') {
      return Boolean(
        access.owner ||
          (access.permissions.includes('attendance.self') && status.selfTeaching) ||
          access.permissions.includes('staff.view'),
      );
    }
    if (path === '/staff/self') {
      return Boolean(
        access.owner ||
          (access.permissions.includes('attendance.self') && status.selfLinked) ||
          access.permissions.includes('staff.view'),
      );
    }
    return Boolean(navigation.allowed(path));
  };

  const isNavVisible = (path: string): boolean => {
    // Punch in & out and Salary & Leaves are personal teacher/staff features,
    // they should never appear in the School Workspace (admin/owner view) sidebar.
    if (path === '/staff/punch' || path === '/staff/self') {
      return isTeacherScoped;
    }
    return Boolean(navigation.allowed(path));
  };

  const context = { schoolId, access, profile, status, reload: state.reload };
  return (
    <SchoolContext.Provider value={context}>
      <AppShell
        overviewUrl="/overview"
        visibleRoute={isNavVisible}
        school={{ name: schoolName, logo: profile?.school.logoDataUrl }}
        user={{ name: session.user.name, detail: session.user.email }}
        preferences={{ language: 'English', landingPage: 'Dashboard' }}
        attentionCount={null}
        studentSearchUrl={(query) => `/students?studentSearch=${encodeURIComponent(query)}`}
        schoolPicker={
          <SchoolPicker name={schoolName} logo={profile?.school.logoDataUrl} schoolId={schoolId} />
        }
        topbar={state.data ? <SessionControls context={context} /> : null}
        extraNavigation={
          state.data && session.user.platformRole === 'super_admin' ? (
            <NavLink
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              to="/platform"
            >
              <AppIcon name="security" size={20} />
              <span>Super Admin</span>
            </NavLink>
          ) : undefined
        }
      >
        {!state.data ? (
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
        ) : (location.pathname === '/' || location.pathname === '/login') &&
          navigation.home === '/staff/punch' ? (
          <Navigate to="/staff/punch" replace />
        ) : isRouteAllowed(location.pathname) ? (
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
        <TopbarControls
          academicYear={context.profile?.academicYear}
          showNotifications={
            context.access.owner ||
            (!context.status.selfTeaching &&
              (context.access.permissions.includes('overview.view') ||
                context.access.permissions.includes('school.profile.view')))
          }
        />
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
