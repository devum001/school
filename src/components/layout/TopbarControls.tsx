import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, ChevronDown } from 'lucide-react';
import { useSchool } from '../../app/useSchool';
import { Modal } from '../ui/Primitives';
import { notificationAttention, notificationReviewUrl } from '../../lib/communicationOverview';
import { displayDate } from '../../lib/config';
import './topbar-controls.css';

export default function TopbarControls() {
  const state = useSchool();
  const [dialog, setDialog] = useState<'year' | 'notifications' | null>(null);
  const attention = notificationAttention(state);
  return (
    <>
      <button
        className="year-chip"
        aria-label="Academic year details"
        onClick={() => setDialog('year')}
      >
        <span />
        {state.academicYear.name}
        <ChevronDown size={12} />
      </button>
      <button
        className="icon-button notification-bell"
        aria-label={`Notifications: ${attention.count} need attention`}
        onClick={() => setDialog('notifications')}
      >
        <Bell size={19} />
        {attention.count > 0 && (
          <span className="notification-count" aria-hidden="true">
            {attention.count > 99 ? '99+' : attention.count}
          </span>
        )}
      </button>
      <Modal
        open={dialog === 'year'}
        onClose={() => setDialog(null)}
        title="Academic Year"
        description="Current school session."
      >
        <dl className="topbar-year-details">
          <div>
            <dt>Academic year</dt>
            <dd>{state.academicYear.name}</dd>
          </div>
          <div>
            <dt>Starts</dt>
            <dd>{displayDate(state.academicYear.start)}</dd>
          </div>
          <div>
            <dt>Ends</dt>
            <dd>{displayDate(state.academicYear.end)}</dd>
          </div>
        </dl>
        <div className="modal-actions">
          <Link
            className="button secondary"
            to="/settings?tab=Preferences"
            onClick={() => setDialog(null)}
          >
            Academic year preferences
          </Link>
        </div>
      </Modal>
      <Modal
        open={dialog === 'notifications'}
        onClose={() => setDialog(null)}
        title="Notifications"
        description={`${attention.count} alerts and failed messages need attention.`}
      >
        <div className="topbar-alert-list">
          {attention.pending.map((group) => (
            <Link
              key={`${group.date}:${group.event}`}
              to={notificationReviewUrl(group.event, group.date, attention.records)}
              onClick={() => setDialog(null)}
            >
              <span>
                <strong>{group.event}</strong>
                <small>{displayDate(group.date)} · Pending review</small>
              </span>
              <b>{group.recipients.size}</b>
            </Link>
          ))}
          {attention.failed > 0 && (
            <Link
              to="/notifications?tab=History&historyStatus=Failed"
              onClick={() => setDialog(null)}
            >
              <span>
                <strong>Failed notifications</strong>
                <small>Review and retry</small>
              </span>
              <b>{attention.failed}</b>
            </Link>
          )}
          {attention.count === 0 && <p>No notifications need attention.</p>}
        </div>
        <div className="modal-actions">
          <Link className="button secondary" to="/notifications" onClick={() => setDialog(null)}>
            Open Notifications
          </Link>
        </div>
      </Modal>
    </>
  );
}
