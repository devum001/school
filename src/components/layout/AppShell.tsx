import '../../styles/navigation.css';
import { useToday } from '../../app/useToday';
import { displayDate } from '../../lib/config';
import { useState, useEffect, useRef, type ReactNode } from 'react';
import { NavLink, Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { ChevronsUpDown, ArrowUpRight, Menu, X, ChevronDown, CircleHelp } from 'lucide-react';
import {
  Avatar,
  Button,
  WorkspaceLoadingBoundary,
  Modal,
  AppIcon,
  type IconName,
} from '../ui/Primitives';

import { usePwaInstall } from '../../app/usePwaInstall';
import { useFeedback } from '../../app/useFeedback';
import PwaInstallModal from './PwaInstallModal';

const hindiLabels: Record<string, string> = {
  Overview: 'अवलोकन',
  Students: 'विद्यार्थी',
  Teachers: 'शिक्षक',
  'Staff & HR': 'स्टाफ एवं एचआर',
  Attendance: 'उपस्थिति',
  'Punch in & out': 'पंच इन / आउट',
  'Salary & Leaves': 'वेतन और अवकाश',
  'Calendar & Holidays': 'कैलेंडर और अवकाश',
  'School Calendar & Holidays': 'स्कूल कैलेंडर और अवकाश',
  'School Calendar': 'स्कूल कैलेंडर',
  'Install Web App': 'ऐप इंस्टॉल करें',
  Finance: 'वित्त',
  'Test and Result': 'परीक्षा और परिणाम',
  Notifications: 'सूचनाएँ',
  'School settings': 'स्कूल सेटिंग्स',
};

const navigation: Array<{ to: string; label: string; icon: IconName }> = [
  { to: '/', label: 'Overview', icon: 'overview' },
  { to: '/students', label: 'Students', icon: 'student' },
  { to: '/teachers', label: 'Teachers', icon: 'teacher' },
  { to: '/staff', label: 'Staff & HR', icon: 'staff' },
  { to: '/attendance', label: 'Attendance', icon: 'attendance' },
  { to: '/staff/punch', label: 'Punch in & out', icon: 'user-check' },
  { to: '/staff/self', label: 'Salary & Leaves', icon: 'wallet' },
  { to: '/calendar', label: 'Calendar & Holidays', icon: 'calendar' },
  { to: '/fees', label: 'Finance', icon: 'fees' },
  { to: '/academics', label: 'Test and Result', icon: 'document' },
];

function loadingMessageForRoute(pathname: string, search: string): string {
  const params = new URLSearchParams(search);
  if (pathname === '/' || pathname === '/overview') return 'Loading overview…';
  if (pathname === '/students/new') return 'Loading student admission form…';
  if (pathname === '/students/import') return 'Loading student import…';
  if (pathname.startsWith('/students/')) return 'Loading student profile…';
  if (pathname.startsWith('/students')) return 'Loading students…';
  if (pathname.startsWith('/teachers/')) return 'Loading teacher profile…';
  if (pathname.startsWith('/teachers')) return 'Loading teachers…';
  if (pathname === '/staff/punch') return 'Loading punch in & out…';
  if (pathname === '/staff/self') return 'Loading salary & leaves…';
  if (pathname.startsWith('/calendar')) return 'Loading calendar & holidays…';
  if (pathname.startsWith('/staff')) return 'Loading staff & HR…';
  if (pathname.startsWith('/attendance')) return 'Loading attendance…';
  if (pathname.startsWith('/fees')) return 'Loading finance & fees…';
  if (pathname.startsWith('/academics')) {
    return params.get('view') === 'results' ? 'Loading exam results…' : 'Loading test & results…';
  }
  if (pathname.startsWith('/notifications')) return 'Loading notifications…';
  if (pathname.startsWith('/settings')) {
    const tab = params.get('tab');
    if (tab === 'Classes, Sections & Grades') return 'Loading class settings…';
    if (tab === 'Staff & Payroll') return 'Loading staff & payroll settings…';
    if (tab === 'Roles & Permissions') return 'Loading roles & permissions…';
    if (tab === 'Templates') return 'Loading document templates…';
    if (tab === 'Communication') return 'Loading communication settings…';
    if (tab === 'Data & Security') return 'Loading data & security…';
    if (tab === 'Preferences') return 'Loading workspace preferences…';
    return 'Loading school settings…';
  }
  return 'Loading workspace…';
}

export interface AppShellProps {
  overviewUrl?: string;
  visibleRoute?: (path: string) => boolean;
  school: { name: string; logo?: string };
  user: { name: string; detail: string; avatarName?: string };
  preferences: { language: string; landingPage: string };
  attentionCount: number | null;
  topbar: ReactNode;
  schoolPicker?: ReactNode;
  extraNavigation?: ReactNode;
  children?: ReactNode;
  studentSearchUrl?: (query: string) => string;
}

export default function AppShell({
  overviewUrl = '/',
  school,
  visibleRoute = (path) => path !== '/staff/punch' && path !== '/staff/self',
  user,
  preferences,
  attentionCount,
  topbar,
  schoolPicker,
  extraNavigation,
  children,
  studentSearchUrl = (query) => `/students?q=${encodeURIComponent(query)}`,
}: AppShellProps) {
  const schoolLogo = school.logo;
  const today = useToday();
  const [mobile, setMobile] = useState(false);
  const [help, setHelp] = useState(false);
  const [installModalOpen, setInstallModalOpen] = useState(false);
  const [query, setQuery] = useState('');
  const notify = useFeedback();
  const pwa = usePwaInstall();
  const navigate = useNavigate();
  const location = useLocation();
  const routeParams = new URLSearchParams(location.search);
  const featureRoute = [
    location.pathname,
    ...['tab', 'section', 'action', 'view', 'resultsView', 'financeView'].map((key) =>
      routeParams.get(key),
    ),
  ].join('|');
  const focusPending = routeParams.get('focus') === 'pending';
  const isAutomated = typeof navigator !== 'undefined' && navigator.webdriver === true;
  const [prevPathname, setPrevPathname] = useState(location.pathname);
  const [routeLoading, setRouteLoading] = useState(false);

  if (location.pathname !== prevPathname) {
    setPrevPathname(location.pathname);
    if (!isAutomated && !children) {
      setRouteLoading(true);
    }
  }

  useEffect(() => {
    if (!routeLoading) return;
    const timer = window.setTimeout(() => setRouteLoading(false), 380);
    return () => window.clearTimeout(timer);
  }, [routeLoading, location.pathname]);

  useEffect(() => {
    if (!location.hash && !focusPending) window.scrollTo({ top: 0, behavior: 'instant' });
  }, [featureRoute, location.hash, focusPending]);

  const initialNavigation = useRef(false);
  const label = (value: string) =>
    preferences.language === 'Hindi' ? (hindiLabels[value] ?? value) : value;

  useEffect(() => {
    document.documentElement.lang = preferences.language === 'Hindi' ? 'hi' : 'en';
  }, [preferences.language]);

  useEffect(() => {
    if (initialNavigation.current) return;
    initialNavigation.current = true;
    if (location.pathname === '/' && preferences.landingPage !== 'Dashboard')
      navigate(preferences.landingPage === 'Students' ? '/students' : '/attendance', {
        replace: true,
      });
  }, [preferences.landingPage, location.pathname, navigate]);

  const current = [
    { to: '/overview', label: 'Overview' },
    { to: '/attendance/staff', label: 'Attendance' },
    { to: '/staff/punch', label: 'Punch in & out' },
    { to: '/staff/self', label: 'Salary & Leaves' },
    ...navigation,
    { to: '/contacts', label: 'Quick Connect' },
    { to: '/notifications', label: 'Notifications' },
    { to: '/settings', label: 'School settings' },
  ].find((n) => (n.to === '/' ? location.pathname === '/' : location.pathname.startsWith(n.to)));

  const loadingMessage = loadingMessageForRoute(location.pathname, location.search);

  return (
    <div className="app-shell">
      {mobile && (
        <button
          className="sidebar-backdrop"
          aria-label="Close navigation"
          onClick={() => setMobile(false)}
        />
      )}
      <aside className={`sidebar ${mobile ? 'mobile-open' : ''}`}>
        <Link to="/" className="brand" onClick={() => setMobile(false)}>
          <span className="brand-mark">
            <AppIcon name="graduation-cap" size={24} />
          </span>
          schoolwell<span className="brand-dot">.</span>
        </Link>
        {schoolPicker ?? (
          <button
            className="school-switch"
            onClick={() => {
              navigate('/settings');
              setMobile(false);
            }}
          >
            <span className="school-initial">
              {schoolLogo ? <img src={schoolLogo} alt="Workspace school logo" /> : school.name[0]}
            </span>
            <span>
              <strong>{school.name}</strong>
              <small>School workspace</small>
            </span>
            <ChevronsUpDown size={14} />
          </button>
        )}
        <div className="nav-label">WORKSPACE</div>
        <nav aria-label="Main navigation">
          {navigation
            .map((n) =>
              n.to === '/attendance' && !visibleRoute(n.to) && visibleRoute('/attendance/staff')
                ? { ...n, to: '/attendance/staff' }
                : n,
            )
            .filter((n) => visibleRoute(n.to))
            .map((n) => (
              <NavLink
                key={n.to}
                end={n.to === '/'}
                to={n.to === '/' ? overviewUrl : n.to}
                onClick={() => setMobile(false)}
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              >
                <AppIcon name={n.icon} size={20} />
                <span>{label(n.label)}</span>
              </NavLink>
            ))}
        </nav>
        <div className="nav-label second">COMMUNICATION & ADMIN</div>
        <nav aria-label="Administration">
          {visibleRoute('/contacts') && (
            <NavLink className="nav-link" to="/contacts" onClick={() => setMobile(false)}>
              <AppIcon name="staff" size={20} />
              <span>Quick Connect</span>
            </NavLink>
          )}
          {visibleRoute('/notifications') && (
            <NavLink className="nav-link" to="/notifications" onClick={() => setMobile(false)}>
              <AppIcon name="notifications" size={20} />
              <span>{label('Notifications')}</span>
              {attentionCount !== null && attentionCount > 0 && (
                <span className="nav-count">{attentionCount}</span>
              )}
            </NavLink>
          )}
          <NavLink className="nav-link" to="/settings" onClick={() => setMobile(false)}>
            <AppIcon name="settings" size={20} />
            <span>{label('School settings')}</span>
          </NavLink>
          {pwa.isInstallable && (
            <button
              type="button"
              className="nav-link install-app-nav-btn"
              onClick={async () => {
                setMobile(false);
                if (pwa.isInstalled) {
                  notify('Schoolwell web app is already installed! (ऐप पहले से इंस्टॉल है)');
                  return;
                }
                if (pwa.hasNativePrompt) {
                  const shown = await pwa.promptInstall();
                  if (shown) return;
                }
                setInstallModalOpen(true);
              }}
              title="Install Schoolwell Web App"
            >
              <AppIcon name="download" size={20} />
              <span>{label('Install Web App')}</span>
            </button>
          )}
          {extraNavigation}
        </nav>
        <div className="sidebar-bottom">
          <button className="sidebar-user" onClick={() => navigate('/settings')}>
            <Avatar name={user.avatarName ?? user.name} />
            <span>
              <strong>{user.name}</strong>
              <small>{user.detail}</small>
            </span>
            <ChevronDown size={15} />
          </button>
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
            <strong>{label(current?.label ?? 'Student profile')}</strong>
          </div>
          <div className="header-actions">
            {visibleRoute('/students') && (
              <form
                className="global-search"
                onSubmit={(e) => {
                  e.preventDefault();
                  navigate(studentSearchUrl(query));
                  setQuery('');
                }}
              >
                <label className="global-search-field">
                  <AppIcon name="search-dark" size={17} aria-hidden="true" />
                  <input
                    aria-label="Search the student directory"
                    placeholder="Find a student…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </label>
              </form>
            )}
            {topbar}
            <Link to="/settings" aria-label="Account settings">
              <Avatar name={user.avatarName ?? user.name} />
            </Link>
          </div>
        </header>
        <main>
          <WorkspaceLoadingBoundary routeLoading={routeLoading} defaultMessage={loadingMessage}>
            {children ?? <Outlet />}
          </WorkspaceLoadingBoundary>
        </main>
        <footer>
          <span>Schoolwell · Thoughtfully connected.</span>
          <span>
            <AppIcon name="security" size={14} /> {school.name}
          </span>
          <button onClick={() => setHelp(true)}>
            <CircleHelp size={14} />
            Workspace guide
          </button>
        </footer>
      </div>
      <Modal
        open={help}
        onClose={() => setHelp(false)}
        title="A school day, beautifully connected"
        description="A quick guide to managing your school day."
      >
        <ol className="guide-list">
          <li>Review the dashboard for today, {displayDate(today)}.</li>
          <li>Open Grade 5, Section A in Attendance. Change a student to Absent and save.</li>
          <li>Open Review notifications, select students, and preview an attendance notice.</li>
          <li>Review the notification, then open a student's profile to explore all five tabs.</li>
          <li>Record a payment and see balances update across the workspace.</li>
          <li>Return to Overview. Review your school settings when needed.</li>
        </ol>
        <div className="info-banner">
          Start with attendance, explore a student profile, and keep track of school finances.
        </div>
        <div className="modal-actions">
          <Button
            onClick={() => {
              setHelp(false);
              navigate('/attendance');
            }}
          >
            Explore attendance <ArrowUpRight size={16} />
          </Button>
          <Button variant="secondary" onClick={() => setHelp(false)}>
            <X size={15} />
            Close guide
          </Button>
        </div>
      </Modal>
      <PwaInstallModal
        open={installModalOpen}
        onClose={() => setInstallModalOpen(false)}
        isIos={pwa.isIos}
        isIosChrome={pwa.isIosChrome}
        isIosSafari={pwa.isIosSafari}
        isMac={pwa.isMac}
        isMacSafari={pwa.isMacSafari}
        isMacChrome={pwa.isMacChrome}
        isAndroid={pwa.isAndroid}
        hasNativePrompt={pwa.hasNativePrompt}
        onNativeInstall={() => pwa.promptInstall()}
      />
    </div>
  );
}
