import { useToday } from '../../app/useToday';
import { displayDate } from '../../lib/config';
import { useState } from 'react';
import { NavLink, Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  BookOpen,
  CalendarCheck,
  Wallet,
  GraduationCap,
  Bell,
  Settings,
  ChevronsUpDown,
  ArrowUpRight,
  Search,
  Menu,
  X,
  ChevronDown,
  ShieldCheck,
  CircleHelp,
} from 'lucide-react';
import { useSchool } from '../../app/useSchool';
import { Avatar, Button, Modal } from '../ui/Primitives';
const navigation = [
  { to: '/', label: 'Overview', icon: LayoutDashboard },
  { to: '/students', label: 'Students', icon: Users },
  { to: '/teachers', label: 'Teachers', icon: GraduationCap },
  { to: '/classes', label: 'Classes & sections', icon: BookOpen },
  { to: '/attendance', label: 'Attendance', icon: CalendarCheck },
  { to: '/fees', label: 'Fee management', icon: Wallet },
  { to: '/academics', label: 'Academics', icon: GraduationCap },
];
export default function AppShell() {
  const state = useSchool();
  const today = useToday();
  const [mobile, setMobile] = useState(false);
  const [help, setHelp] = useState(false);
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
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
            <GraduationCap size={23} />
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
          <span className="school-initial">{state.school.name[0]}</span>
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
              <n.icon size={19} />
              <span>{n.label}</span>
              {n.to === '/attendance' && <span className="nav-dot" />}
            </NavLink>
          ))}
        </nav>
        <div className="nav-label second">COMMUNICATION & ADMIN</div>
        <nav aria-label="Administration">
          <NavLink className="nav-link" to="/notifications" onClick={() => setMobile(false)}>
            <Bell size={19} />
            Notifications
            {state.notifications.length > 0 && (
              <span className="nav-count">{state.notifications.length}</span>
            )}
          </NavLink>
          <NavLink className="nav-link" to="/settings" onClick={() => setMobile(false)}>
            <Settings size={19} />
            School settings
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
            <strong>{current?.label ?? 'Student profile'}</strong>
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
              <Search size={16} />
              <input
                aria-label="Search the student directory"
                placeholder="Find a student…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <kbd>↵</kbd>
            </form>
            <span className="year-chip">
              <span />
              {state.academicYear.name}
              <ChevronDown size={12} />
            </span>
            <Link
              to="/notifications"
              className="icon-button notification-bell"
              aria-label="Notification history"
            >
              <Bell size={19} />
              {state.notifications.length > 0 && <i />}
            </Link>
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
            <ShieldCheck size={13} /> {state.school.name}
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
          <li>Open Notify parents, select recipients, and preview a parent attendance notice.</li>
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
