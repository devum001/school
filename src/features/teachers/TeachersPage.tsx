import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useSchool } from '../../app/useSchool';
import {
  Avatar,
  Badge,
  Button,
  EmptyState,
  PageHeading,
  Panel,
  SearchInput,
  StatCard,
  AppIcon,
} from '../../components/ui/Primitives';
import { downloadCsv } from '../../lib/download';
import { staffDirectory, staffDesignation } from '../../lib/staffStructure';
import { defaultStaffPayroll } from '../../lib/settings';
import '../../styles/management.css';
export default function TeachersPage() {
  const state = useSchool();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const config = state.staffPayroll ?? defaultStaffPayroll;
  const teachers = staffDirectory(state, config).filter((member) => !!member.teacherId);
  const rows = teachers
    .filter(
      (t) =>
        (!status || t.status === status) &&
        `${t.name} ${staffDesignation(t, config)}`.toLowerCase().includes(query.toLowerCase()),
    )
    .sort((a, b) => a.name.localeCompare(b.name, 'en-IN', { sensitivity: 'base' }));
  const pages = Math.max(1, Math.ceil(rows.length / 10));
  const current = Math.min(page, pages);
  return (
    <>
      <PageHeading
        title="Teachers"
        actions={
          <>
            <Button
              variant="secondary"
              onClick={() =>
                downloadCsv(
                  'teachers.csv',
                  [
                    'Name',
                    'Department',
                    'Designation',
                    'Phone',
                    'Email',
                    'Qualification',
                    'Joining Date',
                    'Status',
                  ],
                  rows.map((member) => [
                    member.name,
                    config.setup.departments.find(
                      (department) => department.id === member.departmentId,
                    )?.name ?? '',
                    staffDesignation(member, config),
                    member.phone,
                    member.email,
                    member.qualification ?? '',
                    member.joinedOn,
                    member.status,
                  ]),
                )
              }
            >
              <AppIcon name="download" size={15} />
              Export teachers
            </Button>
            <Link className="button primary" to="/staff?add=teacher">
              <AppIcon name="teacher" size={16} /> Add teaching staff
            </Link>
          </>
        }
      />
      <div className="stats-grid two teacher-summary">
        <StatCard
          label="Teaching team"
          value={teachers.length}
          detail="All staff profiles"
          icon={<AppIcon name="teacher" size={88} />}
        />
        <StatCard
          label="Active teachers"
          value={teachers.filter((t) => t.status === 'active').length}
          detail={`${teachers.filter((t) => t.status === 'inactive').length} inactive`}
          icon={<AppIcon name="user-check" size={88} />}
          tone="green"
        />
      </div>
      <Panel
        className="teacher-directory"
        title="Teachers"
        action={
          <div className="panel-header-actions">
            <SearchInput
              value={query}
              onChange={(v) => {
                setQuery(v);
                setPage(1);
              }}
              placeholder="Search teacher name or designation…"
            />
            <select
              aria-label="Filter teacher status"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
            <Link className="button primary" to="/staff?add=teacher">
              <AppIcon name="teacher" size={16} /> Add teaching staff
            </Link>
          </div>
        }
      >
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Teacher</th>
                <th>Department</th>
                <th>Designation</th>
                <th>Contact</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice((current - 1) * 10, current * 10).map((t) => (
                <tr key={t.id}>
                  <td>
                    <Link className="teacher-name-button" to={`/teachers/${t.id}`}>
                      <Avatar name={t.name} />
                      <span>
                        <strong>{t.name}</strong>
                        <small>
                          {[t.staffId, staffDesignation(t, config)].filter(Boolean).join(' · ')}
                        </small>
                      </span>
                    </Link>
                  </td>
                  <td>
                    {config.setup.departments.find((department) => department.id === t.departmentId)
                      ?.name ?? '—'}
                  </td>
                  <td>{staffDesignation(t, config) || '—'}</td>
                  <td>{t.email || t.phone || 'Not provided'}</td>
                  <td>
                    <Badge tone={t.status === 'active' ? 'green' : 'neutral'}>
                      {t.status === 'active' ? 'Active' : 'Inactive'}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!rows.length && (
          <EmptyState
            title="No teachers found"
            description="Try another search or add a teacher to your school."
          />
        )}
        <div className="pagination">
          <span>{rows.length} teachers · A–Z</span>
          <div>
            <Button
              variant="secondary"
              aria-label="Previous teacher page"
              disabled={current === 1}
              onClick={() => setPage(current - 1)}
            >
              <ChevronLeft size={15} />
            </Button>
            <span>
              Page {current} of {pages}
            </span>
            <Button
              variant="secondary"
              aria-label="Next teacher page"
              disabled={current === pages}
              onClick={() => setPage(current + 1)}
            >
              <ChevronRight size={15} />
            </Button>
          </div>
        </div>
      </Panel>
    </>
  );
}
