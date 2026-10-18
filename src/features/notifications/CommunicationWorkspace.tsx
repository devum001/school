import TabRail from '../../components/ui/TabRail';
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useSchool } from '../../app/useSchool';
import { useToday } from '../../app/useToday';
import { PickerInput, Button, PageHeading } from '../../components/ui/Primitives';
import { notificationReviewUrl } from '../../lib/communicationOverview';
import { communicationFor } from '../../lib/communication';
import { ACTIVE_EVENTS, EVENTS, SYSTEM_EVENTS } from '../../lib/communicationConfig';
import { repository } from '../../lib/repository';
import { displayDate } from '../../lib/config';
import CommunicationQueue from './CommunicationQueue';
import CommunicationHistory from './CommunicationHistory';
import SendNotice from './SendNotice';
import './communication.css';
import '../../styles/admin-settings.css';

const tabs = ['Overview', 'Compose Notice', 'History'] as const;
export default function CommunicationWorkspace() {
  const state = useSchool(),
    today = useToday(),
    [params, setParams] = useSearchParams();
  const requestedTab = params.get('tab') === 'Send Notice' ? 'Compose Notice' : params.get('tab');
  const tab = tabs.find((value) => value === requestedTab) ?? 'Overview';
  const requestedDate = params.get('date'),
    date =
      requestedDate &&
      /^\d{4}-\d{2}-\d{2}$/.test(requestedDate) &&
      requestedDate <= today &&
      requestedDate >= state.academicYear.start
        ? requestedDate
        : today;
  const communication = communicationFor(state),
    all = communication.records.filter((r) => r.schoolId === state.school.id),
    pending = all.filter((r) => r.status === 'Pending'),
    failed = all.filter((r) => r.status === 'Failed');
  const [error, setError] = useState('');
  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        repository.refreshCommunication(date);
      } catch {
        setError('Unable to refresh communication. Check browser storage and retry.');
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [date]);
  const updateMany = (values: Record<string, string>) =>
    setParams((previous) => {
      const next = new URLSearchParams(previous);
      for (const [key, value] of Object.entries(values)) {
        if (value) next.set(key, value);
        else next.delete(key);
      }
      return next;
    });
  const update = (key: string, value: string) => updateMany({ [key]: value });
  const chooseTab = (value: string) => update('tab', value);
  const reviewEvent = (event: string) => {
    if (event === 'Compose Notice') {
      setParams({ tab: 'Compose Notice', event });
      return;
    }
    setParams(new URLSearchParams(notificationReviewUrl(event, today, all).split('?')[1]));
  };
  const eventFilter =
    params.get('event') ?? (params.get('date') && !params.get('tab') ? 'Student Absent' : 'all');
  useEffect(() => {
    if (tab !== 'Overview' || params.get('focus') !== 'pending') return;
    const timer = window.setTimeout(() => {
      const target = document.getElementById('pending-alerts');
      target?.scrollIntoView({ block: 'start', behavior: 'instant' });
      target?.focus({ preventScroll: true });
    }, 50);
    return () => window.clearTimeout(timer);
  }, [tab, params]);
  const filtered = all.filter(
    (r) =>
      r.date === date &&
      (eventFilter === 'all' || r.event === eventFilter) &&
      (!params.get('class') || r.recipient.classId === params.get('class')) &&
      (!params.get('section') || r.recipient.sectionId === params.get('section')),
  );
  const alertCount = (
    event: string,
    records = all.filter((r) => r.date === today && r.status !== 'Cancelled'),
  ) =>
    new Set(
      records
        .filter((r) => r.event === event)
        .map((r) =>
          ['Test Scheduled', 'Result Published'].includes(event)
            ? r.key.split(':')[2]
            : SYSTEM_EVENTS.some((e) => e === event)
              ? (r.recipient.enrollmentId ?? r.recipient.id)
              : r.key.split(':')[0],
        ),
    ).size;
  return (
    <div className="communication-workspace">
      <PageHeading
        title="Notifications"
        actions={
          <Link className="button secondary" to="/settings?tab=Communication">
            Communication Settings
          </Link>
        }
      />
      <TabRail className="communication-tabs" role="tablist" aria-label="Notifications">
        {tabs.map((value, index) => (
          <button
            role="tab"
            key={value}
            id={`communication-tab-${index}`}
            aria-controls="communication-panel"
            aria-selected={tab === value}
            tabIndex={tab === value ? 0 : -1}
            onClick={() => chooseTab(value)}
            onKeyDown={(e) => {
              if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(e.key)) return;
              e.preventDefault();
              const next =
                e.key === 'Home'
                  ? 0
                  : e.key === 'End'
                    ? tabs.length - 1
                    : (index + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length;
              chooseTab(tabs[next]);
              document.getElementById(`communication-tab-${next}`)?.focus();
            }}
          >
            {value}
          </button>
        ))}
      </TabRail>
      {error && (
        <p className="form-error" role="alert">
          {error}
          <Button
            variant="ghost"
            onClick={() => {
              try {
                repository.refreshCommunication(date);
                setError('');
              } catch {
                setError('Browser storage is unavailable.');
              }
            }}
          >
            Retry
          </Button>
        </p>
      )}
      <div
        id="communication-panel"
        role="tabpanel"
        aria-labelledby={`communication-tab-${tabs.indexOf(tab)}`}
        tabIndex={0}
      >
        {tab === 'Overview' && (
          <>
            <div className="communication-overview-heading">
              <h2>Today’s communication</h2>
              <span>{displayDate(today)}</span>
            </div>
            <div className="communication-stats">
              {[
                ['Student Absent', 'Student Absent alerts'],
                ['Low Attendance', 'Low Attendance alerts'],
                ['Fee Installment Due', 'Fee Installments Due'],
                ['Fee Installment Overdue', 'Fee Installments Overdue'],
                ['Event / Announcement', 'Events / Announcements'],
                ['Compose Notice', 'Compose Notice'],
              ].map(([event, label]) => (
                <button
                  className="panel communication-stat"
                  key={event}
                  onClick={() => reviewEvent(event)}
                >
                  <strong>{event === 'Compose Notice' ? '+' : alertCount(event)}</strong>
                  <span>
                    {label}
                    {SYSTEM_EVENTS.some((value) => value === event) && alertCount(event) > 0 && (
                      <small className="communication-cell-note">
                        {alertCount(
                          event,
                          pending.filter((record) => record.date === today),
                        )}{' '}
                        pending
                      </small>
                    )}
                    {event.startsWith('Fee Installment') && (
                      <small style={{ display: 'block' }}>students</small>
                    )}
                  </span>
                </button>
              ))}
              <button
                className="panel communication-stat failed"
                onClick={() => {
                  setParams({ historyStatus: 'Failed', tab: 'History' });
                }}
              >
                <strong>{failed.length}</strong>
                <span>Failed notifications</span>
              </button>
            </div>
          </>
        )}
        {tab === 'Compose Notice' && (
          <SendNotice
            key={params.get('event') ?? 'notice'}
            initialEvent={EVENTS.find((event) => event === params.get('event'))}
            onSent={() =>
              updateMany({
                tab: 'History',
                historyStatus: '',
                historyType: '',
                historyDate: '',
                historyClass: '',
                historyChannel: '',
              })
            }
          />
        )}
        {tab === 'History' && <CommunicationHistory />}
        {tab === 'Overview' && (
          <>
            <div className="communication-filters">
              <label>
                Notification type
                <select
                  aria-label="Notification type"
                  value={eventFilter}
                  onChange={(e) => update('event', e.target.value)}
                >
                  <option value="all">All types</option>
                  {ACTIVE_EVENTS.map((event) => (
                    <option key={event}>{event}</option>
                  ))}
                </select>
              </label>
              <label>
                Notification date
                <PickerInput
                  type="date"
                  value={date}
                  min={state.academicYear.start}
                  max={today}
                  onChange={(e) => {
                    if (e.target.value) update('date', e.target.value);
                  }}
                />
              </label>
              <label>
                Class
                <select
                  aria-label="Class"
                  value={params.get('class') ?? ''}
                  onChange={(e) => {
                    updateMany({ class: e.target.value, section: '' });
                  }}
                >
                  <option value="">All classes</option>
                  {state.classes
                    .filter((c) => c.schoolId === state.school.id)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </select>
              </label>
            </div>
            <div id="pending-alerts" tabIndex={-1} className="pending-alert-focus">
              <CommunicationQueue
                records={filtered}
                onSent={() =>
                  updateMany({
                    tab: 'History',
                    historyStatus: '',
                    historyType: '',
                    historyDate: '',
                    historyClass: '',
                    historyChannel: '',
                  })
                }
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
