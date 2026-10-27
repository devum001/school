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
  LocateFixed,
  LogIn,
  LogOut,
  MapPin,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import { Button, PageHeading } from '../../components/ui/Primitives';
import { useSession } from '../auth/useSession';
import { useLiveSchool } from '../live/schoolContext';
import { useTeacherPunch } from './useTeacherPunch';
import { punchLocationFeedback } from './punchLocationFeedback';
import './teacher-punch.css';

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
  const time = (value: number | string) =>
    new Intl.DateTimeFormat('en-IN', {
      timeZone: data?.timezone,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    }).format(new Date(value));
  const feedback =
    reading && data ? punchLocationFeedback(reading, data.locationPolicy, tick) : undefined;
  const seconds = data?.punchIn
    ? Math.max(
        0,
        Math.floor(
          ((data.punchOut ? Date.parse(data.punchOut) : now) - Date.parse(data.punchIn)) / 1000,
        ),
      )
    : 0;
  const elapsed = `${String(Math.floor(seconds / 3600)).padStart(2, '0')}:${String(Math.floor(seconds / 60) % 60).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  return (
    <div className="punch-page" aria-label="My school punch" role="region">
      <PageHeading title="Punch in & out" description="Your school day, in one place." />
      <div className="punch-page-links">
        <span>
          <MapPin size={16} />
          {schoolName}
        </span>
        <Link to="/staff/self">
          <CalendarDays size={16} />
          My attendance & salary
          <ArrowRight size={16} />
        </Link>
        <Link to="/staff/self?view=requests">ARS</Link>
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
      <section className="punch-clock-panel">
        <div className="punch-clock-main">
          <span className={`punch-state ${data?.active ? 'on-duty' : ''}`} role="status">
            <span />
            {!data
              ? 'Loading your school day…'
              : data.active
                ? data.attendanceStatus === 'half-day'
                  ? 'On duty · Half day'
                  : data.late
                    ? 'On duty · Late arrival'
                    : 'On duty'
                : data.punchOut
                  ? 'School day completed'
                  : data.attendanceClosed
                    ? 'Attendance correction'
                    : 'Ready to start your day'}
          </span>
          <p className="punch-date">
            {data
              ? new Intl.DateTimeFormat('en-IN', {
                  timeZone: data.timezone,
                  weekday: 'long',
                  day: '2-digit',
                  month: 'long',
                  year: 'numeric',
                }).format(new Date(now))
              : 'School local time'}
          </p>
          <div className="punch-live-clock" aria-label="Current school time">
            {data ? time(now) : '—'}
          </div>
          <p className="punch-timezone">{data?.timezone ?? 'Loading timezone…'}</p>
          <p className="punch-shift">
            <Clock3 size={16} />
            School hours {data ? `${data.schedule.start} – ${data.schedule.end}` : '—'}
          </p>
        </div>
        <div className="punch-clock-action">
          <div className="punch-action-symbol">
            {data?.punchOut ? (
              <CheckCircle2 size={34} />
            ) : data?.active ? (
              <LogOut size={34} />
            ) : (
              <LogIn size={34} />
            )}
          </div>
          <h2>
            {data?.attendanceClosed
              ? 'Attendance correction'
              : data?.punchOut
                ? 'You’re all set for today'
                : data?.active
                  ? 'Finish your school day'
                  : 'Let’s start your school day'}
          </h2>
          <p>
            {data?.attendanceClosed
              ? 'View your correction in the ARS tab.'
              : data?.punchOut
                ? 'Your arrival and departure have been recorded.'
                : data?.active
                  ? 'Punch out when you leave. Your recorded times will appear below.'
                  : 'We’ll check your location and record your arrival securely.'}
          </p>
          <Button
            className="punch-primary"
            disabled={!!busy || !data?.state.allowed}
            onClick={() => void act(true)}
          >
            {busy === 'punch'
              ? 'Verifying your location…'
              : data?.attendanceClosed
                ? 'View ARS status'
                : data?.active || data?.punchOut
                  ? 'Punch out'
                  : 'Punch in'}
            {data?.active ? <LogOut size={18} /> : <LogIn size={18} />}
          </Button>
          {data?.state.reason && <p className="punch-rule-note">{data.state.reason}</p>}
          <button className="punch-refresh" disabled={!!busy} onClick={() => void refresh()}>
            <RefreshCw size={14} />
            Refresh status
          </button>
        </div>
      </section>
      <section className="punch-today" aria-label="Today’s recorded times">
        {[
          ['Punch in', data?.punchIn ? time(data.punchIn) : 'Not recorded'],
          ['Punch out', data?.punchOut ? time(data.punchOut) : 'Not recorded'],
          [
            data?.attendanceSource ? 'Approved duration' : 'Recorded duration',
            data?.attendanceClosed && !data.punchOut ? 'Not confirmed' : elapsed,
          ],
        ].map(([label, value]) => (
          <div key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </section>
      <section
        className={`punch-location-panel ${feedback ? (feedback.ok ? 'location-ok' : 'location-review') : ''}`}
      >
        <div className="punch-location-heading">
          <div>
            <h2>
              <ShieldCheck size={20} />
              School location check
            </h2>
            <p>{feedback?.title ?? 'Check your location before you punch.'}</p>
          </div>
          <Button variant="secondary" disabled={!!busy || !data} onClick={() => void act(false)}>
            <LocateFixed size={16} />
            {busy === 'location' ? 'Locating…' : reading ? 'Check again' : 'Check my location'}
          </Button>
        </div>
        {feedback ? (
          <>
            <div className="punch-location-metrics">
              <div>
                <span>Distance to {feedback.campus?.name ?? 'campus'}</span>
                <strong>
                  {feedback.campus ? `${Math.round(feedback.campus.distance)} m` : '—'}
                </strong>
              </div>
              <div>
                <span>Allowed radius</span>
                <strong>{feedback.campus ? `${feedback.campus.radius} m` : 'Not set'}</strong>
              </div>
              <div>
                <span>Your GPS accuracy</span>
                <strong>±{Math.round(feedback.accuracy)} m</strong>
              </div>
              <div>
                <span>Required accuracy</span>
                <strong>±{data?.locationPolicy.maxAccuracy} m or better</strong>
              </div>
            </div>
            <p>{feedback.message}</p>
          </>
        ) : (
          <p>
            Allow location access when asked. We only check it when you choose Check my location or
            punch in/out.
          </p>
        )}
        {!reading && data && (
          <p className="punch-location-campus">
            {data.locationPolicy.locations
              .map((l) => `${l.name} · ${l.radius} m radius`)
              .join('  /  ') || 'Your administrator needs to configure a school location.'}
          </p>
        )}
      </section>
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
