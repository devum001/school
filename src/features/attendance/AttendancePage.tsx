import { useToday } from '../../app/useToday';
import { useEffect, useState } from 'react';
import { Link, useBlocker, useSearchParams } from 'react-router-dom';
import { CalendarCheck, CheckCheck, Save, Send, CircleAlert } from 'lucide-react';
import { useSchool } from '../../app/useSchool';
import { useFeedback } from '../../app/useFeedback';
import { Avatar, Badge, Button, Modal, PageHeading, Panel } from '../../components/ui/Primitives';
import { ClassFilters } from '../../components/shared/ClassFilters';
import { attendanceSummary, roster, statusFor } from '../../lib/selectors';
import { STATUS_LABELS, displayDate } from '../../lib/config';
import { repository } from '../../lib/repository';
import type { AttendanceStatus } from '../../types/domain';
const statuses = Object.keys(STATUS_LABELS) as AttendanceStatus[];
export default function AttendancePage() {
  const [params] = useSearchParams();
  return <AttendanceRegister key={params.toString()} />;
}
function AttendanceRegister() {
  const state = useSchool();
  const today = useToday();
  const notify = useFeedback();
  const [params, setParams] = useSearchParams();
  const requested = params.get('class');
  const classId = state.classes.some((c) => c.id === requested) ? requested! : 'class-5';
  const sections = state.sections.filter((s) => s.classId === classId);
  const sectionId = sections.some((s) => s.id === params.get('section'))
    ? params.get('section')!
    : sections[0].id;
  const [openedDate] = useState(today);
  const requestedDate = params.get('date') ?? openedDate;
  const date =
    /^\d{4}-\d{2}-\d{2}$/.test(requestedDate) &&
    requestedDate <= today &&
    requestedDate >= state.academicYear.start
      ? requestedDate
      : today;
  const rows = roster(state).filter((r) => r.enrollment.sectionId === sectionId);
  const [draft, setDraft] = useState<Record<string, AttendanceStatus>>({});
  const [error, setError] = useState('');
  const dirty = Object.entries(draft).some(([id, status]) => statusFor(state, id, date) !== status);
  const summary = attendanceSummary(
    rows.map((r) => draft[r.enrollment.id] ?? statusFor(state, r.enrollment.id, date)),
  );
  const blocker = useBlocker(dirty);
  useEffect(() => {
    const handle = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handle);
    return () => window.removeEventListener('beforeunload', handle);
  }, [dirty]);
  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    next.set(key, value);
    if (key === 'class') next.delete('section');
    setParams(next);
  };
  const save = () => {
    try {
      repository.saveAttendance(
        date,
        sectionId,
        Object.fromEntries(
          rows.map((r) => [
            r.enrollment.id,
            draft[r.enrollment.id] ?? statusFor(state, r.enrollment.id, date),
          ]),
        ),
      );
      setDraft({});
      setError('');
      notify('Attendance saved. Dashboard and student profiles are up to date.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to save attendance.');
    }
  };
  return (
    <>
      <PageHeading
        eyebrow="EVERY STUDENT COUNTS"
        title="Attendance register"
        description="A small daily habit. A better picture of every learner."
        actions={
          <Link
            className="button secondary"
            to={`/notifications?date=${date}&class=${classId}&section=${sectionId}`}
          >
            <Send size={16} />
            Notify parents
          </Link>
        }
      />
      <Panel>
        <div className="toolbar attendance-toolbar">
          <label className="filter-label">
            <span>Attendance date</span>
            <input
              aria-label="Attendance date"
              type="date"
              value={date}
              min={state.academicYear.start}
              max={today}
              onChange={(e) => {
                if (e.target.value) update('date', e.target.value);
              }}
            />
          </label>
          <ClassFilters
            classId={classId}
            sectionId={sectionId}
            onClassChange={(v) => update('class', v)}
            onSectionChange={(v) => update('section', v)}
            allowAll={false}
          />
          <div className="register-context">
            <CalendarCheck size={18} />
            <span>
              <strong>{state.academicYear.name}</strong>
              <small>Academic year</small>
            </span>
          </div>
        </div>
      </Panel>
      <div className="attendance-summary">
        {[
          { label: 'Students', value: summary.total, tone: '' },
          { label: 'Present', value: summary.present, tone: 'green' },
          { label: 'Absent', value: summary.absent, tone: 'red' },
          {
            label: 'Late / half day',
            value: `${summary.late} / ${summary['half-day']}`,
            tone: 'amber',
          },
          { label: 'Not marked', value: summary.unmarked, tone: 'neutral' },
        ].map((s) => (
          <div className="panel" key={s.label}>
            <span>{s.label}</span>
            <strong className={`text-${s.tone}`}>{s.value}</strong>
          </div>
        ))}
      </div>
      <Panel
        title={`${state.classes.find((c) => c.id === classId)?.name} · Section ${sections.find((s) => s.id === sectionId)?.name}`}
        subtitle={`${rows.length} active students · ${displayDate(date)}`}
        action={
          <Button
            variant="secondary"
            onClick={() =>
              setDraft(Object.fromEntries(rows.map((r) => [r.enrollment.id, 'present'])))
            }
          >
            <CheckCheck size={16} />
            Mark all present
          </Button>
        }
      >
        <div className="info-banner inline">
          <CircleAlert size={16} />
          Not marked is a separate status. It is never counted as absent.
        </div>
        <div className="table-wrap">
          <table className="attendance-table">
            <thead>
              <tr>
                <th>Roll no.</th>
                <th>Student</th>
                <th>Admission number</th>
                <th>Attendance status</th>
                <th>Record</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const status = draft[r.enrollment.id] ?? statusFor(state, r.enrollment.id, date);
                return (
                  <tr key={r.enrollment.id}>
                    <td className="mono">{String(r.enrollment.rollNumber).padStart(2, '0')}</td>
                    <td>
                      <Link className="person" to={`/students/${r.student.id}`}>
                        <Avatar name={r.student.name} />
                        <strong>{r.student.name}</strong>
                      </Link>
                    </td>
                    <td className="mono muted">{r.student.admissionNumber}</td>
                    <td>
                      <div
                        className="status-options"
                        role="group"
                        aria-label={`${r.student.name} attendance`}
                      >
                        {statuses.map((s) => (
                          <button
                            key={s}
                            aria-pressed={status === s}
                            className={status === s ? `selected ${s}` : ''}
                            onClick={() => setDraft({ ...draft, [r.enrollment.id]: s })}
                          >
                            {STATUS_LABELS[s]}
                          </button>
                        ))}
                      </div>
                    </td>
                    <td>
                      <Badge tone={status}>{STATUS_LABELS[status]}</Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="save-bar">
          <div>
            <span className={`status-dot ${dirty ? 'pending' : 'active'}`} />
            <strong>{dirty ? 'Unsaved changes' : 'Register up to date'}</strong>
            <small>
              {summary.attended} attending / {summary.marked} marked · {summary.percentage}%
              attendance
            </small>
          </div>
          <Button onClick={save}>
            <Save size={16} />
            Save attendance
          </Button>
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
      </Panel>
      <div className="panel-note">
        Choose a date to review attendance. Save changes to update student profiles and the
        dashboard.
      </div>
      <Modal
        open={blocker.state === 'blocked'}
        onClose={() => blocker.state === 'blocked' && blocker.reset()}
        title="Leave unsaved attendance?"
        description="Your attendance changes have not been saved. Stay to save them, or discard this draft."
      >
        <div className="modal-actions">
          <Button
            variant="secondary"
            onClick={() => blocker.state === 'blocked' && blocker.reset()}
          >
            Keep editing
          </Button>
          <Button variant="danger" onClick={() => blocker.state === 'blocked' && blocker.proceed()}>
            Discard and leave
          </Button>
        </div>
      </Modal>
    </>
  );
}
