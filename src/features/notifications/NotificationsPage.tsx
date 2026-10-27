import SectionNavigation from '../../components/shared/SectionNavigation';
import { useToday } from '../../app/useToday';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import { useSchool } from '../../app/useSchool';
import { useFeedback } from '../../app/useFeedback';
import {
  PickerInput,
  Avatar,
  Badge,
  Button,
  EmptyState,
  Modal,
  PageHeading,
  Panel,
  AppIcon,
} from '../../components/ui/Primitives';
import { ClassFilters } from '../../components/shared/ClassFilters';
import { eligibleRecipients, roster, statusFor } from '../../lib/selectors';
import { displayDate } from '../../lib/config';
import { NotificationPreview } from './NotificationPreview';
import { repository } from '../../lib/repository';
export default function NotificationsPage() {
  const state = useSchool();
  const today = useToday();
  const notify = useFeedback();
  const [params] = useSearchParams();
  const [selectedDate, setDate] = useState<string | null>(params.get('date'));
  const date = selectedDate ?? today;
  const [classId, setClass] = useState(params.get('class') ?? '');
  const [sectionId, setSection] = useState(params.get('section') ?? '');
  const [selected, setSelected] = useState<string[]>([]);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('compose');
  const rows = roster(state).filter(
    (r) =>
      statusFor(state, r.enrollment.id, date) === 'absent' &&
      (!classId || r.enrollment.classId === classId) &&
      (!sectionId || r.enrollment.sectionId === sectionId),
  );
  const selectedVisible = selected.filter((id) => rows.some((r) => r.enrollment.id === id));
  const eligible = eligibleRecipients(state, selectedVisible, date);
  const toggle = (id: string) =>
    setSelected(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]);
  const dispatch = () => {
    try {
      repository.dispatchNotifications(
        eligible.map((r) => r.enrollment.id),
        date,
      );
      setConfirm(false);
      setSelected([]);
      setTab('history');
      notify(`Notifications prepared for ${eligible.length} recipients.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Notifications could not be prepared.');
      setConfirm(false);
    }
  };
  return (
    <>
      <PageHeading
        title="Parent notifications"
        actions={
          <Badge tone="amber">
            <AppIcon name="security" size={14} />
            Attendance notices
          </Badge>
        }
      />
      <SectionNavigation
        label="Notifications"
        value={tab}
        onChange={(value: string) => setTab(value as 'compose' | 'history')}
        items={[
          { id: 'compose', label: 'Compose notice', icon: 'send' },
          { id: 'history', label: 'Notification history', icon: 'inbox', badge: state.notifications.length },
        ]}
      />
      <div className="info-banner">
        <AppIcon name="security" size={18} />
        <span>
          Select absent students, review the Hindi message, and confirm the recipients. Students
          without a parent contact are excluded.
        </span>
      </div>
      {tab === 'compose' ? (
        <>
          <div className="toolbar standalone">
            <label className="filter-label">
              <span>Attendance date</span>
              <PickerInput
                type="date"
                aria-label="Notification attendance date"
                value={date}
                min={state.academicYear.start}
                max={today}
                onChange={(e) => {
                  if (e.target.value) {
                    setDate(e.target.value);
                    setSelected([]);
                  }
                }}
              />
            </label>
            <ClassFilters
              classId={classId}
              sectionId={sectionId}
              onSectionChange={(v) => {
                setSection(v);
                setSelected([]);
              }}
              onClassChange={(v) => {
                setClass(v);
                setSection('');
                setSelected([]);
              }}
            />
          </div>
          <div className="notification-grid">
            <Panel
              title="Absent students"
              subtitle={`${rows.length} students marked absent on ${displayDate(date)}`}
              action={
                <Button
                  variant="ghost"
                  onClick={() =>
                    setSelected(
                      selectedVisible.length === rows.length
                        ? []
                        : rows.map((r) => r.enrollment.id),
                    )
                  }
                >
                  {rows.length > 0 && selectedVisible.length === rows.length
                    ? 'Deselect all'
                    : 'Select all'}
                </Button>
              }
            >
              <div className="recipient-list">
                {rows.map((r) => (
                  <label className="recipient-row" key={r.enrollment.id}>
                    <input
                      type="checkbox"
                      checked={selected.includes(r.enrollment.id)}
                      onChange={() => toggle(r.enrollment.id)}
                      aria-label={`Select ${r.student.name}`}
                    />
                    <Avatar name={r.student.name} />
                    <span className="recipient-details">
                      <strong>{r.student.name}</strong>
                      <small>
                        {r.className} · Section {r.sectionName} · {r.student.guardian.name}
                      </small>
                    </span>
                    <Badge tone={r.student.guardian.contact ? 'green' : 'amber'}>
                      {r.student.guardian.contact ? 'Contact ready' : 'No contact'}
                    </Badge>
                  </label>
                ))}
              </div>
              {!rows.length && (
                <EmptyState
                  title="Everyone accounted for"
                  description="No saved absences for these filters. Mark and save attendance to compose a notice."
                  action={
                    <Link className="button secondary" to={`/attendance?date=${date}`}>
                      Open attendance
                    </Link>
                  }
                />
              )}
              <div className="panel-note">
                {selectedVisible.length} selected · {eligible.length} eligible ·{' '}
                {selectedVisible.length - eligible.length} missing a contact
              </div>
            </Panel>
            <NotificationPreview
              schoolName={state.school.name}
              date={date}
              eligible={eligible}
              selectedCount={selectedVisible.length}
              onReview={() => setConfirm(true)}
            />
          </div>
        </>
      ) : (
        <Panel
          title="Notification history"
          subtitle="Prepared attendance notices and records requiring attention"
        >
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Attendance date</th>
                  <th>Channel</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {state.notifications.map((n) => {
                  const row = roster(state, true).find((r) => r.enrollment.id === n.enrollmentId);
                  return (
                    <tr key={n.id}>
                      <td>
                        <Link className="person" to={`/students/${row?.student.id}`}>
                          <Avatar name={row?.student.name ?? ''} />
                          <span>
                            <strong>{row?.student.name}</strong>
                            <small>
                              {row?.className} · {row?.sectionName}
                            </small>
                          </span>
                        </Link>
                      </td>
                      <td>{displayDate(n.attendanceDate)}</td>
                      <td>WhatsApp</td>
                      <td>
                        <Badge tone={n.status === 'simulated-success' ? 'green' : 'red'}>
                          {n.status === 'simulated-success' ? (
                            <CheckCircle2 size={13} />
                          ) : (
                            <AlertCircle size={13} />
                          )}{' '}
                          {n.status === 'simulated-success' ? 'Ready' : 'Needs attention'}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {!state.notifications.length && (
            <EmptyState
              title="Your communication story starts here"
              description="Prepare an attendance notice to see its record here."
            />
          )}
        </Panel>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <Modal
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Confirm parent notifications"
        description={`${eligible.length} eligible recipients will be processed. ${selectedVisible.length - eligible.length} selected students without contacts will be skipped.`}
      >
        <div className="info-banner">
          Please check the selected students and their attendance date before confirming.
        </div>
        <div className="modal-actions">
          <Button variant="secondary" onClick={() => setConfirm(false)}>
            Cancel
          </Button>
          <Button onClick={dispatch}>
            <AppIcon name="send" size={16} />
            Confirm notifications
          </Button>
        </div>
      </Modal>
    </>
  );
}
