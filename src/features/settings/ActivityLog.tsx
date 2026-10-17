import { useState } from 'react';
import { useSchool } from '../../app/useSchool';
import { Button, EmptyState, Panel } from '../../components/ui/Primitives';
import { displayDate } from '../../lib/config';
import { getSchoolDate } from '../../lib/dates';
import { downloadCsv } from '../../lib/download';
import { displayPreferences } from '../../lib/displayPreferences';
export default function ActivityLog() {
  const state = useSchool(),
    all = (state.auditLog ?? [])
      .filter((entry) => entry.schoolId === state.school.id)
      .slice()
      .reverse();
  const [user, setUser] = useState(''),
    [action, setAction] = useState(''),
    [date, setDate] = useState(''),
    [module, setModule] = useState(''),
    [page, setPage] = useState(1);
  const filtered = all.filter(
    (entry) =>
      (!user || entry.actor === user) &&
      (!action || entry.action === action) &&
      (!date || getSchoolDate(new Date(entry.createdAt)) === date) &&
      (!module || entry.module === module),
  );
  const current = Math.min(page, Math.max(1, Math.ceil(filtered.length / 20)));
  return (
    <Panel
      title="Activity Log"
      subtitle="Changes recorded in this school workspace."
      action={
        <Button
          variant="secondary"
          disabled={!filtered.length}
          onClick={() =>
            downloadCsv(
              'activity-log.csv',
              ['Date', 'User', 'Action', 'Module', 'Detail'],
              filtered.map((entry) => [
                entry.createdAt,
                entry.actor,
                entry.action,
                entry.module,
                entry.detail,
              ]),
            )
          }
        >
          Export CSV
        </Button>
      }
    >
      <div className="admin-filter-bar">
        {(
          [
            ['User', user, setUser, all.map((e) => e.actor)],
            ['Action', action, setAction, all.map((e) => e.action)],
            ['Module', module, setModule, all.map((e) => e.module)],
          ] as const
        ).map(([label, value, set, values]) => (
          <label className="field" key={label}>
            {label}
            <select
              aria-label={`Activity ${label}`}
              value={value}
              onChange={(e) => {
                set(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All {label.toLowerCase()}s</option>
              {[...new Set(values)].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
        ))}
        <label className="field">
          Date
          <input
            aria-label="Activity Date"
            type="date"
            value={date}
            onChange={(e) => {
              setDate(e.target.value);
              setPage(1);
            }}
          />
        </label>
      </div>
      {filtered.length ? (
        <div className="table-wrap" role="region" aria-label="Activity records" tabIndex={0}>
          <table>
            <thead>
              <tr>
                <th>Date & Time</th>
                <th>User</th>
                <th>Action</th>
                <th>Module</th>
                <th>Detail</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice((current - 1) * 20, current * 20).map((entry) => (
                <tr key={entry.id}>
                  <td>
                    {displayDate(getSchoolDate(new Date(entry.createdAt)))}
                    <small className="audit-time">
                      {new Date(entry.createdAt).toLocaleTimeString('en-IN', {
                        timeZone: 'Asia/Kolkata',
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: displayPreferences().timeFormat === '12-hour',
                      })}
                    </small>
                  </td>
                  <td>{entry.actor}</td>
                  <td>{entry.action}</td>
                  <td>{entry.module}</td>
                  <td>{entry.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          title="No activity found"
          description="Saved school changes will appear here. Try another filter if records are hidden."
        />
      )}
      {filtered.length > 20 && (
        <div className="pagination">
          <Button variant="secondary" disabled={current === 1} onClick={() => setPage(current - 1)}>
            Previous
          </Button>
          <span>
            Page {current} of {Math.ceil(filtered.length / 20)}
          </span>
          <Button
            variant="secondary"
            disabled={current * 20 >= filtered.length}
            onClick={() => setPage(current + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </Panel>
  );
}
