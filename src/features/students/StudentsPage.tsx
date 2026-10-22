import { useToday } from '../../app/useToday';
import { useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { ArrowUpRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { useSchool } from '../../app/useSchool';
import {
  Avatar,
  Badge,
  Button,
  EmptyState,
  PageHeading,
  Panel,
  SearchInput,
  AppIcon,
} from '../../components/ui/Primitives';
import { ClassFilters } from '../../components/shared/ClassFilters';
import { roster, statusFor } from '../../lib/selectors';
import { STATUS_LABELS } from '../../lib/config';
import { downloadCsv } from '../../lib/download';
import StudentDialog from './StudentDialog';
import DeleteStudentDialog from './DeleteStudentDialog';
export default function StudentsPage() {
  const state = useSchool();
  const navigate = useNavigate();
  const today = useToday();
  const [editing, setEditing] = useState<string | null>(null);
  const [deleting, setDeleting] = useState('');
  const [params, setParams] = useSearchParams();
  const query = params.get('q') ?? '';
  const classId = params.get('class') ?? '';
  const section = params.get('section') ?? '';
  const status = params.get('status') ?? '';
  const [page, setPage] = useState(1);
  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key === 'class') next.delete('section');
    setParams(next, { flushSync: true });
    setPage(1);
  };
  const rows = roster(state, true).filter(
    (r) =>
      (!classId || r.enrollment.classId === classId) &&
      (!section || r.enrollment.sectionId === section) &&
      (!status || r.student.status === status) &&
      `${r.student.name} ${r.student.admissionNumber}`.toLowerCase().includes(query.toLowerCase()),
  );
  const pages = Math.max(1, Math.ceil(rows.length / 12));
  const current = Math.min(page, pages);
  return (
    <>
      <PageHeading
        title="Student directory"
        actions={
          <>
            <Button
              variant="secondary"
              onClick={() =>
                downloadCsv(
                  'vidya-niketan-students.csv',
                  ['Admission number', 'Name', 'Class', 'Section', 'Status'],
                  rows.map((r) => [
                    r.student.admissionNumber,
                    r.student.name,
                    r.className,
                    r.sectionName,
                    r.student.status,
                  ]),
                )
              }
            >
              <AppIcon name="download" size={16} />
              Export directory
            </Button>
            <Button
              onClick={() =>
                navigate(
                  `/students/new?${new URLSearchParams({ classId, sectionId: section, returnTo: `/students?${params}` })}`,
                )
              }
            >
              <AppIcon name="student" size={16} />
              Add student
            </Button>
          </>
        }
      />
      <div className="directory-banner">
        <div className="banner-icon">
          <AppIcon name="users" size={30} />
        </div>
        <div>
          <strong>{state.students.length} student stories. One school community.</strong>
          <p>
            {roster(state).length} active students across {state.classes.length} grades and{' '}
            {state.sections.length} sections.
          </p>
        </div>
        <Badge tone="blue">Academic year {state.academicYear.name}</Badge>
      </div>
      <Panel>
        <div className="toolbar live-students-toolbar">
          <div className="students-search-group">
            <span>Search</span>
            <SearchInput
              value={query}
              onChange={(v) => update('q', v)}
              placeholder="Search name or admission number…"
            />
          </div>
          <div className="students-filters-group">
            <ClassFilters
              classId={classId}
              sectionId={section}
              onClassChange={(v) => update('class', v)}
              onSectionChange={(v) => update('section', v)}
            />
            <label className="filter-label">
              <span>Status</span>
              <select
                aria-label="Student status"
                value={status}
                onChange={(e) => update('status', e.target.value)}
              >
                <option value="">All statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </label>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Student</th>
                <th>Admission number</th>
                <th>Class & section</th>
                <th>Guardian</th>
                <th>Attendance</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.slice((current - 1) * 12, current * 12).map((r) => (
                <tr key={r.enrollment.id}>
                  <td>
                    <Link className="person" to={`/students/${r.student.id}`}>
                      <Avatar name={r.student.name} />
                      <strong>{r.student.name}</strong>
                    </Link>
                  </td>
                  <td className="mono">{r.student.admissionNumber}</td>
                  <td>
                    {r.className} · {r.sectionName}
                  </td>
                  <td>{r.student.guardian.name}</td>
                  <td>
                    <Badge tone={statusFor(state, r.enrollment.id, today)}>
                      {STATUS_LABELS[statusFor(state, r.enrollment.id, today)]}
                    </Badge>
                  </td>
                  <td>
                    <span className={`status-dot ${r.student.status}`} />
                    {r.student.status === 'active' ? 'Active' : 'Inactive'}
                  </td>
                  <td>
                    <div className="management-row-actions">
                      <Link aria-label={`Open ${r.student.name}`} to={`/students/${r.student.id}`}>
                        <ArrowUpRight size={17} />
                      </Link>
                      <Button
                        variant="ghost"
                        aria-label={`Edit ${r.student.name}`}
                        onClick={() => setEditing(r.student.id)}
                      >
                        <AppIcon name="edit" size={16} />
                      </Button>
                      <Button
                        variant="ghost"
                        className="delete-action"
                        aria-label={`Delete ${r.student.name}`}
                        onClick={() => setDeleting(r.student.id)}
                      >
                        <AppIcon name="delete" size={16} />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!rows.length && (
          <EmptyState
            action={
              <Button
                variant="secondary"
                onClick={() => {
                  setParams({}, { flushSync: true });
                  setPage(1);
                }}
              >
                Clear filters
              </Button>
            }
          />
        )}
        <div className="pagination">
          <span>
            {rows.length
              ? `${(current - 1) * 12 + 1}–${Math.min(current * 12, rows.length)} of ${rows.length}`
              : '0'}{' '}
            students
          </span>
          <div>
            <Button
              variant="secondary"
              disabled={current === 1}
              onClick={() => setPage(current - 1)}
              aria-label="Previous page"
            >
              <ChevronLeft size={15} />
            </Button>
            <span>
              Page {current} of {pages}
            </span>
            <Button
              variant="secondary"
              disabled={current === pages}
              onClick={() => setPage(current + 1)}
              aria-label="Next page"
            >
              <ChevronRight size={15} />
            </Button>
          </div>
        </div>
      </Panel>
      {editing !== null && (
        <StudentDialog studentId={editing || undefined} onClose={() => setEditing(null)} />
      )}
      {deleting && <DeleteStudentDialog studentId={deleting} onClose={() => setDeleting('')} />}
    </>
  );
}
