import TabRail from '../../components/ui/TabRail';
import { useState } from 'react';
import { tabKeyboard } from '../../lib/tabKeyboard';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { useSchool } from '../../app/useSchool';
import { useToday } from '../../app/useToday';
import {
  PickerInput,
  Avatar,
  Badge,
  Button,
  EmptyState,
  PageHeading,
  Panel,
  SearchInput,
} from '../../components/ui/Primitives';
import { staffDirectory, staffLabel } from '../../lib/staffStructure';
import { defaultStaffPayroll } from '../../lib/settings';
import { currentPayrollMonth, payrollCycle } from '../../lib/staffPayroll';
import { salaryMonthSchema } from '../../lib/staffSalary';
import { displayDate } from '../../lib/config';
import StaffDialog from './StaffDialog';
import StaffAttendancePage from '../attendance/StaffAttendancePage';
import '../../styles/ledgers.css';

const tabs = ['All Staff', 'Attendance', 'Leave'] as const;
export default function StaffHRPage() {
  const state = useSchool(),
    today = useToday(),
    [params, setParams] = useSearchParams(),
    config = state.staffPayroll ?? defaultStaffPayroll;
  const tab = tabs.find((value) => value === params.get('tab')) ?? 'All Staff',
    members = staffDirectory(state, config),
    focus = params.get('staff') ?? '';
  const [query, setQuery] = useState(''),
    [editing, setEditing] = useState<string | null>(null),
    [adding, setAdding] = useState(params.get('add') === 'teacher');
  const requestedMonth = params.get('month'),
    month = salaryMonthSchema.safeParse(requestedMonth).success
      ? requestedMonth!
      : currentPayrollMonth(today, config.payroll.paymentDay),
    cycle = payrollCycle(month, config.payroll.paymentDay);
  const department = params.get('department') ?? '';
  const filtered = members.filter(
    (member) =>
      (!focus || member.id === focus) &&
      (!department || member.departmentId === department) &&
      staffLabel(member, config).toLowerCase().includes(query.toLowerCase()),
  );
  const update = (key: string, value: string) =>
    setParams((previous) => {
      const next = new URLSearchParams(previous);
      if (value) next.set(key, value);
      else next.delete(key);
      return next;
    });
  const [page, setPage] = useState(1),
    pages = Math.max(1, Math.ceil(filtered.length / 20)),
    currentPage = Math.min(page, pages);
  if (params.get('tab') === 'Salary') {
    const financeParams = new URLSearchParams(params);
    financeParams.set('tab', 'Salary Expenses');
    return <Navigate replace to={`/fees?${financeParams}`} />;
  }
  return (
    <div className="ledger-stack">
      <PageHeading
        title="Staff & HR"
        actions={<Button onClick={() => setAdding(true)}>Add Staff</Button>}
      />
      <TabRail className="hr-tabs" role="tablist" aria-label="Staff & HR">
        {tabs.map((value, index) => (
          <button
            key={value}
            id={`hr-tab-${index}`}
            role="tab"
            aria-controls="hr-panel"
            aria-selected={tab === value}
            tabIndex={tab === value ? 0 : -1}
            onKeyDown={(e) =>
              tabKeyboard(
                e,
                index,
                tabs,
                (value) => update('tab', value),
                (_, i) => `hr-tab-${i}`,
              )
            }
            onClick={() => update('tab', value)}
          >
            {value}
          </button>
        ))}
      </TabRail>
      {focus && (
        <p className="panel-note">
          Viewing {members.find((member) => member.id === focus)?.name ?? 'selected staff'} ·{' '}
          <button className="text-link" onClick={() => update('staff', '')}>
            Show all staff
          </button>
        </p>
      )}
      <div id="hr-panel" role="tabpanel" aria-labelledby={`hr-tab-${tabs.indexOf(tab)}`}>
        {tab === 'All Staff' && (
          <Panel
            title="All Staff"
            subtitle={`${filtered.length} staff records`}
            action={
              <Link className="text-link" to="/settings?tab=Staff+%26+Payroll">
                Manage departments & work rules
              </Link>
            }
          >
            <div className="toolbar">
              <SearchInput
                value={query}
                onChange={(value) => {
                  setQuery(value);
                  setPage(1);
                }}
                placeholder="Search staff name or designation…"
              />
              <label className="field">
                Department filter
                <select
                  aria-label="Department filter"
                  value={department}
                  onChange={(e) => update('department', e.target.value)}
                >
                  <option value="">All departments</option>
                  {config.setup.departments.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {filtered.length ? (
              <div className="table-wrap" role="region" aria-label="All Staff" tabIndex={0}>
                <table>
                  <thead>
                    <tr>
                      <th scope="col">Staff</th>
                      <th scope="col">Department</th>
                      <th scope="col">Contact</th>
                      <th scope="col">Status</th>
                      <th scope="col">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.slice((currentPage - 1) * 20, currentPage * 20).map((member) => (
                      <tr key={member.id}>
                        <th scope="row">
                          <div className="person-cell">
                            <Avatar name={member.name} />
                            {member.teacherId ? (
                              <Link className="text-link" to={`/teachers/${member.id}`}>
                                {staffLabel(member, config)}
                              </Link>
                            ) : (
                              staffLabel(member, config)
                            )}
                          </div>
                        </th>
                        <td>
                          {config.setup.departments.find((item) => item.id === member.departmentId)
                            ?.name ?? '—'}
                        </td>
                        <td>{member.phone || member.email || '—'}</td>
                        <td>
                          <Badge tone={member.status === 'active' ? 'green' : 'neutral'}>
                            {member.status === 'active' ? 'Active' : 'Inactive'}
                          </Badge>
                        </td>
                        <td>
                          <Button
                            variant="ghost"
                            aria-label={`Edit staff ${member.name}`}
                            onClick={() => setEditing(member.id)}
                          >
                            Edit staff
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState
                title="No matching staff"
                description="Try another name or department, or add staff."
              />
            )}
            {pages > 1 && (
              <div className="pagination">
                <Button
                  variant="secondary"
                  disabled={currentPage === 1}
                  onClick={() => setPage(currentPage - 1)}
                >
                  Previous
                </Button>
                <span>
                  Page {currentPage} of {pages}
                </span>
                <Button
                  variant="secondary"
                  disabled={currentPage === pages}
                  onClick={() => setPage(currentPage + 1)}
                >
                  Next
                </Button>
              </div>
            )}
          </Panel>
        )}
        {tab === 'Attendance' && <StaffAttendancePage embedded />}
        {tab === 'Leave' && (
          <Panel
            title="Leave"
            subtitle="Full-day and half-day absences counted from staff attendance."
          >
            <div className="toolbar staff-leave-toolbar">
              <label className="field">
                Leave cycle month
                <PickerInput
                  aria-label="Leave cycle month"
                  type="month"
                  value={month}
                  onChange={(e) => {
                    if (e.target.value) update('month', e.target.value);
                  }}
                />
              </label>
              <label className="field">
                Department
                <select
                  aria-label="Leave department"
                  value={department}
                  onChange={(e) => update('department', e.target.value)}
                >
                  <option value="">All departments</option>
                  {config.setup.departments.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
              <Link
                className="button secondary staff-toolbar-action"
                to={`/staff?tab=Attendance&date=${today >= cycle.start && today <= cycle.end ? today : cycle.end > today ? today : cycle.end}${focus ? `&staff=${encodeURIComponent(focus)}` : ''}${department ? `&department=${encodeURIComponent(department)}` : ''}`}
              >
                Open Staff Attendance
              </Link>
            </div>
            <p className="panel-note">
              {displayDate(cycle.start)} – {displayDate(cycle.end)}
            </p>
            <div className="table-wrap" role="region" aria-label="Staff leave counts" tabIndex={0}>
              <table>
                <thead>
                  <tr>
                    <th scope="col">Staff</th>
                    <th scope="col">Full leaves</th>
                    <th scope="col">Half days</th>
                    <th scope="col">Total leaves</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((member) => {
                    const records = (state.staffAttendance ?? []).filter(
                      (record) =>
                        record.schoolId === state.school.id &&
                        record.staffId === member.id &&
                        record.date >= cycle.start &&
                        record.date <= cycle.end &&
                        record.date <= today &&
                        record.date >= member.joinedOn,
                    );
                    const full = records.filter((record) => record.status === 'absent').length,
                      half = records.filter((record) => record.status === 'half-day').length;
                    return (
                      <tr key={member.id}>
                        <th scope="row">{staffLabel(member, config)}</th>
                        <td>{full}</td>
                        <td>{half}</td>
                        <td>{full + half * 0.5} leaves</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Panel>
        )}
      </div>
      {adding && (
        <StaffDialog
          teaching={params.get('add') === 'teacher'}
          departmentId={
            params.get('add') === 'teacher'
              ? config.setup.departments.find((item) => item.name.toLowerCase() === 'academics')?.id
              : department || undefined
          }
          onClose={() => {
            setAdding(false);
            update('add', '');
          }}
        />
      )}
      {editing && <StaffDialog staffId={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
