import TabRail from '../../components/ui/TabRail';
import { StudentProfileBridge } from './studentProfileBridge';
import { useContext, useState } from 'react';
import StudentDialog from './StudentDialog';
import DeleteStudentDialog from './DeleteStudentDialog';
import { useToday } from '../../app/useToday';
import { Link, useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, MapPin, Users, CalendarDays, ArrowUpRight } from 'lucide-react';
import { useSchool } from '../../app/useSchool';
import {
  Avatar,
  Badge,
  Button,
  EmptyState,
  Panel,
  StatCard,
  AppIcon,
  type IconName,
} from '../../components/ui/Primitives';
import { recordedAttendanceSummary, feeSummary, resultSummary, roster } from '../../lib/selectors';
import { displayDate, money } from '../../lib/config';
import { StudentFees } from '../fees/StudentFees';
import { StudentAcademics } from '../academics/StudentAcademics';
import { StudentAttendance } from './StudentAttendance';
import EntityDocuments from '../../components/shared/EntityDocuments';
import '../../styles/ledgers.css';
const tabs = ['overview', 'attendance', 'fees', 'academics', 'documents'] as const;
const tabIcons: Record<(typeof tabs)[number], IconName> = {
  overview: 'overview',
  attendance: 'attendance',
  fees: 'fees',
  academics: 'academics',
  documents: 'document',
};
export default function StudentProfilePage() {
  const state = useSchool();
  const bridge = useContext(StudentProfileBridge);
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const today = useToday();
  const monthName = new Date(`${today}T12:00:00`).toLocaleDateString('en-IN', { month: 'long' });
  const { studentId } = useParams();
  const [params, setParams] = useSearchParams();
  const requestedTab = params.get('tab') as (typeof tabs)[number] | null;
  const tab =
    requestedTab &&
    tabs.includes(requestedTab) &&
    (!bridge ||
      !['attendance', 'academics', 'fees'].includes(requestedTab) ||
      bridge[requestedTab as 'attendance' | 'academics' | 'fees'])
      ? requestedTab
      : 'overview';
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
  const attendance = recordedAttendanceSummary(
    state.attendance
      .filter((r) => r.enrollmentId === enrollment.id && r.date.startsWith(today.slice(0, 7)))
      .map((r) => r.status),
  );
  const fees = bridge
    ? {
        outstanding: bridge.feeSummary?.outstanding ?? 0,
        paid: bridge.feeSummary?.paid ?? 0,
        payments: [],
      }
    : feeSummary(state, enrollment.id);
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
            {row.className}
            {row.sectionName ? `, Section ${row.sectionName}` : ''}
            <span>·</span>Roll no. {enrollment.rollNumber}
          </p>
          <small>
            <CalendarDays size={13} />
            Academic year {state.academicYear.name}
          </small>
        </div>
        {(!bridge || bridge.attendance) && (
          <Link
            className="button secondary"
            to={`/attendance?class=${enrollment.classId}&section=${enrollment.sectionId}&year=${state.academicYear.id}`}
          >
            <AppIcon name="attendance" size={16} />
            Class register
          </Link>
        )}
      </div>
      {(!bridge || bridge.manage) && (
        <div className="student-profile-actions">
          <Button variant="secondary" onClick={() => (bridge ? bridge.edit() : setEditing(true))}>
            <AppIcon name="edit" size={15} />
            Edit student
          </Button>
          <Button
            variant="ghost"
            className="delete-action"
            onClick={() => (bridge ? bridge.remove() : setDeleting(true))}
          >
            <AppIcon name="delete" size={15} />
            Delete student
          </Button>
        </div>
      )}
      {editing && <StudentDialog studentId={student.id} onClose={() => setEditing(false)} />}
      {deleting && (
        <DeleteStudentDialog
          studentId={student.id}
          onClose={() => setDeleting(false)}
          onDeleted={() => navigate('/students')}
        />
      )}
      <TabRail className="tabs profile-tabs" role="tablist" aria-label="Student profile tabs">
        {tabs
          .filter(
            (t) =>
              !bridge ||
              !['attendance', 'academics', 'fees'].includes(t) ||
              bridge[t as 'attendance' | 'academics' | 'fees'],
          )
          .map((t) => (
            <button
              role="tab"
              aria-selected={tab === t}
              id={`tab-${t}`}
              aria-controls={`panel-${t}`}
              key={t}
              className={tab === t ? 'active' : ''}
              onClick={() =>
                setParams((previous) => {
                  const next = new URLSearchParams(previous);
                  next.set('tab', t);
                  return next;
                })
              }
            >
              <AppIcon name={tabIcons[t]} size={16} />
              {t === 'academics' ? 'Progress Report' : t[0].toUpperCase() + t.slice(1)}
            </button>
          ))}
      </TabRail>
      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === 'overview' && (
          <>
            <div className="stats-grid three">
              {(!bridge || bridge.attendance) && (
                <StatCard
                  label={`${monthName} attendance`}
                  value={`${attendance.percentage}%`}
                  detail={`${attendance.attended} attending / ${attendance.marked} marked days`}
                  icon={<AppIcon name="attendance" size={24} />}
                  tone="green"
                  href={`/students/${student.id}?year=${state.academicYear.id}&tab=attendance`}
                />
              )}
              {(!bridge || bridge.fees) && (
                <StatCard
                  label="Outstanding fees"
                  value={
                    bridge && !bridge.feeSummary?.configured ? 'Not set' : money(fees.outstanding)
                  }
                  detail={
                    bridge
                      ? 'All academic years · Includes future dues'
                      : 'Current academic year · Includes future dues'
                  }
                  icon={<AppIcon name="finance-balance" size={24} />}
                  tone="amber"
                  href={`/students/${student.id}?year=${state.academicYear.id}&tab=fees`}
                />
              )}
              {(!bridge || bridge.academics) && (
                <StatCard
                  label="Latest examination"
                  value={academic ? `${academic.percentage}%` : '—'}
                  detail={
                    academic
                      ? `${latestExam.name} · ${result?.absent ? 'Absent' : `Grade ${academic.grade}`}`
                      : 'No results recorded yet'
                  }
                  icon={<AppIcon name="trophy" size={24} />}
                  href={`/students/${student.id}?year=${state.academicYear.id}&tab=academics`}
                />
              )}
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
                      {row.className}
                      {row.sectionName ? ` · ${row.sectionName}` : ''}
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
                </div>
                {bridge ? (
                  <p className="panel-bottom-link">Parent messaging is not available yet.</p>
                ) : (
                  <Link className="panel-bottom-link" to="/notifications">
                    Open notification workspace <ArrowUpRight size={15} />
                  </Link>
                )}
              </Panel>
            </div>
            <Panel
              title="Recent student activity"
              subtitle="Records from the same school workspace"
            >
              <div className="student-activity">
                {(!bridge || bridge.attendance) && (
                  <div>
                    <span className="activity-icon blue">
                      <AppIcon name="attendance" size={20} />
                    </span>
                    <span>
                      <strong>{monthName} attendance summary</strong>
                      <small>
                        {attendance.marked} marked records · {attendance.absent} absent days
                      </small>
                    </span>
                  </div>
                )}
                {(!bridge || bridge.fees) && (
                  <div>
                    <span className="activity-icon green">
                      <AppIcon name="wallet" size={20} />
                    </span>
                    <span>
                      <strong>
                        {bridge ? (bridge.feeSummary?.paymentCount ?? 0) : fees.payments.length}{' '}
                        payments recorded
                      </strong>
                      <small>
                        {money(fees.paid)} paid toward {bridge ? 'recorded fees' : 'annual fees'}
                      </small>
                    </span>
                  </div>
                )}
                {(!bridge || bridge.academics) && (
                  <div>
                    <span className="activity-icon blue">
                      <AppIcon name="trophy" size={20} />
                    </span>
                    <span>
                      <strong>{latestExam?.name ?? 'No results recorded yet'}</strong>
                      <small>
                        {academic && `${academic.marks}/${academic.maximum}`}{' '}
                        {latestExam && ` · ${displayDate(latestExam.date)}`}
                      </small>
                    </span>
                  </div>
                )}
              </div>
            </Panel>
          </>
        )}
        {tab === 'attendance' && <StudentAttendance enrollmentId={enrollment.id} />}{' '}
        {tab === 'fees' &&
          (bridge ? bridge.feeContent : <StudentFees enrollmentId={enrollment.id} />)}{' '}
        {tab === 'academics' && <StudentAcademics enrollmentId={enrollment.id} />}{' '}
        {tab === 'documents' &&
          (bridge ? (
            bridge.documentContent
          ) : (
            <EntityDocuments ownerKind="student" ownerId={student.id} />
          ))}
      </div>
    </>
  );
}
