import { formatCalendarDate } from '../../lib/displayFormat';
import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Badge,
  Button,
  LoadingOverlay,
  Modal,
  Panel,
  PickerInput,
  EmptyState,
} from '../../components/ui/Primitives';
import {
  setupApi,
  yearValidation,
  type AcademicYear,
  type SetupStatus,
} from '../../services/schoolSetupService';
import type { SchoolAccess } from '../../services/schoolAccessService';
import { useDraftGuard } from '../academics/useDraftGuard';
import { useSetupList } from './useSetupList';
import { ConfirmAction, LoadState, Paging } from './SetupControls';
export default function AcademicYears({
  access,
  status,
  changed,
}: {
  access: SchoolAccess;
  status: SetupStatus;
  changed: () => void;
}) {
  const load = useCallback(
    (signal: AbortSignal, after?: string) => setupApi.years(access.schoolId, signal, after),
    [access.schoolId],
  );
  const state = useSetupList(load),
    manage = access.permissions.includes('academic-years.manage');
  const [editing, setEditing] = useState<AcademicYear | 'new' | null>(null);
  const [confirm, setConfirm] = useState<{ year: AcademicYear; kind: 'select' | 'close' } | null>(
    null,
  );
  const [notice, setNotice] = useState('');
  const saved = () => {
    state.reload();
    changed();
    setNotice('Academic year saved.');
  };
  return (
    <LoadingOverlay
      loading={state.loading}
      size="xl"
      label="Loading academic years…"
      message="Loading academic years…"
    >
      <Panel
        title="Academic years"
        subtitle="Create a draft, review its dates, then explicitly select the current year."
        action={manage && <Button onClick={() => setEditing('new')}>Create academic year</Button>}
      >
        <div className="live-content">
          {state.error && <LoadState {...state} loading={false} retry={state.reload} />}
          {notice && <p role="status">{notice}</p>}
          {!state.error && (
            <>
              <div className="live-table-wrap">
                <table className="live-table">
                  <thead>
                    <tr>
                      <th>Academic year</th>
                      <th>Dates</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(state.data?.items ?? []).map((year) => (
                      <tr key={year.id}>
                        <td>
                          <strong>{year.name}</strong>
                          {status.currentAcademicYearId === year.id && <small>Current year</small>}
                        </td>
                        <td>
                          {formatCalendarDate(year.start)} → {formatCalendarDate(year.end)}
                        </td>
                        <td>
                          <Badge tone={year.status === 'active' ? 'green' : 'neutral'}>
                            {year.status}
                          </Badge>
                        </td>
                        <td>
                          <div className="live-actions">
                            {access.permissions.includes('classes.view') && (
                              <Link
                                className="button secondary"
                                to={`/settings?tab=Classes&year=${year.id}`}
                              >
                                View structure
                              </Link>
                            )}
                            {manage && year.status !== 'closed' && (
                              <>
                                <Button variant="secondary" onClick={() => setEditing(year)}>
                                  Edit
                                </Button>
                                {status.currentAcademicYearId !== year.id && (
                                  <>
                                    <Button onClick={() => setConfirm({ year, kind: 'select' })}>
                                      Set current
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      onClick={() => setConfirm({ year, kind: 'close' })}
                                    >
                                      Close year
                                    </Button>
                                  </>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {state.data && !state.data.items.length && !state.loading && (
                <EmptyState
                title="No academic years configured"
                description="Create your first academic year to begin enrollment and fee tracking."
                action={
                  manage ? (
                    <Button onClick={() => setEditing('new')}>
                      Create academic year
                    </Button>
                  ) : undefined
                }
              />
              )}
              {state.data && <Paging {...state} nextCursor={state.data.nextCursor} />}
            </>
          )}
          <p className="panel-note">
            Dates cannot overlap another year. Selecting a draft activates it; previous years keep
            their records. Close a non-current year when it should become permanently read-only.
          </p>
        </div>
      {editing && (
        <YearForm
          year={editing === 'new' ? undefined : editing}
          schoolId={access.schoolId}
          close={() => setEditing(null)}
          saved={saved}
        />
      )}
      {confirm && (
        <ConfirmAction
          title={
            confirm.kind === 'select' ? 'Change current academic year?' : 'Close academic year?'
          }
          description={
            confirm.kind === 'select'
              ? `${confirm.year.name} will become the current year. Existing records stay in their original year.`
              : `${confirm.year.name} and its class structure will become read-only. This cannot be undone.`
          }
          action={() =>
            confirm.kind === 'select'
              ? setupApi.selectYear(access.schoolId, confirm.year.id, status.academicRevision)
              : setupApi.closeYear(access.schoolId, confirm.year)
          }
          close={() => setConfirm(null)}
          saved={saved}
        />
      )}
      </Panel>
    </LoadingOverlay>
  );
}
function YearForm({
  year,
  schoolId,
  close,
  saved,
}: {
  year?: AcademicYear;
  schoolId: string;
  close: () => void;
  saved: () => void;
}) {
  const [initial] = useState(() => ({
    name: year?.name ?? '',
    start: year?.start ?? '',
    end: year?.end ?? '',
  }));
  const [draft, setDraft] = useState(initial),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [errors, setErrors] = useState<Record<string, string>>({});
  const dirty = JSON.stringify(initial) !== JSON.stringify(draft),
    guard = useDraftGuard(dirty && !busy, close);
  return (
    <Modal
      open
      description="Changes are saved to this school’s live workspace."
      title={
        guard.confirming
          ? 'Discard year changes?'
          : year
            ? 'Edit academic year'
            : 'Create academic year'
      }
      onClose={() => {
        if (!busy) guard.requestClose();
      }}
    >
      {guard.confirming ? (
        <div className="live-content">
          <Button onClick={guard.keepEditing}>Keep editing</Button>
          <Button variant="danger" onClick={guard.discard}>
            Discard changes
          </Button>
        </div>
      ) : (
        <form
          className="live-form"
          data-unsaved={dirty}
          noValidate
          onSubmit={async (event) => {
            event.preventDefault();
            if (busy) return;
            const validation = yearValidation(draft);
            setErrors(validation);
            if (Object.values(validation).some(Boolean)) return;
            setBusy(true);
            setError('');
            try {
              await setupApi.saveYear(schoolId, draft, year);
              guard.complete(() => {
                saved();
                close();
              });
            } catch (cause) {
              setError(cause instanceof Error ? cause.message : 'Unable to save the year.');
            } finally {
              setBusy(false);
            }
          }}
        >
          {(['name', 'start', 'end'] as const).map((key) => (
            <label key={key}>
              {key === 'name' ? 'Year name' : key === 'start' ? 'Start date' : 'End date'}
              {key === 'name' ? (
                <input
                  type="text"
                  maxLength={80}
                  required
                  disabled={busy}
                  value={draft[key]}
                  onChange={(event) => setDraft({ ...draft, [key]: event.target.value })}
                  aria-invalid={!!errors[key]}
                  aria-describedby={errors[key] ? `year-${key}-error` : undefined}
                />
              ) : (
                <PickerInput
                  type="date"
                  maxLength={80}
                  required
                  disabled={busy || year?.status === 'active'}
                  value={draft[key]}
                  onChange={(event) => setDraft({ ...draft, [key]: event.target.value })}
                  aria-invalid={!!errors[key]}
                  aria-describedby={errors[key] ? `year-${key}-error` : undefined}
                />
              )}
              {errors[key] && (
                <span className="form-error" id={`year-${key}-error`}>
                  {errors[key]}
                </span>
              )}
            </label>
          ))}
          <p>
            {year?.status === 'active'
              ? 'An activated year keeps its dates to protect future historical records.'
              : 'Saving creates or updates a draft. It does not switch the current year.'}
          </p>
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
          <div className="live-actions">
            <Button type="button" variant="secondary" disabled={busy} onClick={guard.requestClose}>
              Cancel
            </Button>
            <Button disabled={busy}>{busy ? 'Saving…' : 'Save academic year'}</Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
