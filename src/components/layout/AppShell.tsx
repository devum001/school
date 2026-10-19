import '../../styles/navigation.css';
import { useToday } from '../../app/useToday';
import { displayDate } from '../../lib/config';
import { useState, useEffect, useRef } from 'react';
import { NavLink, Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import {
  ChevronsUpDown,
  ArrowUpRight,
  Menu,
  X,
  ChevronDown,
  CircleHelp,
} from 'lucide-react';
import { schoolLogoFor } from '../../lib/schoolBranding';
import { useSchool } from '../../app/useSchool';
import { Avatar, Button, Modal, AppIcon, type IconName } from '../ui/Primitives';
import TopbarControls from './TopbarControls';
import { notificationAttention } from '../../lib/communicationOverview';
import { preferencesFor } from '../../lib/adminSettings';
const hindiLabels: Record<string, string> = {
  Overview: 'अवलोकन',
  Students: 'विद्यार्थी',
  Teachers: 'शिक्षक',
  'Staff & HR': 'स्टाफ एवं एचआर',
  Attendance: 'उपस्थिति',
  Finance: 'वित्त',
  Academics: 'अकादमिक',
  Notifications: 'सूचनाएँ',
  'School settings': 'स्कूल सेटिंग्स',
};
const navigation: Array<{ to: string; label: string; icon: IconName }> = [
  { to: '/', label: 'Overview', icon: 'overview' },
  { to: '/students', label: 'Students', icon: 'student' },
  { to: '/teachers', label: 'Teachers', icon: 'teacher' },
  { to: '/staff', label: 'Staff & HR', icon: 'staff' },
  { to: '/attendance', label: 'Attendance', icon: 'attendance' },
  { to: '/fees', label: 'Finance', icon: 'fees' },
  { to: '/academics', label: 'Academics', icon: 'academics' },
];
export default function AppShell() {
  const state = useSchool();
  const schoolLogo = schoolLogoFor(state);
  const today = useToday();
  const attention = notificationAttention(state);
  const [mobile, setMobile] = useState(false);
  const [help, setHelp] = useState(false);
  const [query, setQuery] = useState('');
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
  useEffect(() => {
    if (!location.hash && !focusPending) window.scrollTo({ top: 0, behavior: 'instant' });
  }, [featureRoute, location.hash, focusPending]);
  const preferences = preferencesFor(state),
    initialNavigation = useRef(false);
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
    ...navigation,
    { to: '/notifications', label: 'Notifications' },
    { to: '/settings', label: 'School settings' },
  ].find((n) => (n.to === '/' ? location.pathname === '/' : location.pathname.startsWith(n.to)));
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
        <button
          className="school-switch"
          onClick={() => {
            navigate('/settings');
            setMobile(false);
          }}
        >
          <span className="school-initial">
            {schoolLogo ? (
              <img src={schoolLogo} alt="Workspace school logo" />
            ) : (
              state.school.name[0]
            )}
          </span>
          <span>
            <strong>{state.school.name}</strong>
            <small>School workspace</small>
          </span>
          <ChevronsUpDown size={14} />
        </button>
        <div className="nav-label">WORKSPACE</div>
        <nav aria-label="Main navigation">
          {navigation.map((n) => (
            <NavLink
              key={n.to}
              end={n.to === '/'}
              to={n.to}
              onClick={() => setMobile(false)}
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            >
              <AppIcon name={n.icon} size={20} />
              <span>{label(n.label)}</span>
              {n.to === '/attendance' && <span className="nav-dot" />}
            </NavLink>
          ))}
        </nav>
        <div className="nav-label second">COMMUNICATION & ADMIN</div>
        <nav aria-label="Administration">
          <NavLink className="nav-link" to="/notifications" onClick={() => setMobile(false)}>
            <AppIcon name="notifications" size={20} />
            {label('Notifications')}
            {attention.count > 0 && <span className="nav-count">{attention.count}</span>}
          </NavLink>
          <NavLink className="nav-link" to="/settings" onClick={() => setMobile(false)}>
            <AppIcon name="settings" size={20} />
            {label('School settings')}
          </NavLink>
        </nav>
        <div className="sidebar-bottom">
          <button className="sidebar-user" onClick={() => navigate('/settings')}>
            <Avatar name="Nandita Rao" />
            <span>
              <strong>Dr. Nandita Rao</strong>
              <small>Principal</small>
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
            <form
              className="global-search"
              onSubmit={(e) => {
                e.preventDefault();
                navigate(`/students?q=${encodeURIComponent(query)}`);
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
            <TopbarControls />
            <Link to="/settings" aria-label="Account settings">
              <Avatar name="Nandita Rao" />
            </Link>
          </div>
        </header>
        <main>
          <Outlet />
        </main>
        <footer>
          <span>Schoolwell · Thoughtfully connected.</span>
          <span>
            <AppIcon name="security" size={14} /> {state.school.name}
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
    </div>
  );
}
