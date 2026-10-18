import TabRail from '../../components/ui/TabRail';
import { useState } from 'react';
import { tabKeyboard } from '../../lib/tabKeyboard';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useSchool } from '../../app/useSchool';
import { useToday } from '../../app/useToday';
import { PickerInput, Avatar, EmptyState, Panel } from '../../components/ui/Primitives';
import EntityDocuments from '../../components/shared/EntityDocuments';
import { staffDirectory, staffDesignation } from '../../lib/staffStructure';
import { defaultStaffPayroll } from '../../lib/settings';
import { attendanceSummary } from '../../lib/selectors';
import { displayDate } from '../../lib/config';
import '../../styles/ledgers.css';

export default function TeacherProfilePage() {
  const state = useSchool(),
    today = useToday(),
    { teacherId } = useParams(),
    [params, setParams] = useSearchParams();
  const [month, setMonth] = useState(today.slice(0, 7)),
    config = state.staffPayroll ?? defaultStaffPayroll;
  const member = staffDirectory(state, config).find(
    (item) => (item.id === teacherId || item.teacherId === teacherId) && !!item.teacherId,
  );
  if (!member)
    return (
      <EmptyState
        title="Teacher not found"
        description="Open the teaching staff directory to choose a record."
        action={
          <Link className="button primary" to="/teachers">
            Teachers
          </Link>
        }
      />
    );
  const tab = params.get('tab') === 'Documents' ? 'Documents' : 'Overview';
  const summary = attendanceSummary(
    (state.staffAttendance ?? [])
      .filter(
        (record) =>
          record.schoolId === state.school.id &&
          record.staffId === member.id &&
          record.date.startsWith(month) &&
          record.date <= today,
      )
      .map((record) => record.status),
  );
  return (
    <div className="ledger-stack">
      <Link className="back-link" to="/teachers">
        ← Teacher List
      </Link>
      <TabRail className="teacher-detail-tabs" role="tablist" aria-label="Teacher detail">
        {(['Overview', 'Documents'] as const).map((value, index) => (
          <button
            key={value}
            id={`teacher-tab-${value}`}
            role="tab"
            aria-controls="teacher-detail-panel"
            aria-selected={tab === value}
            tabIndex={tab === value ? 0 : -1}
            onKeyDown={(e) =>
              tabKeyboard(
                e,
                index,
                ['Overview', 'Documents'] as const,
                (value) => setParams({ tab: value }),
                (value) => `teacher-tab-${value}`,
              )
            }
            onClick={() => setParams({ tab: value })}
          >
            {value}
          </button>
        ))}
      </TabRail>
      <div id="teacher-detail-panel" role="tabpanel" aria-labelledby={`teacher-tab-${tab}`}>
        {tab === 'Overview' ? (
          <div className="ledger-stack">
            <Panel title="Overview">
              <div className="panel-padding teacher-overview">
                <div>
                  {member.photoDataUrl ? (
                    <img
                      className="teacher-overview-photo"
                      src={member.photoDataUrl}
                      alt={`${member.name} photo`}
                    />
                  ) : (
                    <Avatar name={member.name} large />
                  )}
                </div>
                <dl className="detail-list">
                  {[
                    ['Name', member.name],
                    [
                      'Department',
                      config.setup.departments.find(
                        (department) => department.id === member.departmentId,
                      )?.name,
                    ],
                    ['Designation', staffDesignation(member, config)],
                    ['Phone', member.phone],
                    ['Email', member.email],
                    ['Joining Date', displayDate(member.joinedOn)],
                    ['Qualification', member.qualification],
                    ['Status', member.status === 'active' ? 'Active' : 'Inactive'],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt>{label}</dt>
                      <dd>{value || '—'}</dd>
                    </div>
                  ))}
                </dl>
              </div>
              <div className="panel-padding">
                <Link className="text-link" to={`/staff?staff=${member.id}`}>
                  View in Staff & HR →
                </Link>
              </div>
            </Panel>
            <Panel
              title="Staff Attendance summary"
              action={
                <label className="field">
                  Month
                  <PickerInput
                    aria-label="Teacher attendance month"
                    type="month"
                    value={month}
                    max={today.slice(0, 7)}
                    onChange={(e) => {
                      if (/^\d{4}-\d{2}$/.test(e.target.value)) setMonth(e.target.value);
                    }}
                  />
                </label>
              }
            >
              <div className="panel-padding">
                <dl className="detail-list">
                  {[
                    ['Present', summary.present],
                    ['Absent', summary.absent],
                    ['Half Day', summary['half-day']],
                    ['Late', summary.late],
                    ['Marked days', summary.marked],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt>{label}</dt>
                      <dd>{value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </Panel>
          </div>
        ) : (
          <EntityDocuments ownerKind="staff" ownerId={member.id} />
        )}
      </div>
    </div>
  );
}
