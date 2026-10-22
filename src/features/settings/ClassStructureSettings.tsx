import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Panel, Button, LoadingOverlay } from '../../components/ui/Primitives';
import ClassStructureView from './ClassStructureView';
import ClassStructureForm from './ClassStructureForm';
import ClassSetupDialog from './ClassSetupDialog';
import SubjectEditor from './SubjectEditor';
import { useRemote } from '../live/useRemote';
import type { ClassSettingsSource } from './data/contracts';
export default function ClassStructureSettings({
  source,
  renderStudents,
  permissions,
}: {
  source: ClassSettingsSource;
  renderStudents: (classId: string, changed: () => void) => ReactNode;
  permissions?: readonly string[];
}) {
  const [setup, setSetup] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => source.subscribe?.(() => setRevision((value) => value + 1)), [source]);
  const load = useCallback(
    (signal: AbortSignal) => {
      // Demo mutations from nested dialogs must also update the parent class counts.
      void revision;
      return source.load(signal);
    },
    [source, revision],
  );
  const state = useRemote(load);
  const can = (permission: string) => !permissions || permissions.includes(permission);
  if (state.error)
    return (
      <Panel>
        <p role="alert">{state.error}</p>
        <Button onClick={state.reload}>Retry class settings</Button>
      </Panel>
    );
  const data = state.data ?? {
    classes: [],
    sections: [],
    teachers: [],
    counts: [],
    writable: false,
  };
  return (
    <LoadingOverlay
      loading={state.loading || !state.data}
      size="xl"
      label="Loading class settings…"
      message="Loading class settings…"
    >
      <ClassStructureView
        {...data}
        setupAction={
          can('sections.manage') ? (
            <Button
              disabled={!data.writable || !can('classes.manage') || !can('sections.manage')}
              onClick={() => setSetup(true)}
            >
              Set up classes
            </Button>
          ) : undefined
        }
        canViewStudents={can('students.view')}
        canViewSubjects={can('subjects.view')}
        canManageClasses={data.writable && can('classes.manage')}
        canManageSections={data.writable && can('sections.manage')}
        renderStudents={(id) =>
          can('students.view') ? (
            renderStudents(id, state.reload)
          ) : (
            <Panel>Student access is not included in your role.</Panel>
          )
        }
        renderSubjects={(id) =>
          can('subjects.view') ? (
            <ClassSubjects
              key={id}
              source={source}
              classId={id}
              name={data.classes.find((c) => c.id === id)!.name}
              canManage={data.writable && can('subjects.manage')}
            />
          ) : (
            <Panel>Subject access is not included in your role.</Panel>
          )
        }
        renderEditor={(props) => {
          const record = (props.kind === 'class' ? data.classes : data.sections).find(
            (c) => c.id === props.id,
          );
          return (
            <ClassStructureForm
              key={`${props.kind}:${props.id ?? 'new'}`}
              {...props}
              initial={{
                name: record?.name ?? '',
                grade: record?.grade ?? '',
                teacherId: record?.teacherId ?? '',
              }}
              teachers={data.teachers.filter(
                (t) => !t.status || t.status === 'active' || t.id === record?.teacherId,
              )}
              canAssignTeacher={can('staff.view')}
              save={async (draft) => {
                await source.save(props.kind, draft, record, props.classId);
                state.reload();
              }}
            />
          );
        }}
        remove={async (kind, id) => {
          const record = (kind === 'class' ? data.classes : data.sections).find(
            (c) => c.id === id,
          )!;
          await source.remove(kind, record);
          state.reload();
        }}
      />
      {setup && (
        <ClassSetupDialog
          existing={data.classes.map((c) => c.name)}
          onClose={() => setSetup(false)}
          save={async (rows) => {
            await source.setupClasses(rows);
            state.reload();
          }}
        />
      )}
    </LoadingOverlay>
  );
}
function ClassSubjects({
  source,
  classId,
  name,
  canManage,
}: {
  source: ClassSettingsSource;
  classId: string;
  name: string;
  canManage: boolean;
}) {
  const load = useCallback(
    (signal: AbortSignal) => source.subjects(classId, signal),
    [source, classId],
  );
  const state = useRemote(load);
  if (state.error)
    return (
      <Panel>
        <p role="alert">{state.error}</p>
        <Button onClick={state.reload}>Retry subjects</Button>
      </Panel>
    );
  return (
    <LoadingOverlay
      loading={state.loading || !state.data}
      size="xl"
      label={`Loading ${name} subjects…`}
      message={`Loading ${name} subjects…`}
    >
      {state.data ? (
        <SubjectEditor
          initiallyUnsaved={canManage && state.data.some((s) => s.id.startsWith('default-'))}
          name={name}
          configured={state.data}
          canManage={canManage}
          save={(subjects) => source.saveSubjects(classId, subjects)}
        />
      ) : (
        <Panel title={`${name} subjects`}>
          <p>Configure subjects for {name}.</p>
        </Panel>
      )}
    </LoadingOverlay>
  );
}
