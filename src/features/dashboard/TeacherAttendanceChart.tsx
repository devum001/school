import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Panel } from '../../components/ui/Primitives';
import { formatCalendarDate } from '../../lib/displayFormat';
import './teacher-attendance-chart.css';

export default function TeacherAttendanceChart({
  summary,
  registerUrl,
}: {
  summary: { date: string; total: number; counts: Record<string, number> };
  registerUrl?: string;
}) {
  const count = (key: string) => summary.counts[key] || 0;
  const present = count('present') + count('late') + count('half-day');
  const rows = [
    { key: 'present', label: 'Present', count: present, color: '#348775' },
    { key: 'absent', label: 'Absent', count: count('absent'), color: '#b34249' },
    { key: 'leave', label: 'On leave', count: count('leave'), color: '#aa4b79' },
    ...(count('invalid')
      ? [{ key: 'invalid', label: 'Invalid punch', count: count('invalid'), color: '#35414a' }]
      : []),
    ...(count('off') + count('holiday')
      ? [
          {
            key: 'off',
            label: 'Day off / holiday',
            count: count('off') + count('holiday'),
            color: '#ca925b',
          },
        ]
      : []),
  ];
  const total = Math.max(summary.total, 1),
    circumference = 2 * Math.PI * 64;
  return (
    <Panel
      title="Teacher attendance"
      subtitle={`Selected day · ${formatCalendarDate(summary.date)}`}
      className="teacher-attendance-panel"
      action={
        registerUrl && (
          <Link className="text-link" to={registerUrl}>
            View register <ArrowRight size={15} />
          </Link>
        )
      }
    >
      <div className="teacher-attendance-body">
        <div
          className="teacher-attendance-ring"
          role="img"
          aria-label={`${present} of ${summary.total} teachers present; ${count('absent')} absent; ${count('leave')} on leave`}
        >
          <svg viewBox="0 0 160 160" aria-hidden="true">
            <circle className="teacher-ring-track" cx="80" cy="80" r="64" />
            {rows.map((row, index) => (
              <circle
                key={row.key}
                cx="80"
                cy="80"
                r="64"
                fill="none"
                stroke={row.color}
                strokeWidth="12"
                strokeDasharray={`${(row.count / total) * circumference} ${circumference}`}
                strokeDashoffset={
                  (-rows.slice(0, index).reduce((sum, r) => sum + r.count, 0) / total) *
                  circumference
                }
                transform="rotate(-90 80 80)"
              />
            ))}
          </svg>
          <div>
            <strong>
              {present}
              <small> / {summary.total}</small>
            </strong>
            <span>Present</span>
          </div>
        </div>
        <div className="teacher-attendance-distribution">
          <div className="teacher-attendance-rows">
            {rows.map((row) => (
              <div className="teacher-attendance-row" key={row.key}>
                <span>
                  <i style={{ background: row.color }} />
                  {row.label}
                </span>
                <div className="teacher-attendance-meter" aria-hidden="true">
                  <i style={{ width: `${(row.count / total) * 100}%`, background: row.color }} />
                </div>
                <strong>{row.count}</strong>
              </div>
            ))}
          </div>
          <div className="teacher-attendance-details">
            <span className="teacher-late-chip">{count('late')} Late</span>
            <span className="teacher-half-chip">{count('half-day')} Half day</span>
            <small>Included in Present</small>
          </div>
          {count('pending') > 0 && (
            <p className="teacher-attendance-note">
              {count('pending')} awaiting a punch · absence is confirmed after school closes.
            </p>
          )}
          {count('unmarked') > 0 && (
            <p className="teacher-attendance-note">
              {count('unmarked')} without tracked attendance on this date. Tracking starts with the
              first punch.
            </p>
          )}
          {!summary.total && (
            <p className="teacher-attendance-note">No active teachers on this date.</p>
          )}
        </div>
      </div>
    </Panel>
  );
}
