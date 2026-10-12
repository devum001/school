import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Plus,
  Pencil,
  Trash2,
  Users,
  UserCheck,
  BookOpen,
  Download,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useSchool } from '../../app/useSchool';
import { useFeedback } from '../../app/useFeedback';
import {
  Avatar,
  Badge,
  Button,
  EmptyState,
  Modal,
  PageHeading,
  Panel,
  SearchInput,
  StatCard,
} from '../../components/ui/Primitives';
import DeleteDialog from '../../components/shared/DeleteDialog';
import { repository } from '../../lib/repository';
import { downloadCsv } from '../../lib/download';
import { displayDate } from '../../lib/config';
import TeacherDialog from './TeacherDialog';
import '../../styles/management.css';
export default function TeachersPage() {
  const state = useSchool();
  const notify = useFeedback();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [subject, setSubject] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [deleting, setDeleting] = useState('');
  const [viewing, setViewing] = useState('');
  const [page, setPage] = useState(1);
  const teachers = state.teachers.filter((t) => t.schoolId === state.school.id);
  const rows = teachers
    .filter(
      (t) =>
        (!status || t.status === status) &&
        (!subject || t.subject === subject) &&
        `${t.name} ${t.staffId} ${t.subject}`.toLowerCase().includes(query.toLowerCase()),
    )
    .sort((a, b) => a.name.localeCompare(b.name, 'en-IN', { sensitivity: 'base' }));
  const subjects = [...new Set(teachers.map((t) => t.subject))].sort();
  const pages = Math.max(1, Math.ceil(rows.length / 10));
  const current = Math.min(page, pages);
  const selected = teachers.find((t) => t.id === viewing);
  const target = teachers.find((t) => t.id === deleting);
  const assignments = (id: string) => state.sections.filter((s) => s.teacherId === id);
  const sectionLabel = (id: string) => {
    const s = state.sections.find((s) => s.id === id)!;
    return `${state.classes.find((c) => c.id === s.classId)?.name} · ${s.name}`;
  };
  return (
    <>
      <PageHeading
        eyebrow="THE PEOPLE BEHIND EVERY CLASSROOM"
        title="Teachers"
        description="Staff profiles, teaching subjects and class responsibilities, in one place."
        actions={
          <>
            <Button
              variant="secondary"
              onClick={() =>
                downloadCsv(
                  'teachers.csv',
                  [
                    'Name',
                    'Staff ID',
                    'Subject',
                    'Status',
                    'Email',
                    'Mobile',
                    'Class-teacher assignments',
                  ],
                  rows.map((t) => [
                    t.name,
                    t.staffId,
                    t.subject,
                    t.status,
                    t.email,
                    t.phone,
                    assignments(t.id)
                      .map((s) => sectionLabel(s.id))
                      .join('; '),
                  ]),
                )
              }
            >
              <Download size={15} />
              Export teachers
            </Button>
            <Button onClick={() => setEditing('')}>
              <Plus size={16} />
              Add teacher
            </Button>
          </>
        }
      />
      <div className="stats-grid three">
        <StatCard
          label="Teaching team"
          value={teachers.length}
          detail="All staff profiles"
          icon={<Users size={18} />}
        />
        <StatCard
          label="Active teachers"
          value={teachers.filter((t) => t.status === 'active').length}
          detail={`${teachers.filter((t) => t.status === 'inactive').length} inactive`}
          icon={<UserCheck size={18} />}
          tone="green"
        />
        <StatCard
          label="Sections without a class teacher"
          value={state.sections.filter((s) => !s.teacherId).length}
          detail={`${state.sections.length} sections in this school`}
          icon={<BookOpen size={18} />}
          tone="amber"
        />
      </div>
      <Panel className="teacher-directory">
        <div className="toolbar">
          <SearchInput
            value={query}
            onChange={(v) => {
              setQuery(v);
              setPage(1);
            }}
            placeholder="Search teacher, staff ID or subject…"
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
          <select
            aria-label="Filter teaching subject"
            value={subject}
            onChange={(e) => {
              setSubject(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All subjects</option>
            {subjects.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Teacher</th>
                <th>Subject</th>
                <th>Class teacher for</th>
                <th>Contact</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice((current - 1) * 10, current * 10).map((t) => (
                <tr key={t.id}>
                  <td>
                    <button className="teacher-name-button" onClick={() => setViewing(t.id)}>
                      <Avatar name={t.name} />
                      <span>
                        <strong>{t.name}</strong>
                        <small>{t.staffId}</small>
                      </span>
                    </button>
                  </td>
                  <td>{t.subject}</td>
                  <td>
                    <div className="teacher-tags">
                      {assignments(t.id).length ? (
                        assignments(t.id).map((s) => (
                          <Link key={s.id} to={`/students?class=${s.classId}&section=${s.id}`}>
                            <Badge>{sectionLabel(s.id)}</Badge>
                          </Link>
                        ))
                      ) : (
                        <span className="muted">Not assigned</span>
                      )}
                    </div>
                  </td>
                  <td>{t.email || t.phone || 'Not provided'}</td>
                  <td>
                    <Badge tone={t.status === 'active' ? 'green' : 'neutral'}>
                      {t.status === 'active' ? 'Active' : 'Inactive'}
                    </Badge>
                  </td>
                  <td>
                    <div className="management-row-actions">
                      <Button
                        variant="ghost"
                        aria-label={`Edit ${t.name}`}
                        onClick={() => setEditing(t.id)}
                      >
                        <Pencil size={15} />
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        className="delete-action"
                        aria-label={`Delete ${t.name}`}
                        onClick={() => setDeleting(t.id)}
                      >
                        <Trash2 size={15} />
                        Delete
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
      {selected && (
        <Modal
          open
          onClose={() => setViewing('')}
          title={selected.name}
          description={`${selected.staffId} · ${selected.subject}`}
        >
          <Badge tone={selected.status === 'active' ? 'green' : 'neutral'}>
            {selected.status === 'active' ? 'Active teacher' : 'Inactive teacher'}
          </Badge>
          <dl className="teacher-profile-grid">
            <div>
              <dt>Email</dt>
              <dd>{selected.email || 'Not provided'}</dd>
            </div>
            <div>
              <dt>Mobile</dt>
              <dd>{selected.phone || 'Not provided'}</dd>
            </div>
            <div>
              <dt>Qualification</dt>
              <dd>{selected.qualification || 'Not provided'}</dd>
            </div>
            <div>
              <dt>Joined</dt>
              <dd>{displayDate(selected.joinedOn)}</dd>
            </div>
          </dl>
          <h3 className="management-form-title">Class-teacher assignments</h3>
          <p className="panel-note">
            {assignments(selected.id)
              .map((s) => sectionLabel(s.id))
              .join(', ') || 'No sections assigned'}
          </p>
          <div className="modal-actions">
            <Button
              variant="secondary"
              onClick={() => {
                setViewing('');
                setDeleting(selected.id);
              }}
            >
              Delete teacher
            </Button>
            <Button
              onClick={() => {
                setViewing('');
                setEditing(selected.id);
              }}
            >
              Edit teacher
            </Button>
          </div>
        </Modal>
      )}
      {editing !== null && (
        <TeacherDialog teacherId={editing || undefined} onClose={() => setEditing(null)} />
      )}
      {target && (
        <DeleteDialog
          title={`Delete ${target.name}?`}
          description="This removes the staff profile and releases their class-teacher assignments. Student records and class sections are preserved."
          detail={`${assignments(target.id).length} sections will need a class teacher. Use Inactive to keep this staff profile instead.`}
          onClose={() => setDeleting('')}
          onDelete={() => {
            repository.deleteTeacher(target.id);
            notify('Teacher deleted. Class assignments updated.');
          }}
        />
      )}
    </>
  );
}
