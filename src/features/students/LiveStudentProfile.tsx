import { useCallback, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { SchoolFeatureContext, type SchoolFeatureData } from '../../app/schoolFeatureContext';
import { Button, LoadingOverlay, Panel } from '../../components/ui/Primitives';
import EntityDocuments from '../../components/shared/EntityDocuments';
import DeleteDialog from '../../components/shared/DeleteDialog';
import { loadStudentProfile, studentDocumentApi } from '../../services/studentProfileService';
import { productApi } from '../../services/productService';
import { feeApi, type FeeStudentRow } from '../../services/feeService';
import { useLiveSchool } from '../live/schoolContext';
import { useRemote } from '../live/useRemote';
import FeeStudentLedger from '../fees/FeeStudentLedger';
import StudentProfilePage from './StudentProfilePage';
import { StudentProfileBridge } from './studentProfileBridge';
import LiveStudentForm from './LiveStudentForm';
const unsupported = async (): Promise<never> => {
  throw new Error('Use the class workspace to update learning records.');
};
export default function LiveStudentProfile({ yearId }: { yearId: string | null }) {
  const { schoolId, access } = useLiveSchool(),
    { studentId = '' } = useParams(),
    navigate = useNavigate();
  const load = useCallback(
    (signal: AbortSignal) =>
      yearId ? loadStudentProfile(schoolId, yearId, studentId, signal) : Promise.resolve(null),
    [schoolId, yearId, studentId],
  );
  const state = useRemote(load),
    [editing, setEditing] = useState(false),
    [deleting, setDeleting] = useState(false);
  if (!yearId)
    return (
      <Panel title="Select an academic year">
        Choose the student's academic year to view their profile.
      </Panel>
    );
  if (!state.data)
    return (
      <LoadingOverlay loading={state.loading} label="Loading student profile…">
        <Panel>
          {state.error && (
            <>
              <p role="alert" className="form-error">
                {state.error}
              </p>
              <Button onClick={state.reload}>Retry</Button>
            </>
          )}
        </Panel>
      </LoadingOverlay>
    );
  const data = state.data,
    row = data.row;
  const feature: SchoolFeatureData = {
    state: data.snapshot.state,
    mode: 'live',
    today: data.snapshot.today,
    canManage: false,
    unavailable: [],
    getSnapshot: () => data.snapshot.state,
    createTest: unsupported,
    updateTest: unsupported,
    deleteTest: unsupported,
    saveMarksSheets: unsupported,
    saveAttendance: unsupported,
  };
  return (
    <SchoolFeatureContext.Provider value={feature}>
      <StudentProfileBridge.Provider
        value={{
          ...data.capabilities,
          feeSummary: data.feeSummary,
          edit: () => setEditing(true),
          remove: () => setDeleting(true),
          feeContent: (
            <ProfileFees
              schoolId={schoolId}
              yearId={yearId}
              row={row}
              permissions={access.permissions}
              changed={state.reload}
            />
          ),
          documentContent: (
            <ProfileDocuments
              schoolId={schoolId}
              studentId={studentId}
              manage={access.permissions.includes('students.manage')}
            />
          ),
        }}
      >
        {editing ? (
          <ProfileEdit
            schoolId={schoolId}
            yearId={yearId}
            row={row}
            close={() => setEditing(false)}
            saved={() => {
              setEditing(false);
              state.reload();
            }}
          />
        ) : (
          <StudentProfilePage />
        )}
        {deleting && (
          <DeleteDialog
            title={`Delete ${row.student.name}?`}
            description="Permanently delete this student and their documents. Students with fee records are protected."
            onClose={() => setDeleting(false)}
            onDelete={async () => {
              await productApi.deleteStudent(schoolId, yearId, row.student);
              navigate('/students');
            }}
          />
        )}
      </StudentProfileBridge.Provider>
    </SchoolFeatureContext.Provider>
  );
}
function ProfileEdit({
  schoolId,
  yearId,
  row,
  close,
  saved,
}: {
  schoolId: string;
  yearId: string;
  row: Awaited<ReturnType<typeof loadStudentProfile>>['row'];
  close: () => void;
  saved: () => void;
}) {
  const load = useCallback(
    (signal: AbortSignal) => productApi.studentContext(schoolId, yearId, signal),
    [schoolId, yearId],
  );
  const state = useRemote(load);
  return (
    <LoadingOverlay loading={state.loading} label="Loading student details…">
      {state.data && (
        <LiveStudentForm
          schoolId={schoolId}
          yearId={yearId}
          existing={row}
          snapshot={state.data}
          presentation="page"
          close={close}
          saved={saved}
        />
      )}{' '}
      {state.error && (
        <p className="form-error" role="alert">
          {state.error}
        </p>
      )}
    </LoadingOverlay>
  );
}
function ProfileFees({
  schoolId,
  yearId,
  row,
  permissions,
  changed,
}: {
  schoolId: string;
  yearId: string;
  row: Awaited<ReturnType<typeof loadStudentProfile>>['row'];
  permissions: readonly string[];
  changed: () => void;
}) {
  const load = useCallback(
    (signal: AbortSignal) => feeApi.context(schoolId, yearId, signal),
    [schoolId, yearId],
  );
  const state = useRemote(load);
  const student: FeeStudentRow = {
    id: row.student.id,
    name: row.student.name,
    code: row.student.code,
    enrollment: {
      classId: row.classId,
      ...(row.sectionId ? { sectionId: row.sectionId } : {}),
      status: row.status,
    },
    configured: false,
    net: 0,
    outstanding: 0,
    overdue: 0,
    pending: 0,
    paid: 0,
    oldDues: 0,
    nextDue: null,
  };
  return (
    <LoadingOverlay loading={state.loading} label="Loading student fees…">
      {state.data && (
        <FeeStudentLedger
          embedded
          schoolId={schoolId}
          context={state.data}
          student={student}
          permissions={permissions}
          close={() => {}}
          changed={changed}
        />
      )}{' '}
      {state.error && (
        <p className="form-error" role="alert">
          {state.error}
        </p>
      )}
    </LoadingOverlay>
  );
}
function ProfileDocuments({
  schoolId,
  studentId,
  manage,
}: {
  schoolId: string;
  studentId: string;
  manage: boolean;
}) {
  const load = useCallback(
    (signal: AbortSignal) => studentDocumentApi.list(schoolId, studentId, signal),
    [schoolId, studentId],
  );
  const state = useRemote(load);
  return (
    <LoadingOverlay loading={state.loading} label="Loading student documents…">
      <EntityDocuments
        ownerKind="student"
        ownerId={studentId}
        adapter={{
          documents: state.data ?? [],
          canManage: manage,
          load: async (id) =>
            (await studentDocumentApi.list(schoolId, studentId, undefined, id))[0],
          save: async (input) => {
            await studentDocumentApi.save(schoolId, studentId, input);
            state.reload();
          },
          remove: async (id) => {
            await studentDocumentApi.remove(schoolId, studentId, id);
            state.reload();
          },
        }}
      />
      {state.error && (
        <p className="form-error" role="alert">
          {state.error}
        </p>
      )}
    </LoadingOverlay>
  );
}
