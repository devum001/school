import ArsRequestDialog from './ArsRequestDialog';
import { liveHrAdapter } from '../../services/hrService';
import { formatCalendarDate } from '../../lib/displayFormat';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  LogOut,
  RefreshCw,
} from 'lucide-react';
import { Button } from '../../components/ui/Primitives';
import { useSession } from '../auth/useSession';
import { useLiveSchool } from '../live/schoolContext';
import { useTeacherPunch } from './useTeacherPunch';
import { punchLocationFeedback } from './punchLocationFeedback';
import './teacher-punch.css';

function DeskIllustration() {
  return (
    <div className="punch-illustration-wrap" aria-hidden="true">
      <svg
        viewBox="0 0 280 230"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="punch-illustration-svg"
      >
        {/* Soft Circular Backdrop */}
        <circle cx="158" cy="115" r="95" fill="#e5eee8" />

        {/* Wall Clock (upper right) */}
        <g transform="translate(164, 22)">
          <circle cx="34" cy="34" r="34" fill="#2d4a43" />
          <circle cx="34" cy="34" r="30" fill="#ffffff" />
          {/* Clock Ticks */}
          <line x1="34" y1="8" x2="34" y2="13" stroke="#64748b" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="60" y1="34" x2="55" y2="34" stroke="#64748b" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="34" y1="60" x2="34" y2="55" stroke="#64748b" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="8" y1="34" x2="13" y2="34" stroke="#64748b" strokeWidth="2.5" strokeLinecap="round" />
          {/* Clock Hands */}
          <line x1="34" y1="34" x2="22" y2="21" stroke="#1e293b" strokeWidth="3" strokeLinecap="round" />
          <line x1="34" y1="34" x2="48" y2="25" stroke="#1e293b" strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="34" cy="34" r="3" fill="#1e293b" />
          {/* Top Right Green Check Badge */}
          <circle cx="58" cy="10" r="13" fill="#2d7a5b" />
          <path d="M53 10L56.5 13.5L63 7" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </g>

        {/* Desk Calendar (upper left) */}
        <g transform="translate(42, 42)">
          {/* Calendar Rings */}
          <rect x="12" y="0" width="3" height="6" rx="1.5" fill="#5a736a" />
          <rect x="26" y="0" width="3" height="6" rx="1.5" fill="#5a736a" />
          <rect x="40" y="0" width="3" height="6" rx="1.5" fill="#5a736a" />
          {/* Calendar Card Body */}
          <rect x="2" y="3" width="52" height="46" rx="6" fill="#ffffff" stroke="#2d4a43" strokeWidth="2" />
          {/* Calendar Top Banner */}
          <path d="M2 9C2 5.68629 4.68629 3 8 3H48C51.3137 3 54 5.68629 54 9V14H2V9Z" fill="#2d4a43" />
          {/* Dots Grid */}
          <circle cx="12" cy="22" r="2" fill="#94a3b8" />
          <circle cx="21" cy="22" r="2" fill="#94a3b8" />
          <circle cx="30" cy="22" r="2" fill="#94a3b8" />
          <circle cx="39" cy="22" r="2" fill="#94a3b8" />
          <circle cx="12" cy="30" r="2" fill="#94a3b8" />
          <circle cx="21" cy="30" r="2" fill="#94a3b8" />
          <circle cx="30" cy="30" r="2" fill="#2d7a5b" />
          <circle cx="39" cy="30" r="2" fill="#94a3b8" />
          <circle cx="12" cy="38" r="2" fill="#94a3b8" />
          <circle cx="21" cy="38" r="2" fill="#94a3b8" />
          <circle cx="30" cy="38" r="2" fill="#94a3b8" />
          <circle cx="39" cy="38" r="2" fill="#94a3b8" />
        </g>

        {/* Lamp light cone (behind laptop) */}
        <path d="M190 120L100 178H230L205 125Z" fill="#fef9c3" fillOpacity="0.38" />

        {/* Desk Surface Bar */}
        <rect x="20" y="178" width="240" height="6" rx="3" fill="#2d4a43" />

        {/* Potted Plant */}
        <g transform="translate(36, 128)">
          <path d="M6 34L9 50H23L26 34H6Z" fill="#ffffff" stroke="#2d4a43" strokeWidth="2" strokeLinejoin="round" />
          <path d="M16 34C16 20 7 15 5 11C14 11 19 22 16 34Z" fill="#2d6a4f" />
          <path d="M16 34C16 18 25 14 28 8C28 19 20 26 16 34Z" fill="#40916c" />
          <path d="M16 34C16 15 16 7 16 2C18 10 18 22 16 34Z" fill="#52b788" />
        </g>

        {/* Modern Laptop on Desk */}
        <g transform="translate(94, 126)">
          <rect x="0" y="48" width="68" height="4" rx="2" fill="#2d4a43" />
          <rect x="26" y="49" width="16" height="2" rx="1" fill="#94a3b8" />
          <rect x="5" y="4" width="58" height="44" rx="4" fill="#1b3834" stroke="#2d4a43" strokeWidth="2" />
          <rect x="9" y="8" width="50" height="36" rx="2" fill="#0f2623" />
          <circle cx="34" cy="24" r="5" fill="#e2eee7" fillOpacity="0.85" />
          <line x1="16" y1="14" x2="28" y2="14" stroke="#2d6a4f" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="16" y1="36" x2="36" y2="36" stroke="#2d6a4f" strokeWidth="1.5" strokeLinecap="round" />
        </g>

        {/* Modern Desk Lamp */}
        <g transform="translate(178, 92)">
          <rect x="28" y="82" width="20" height="4" rx="2" fill="#2d4a43" />
          <line x1="38" y1="82" x2="42" y2="44" stroke="#2d4a43" strokeWidth="3" strokeLinecap="round" />
          <circle cx="42" cy="44" r="3.5" fill="#2d4a43" />
          <line x1="42" y1="44" x2="16" y2="24" stroke="#2d4a43" strokeWidth="3" strokeLinecap="round" />
          <circle cx="16" cy="24" r="3.5" fill="#2d4a43" />
          <path d="M8 28L28 14L20 4L0 18L8 28Z" fill="#2d4a43" />
        </g>
      </svg>
    </div>
  );
}

export default function TeacherPunchPage() {
  const { schoolId, profile } = useLiveSchool();
  const { session } = useSession();
  const schoolName =
    profile?.school.name ??
    session?.memberships.find((m) => m.schoolId === schoolId)?.schoolName ??
    'Your school';
  return <PunchPage key={schoolId} schoolId={schoolId} schoolName={schoolName} />;
}

function PunchPage({ schoolId, schoolName }: { schoolId: string; schoolName: string }) {
  const { data, busy, error, reading, clockOffset, refresh, act } = useTeacherPunch(schoolId);
  const adapter = useMemo(() => liveHrAdapter(schoolId), [schoolId]);
  const [tick, setTick] = useState(Date.now);
  const [dismissedMissed, setDismissedMissed] = useState('');
  const missed = data?.missedPunches?.[0];

  useEffect(() => {
    const timer = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const now = Math.max(tick + clockOffset, data ? Date.parse(data.serverNow) : 0);
  const rollover = useRef('');

  useEffect(() => {
    if (!data || busy) return;
    const localDate = new Intl.DateTimeFormat('en-CA', {
      timeZone: data.timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(now));
    if (localDate !== data.today && rollover.current !== localDate) {
      rollover.current = localDate;
      void refresh();
    }
  }, [now, data, busy, refresh]);

  const formatTimeStr = (value: number | string) => {
    try {
      return new Intl.DateTimeFormat('en-US', {
        timeZone: data?.timezone || 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      })
        .format(new Date(value))
        .toLowerCase();
    } catch {
      return '12:00:00 pm';
    }
  };

  const formatDateLong = (val: number | string | Date) => {
    try {
      return new Intl.DateTimeFormat('en-GB', {
        timeZone: data?.timezone || undefined,
        weekday: 'long',
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      }).format(new Date(val));
    } catch {
      return 'Thursday, 05 November 2026';
    }
  };

  const seconds = data?.punchIn
    ? Math.max(
        0,
        Math.floor(
          ((data.punchOut ? Date.parse(data.punchOut) : now) - Date.parse(data.punchIn)) / 1000,
        ),
      )
    : 0;

  const formatDurationHMS = (totalSeconds: number) => {
    if (!totalSeconds || totalSeconds < 0) return '00h 00m 00s';
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
  };

  const feedback =
    reading && data ? punchLocationFeedback(reading, data.locationPolicy, tick) : undefined;
  const isWithinRange = feedback ? feedback.ok : true;

  const campusLocation =
    data?.locationPolicy.locations?.[0] ?? {
      name: schoolName || 'School campus',
      radius: 200,
    };

  return (
    <div className="punch-page" aria-label="My school punch" role="region">
      {/* Header section matching Image 1: serif heading & clean subtitle */}
      <div className="punch-page-header">
        <div>
          <h1 className="punch-page-title">Punch in & out</h1>
          <p className="punch-page-desc">Record your work hours here.</p>
        </div>
        <div className="punch-header-nav">
          <Link to="/staff/self" className="punch-header-link" title="Open Salary & Leaves">
            <CalendarDays size={14} />
            Salary & Leaves
            <ArrowRight size={13} />
          </Link>
          <button
            type="button"
            className="punch-header-refresh"
            disabled={!!busy}
            onClick={() => void refresh()}
            title="Refresh status"
          >
            <RefreshCw size={13} className={busy ? 'punch-spin' : ''} />
          </button>
        </div>
      </div>

      {!!data?.missedPunches?.length && (
        <div className="punch-missed-notice">
          <strong>Submit a correction for your missed punch-out</strong>
          <p>
            {data.missedPunches.map((d) => formatCalendarDate(d.date)).join(', ')} · Submit an ARS
            before starting today; the previous day stays invalid until approved.
          </p>
          <Button onClick={() => setDismissedMissed('')}>Resolve missed punch</Button>
        </div>
      )}

      {/* Main 2-column grid layout */}
      <div className="punch-cards-grid">
        {/* Left Column: Punch card + School location check card */}
        <div className="punch-left-column">
          {/* Left Card: Clock & Action */}
          <section className="punch-main-card" aria-label="Punch action and time">
            <div className="punch-main-card-header">Punch in & out</div>

            <div className="punch-main-card-body">
              <div className="punch-main-col-left">
                <p className="punch-main-date">{formatDateLong(now)}</p>
                <div className="punch-main-clock" aria-label="Current school time">
                  {formatTimeStr(now)}
                </div>

                {/* Status pill badge */}
                <div className="punch-badge-row">
                  {data?.punchOut ? (
                    <span className="punch-status-badge completed">
                      <CheckCircle2 size={13} /> Day Completed
                    </span>
                  ) : data?.active ? (
                    <span className="punch-status-badge on-duty">
                      <span className="punch-pulse-dot" /> On duty
                    </span>
                  ) : data?.state.code === 'HR_ON_LEAVE' ? (
                    <span className="punch-status-badge on-leave">
                      <CheckCircle2 size={13} /> On approved leave
                    </span>
                  ) : (
                    <span className="punch-status-badge ready">
                      <span className="punch-ready-dot" /> Ready to start
                    </span>
                  )}
                </div>

                {/* Large headline message */}
                <h2 className="punch-main-headline">
                  {data?.state.code === 'HR_ON_LEAVE'
                    ? 'On approved leave today'
                    : data?.attendanceClosed
                      ? data.attendanceSource === 'admin'
                        ? 'Attendance recorded by admin'
                        : 'Attendance correction'
                      : data?.punchOut
                        ? "You're all set for today"
                        : data?.active
                          ? 'Finish your school day'
                          : "Let's start your school day"}
                </h2>

                {/* Action Button */}
                {data?.state.code === 'HR_ON_LEAVE' ? (
                  <button className="punch-action-btn completed" disabled type="button">
                    On leave today
                  </button>
                ) : data?.punchOut ? (
                  <button className="punch-action-btn completed" disabled type="button">
                    Punch out <ArrowRight size={16} />
                  </button>
                ) : (
                  <button
                    type="button"
                    className="punch-action-btn active"
                    disabled={!!busy || !data?.state.allowed}
                    onClick={() => void act(true)}
                  >
                    {busy === 'punch'
                      ? 'Verifying your location…'
                      : data?.active
                        ? 'Punch out'
                        : 'Punch in'}
                    <ArrowRight size={16} />
                  </button>
                )}

                {/* Subtext note below button */}
                <p className="punch-action-subtext">
                  {data?.state.code === 'HR_ON_LEAVE'
                    ? 'Your leave is approved for today. Punch in and punch out are disabled while on leave.'
                    : data?.punchOut
                      ? "Today's punch-in and punch-out are already recorded."
                      : data?.active
                        ? 'Punch out when you leave. Your recorded times will appear on the right.'
                        : "We'll check your location and record your arrival securely."}
                </p>

                {data?.state.code !== 'HR_ON_LEAVE' && data?.state.reason && !data?.punchOut && (
                  <p className="punch-rule-warning">{data.state.reason}</p>
                )}
              </div>

              <div className="punch-main-col-right">
                <DeskIllustration />
              </div>
            </div>
          </section>

          {/* School Location Check Card matching user screenshot exactly */}
          <section
            className={`punch-location-card ${isWithinRange ? 'loc-in-range' : 'loc-out-of-range'}`}
            aria-label="School location check"
          >
            <div className="punch-loc-pin-box" aria-hidden="true">
              <svg
                width="42"
                height="56"
                viewBox="0 0 46 60"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="punch-loc-pin-svg"
              >
                <path
                  d="M23 2C12.5066 2 4 10.5066 4 21C4 32.5 20.5 54.5 22.1 56.6C22.5 57.1 23.5 57.1 23.9 56.6C25.5 54.5 42 32.5 42 21C42 10.5066 33.4934 2 23 2Z"
                  fill={isWithinRange ? '#5f8275' : '#ef4444'}
                  stroke={isWithinRange ? '#1c3b32' : '#991b1b'}
                  strokeWidth="2.5"
                  strokeLinejoin="round"
                />
                <circle
                  cx="23"
                  cy="21"
                  r="7"
                  fill="#ffffff"
                  stroke={isWithinRange ? '#1c3b32' : '#991b1b'}
                  strokeWidth="2.4"
                />
              </svg>
            </div>

            <div className="punch-loc-content-box">
              <h3 className="punch-loc-card-title">School location check</h3>

              <div className="punch-loc-badge-row">
                <span className={`punch-loc-pill ${isWithinRange ? 'in-range' : 'out-of-range'}`}>
                  {isWithinRange ? 'Within range' : 'Outside range'} •{' '}
                  {campusLocation.name} ({campusLocation.radius}m radius)
                </span>

                <button
                  type="button"
                  className="punch-loc-pill-btn"
                  disabled={!!busy || !data}
                  onClick={() => void act(false)}
                >
                  {busy === 'location' ? 'Locating…' : reading ? 'Check again' : 'Check my location'}
                </button>
              </div>

              <p className="punch-loc-subtext">
                {feedback ? feedback.message : 'Check your location before you punch.'}
              </p>
            </div>
          </section>
        </div>

        {/* Right Column: Today's Timeline / Attendance Log */}
        <div className="punch-right-column">
          <section className="punch-timeline-card" aria-label="Today's Timeline and recorded duration">
            <div className="punch-timeline-header">
              <h3 className="punch-timeline-title">Today's Timeline</h3>
              <span className="punch-timeline-subtitle">Attendance Log</span>
            </div>

            <div className="punch-timeline-stepper">
              <div className="punch-timeline-stem" aria-hidden="true" />

              {/* Punch In */}
              <div className="punch-timeline-item">
                <div className="punch-timeline-info">
                  <span className="punch-timeline-label">Punch In</span>
                  <strong className="punch-timeline-time">
                    {data?.punchIn ? formatTimeStr(data.punchIn) : '—'}
                  </strong>
                </div>
                <div className="punch-timeline-connector-wrap">
                  <span
                    className={`punch-timeline-dot ${data?.punchIn ? 'filled' : ''}`}
                    aria-hidden="true"
                  />
                  <div className="punch-timeline-icon-box" title="Punch In recorded">
                    <Clock3 size={16} />
                  </div>
                </div>
              </div>

              {/* Punch Out */}
              <div className="punch-timeline-item">
                <div className="punch-timeline-info">
                  <span className="punch-timeline-label">Punch Out</span>
                  <strong className="punch-timeline-time">
                    {data?.punchOut ? formatTimeStr(data.punchOut) : '—'}
                  </strong>
                </div>
                <div className="punch-timeline-connector-wrap">
                  <span
                    className={`punch-timeline-dot ${data?.punchOut ? 'filled' : ''}`}
                    aria-hidden="true"
                  />
                  <div className="punch-timeline-icon-box" title="Punch Out recorded">
                    <LogOut size={16} />
                  </div>
                </div>
              </div>
            </div>

            <div className="punch-timeline-duration-wrap">
              <div className="punch-duration-label">Approved Duration</div>
              <div className="punch-duration-val">
                {data?.attendanceClosed && !data.punchOut ? 'Not confirmed' : formatDurationHMS(seconds)}
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* Dialog for missed punches if needed */}
      {data && missed && dismissedMissed !== missed.id && (
        <ArsRequestDialog
          key={missed.id}
          day={{ ...missed, status: 'invalid' }}
          timezone={data.timezone}
          adapter={adapter}
          close={() => setDismissedMissed(missed.id)}
          saved={() => {
            setDismissedMissed(missed.id);
            void refresh();
          }}
        />
      )}

      {error && (
        <div role="alert" className="punch-error">
          <strong>We couldn’t confirm this action</strong>
          <p>{error}</p>
          <span>
            Your attendance has not been confirmed. Check the status above before retrying.
          </span>
        </div>
      )}
    </div>
  );
}
