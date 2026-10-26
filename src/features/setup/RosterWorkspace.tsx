import { displayTimestamp } from '../../lib/displayFormat';
import { useCallback, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button, Modal, Panel } from '../../components/ui/Primitives';
import { onboardingApi, type RosterKind, type Person } from '../../services/onboardingService';
import { setupApi } from '../../services/schoolSetupService';
import { accessError, type SchoolAccess } from '../../services/schoolAccessService';
import {
  rosterColumns,
  rosterInstructions,
  downloadRosterTemplate,
  readRosterFile,
} from '../../lib/liveRosterImport';
import { useSetupList } from './useSetupList';
import { ConfirmAction, LoadState, Paging } from './SetupControls';
import { useDraftGuard } from '../academics/useDraftGuard';
import ImportJob from './ImportJob';
export default function RosterWorkspace({
  access,
  kind,
  yearId,
}: {
  access: SchoolAccess;
  kind: RosterKind;
  yearId: string | null;
}) {
  const [params, setParams] = useSearchParams(),
    jobId = params.get('import');
  const manage = access.permissions.includes(`${kind}.manage`);
  const openJob = (id: string | null) =>
    setParams((previous) => {
      const next = new URLSearchParams(previous);
      if (id) next.set('import', id);
      else next.delete('import');
      return next;
    });
  if (jobId && manage)
    return (
      <ImportJob key={jobId} schoolId={access.schoolId} jobId={jobId} close={() => openJob(null)} />
    );
  return (
    <div className="setup-stack">
      {manage && (
        <ImportStart
          key={`${access.schoolId}:${kind}:${yearId}`}
          schoolId={access.schoolId}
          kind={kind}
          yearId={yearId}
          openJob={openJob}
        />
      )}
      <Directory key={`${access.schoolId}:${kind}`} access={access} kind={kind} />
      {manage && <History schoolId={access.schoolId} kind={kind} openJob={openJob} />}
    </div>
  );
}
function ImportStart({
  schoolId,
  kind,
  yearId,
  openJob,
}: {
  schoolId: string;
  kind: RosterKind;
  yearId: string | null;
  openJob: (id: string) => void;
}) {
  const [selectedYear, setYear] = useState(yearId ?? ''),
    [mode, setMode] = useState<'create' | 'update'>('create'),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [individual, setIndividual] = useState(false);
  const load = useCallback(
    (signal: AbortSignal, after?: string) => setupApi.years(schoolId, signal, after),
    [schoolId],
  );
  const years = useSetupList(load);
  async function preview(grid: string[][]) {
    const result = await onboardingApi.preview(schoolId, selectedYear, kind, mode, grid);
    openJob(result.id);
  }
  return (
    <Panel
      title={kind === 'staff' ? 'Bring your staff into the school' : 'Import your student roster'}
      subtitle={
        kind === 'staff'
          ? 'Add teachers and non-teaching staff together. Profiles do not create login accounts.'
          : 'Permanent student identities, with a separate enrollment for each academic year.'
      }
    >
      <div className="live-content">
        <div className="live-actions">
          <Button variant="secondary" onClick={() => downloadRosterTemplate(kind, 'csv')}>
            Download CSV template
          </Button>
          <Button variant="secondary" onClick={() => downloadRosterTemplate(kind, 'xlsx')}>
            Download XLSX template
          </Button>
        </div>
        <details>
          <summary>Column guide and safe re-import rules</summary>
          <ul>
            {rosterInstructions.map((text) => (
              <li key={text}>{text}</li>
            ))}
          </ul>
          <p>
            {kind === 'staff'
              ? 'Required: Staff Code, Staff Name, Teaching (Yes/No). Other fields are optional.'
              : 'Required: Admission Number, Student Name, Class, Section. Roll number and personal/contact fields are optional.'}
          </p>
        </details>
        <LoadState {...years} retry={years.reload} />
        <div className="setup-grid">
          <label>
            Import academic year
            <select
              value={selectedYear}
              disabled={busy}
              onChange={(event) => setYear(event.target.value)}
            >
              <option value="">Choose a year</option>
              {selectedYear && !years.data?.items.some((item) => item.id === selectedYear) && (
                <option value={selectedYear}>Selected academic year</option>
              )}
              {years.data?.items.map((year) => (
                <option key={year.id} value={year.id} disabled={year.status === 'closed'}>
                  {year.name} · {year.status}
                </option>
              ))}
            </select>
          </label>
          <label>
            Matching existing records
            <select
              disabled={busy}
              value={mode}
              onChange={(event) => setMode(event.target.value as 'create' | 'update')}
            >
              <option value="create">Create new · skip identical</option>
              <option value="update">Update matching profiles</option>
            </select>
          </label>
        </div>
        <Paging {...years} nextCursor={years.data?.nextCursor} />
        {!years.data?.items.length && !years.loading && (
          <p>
            <Link to="/settings?tab=Years">Create an academic year</Link> before importing.
          </p>
        )}
        {mode === 'update' && (
          <p className="form-error">
            Update mode replaces profile details for matching codes. Blank optional fields clear
            saved values. Class, section and roll changes to existing enrollments are rejected.
          </p>
        )}
        <label className="roster-upload">
          Choose CSV or XLSX to preview
          <input
            type="file"
            accept=".csv,.xlsx"
            disabled={busy || !selectedYear}
            onChange={async (event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (!file) return;
              setBusy(true);
              setError('');
              try {
                await preview(await readRosterFile(file, kind));
              } catch (cause) {
                setError(
                  cause instanceof Error ? cause.message : 'Unable to read or upload this file.',
                );
              } finally {
                setBusy(false);
              }
            }}
          />
        </label>
        <p>
          Up to 1,000 records and 1 MiB per file. Nothing is added to the roster until you review
          and confirm.
        </p>
        {busy && <p role="status">Preparing the saved preview…</p>}
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <Button
          variant="ghost"
          disabled={busy || !selectedYear}
          onClick={() => setIndividual(true)}
        >
          Add one {kind === 'staff' ? 'staff member' : 'student'}
        </Button>
        {individual && (
          <Individual kind={kind} preview={preview} close={() => setIndividual(false)} />
        )}
      </div>
    </Panel>
  );
}
function Individual({
  kind,
  preview,
  close,
}: {
  kind: RosterKind;
  preview: (grid: string[][]) => Promise<void>;
  close: () => void;
}) {
  const columns = rosterColumns[kind],
    [cells, setCells] = useState(columns.map(() => '')),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const dirty = cells.some(Boolean),
    guard = useDraftGuard(dirty && !busy, close);
  return (
    <Modal
      open
      title={
        guard.confirming
          ? 'Discard this record?'
          : `Add one ${kind === 'staff' ? 'staff member' : 'student'}`
      }
      description="The record goes through the same preview and validation as a file import."
      onClose={() => {
        if (!busy) guard.requestClose();
      }}
    >
      {guard.confirming ? (
        <div className="live-content">
          <Button onClick={guard.keepEditing}>Keep editing</Button>
          <Button variant="danger" onClick={guard.discard}>
            Discard
          </Button>
        </div>
      ) : (
        <form
          data-unsaved={dirty}
          className="live-form"
          onSubmit={async (event) => {
            event.preventDefault();
            setBusy(true);
            try {
              await preview([columns, cells]);
              guard.complete(close);
            } catch (cause) {
              setError(accessError(cause));
            } finally {
              setBusy(false);
            }
          }}
        >
          {columns.map((column, index) => (
            <label key={column}>
              {column}
              <input
                disabled={busy}
                maxLength={300}
                value={cells[index]}
                onChange={(event) =>
                  setCells((old) =>
                    old.map((value, i) => (i === index ? event.target.value : value)),
                  )
                }
              />
            </label>
          ))}
          {error && <p role="alert">{error}</p>}
          <Button disabled={busy}>Validate and preview</Button>
        </form>
      )}
    </Modal>
  );
}
function Directory({ access, kind }: { access: SchoolAccess; kind: RosterKind }) {
  const [search, setSearch] = useState(''),
    [query, setQuery] = useState(''),
    [changing, setChanging] = useState<Person | null>(null);
  const load = useCallback(
    (signal: AbortSignal, after?: string) =>
      onboardingApi.people(access.schoolId, kind, signal, after, query),
    [access.schoolId, kind, query],
  );
  const state = useSetupList(load),
    manage = access.permissions.includes(`${kind}.manage`);
  return (
    <Panel
      title={kind === 'staff' ? 'Staff directory' : 'Student directory'}
      subtitle={
        kind === 'staff'
          ? 'Teaching and non-teaching profiles. Login access is managed separately in Members.'
          : 'One permanent identity per admission number. Use Imports to add a new year’s enrollments.'
      }
    >
      <div className="live-content">
        <form
          className="live-actions"
          onSubmit={(event) => {
            event.preventDefault();
            state.first();
            setQuery(search);
          }}
        >
          <input
            aria-label="Search directory"
            maxLength={80}
            placeholder="Search name or code"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <Button variant="secondary">Search</Button>
          <Button type="button" variant="ghost" onClick={state.reload}>
            Refresh directory
          </Button>
        </form>
        <LoadState
          {...state}
          label={kind === 'staff' ? 'Loading staff directory…' : 'Loading student directory…'}
          retry={state.reload}
        />
        {!state.error && (
          <>
            <div className="onboarding-table">
              <table>
                <caption>{kind === 'staff' ? 'Staff records' : 'Student identities'}</caption>
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Name</th>
                    <th>{kind === 'staff' ? 'Role / department' : 'Guardian'}</th>
                    <th>Contact</th>
                    <th>Status</th>
                    {manage && <th>Action</th>}
                  </tr>
                </thead>
                <tbody>
                  {(state.data?.items ?? []).map((person) => (
                    <tr key={person.id}>
                      <td>{person.code}</td>
                      <td>
                        {person.name}
                        {kind === 'staff' && (
                          <small>{person.teaching ? 'Teaching' : 'Non-teaching'}</small>
                        )}
                      </td>
                      <td>
                        {kind === 'staff'
                          ? [person.designation, person.department].filter(Boolean).join(' · ')
                          : person.guardianName || '—'}
                      </td>
                      <td>
                        {kind === 'staff'
                          ? person.email || person.phone || '—'
                          : person.guardianPhone || '—'}
                      </td>
                      <td>{person.status}</td>
                      {manage && (
                        <td>
                          <Button variant="ghost" onClick={() => setChanging(person)}>
                            {person.status === 'active' ? 'Archive' : 'Restore'}
                          </Button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {state.data && !state.data.items.length && !state.loading && (
              <p>
                No matching {kind} yet.{' '}
                {manage
                  ? 'Download the template above to get started.'
                  : 'An administrator can import records.'}
              </p>
            )}
            {state.data && <Paging {...state} nextCursor={state.data.nextCursor} />}
          </>
        )}
        {changing && (
          <ConfirmAction
            title={`${changing.status === 'active' ? 'Archive' : 'Restore'} ${changing.name}?`}
            description="History is preserved. Active enrollments or teaching assignments must be ended before archiving. This does not change login access."
            action={() => onboardingApi.changeStatus(access.schoolId, kind, changing)}
            close={() => setChanging(null)}
            saved={state.reload}
          />
        )}
      </div>
    </Panel>
  );
}
export function History({
  schoolId,
  kind,
  openJob,
}: {
  schoolId: string;
  kind: RosterKind;
  openJob: (id: string) => void;
}) {
  const load = useCallback(
    (signal: AbortSignal, after?: string) => onboardingApi.jobs(schoolId, kind, signal, after),
    [schoolId, kind],
  );
  const state = useSetupList(load);
  return (
    <Panel
      title="Import history"
      subtitle={
        kind === 'students'
          ? 'Your latest 3 imports. Creating another removes the oldest finished or draft import; processing imports are kept safe.'
          : 'Saved previews and results are shared with authorized school administrators.'
      }
    >
      <div className="live-content">
        <LoadState {...state} label="Loading import history…" retry={state.reload} />
        {!state.error && (
          <>
            <ul className="setup-records">
              {(state.data?.items ?? []).map((job) => (
                <li key={job.id}>
                  <div>
                    <strong>
                      {job.total} rows · {job.status}
                    </strong>
                    <small>
                      {displayTimestamp(job.createdAt)} · {job.mode}
                    </small>
                  </div>
                  <span>
                    {job.counts.created} created · {job.counts.failed} failed
                  </span>
                  <Button variant="secondary" onClick={() => openJob(job.id)}>
                    Open import
                  </Button>
                </li>
              ))}
            </ul>
            {state.data && !state.data.items.length && !state.loading && <p>No imports yet.</p>}
            {state.data && <Paging {...state} nextCursor={state.data.nextCursor} />}
          </>
        )}
      </div>
    </Panel>
  );
}
