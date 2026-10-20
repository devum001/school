import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Modal, Panel } from '../../components/ui/Primitives';
import {
  onboardingApi,
  type StructureKind,
  type StructureRow,
  type SchoolCatalog,
} from '../../services/onboardingService';
import type { SchoolAccess } from '../../services/schoolAccessService';
import type { AcademicClass } from '../../services/schoolSetupService';
import { useRemote } from '../live/useRemote';
import { useDraftGuard } from '../academics/useDraftGuard';
import { LoadState } from './SetupControls';
const normalized = (name: string) =>
  name.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
type Draft = StructureRow & { key: string };
type Snapshot = Awaited<ReturnType<typeof onboardingApi.structure>>;
export default function BulkStructure({
  access,
  yearId,
  kind,
  changed,
}: {
  access: SchoolAccess;
  yearId: string | null;
  kind: StructureKind;
  changed: () => void;
}) {
  const load = useCallback(
    async (signal: AbortSignal) => {
      if (!yearId) return null;
      const [snapshot, catalog] = await Promise.all([
        onboardingApi.structure(access.schoolId, yearId, kind, signal),
        onboardingApi.catalog(access.schoolId, signal),
      ]);
      return { snapshot, catalog };
    },
    [access.schoolId, yearId, kind],
  );
  const state = useRemote(load);
  return (
    <Panel
      title={`Configure ${kind} together`}
      subtitle="Make your changes, review the whole batch, then save once."
    >
      <div className="live-content">
        <LoadState {...state} retry={state.reload} />
        {!yearId && (
          <p>
            Create and select an <Link to="/settings?tab=Years">academic year</Link> first.
          </p>
        )}
        {state.data && !state.error && (
          <BulkEditor
            key={`${yearId}:${kind}`}
            {...state.data}
            schoolId={access.schoolId}
            defaultSubjects={access.permissions.includes('subjects.manage')}
            kind={kind}
            manage={access.permissions.includes(`${kind}.manage`)}
            saved={() => {
              state.reload();
              changed();
            }}
          />
        )}
      </div>
    </Panel>
  );
}
function BulkEditor({
  defaultSubjects,
  snapshot,
  catalog,
  schoolId,
  kind,
  manage,
  saved,
}: {
  defaultSubjects: boolean;
  snapshot: Snapshot;
  catalog: SchoolCatalog;
  schoolId: string;
  kind: StructureKind;
  manage: boolean;
  saved: () => void;
}) {
  const initial: Draft[] = (kind === 'classes' ? snapshot.classes : snapshot.children).map(
    (item) => ({
      key: item.id,
      id: item.id,
      revision: item.revision,
      name: item.name,
      status: item.status,
      ...(kind === 'classes'
        ? { grade: 'grade' in item ? item.grade : '' }
        : {
            classId: 'classId' in item ? item.classId : '',
            ...(kind === 'subjects'
              ? { optional: 'optional' in item ? (item.optional ?? false) : false }
              : {}),
          }),
    }),
  );
  const [rows, setRows] = useState(initial),
    [review, setReview] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const [selected, setSelected] = useState<string[]>([]),
    [pattern, setPattern] = useState('A, B');
  const changes = rows.filter(
    (row) => JSON.stringify(row) !== JSON.stringify(initial.find((item) => item.key === row.key)),
  );
  const guard = useDraftGuard(changes.length > 0 && !busy, () => setRows(initial));
  const readonly = !manage || snapshot.year.status === 'closed' || snapshot.truncated;
  const classes = snapshot.classes.filter((item) => item.status === 'active');
  function patch(key: string, values: Partial<Draft>) {
    setRows((previous) => previous.map((row) => (row.key === key ? { ...row, ...values } : row)));
    setReview(false);
  }
  function add(names: string[], classId?: string, grade?: string) {
    setRows((previous) => {
      const next = [...previous];
      names
        .map((name) => name.trim())
        .filter(Boolean)
        .forEach((name) => {
          if (
            !next.some(
              (row) => row.classId === classId && normalized(row.name) === normalized(name),
            )
          )
            next.push({
              key: crypto.randomUUID(),
              name,
              status: 'active',
              ...(kind === 'classes'
                ? { grade: grade ?? '' }
                : { classId, ...(kind === 'subjects' ? { optional: false } : {}) }),
            });
        });
      return next;
    });
    setReview(false);
  }
  function remove(row: Draft) {
    if (row.id) patch(row.key, { status: row.status === 'active' ? 'archived' : 'active' });
    else setRows((previous) => previous.filter((item) => item.key !== row.key));
  }
  function validate() {
    const names = new Set<string>();
    for (const row of rows) {
      const name = `${row.classId ?? ''}:${normalized(row.name)}`;
      if (!row.name.trim() || names.has(name)) {
        setError(
          'Every name must be filled in and unique within its class. Archived names are also reserved.',
        );
        return;
      }
      names.add(name);
    }
    if (changes.length > 200) {
      setError('Save up to 200 changes per batch. Use fewer classes at a time.');
      return;
    }
    setError('');
    setReview(true);
  }
  const rowEditor = (row: Draft) => (
    <div className="bulk-item" key={row.key}>
      <input
        aria-label={`${kind === 'classes' ? 'Class' : kind === 'sections' ? 'Section' : 'Subject'} name`}
        maxLength={80}
        required
        value={row.name}
        disabled={readonly || busy}
        onChange={(event) => patch(row.key, { name: event.target.value })}
      />
      {kind === 'classes' && (
        <input
          aria-label="Grade code"
          maxLength={40}
          value={row.grade}
          disabled={readonly || busy}
          onChange={(event) => patch(row.key, { grade: event.target.value })}
        />
      )}
      {kind === 'subjects' && (
        <label className="bulk-check">
          <input
            type="checkbox"
            checked={row.optional ?? false}
            disabled={readonly || busy}
            onChange={(event) => patch(row.key, { optional: event.target.checked })}
          />
          Optional
        </label>
      )}
      <small>{row.id ? (row.status === 'active' ? 'Saved' : 'Archived') : 'New'}</small>
      {!readonly && (
        <Button type="button" variant="ghost" disabled={busy} onClick={() => remove(row)}>
          {!row.id ? 'Remove' : row.status === 'active' ? 'Archive' : 'Restore'}
        </Button>
      )}
    </div>
  );
  return (
    <>
      <p>
        <strong>{snapshot.year.name}</strong> ·{' '}
        <Link to="/settings?tab=Years">Change academic year</Link>
      </p>
      {snapshot.truncated && (
        <p role="alert">
          This school exceeds the bulk editor’s 200 classes / 2,000 children display limit. Use the
          detailed class view; bulk saving is disabled.
        </p>
      )}
      {snapshot.year.status === 'closed' && <p>This year is closed and read-only.</p>}
      <form
        data-unsaved={changes.length > 0}
        onSubmit={(event) => {
          event.preventDefault();
          validate();
        }}
      >
        <fieldset disabled={readonly || busy} className="bulk-tools">
          <legend>
            {kind === 'classes'
              ? 'Choose the grades your school offers'
              : 'Apply to selected classes'}
          </legend>
          {kind === 'classes' ? (
            <div className="bulk-grades">
              {catalog.grades.map((grade) => (
                <label key={grade.code}>
                  <input
                    type="checkbox"
                    checked={rows.some(
                      (row) => row.grade === grade.code && row.status === 'active',
                    )}
                    onChange={(event) => {
                      const existing = rows.find((row) => row.grade === grade.code);
                      if (existing && !existing.id && !event.target.checked)
                        setRows((old) => old.filter((row) => row.key !== existing.key));
                      else if (existing)
                        patch(existing.key, {
                          status: event.target.checked ? 'active' : 'archived',
                        });
                      else add([grade.name], undefined, grade.code);
                    }}
                  />
                  {grade.name}
                </label>
              ))}
            </div>
          ) : (
            <>
              <div className="bulk-grades">
                {classes.map((item) => (
                  <label key={item.id}>
                    <input
                      type="checkbox"
                      checked={selected.includes(item.id)}
                      onChange={(event) =>
                        setSelected((old) =>
                          event.target.checked
                            ? [...old, item.id]
                            : old.filter((id) => id !== item.id),
                        )
                      }
                    />
                    {item.name}
                  </label>
                ))}
              </div>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setSelected(classes.map((item) => item.id))}
              >
                Select all classes
              </Button>
              {kind === 'sections' ? (
                <label>
                  Section pattern (comma separated)
                  <input
                    value={pattern}
                    maxLength={500}
                    onChange={(event) => setPattern(event.target.value)}
                  />
                </label>
              ) : (
                <p>
                  {catalog.description} Existing subjects are kept. {catalog.version}
                </p>
              )}
              <Button
                type="button"
                variant="secondary"
                disabled={!selected.length}
                onClick={() =>
                  selected.forEach((id) => {
                    const parent = classes.find((item) => item.id === id)!;
                    const grade = catalog.grades.find(
                      (item) =>
                        item.code === parent.grade ||
                        normalized(item.name) === normalized(parent.name),
                    );
                    add(kind === 'sections' ? pattern.split(',') : (grade?.subjects ?? []), id);
                  })
                }
              >
                {kind === 'sections' ? 'Apply section pattern' : 'Suggest class-wise subjects'}
              </Button>
              {kind === 'subjects' && (
                <p>
                  Senior classes: choose your streams and add subjects as needed. Suggestions:{' '}
                  {catalog.seniorOptions.join(', ')}.
                </p>
              )}
            </>
          )}
        </fieldset>
        <div className="bulk-matrix">
          {kind === 'classes' ? (
            <>
              {rows.map(rowEditor)}
              {!readonly && (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() =>
                    setRows((old) => [
                      ...old,
                      { key: crypto.randomUUID(), name: '', grade: '', status: 'active' },
                    ])
                  }
                >
                  Add custom grade
                </Button>
              )}
            </>
          ) : (
            classes.map((parent) => (
              <ClassRows
                key={parent.id}
                parent={parent}
                rows={rows.filter((row) => row.classId === parent.id)}
                render={rowEditor}
                disabled={readonly || busy}
                kind={kind}
                add={(name) => add([name], parent.id)}
              />
            ))
          )}
        </div>
        {kind !== 'classes' && !classes.length && (
          <p>Add classes first to configure their {kind}.</p>
        )}
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        {!readonly && (
          <div className="live-actions">
            <Button disabled={busy || !changes.length}>Review {changes.length} changes</Button>
            <Button
              type="button"
              variant="secondary"
              disabled={busy || !changes.length}
              onClick={guard.requestClose}
            >
              Discard edits
            </Button>
          </div>
        )}
      </form>
      {review && (
        <Modal
          open
          title="Review academic structure"
          description="The entire batch succeeds together. Existing records retain their identities."
          onClose={() => {
            if (!busy) setReview(false);
          }}
        >
          <div className="live-content">
            <ul className="setup-records">
              {changes.map((row) => (
                <li key={row.key}>
                  {snapshot.classes.find((item) => item.id === row.classId)?.name} {row.name} ·{' '}
                  {row.id ? (row.status === 'archived' ? 'Archive' : 'Update') : 'Create'}
                  {row.optional ? ' · Optional' : ''}
                </li>
              ))}
            </ul>
            <p>
              Archiving preserves history. Active enrollments, assignments and children must be
              resolved first.
            </p>
            {error && <p role="alert">{error}</p>}
            <div className="live-actions">
              <Button variant="secondary" disabled={busy} onClick={() => setReview(false)}>
                Back to editing
              </Button>
              <Button
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  setError('');
                  try {
                    await onboardingApi.saveStructure(
                      schoolId,
                      snapshot.year.id,
                      kind,
                      changes.map((row) => {
                        const values = { ...row };
                        delete (values as Partial<Draft>).key;
                        return values;
                      }),
                      kind === 'classes' && defaultSubjects,
                    );
                    guard.complete(saved);
                  } catch (cause) {
                    setError(cause instanceof Error ? cause.message : 'Unable to save changes.');
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {busy ? 'Saving…' : 'Save batch'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
      {guard.confirming && (
        <Modal
          open
          title="Discard unsaved edits?"
          description="Saved school records will be kept."
          onClose={guard.keepEditing}
        >
          <div className="live-content">
            <Button onClick={guard.keepEditing}>Keep editing</Button>
            <Button variant="danger" onClick={guard.discard}>
              Discard edits
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
function ClassRows({
  parent,
  rows,
  render,
  disabled,
  kind,
  add,
}: {
  parent: AcademicClass;
  rows: Draft[];
  render: (row: Draft) => React.ReactNode;
  disabled: boolean;
  kind: StructureKind;
  add: (name: string) => void;
}) {
  const [name, setName] = useState('');
  return (
    <section className="bulk-class">
      <h3>{parent.name}</h3>
      {rows.map(render)}
      {!rows.length && <p>No {kind} saved yet.</p>}
      <div className="live-actions">
        <input
          aria-label={`New ${kind === 'sections' ? 'section' : 'subject'} for ${parent.name}`}
          maxLength={80}
          value={name}
          disabled={disabled}
          onChange={(event) => setName(event.target.value)}
        />
        <Button
          type="button"
          variant="secondary"
          disabled={disabled || !name.trim()}
          onClick={() => {
            add(name);
            setName('');
          }}
        >
          Add {kind === 'sections' ? 'section' : 'subject'}
        </Button>
      </div>
    </section>
  );
}
