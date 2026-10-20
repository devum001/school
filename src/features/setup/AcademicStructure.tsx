import { useCallback, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Badge, Button, Panel } from '../../components/ui/Primitives';
import {
  setupApi,
  type AcademicClass,
  type AcademicChild,
  type ChildKind,
  type AcademicYear,
} from '../../services/schoolSetupService';
import type { SchoolAccess } from '../../services/schoolAccessService';
import { useRemote } from '../live/useRemote';
import { useSetupList } from './useSetupList';
import { ConfirmAction, LoadState, Paging } from './SetupControls';
import StructureEditor from './StructureEditor';
export default function AcademicStructure({
  access,
  yearId,
  changed,
}: {
  access: SchoolAccess;
  yearId: string | null;
  changed: () => void;
}) {
  if (!yearId)
    return (
      <Panel>
        <div className="live-content">
          <h2>Select an academic year first</h2>
          <p>Use Academic years to create a year and choose its class structure.</p>
          <Link className="button primary" to="/settings?tab=Years">
            Open academic years
          </Link>
        </div>
      </Panel>
    );
  return (
    <YearStructure
      key={`${access.schoolId}:${yearId}`}
      access={access}
      yearId={yearId}
      changed={changed}
    />
  );
}
function YearStructure({
  access,
  yearId,
  changed,
}: {
  access: SchoolAccess;
  yearId: string;
  changed: () => void;
}) {
  const load = useCallback(
    (signal: AbortSignal) => setupApi.year(access.schoolId, yearId, signal),
    [access.schoolId, yearId],
  );
  const year = useRemote(load);
  return (
    <>
      <LoadState {...year} retry={year.reload} />
      {year.data && !year.error && <ClassList access={access} year={year.data} changed={changed} />}
    </>
  );
}
function ClassList({
  access,
  year,
  changed,
}: {
  access: SchoolAccess;
  year: AcademicYear;
  changed: () => void;
}) {
  const load = useCallback(
    (signal: AbortSignal, after?: string) =>
      setupApi.classes(access.schoolId, year.id, signal, after),
    [access.schoolId, year.id],
  );
  const state = useSetupList(load),
    [params, setParams] = useSearchParams();
  const [editing, setEditing] = useState<AcademicClass | 'new' | null>(null),
    [archiving, setArchiving] = useState<AcademicClass | null>(null);
  const selected =
    state.data?.items.find((item) => item.id === params.get('class')) ?? state.data?.items[0];
  const manage = year.status !== 'closed' && access.permissions.includes('classes.manage');
  const saved = () => {
    state.reload();
    changed();
  };
  return (
    <div className="setup-stack">
      <Panel
        title={`Classes · ${year.name}`}
        subtitle={
          year.status === 'closed'
            ? 'This academic year is closed. Its structure is read-only.'
            : 'Create classes, then configure their sections and subjects.'
        }
        action={manage && <Button onClick={() => setEditing('new')}>Add class</Button>}
      >
        <div className="live-content">
          <Link to="/settings?tab=Years">Choose another academic year</Link>
          <LoadState {...state} retry={state.reload} />
          {state.data && !state.error && (
            <>
              <div className="setup-class-list">
                {state.data.items.map((record) => (
                  <div
                    className={`setup-class-item ${selected?.id === record.id ? 'selected' : ''}`}
                    key={record.id}
                  >
                    <button
                      className="setup-class-select"
                      aria-pressed={selected?.id === record.id}
                      onClick={() =>
                        setParams((previous) => {
                          const next = new URLSearchParams(previous);
                          next.set('class', record.id);
                          return next;
                        })
                      }
                    >
                      <strong>{record.name}</strong>
                      <small>
                        {record.grade || 'Class'} · {record.status}
                      </small>
                    </button>
                    {manage && (
                      <div className="live-actions">
                        <Button variant="ghost" onClick={() => setEditing(record)}>
                          Edit {record.name}
                        </Button>
                        <Button variant="ghost" onClick={() => setArchiving(record)}>
                          {record.status === 'active' ? 'Archive' : 'Restore'}
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {!state.data.items.length && <p>No classes in this year yet.</p>}
              <Paging {...state} nextCursor={state.data.nextCursor} />
            </>
          )}
        </div>
      </Panel>
      {selected && !state.error && (
        <div key={selected.id} className="setup-grid">
          {(['sections', 'subjects'] as const).map((kind) =>
            access.permissions.includes(`${kind}.view`) ? (
              <Children
                key={kind}
                kind={kind}
                access={access}
                year={year}
                parent={selected}
                changed={changed}
              />
            ) : (
              <Panel key={kind}>
                <div className="live-content">
                  <h2>{kind === 'sections' ? 'Sections' : 'Subjects'}</h2>
                  <p>
                    Your role does not include viewing {kind}. Ask an administrator to complete this
                    part.
                  </p>
                </div>
              </Panel>
            ),
          )}
        </div>
      )}
      {editing && (
        <StructureEditor
          title={editing === 'new' ? 'Add class' : 'Edit class'}
          initialName={editing === 'new' ? '' : editing.name}
          initialGrade={editing === 'new' ? '' : editing.grade}
          save={(name, grade) =>
            setupApi.saveClass(
              access.schoolId,
              year.id,
              { name, grade },
              editing === 'new' ? undefined : editing,
            )
          }
          close={() => setEditing(null)}
          saved={saved}
        />
      )}
      {archiving && (
        <ConfirmAction
          title={archiving.status === 'active' ? 'Archive class?' : 'Restore class?'}
          description="Records and identifiers are preserved. Active sections and subjects must be archived before their class."
          action={() =>
            setupApi.saveClass(
              access.schoolId,
              year.id,
              {
                name: archiving.name,
                grade: archiving.grade,
                status: archiving.status === 'active' ? 'archived' : 'active',
              },
              archiving,
            )
          }
          close={() => setArchiving(null)}
          saved={saved}
        />
      )}
    </div>
  );
}
function Children({
  kind,
  access,
  year,
  parent,
  changed,
}: {
  kind: ChildKind;
  access: SchoolAccess;
  year: AcademicYear;
  parent: AcademicClass;
  changed: () => void;
}) {
  const load = useCallback(
    (signal: AbortSignal, after?: string) =>
      setupApi.children(kind, access.schoolId, year.id, parent.id, signal, after),
    [kind, access.schoolId, year.id, parent.id],
  );
  const state = useSetupList(load),
    [editing, setEditing] = useState<AcademicChild | 'new' | null>(null),
    [archiving, setArchiving] = useState<AcademicChild | null>(null);
  const manage =
    access.permissions.includes(`${kind}.manage`) &&
    year.status !== 'closed' &&
    parent.status === 'active';
  const singular = kind === 'sections' ? 'section' : 'subject';
  const saved = () => {
    state.reload();
    changed();
  };
  return (
    <Panel
      title={`${kind === 'sections' ? 'Sections' : 'Subjects'} · ${parent.name}`}
      action={
        manage && (
          <Button variant="secondary" onClick={() => setEditing('new')}>
            Add {singular}
          </Button>
        )
      }
    >
      <div className="live-content">
        <LoadState {...state} retry={state.reload} />
        {state.data && !state.error && (
          <>
            <ul className="setup-records">
              {state.data.items.map((item) => (
                <li key={item.id}>
                  <div>
                    <strong>{item.name}</strong> <Badge>{item.status}</Badge>
                  </div>
                  {manage && (
                    <div className="live-actions">
                      <Button variant="ghost" onClick={() => setEditing(item)}>
                        Edit {item.name}
                      </Button>
                      <Button variant="ghost" onClick={() => setArchiving(item)}>
                        {item.status === 'active' ? 'Archive' : 'Restore'}
                      </Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
            {!state.data.items.length && (
              <p>
                No {kind} yet. Add the first {singular} for this class.
              </p>
            )}
            <Paging {...state} nextCursor={state.data.nextCursor} />
          </>
        )}
        {kind === 'sections' && (
          <p className="panel-note">
            Class-teacher assignment will be available with staff management.
          </p>
        )}
      </div>
      {editing && (
        <StructureEditor
          title={`${editing === 'new' ? 'Add' : 'Edit'} ${singular}`}
          initialName={editing === 'new' ? '' : editing.name}
          save={(name) =>
            setupApi.saveChild(
              kind,
              access.schoolId,
              year.id,
              parent.id,
              { name },
              editing === 'new' ? undefined : editing,
            )
          }
          close={() => setEditing(null)}
          saved={saved}
        />
      )}
      {archiving && (
        <ConfirmAction
          title={`${archiving.status === 'active' ? 'Archive' : 'Restore'} ${singular}?`}
          description="Its identity and historical associations will be preserved. Archiving may make school setup incomplete."
          action={() =>
            setupApi.saveChild(
              kind,
              access.schoolId,
              year.id,
              parent.id,
              {
                name: archiving.name,
                status: archiving.status === 'active' ? 'archived' : 'active',
              },
              archiving,
            )
          }
          close={() => setArchiving(null)}
          saved={saved}
        />
      )}
    </Panel>
  );
}
