import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import { Modal, AppIcon } from '../ui/Primitives';
import { notificationAttention, notificationReviewUrl } from '../../lib/communicationOverview';
import { displayDate } from '../../lib/config';
import './topbar-controls.css';

export default function TopbarControls({
  academicYear,
  attention,
  showNotifications = true,
}: {
  showNotifications?: boolean;
  academicYear?: { name: string; start: string; end: string } | null;
  attention?: ReturnType<typeof notificationAttention>;
}) {
  const [dialog, setDialog] = useState<'year' | 'notifications' | null>(null);
  return (
    <>
      <button
        className="year-chip"
        aria-label="Academic year details"
        onClick={() => setDialog('year')}
      >
        <span />
        {academicYear?.name ?? 'Not configured'}
        <ChevronDown size={12} />
      </button>
      {showNotifications && (
        <button
          className="icon-button notification-bell"
          aria-label={
            attention ? `Notifications: ${attention.count} need attention` : 'Notifications'
          }
          onClick={() => setDialog('notifications')}
        >
          <AppIcon name="notifications" size={20} />
          {attention && attention.count > 0 && (
            <span className="notification-count" aria-hidden="true">
              {attention.count > 99 ? '99+' : attention.count}
            </span>
          )}
        </button>
      )}
      <Modal
        open={dialog === 'year'}
        onClose={() => setDialog(null)}
        title="Academic Year"
        description="Current school session."
      >
        <dl className="topbar-year-details">
          <div>
            <dt>Academic year</dt>
            <dd>{academicYear?.name ?? 'Not configured'}</dd>
          </div>
          <div>
            <dt>Starts</dt>
            <dd>{academicYear ? displayDate(academicYear.start) : 'Not configured'}</dd>
          </div>
          <div>
            <dt>Ends</dt>
            <dd>{academicYear ? displayDate(academicYear.end) : 'Not configured'}</dd>
          </div>
        </dl>
        <div className="modal-actions">
          <Link
            className="button secondary"
            to="/settings?tab=Preferences&section=context"
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
        description={
          attention
            ? `${attention.count} alerts and failed messages need attention.`
            : 'School notifications.'
        }
      >
        <div className="topbar-alert-list">
          {!attention && (
            <p>Notification delivery and attention counts are not connected in Phase 1.</p>
          )}
          {attention?.pending.map((group) => (
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
          {attention && attention.failed > 0 && (
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
          {attention && attention.count === 0 && <p>No notifications need attention.</p>}
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
