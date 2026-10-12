import { useState } from 'react';
import StudentDialog from './StudentDialog';
import DeleteStudentDialog from './DeleteStudentDialog';
import { useToday } from '../../app/useToday';
import { Link, useParams, useSearchParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  CalendarCheck,
  Wallet,
  Award,
  FileText,
  MapPin,
  Users,
  CalendarDays,
  ArrowUpRight,
} from 'lucide-react';
import { useSchool } from '../../app/useSchool';
import { Avatar, Badge, Button, EmptyState, Panel, StatCard } from '../../components/ui/Primitives';
import { attendanceSummary, feeSummary, resultSummary, roster } from '../../lib/selectors';
import { displayDate, money } from '../../lib/config';
import { StudentFees } from '../fees/StudentFees';
import { StudentAcademics } from '../academics/StudentAcademics';
import { StudentAttendance } from './StudentAttendance';
const tabs = ['overview', 'attendance', 'fees', 'academics', 'documents'];
export default function StudentProfilePage() {
  const state = useSchool();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const today = useToday();
  const monthName = new Date(`${today}T12:00:00`).toLocaleDateString('en-IN', { month: 'long' });
  const { studentId } = useParams();
  const [params, setParams] = useSearchParams();
  const tab = tabs.includes(params.get('tab') ?? '') ? params.get('tab')! : 'overview';
  const row = roster(state, true).find((r) => r.student.id === studentId);
  if (!row)
    return (
      <EmptyState
        title="Student not found"
        description="This student could not be found in the school directory."
        action={
          <Link to="/students" className="button primary">
            Open directory
          </Link>
        }
      />
    );
  const { student, enrollment } = row;
  const attendance = attendanceSummary(
    state.attendance
      .filter((r) => r.enrollmentId === enrollment.id && r.date.startsWith(today.slice(0, 7)))
      .map((r) => r.status),
  );
  const fees = feeSummary(state, enrollment.id);
  const latestExam = state.exams
    .filter(
      (e) =>
        e.schoolId === state.school.id &&
        e.academicYearId === state.academicYear.id &&
        state.results.some(
          (r) =>
            r.schoolId === state.school.id && r.enrollmentId === enrollment.id && r.examId === e.id,
        ),
    )
    .sort((a, b) => b.date.localeCompare(a.date))[0];
  const result = state.results.find(
    (r) =>
      r.schoolId === state.school.id &&
      r.enrollmentId === enrollment.id &&
      r.examId === latestExam?.id,
  );
  const academic = result ? resultSummary(result) : null;
  return (
    <>
      <Link to="/students" className="back-link">
        <ArrowLeft size={15} />
        Student directory
      </Link>
      <div className="profile-hero">
        <Avatar name={student.name} large />
        <div className="profile-identity">
          <div className="inline-actions">
            <h1>{student.name}</h1>
            <Badge tone={student.status === 'active' ? 'green' : 'neutral'}>
              {student.status === 'active' ? 'Active student' : 'Inactive student'}
            </Badge>
          </div>
          <p>
            {student.admissionNumber}
            <span>·</span>
            {row.className}, Section {row.sectionName}
            <span>·</span>Roll no. {enrollment.rollNumber}
          </p>
          <small>
            <CalendarDays size={13} />
            Academic year {state.academicYear.name}
          </small>
        </div>
        <Link
          className="button secondary"
          to={`/attendance?class=${enrollment.classId}&section=${enrollment.sectionId}`}
        >
          <CalendarCheck size={16} />
          Class register
        </Link>
      </div>
      <div className="management-row-actions">
        <Button variant="secondary" onClick={() => setEditing(true)}>
          Edit student
        </Button>
        <Button variant="ghost" className="delete-action" onClick={() => setDeleting(true)}>
          Delete student
        </Button>
      </div>
      {editing && <StudentDialog studentId={student.id} onClose={() => setEditing(false)} />}
      {deleting && (
        <DeleteStudentDialog
          studentId={student.id}
          onClose={() => setDeleting(false)}
          onDeleted={() => navigate('/students')}
        />
      )}
      <div className="tabs profile-tabs" role="tablist" aria-label="Student profile tabs">
        {tabs.map((t) => (
          <button
            role="tab"
            aria-selected={tab === t}
            id={`tab-${t}`}
            aria-controls={`panel-${t}`}
            key={t}
            className={tab === t ? 'active' : ''}
            onClick={() => setParams({ tab: t })}
          >
            {t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === 'overview' && (
          <>
            <div className="stats-grid three">
              <StatCard
                label={`${monthName} attendance`}
                value={`${attendance.percentage}%`}
                detail={`${attendance.attended} attending / ${attendance.marked} marked days`}
                icon={<CalendarCheck size={18} />}
                tone="green"
                href={`/students/${student.id}?tab=attendance`}
              />
              <StatCard
                label="Outstanding fees"
                value={money(fees.outstanding)}
                detail="Current academic year · Includes future dues"
                icon={<Wallet size={18} />}
                tone="amber"
                href={`/students/${student.id}?tab=fees`}
              />
              <StatCard
                label="Latest examination"
                value={academic ? `${academic.percentage}%` : '—'}
                detail={
                  academic
                    ? `${latestExam.name} · ${result?.absent ? 'Absent' : `Grade ${academic.grade}`}`
                    : 'No results recorded yet'
                }
                icon={<Award size={18} />}
                href={`/students/${student.id}?tab=academics`}
              />
            </div>
            <div className="profile-overview-grid">
              <Panel title="Student information" subtitle="A connected view of the learner">
                <dl className="detail-list">
                  <div>
                    <dt>Full name</dt>
                    <dd>{student.name}</dd>
                  </div>
                  <div>
                    <dt>Admission number</dt>
                    <dd>{student.admissionNumber}</dd>
                  </div>
                  <div>
                    <dt>Date of birth</dt>
                    <dd>{displayDate(student.birthDate)}</dd>
                  </div>
                  <div>
                    <dt>Class & section</dt>
                    <dd>
                      {row.className} · {row.sectionName}
                    </dd>
                  </div>
                  <div>
                    <dt>School</dt>
                    <dd>{state.school.name}</dd>
                  </div>
                  <div>
                    <dt>
                      <MapPin size={14} />
                      Address
                    </dt>
                    <dd>{student.address}</dd>
                  </div>
                </dl>
              </Panel>
              <Panel title="Family connection" subtitle="Parent & guardian information">
                <div className="guardian-card">
                  <span className="banner-icon">
                    <Users size={25} />
                  </span>
                  <h3>{student.guardian.name}</h3>
                  <p>{student.guardian.relation} · Primary guardian</p>
                  <Badge tone={student.guardian.contact ? 'green' : 'amber'}>
                    {student.guardian.contact ? 'Contact on file' : 'Contact not available'}
                  </Badge>
                  <p className="fine-print">
                    Parent communication preferences are managed by the school office.
                  </p>
                </div>
                <Link className="panel-bottom-link" to="/notifications">
                  Open notification workspace <ArrowUpRight size={15} />
                </Link>
              </Panel>
            </div>
            <Panel
              title="Recent student activity"
              subtitle="Records from the same school workspace"
            >
              <div className="student-activity">
                <div>
                  <span className="activity-icon blue">
                    <CalendarCheck size={17} />
                  </span>
                  <span>
                    <strong>{monthName} attendance summary</strong>
                    <small>
                      {attendance.marked} marked records · {attendance.absent} absent days
                    </small>
                  </span>
                </div>
                <div>
                  <span className="activity-icon green">
                    <Wallet size={17} />
                  </span>
                  <span>
                    <strong>{fees.payments.length} payments recorded</strong>
                    <small>{money(fees.paid)} paid toward annual fees</small>
                  </span>
                </div>
                <div>
                  <span className="activity-icon blue">
                    <Award size={17} />
                  </span>
                  <span>
                    <strong>{latestExam?.name ?? 'No results recorded yet'}</strong>
                    <small>
                      {academic && `${academic.marks}/${academic.maximum}`}{' '}
                      {latestExam && ` · ${displayDate(latestExam.date)}`}
                    </small>
                  </span>
                </div>
              </div>
            </Panel>
          </>
        )}
        {tab === 'attendance' && <StudentAttendance enrollmentId={enrollment.id} />}{' '}
        {tab === 'fees' && <StudentFees enrollmentId={enrollment.id} />}{' '}
        {tab === 'academics' && <StudentAcademics enrollmentId={enrollment.id} />}{' '}
        {tab === 'documents' && (
          <Panel>
            <div className="documents-empty">
              <span className="document-illustration">
                <FileText size={46} />
              </span>
              <h2>A home for important documents</h2>
              <p>
                Admission forms, certificates, and reports will live here.
                <br />
                Document uploads will be available soon.
              </p>
              <Badge>Uploads coming soon</Badge>
            </div>
          </Panel>
        )}
      </div>
    </>
  );
}
