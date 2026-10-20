import BulkStructure from './BulkStructure';
import RosterWorkspace from './RosterWorkspace';
import PeopleRelations from './PeopleRelations';
import { useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Check, Circle, ArrowRight } from 'lucide-react';
import { Button, Panel } from '../../components/ui/Primitives';
import { setupApi, type SetupStatus } from '../../services/schoolSetupService';
import type { SchoolAccess } from '../../services/schoolAccessService';
import { useRemote } from '../live/useRemote';
import LiveSchoolProfile from '../settings/LiveSchoolProfile';
import AcademicYears from './AcademicYears';
import AcademicStructure from './AcademicStructure';
import './setup.css';
import { nextSetupStep } from './setupProgress';
export default function SchoolSetup({
  access,
  mode = 'Setup',
}: {
  access: SchoolAccess;
  mode?:
    | 'Setup'
    | 'Years'
    | 'Classes'
    | 'Overview'
    | 'Staff'
    | 'Students'
    | 'Assignments'
    | 'Enrollments';
}) {
  const load = useCallback(
    (signal: AbortSignal) => setupApi.status(access.schoolId, signal),
    [access.schoolId],
  );
  const state = useRemote(load),
    [params] = useSearchParams();
  if (!state.data || state.error)
    return (
      <Panel>
        <div className="live-content">
          {state.loading ? (
            <p role="status">Loading saved school setup…</p>
          ) : (
            <>
              <h2>School setup unavailable</h2>
              <p role="alert">{state.error}</p>
              <Button onClick={state.reload}>Retry school setup</Button>
            </>
          )}
        </div>
      </Panel>
    );
  const status = state.data,
    requested = params.get('step');
  const step =
    requested &&
    [
      'profile',
      'years',
      'structure',
      'sections',
      'subjects',
      'staff',
      'students',
      'branding',
      'review',
    ].includes(requested)
      ? requested
      : nextSetupStep({
          ...status,
          steps: status.steps.filter((item) => access.permissions.includes(item.permission)),
        });
  const can = (permission: string) => access.permissions.includes(permission);
  const target =
    mode === 'Staff'
      ? 'staff'
      : mode === 'Students'
        ? 'students'
        : mode === 'Assignments'
          ? 'assignments'
          : mode === 'Enrollments'
            ? 'enrollments'
            : mode === 'Years'
              ? 'years'
              : mode === 'Classes'
                ? 'structure'
                : mode === 'Overview'
                  ? 'review'
                  : step;
  const permissions: Record<string, string[]> = {
    profile: ['school.profile.view'],
    branding: ['school.profile.view'],
    years: ['academic-years.view'],
    structure: ['classes.view', 'academic-years.view'],
    sections: ['classes.view', 'academic-years.view', 'sections.view'],
    staff: ['staff.view'],
    students: ['students.view'],
    assignments: ['assignments.view'],
    enrollments: ['students.view'],
    subjects: ['classes.view', 'academic-years.view', 'subjects.view'],
    review: [],
  };
  const visible = permissions[target].every(can);
  return (
    <div className="setup-workspace">
      {mode === 'Setup' && (
        <Panel className="setup-progress">
          <div className="live-content">
            <div className="setup-intro">
              <div>
                <span className="eyebrow">YOUR SCHOOL WORKSPACE</span>
                <h2>
                  {status.ready ? 'Your school foundation is ready' : 'Let’s set up your school'}
                </h2>
                <p>Each step is saved to your school. Return here whenever you need to continue.</p>
              </div>
              <span className="setup-count">
                {status.steps.filter((item) => item.required && item.status === 'complete').length}{' '}
                / {status.steps.filter((item) => item.required).length} ready
              </span>
            </div>
            <nav aria-label="School setup steps" className="setup-steps">
              {status.steps
                .filter((item) => access.permissions.includes(item.permission))
                .map((item, index) => (
                  <Link
                    key={item.key}
                    to={`/settings?tab=Setup&step=${item.key}`}
                    aria-current={target === item.key ? 'step' : undefined}
                  >
                    <span
                      className={`setup-step-icon ${item.status === 'complete' ? 'complete' : ''}`}
                    >
                      {item.status === 'complete' ? <Check size={17} /> : <Circle size={17} />}
                    </span>
                    <span>
                      <strong>
                        {index + 1}. {item.label}
                      </strong>
                      <small>{item.required ? item.status.replace('-', ' ') : 'Optional'}</small>
                    </span>
                  </Link>
                ))}
              <Link
                to="/settings?tab=Setup&step=review"
                aria-current={target === 'review' ? 'step' : undefined}
              >
                <ArrowRight size={18} />
                <strong>Review</strong>
              </Link>
            </nav>
          </div>
        </Panel>
      )}
      {!visible ? (
        <Panel>
          <div className="live-content">
            <h2>An administrator needs to complete this step</h2>
            <p>
              Your role does not include all the viewing permissions for this area. Your other
              available settings remain accessible.
            </p>
            <Link to="/settings?tab=Account">Open your account</Link>
          </div>
        </Panel>
      ) : target === 'profile' || target === 'branding' ? (
        <LiveSchoolProfile
          schoolId={access.schoolId}
          canManage={can('school.profile.manage')}
          onSaved={state.reload}
        />
      ) : target === 'years' ? (
        <AcademicYears access={access} status={status} changed={state.reload} />
      ) : target === 'staff' || target === 'students' ? (
        <RosterWorkspace
          key={`${access.schoolId}:${target}`}
          access={access}
          kind={target}
          yearId={params.get('year') ?? status.currentAcademicYearId}
        />
      ) : target === 'assignments' || target === 'enrollments' ? (
        <PeopleRelations
          access={access}
          yearId={params.get('year') ?? status.currentAcademicYearId}
          kind={target === 'assignments' ? 'teaching-assignments' : 'enrollments'}
        />
      ) : target === 'structure' || target === 'sections' || target === 'subjects' ? (
        <>
          <nav className="live-actions" aria-label="Academic structure sections">
            {['structure', 'sections', 'subjects']
              .filter((key) => permissions[key].every(can))
              .map((key) => (
                <Link
                  key={key}
                  to={`/settings?tab=Setup&step=${key}${params.get('year') ? `&year=${params.get('year')}` : ''}`}
                >
                  {key === 'structure'
                    ? 'Grade selection'
                    : key === 'sections'
                      ? 'Sections'
                      : 'Subjects'}
                </Link>
              ))}
          </nav>
          <Link
            to={`/settings?tab=${mode}&step=${target}${params.get('year') ? `&year=${params.get('year')}` : ''}${params.get('view') === 'detail' ? '' : '&view=detail'}`}
          >
            {params.get('view') === 'detail'
              ? 'Open bulk editor'
              : 'Detailed class view and individual corrections'}
          </Link>
          {params.get('view') === 'detail' ? (
            <AcademicStructure
              access={access}
              yearId={params.get('year') ?? status.currentAcademicYearId}
              changed={state.reload}
            />
          ) : (
            <BulkStructure
              key={`${target}:${params.get('year') ?? status.currentAcademicYearId}`}
              access={access}
              yearId={params.get('year') ?? status.currentAcademicYearId}
              kind={target === 'structure' ? 'classes' : target}
              changed={state.reload}
            />
          )}
        </>
      ) : (
        <Review access={access} status={status} overview={mode === 'Overview'} />
      )}
    </div>
  );
}
function Review({
  status,
  overview,
  access,
}: {
  status: SetupStatus;
  overview: boolean;
  access: SchoolAccess;
}) {
  return (
    <Panel
      title={overview ? 'School overview' : 'Review school setup'}
      subtitle={
        status.ready
          ? 'Your required setup is saved and complete.'
          : 'Complete the required steps before starting school operations.'
      }
    >
      <div className="live-content">
        <ul className="setup-review">
          {status.steps.map((step) => (
            <li key={step.key}>
              <div>
                <strong>{step.label}</strong>
                <p>{step.detail}</p>
              </div>
              <span>
                {step.status === 'complete'
                  ? 'Complete'
                  : step.required
                    ? 'Needs attention'
                    : 'Optional'}
              </span>
              {access.permissions.includes(step.permission) && (
                <Link to={`/settings?tab=Setup&step=${step.key}`}>
                  {step.status === 'complete' ? 'Review' : 'Continue'}
                </Link>
              )}
            </li>
          ))}
        </ul>
        <div className="roster-totals">
          {Object.entries({
            Classes: status.counts.classes,
            Sections: status.counts.sections ?? 0,
            Subjects: status.counts.subjects ?? 0,
            Staff: status.counts.staff ?? 0,
            Teachers: status.counts.teachers ?? 0,
            Students: status.counts.students ?? 0,
            Enrollments: status.counts.enrollments ?? 0,
            Assignments: status.counts.assignments ?? 0,
          }).map(([label, count]) => (
            <div key={label}>
              <strong>{count}</strong>
              <span>{label}</span>
            </div>
          ))}
        </div>
        <p>
          Counts come from saved records. Classes, sections, subjects, enrollments and assignments
          reflect the current academic year; staff and student identities belong to the school.
        </p>
        <div className="live-actions">
          {[
            ['staff.view', 'Staff'],
            ['students.view', 'Students'],
            ['students.view', 'Enrollments'],
            ['assignments.view', 'Assignments'],
          ]
            .filter(([permission]) => access.permissions.includes(permission))
            .map(([, tab]) => (
              <Link key={tab} className="button secondary" to={`/settings?tab=${tab}`}>
                Open {tab.toLowerCase()}
              </Link>
            ))}
        </div>
        {status.ready && !overview && (
          <Link className="button primary" to="/settings?tab=Overview">
            Open school dashboard
          </Link>
        )}
        <p className="panel-note">
          School setup, staff, student enrollments and teaching assignments use saved school
          records. Attendance, finance and examinations are not connected yet.
        </p>
      </div>
    </Panel>
  );
}
