import ImportSteps from './ImportSteps';
import { formatRosterCell } from '../../lib/displayFormat';
import { useCallback, useEffect, useState } from 'react';
import { Button, LoadingOverlay, Modal, Panel } from '../../components/ui/Primitives';
import { onboardingApi, type ImportDetail } from '../../services/onboardingService';
import { accessError } from '../../services/schoolAccessService';
import { isCancelled } from '../../services/apiService';
import { downloadText } from '../../lib/liveRosterImport';
import { useDraftGuard } from '../academics/useDraftGuard';
import './import.css';
export default function ImportJob({
  schoolId,
  jobId,
  close,
  backLabel = 'Back to directory',
  wizard = false,
}: {
  schoolId: string;
  jobId: string;
  close: () => void;
  backLabel?: string;
  wizard?: boolean;
}) {
  const [reviewed, setReviewed] = useState(false);
  const [job, setJob] = useState<ImportDetail>(),
    [offset, setOffset] = useState(0),
    [attempt, setAttempt] = useState(0),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [editing, setEditing] = useState<ImportDetail['rows'][number] | null>(null),
    [confirm, setConfirm] = useState<'confirm' | 'cancel' | 'retry' | null>(null);
  const reload = useCallback(() => setAttempt((value) => value + 1), []);
  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function poll() {
      try {
        const data = await onboardingApi.job(schoolId, jobId, offset, controller.signal);
        if (controller.signal.aborted) return;
        setJob(data);
        setError('');
        if (['validating', 'queued', 'processing'].includes(data.status))
          timer = setTimeout(() => {
            void poll();
          }, 1500);
      } catch (cause) {
        if (!isCancelled(cause) && !controller.signal.aborted) setError(accessError(cause));
      }
    }
    void poll();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [schoolId, jobId, offset, attempt]);
  async function action(command = confirm) {
    if (!job || !command) return;
    setBusy(true);
    setError('');
    try {
      await onboardingApi.action(schoolId, job, command);
      setConfirm(null);
      reload();
    } catch (cause) {
      setError(accessError(cause));
    } finally {
      setBusy(false);
    }
  }
  return (
    <LoadingOverlay
      loading={!job && !error}
      size="xl"
      label="Loading import…"
      message="Loading import…"
    >
      <Panel
        className="import-job"
        title={wizard ? 'Student import' : 'Saved import'}
        subtitle="You can leave this page and return through Import history. Processing continues in the background."
      >
        <div className="live-content">
          <Button variant="secondary" onClick={close}>
            {backLabel}
          </Button>
          {error && (
            <div>
              <p role="alert" className="form-error">
                {error}
              </p>
              <Button variant="secondary" onClick={reload}>
                Retry loading import
              </Button>
            </div>
          )}
          {!job && !error && <div style={{ minHeight: 180 }} />}
        {job && (
          <>
            {wizard && (
              <ImportSteps
                step={reviewed || !['validating', 'draft'].includes(job.status) ? 3 : 2}
              />
            )}
            <div className="import-kpi-strip">
              <div className="import-kpi-box">
                <strong>{job.total}</strong>
                <span>Total rows</span>
              </div>
              <div className="import-kpi-box" data-tone="success">
                <strong>{Math.max(0, job.total - job.invalid)}</strong>
                <span>Valid & ready</span>
              </div>
              <div
                className="import-kpi-box"
                data-tone={job.invalid > 0 ? 'danger' : undefined}
              >
                <strong>{job.invalid}</strong>
                <span>Rows needing attention</span>
              </div>
            </div>
            <h3>
              {job.kind === 'staff' ? 'Staff' : 'Student'} import · {job.status}
            </h3>
            <p>
              {job.mode === 'create'
                ? 'Create new records; identical records are skipped.'
                : 'Update matching profiles; blank optional cells clear existing values.'}
            </p>
            <p role="status">
              {job.status === 'validating'
                ? `${job.checked} of ${job.total} rows validated`
                : job.status === 'draft'
                  ? `${job.total} rows previewed`
                  : `${job.processed} of ${job.total} rows processed`}{' '}
              · {job.invalid} rows need attention
            </p>
            {(!wizard || !['draft', 'validating'].includes(job.status)) && (
              <>
                <progress
                  aria-label="Import progress"
                  max={job.total || 1}
                  value={job.status === 'validating' ? job.checked : job.processed}
                />
                <div className="roster-totals">
                  {(['created', 'updated', 'skipped', 'failed', 'pending'] as const).map((key) => (
                    <div key={key}>
                      <strong>{job.counts[key]}</strong>
                      <span>{key}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
            {job.message && <p role="alert">{job.message}</p>}
            <p>
              Correct all flagged rows before confirming. If some rows fail during import,
              successful rows stay saved. Retrying only checks the remaining rows.
            </p>
            {wizard && reviewed && job.status === 'draft' && (
              <div className="import-submit-card">
                <strong>Ready to import {job.total} rows</strong>
                <p>
                  Ready to import {job.total} rows. New students will be created; existing students
                  follow your selected matching option. Nothing is saved until you select Import
                  students.
                </p>
              </div>
            )}
            <div className="live-actions">
              {wizard && reviewed && job.status === 'draft' && (
                <Button variant="secondary" disabled={busy} onClick={() => setReviewed(false)}>
                  Back to preview
                </Button>
              )}
              {job.status === 'draft' && (
                <Button
                  disabled={busy || job.invalid > 0 || !!error}
                  onClick={() => {
                    if (wizard) {
                      if (reviewed) void action('confirm');
                      else setReviewed(true);
                    } else setConfirm('confirm');
                  }}
                >
                  {wizard ? (reviewed ? 'Import students' : 'Next: submit') : 'Confirm import'}
                </Button>
              )}
              {['paused', 'cancelled', 'completed'].includes(job.status) &&
                (job.status === 'paused' || job.counts.failed > 0 || job.counts.pending > 0) && (
                  <Button disabled={busy} onClick={() => setConfirm('retry')}>
                    Revalidate remaining rows
                  </Button>
                )}
              {!['completed', 'cancelled'].includes(job.status) && (
                <Button variant="secondary" disabled={busy} onClick={() => setConfirm('cancel')}>
                  Cancel remaining rows
                </Button>
              )}
              <Button
                variant="secondary"
                disabled={busy}
                onClick={async () => {
                  try {
                    downloadText(
                      `${job.kind}-results.csv`,
                      (await onboardingApi.results(schoolId, job.id)).csv,
                    );
                  } catch (cause) {
                    setError(accessError(cause));
                  }
                }}
              >
                Download import report
              </Button>
            </div>
            {(!wizard || !reviewed || job.status !== 'draft') && (
              <>
                <div
                  className="onboarding-table import-preview"
                  role="region"
                  aria-label="Import preview and validation"
                  tabIndex={0}
                >
                  <table>
                    <caption>Import preview and validation</caption>
                    <thead>
                      <tr>
                        <th>Row</th>
                        {job.columns.map((column) => (
                          <th key={column}>{column}</th>
                        ))}
                        <th className="import-correction-cell">Corrections</th>
                      </tr>
                    </thead>
                    <tbody>
                      {job.rows.map((row) => (
                        <tr key={row.number}>
                          <th scope="row">
                            {row.number}
                            {row.outcome !== 'pending' && <small>{row.outcome}</small>}
                          </th>
                          {row.cells.map((cell, index) => (
                            <td
                              key={index}
                              className={
                                index === 0 && row.errors.length
                                  ? 'import-validation-cell'
                                  : undefined
                              }
                            >
                              {formatRosterCell(job.columns[index], cell) || '—'}
                              {index === 0 &&
                                row.errors.map((message) => (
                                  <p className="form-error" key={message}>
                                    {message}
                                  </p>
                                ))}
                            </td>
                          ))}
                          <td className="import-correction-cell">
                            {job.status === 'draft' && row.outcome === 'pending' && (
                              <Button variant="ghost" onClick={() => setEditing(row)}>
                                Edit row {row.number}
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="live-actions">
                  <Button
                    variant="secondary"
                    disabled={!offset}
                    onClick={() => setOffset(Math.max(0, offset - 50))}
                  >
                    Previous rows
                  </Button>
                  <span>
                    Rows {job.total ? offset + 1 : 0}–{offset + job.rows.length} of {job.total}
                  </span>
                  <Button
                    variant="secondary"
                    disabled={job.nextOffset === null}
                    onClick={() => setOffset(job.nextOffset!)}
                  >
                    Next rows
                  </Button>
                </div>
              </>
            )}
            {editing && (
              <RowEditor
                job={job}
                row={editing}
                schoolId={schoolId}
                close={() => setEditing(null)}
                saved={reload}
              />
            )}
          </>
        )}
        {confirm && (
          <Modal
            open
            title={
              confirm === 'confirm'
                ? 'Start this import?'
                : confirm === 'retry'
                  ? 'Revalidate remaining rows?'
                  : 'Cancel remaining rows?'
            }
            description="Already committed records are kept. Every remaining row is checked again before it is written."
            onClose={() => {
              if (!busy) setConfirm(null);
            }}
          >
            <div className="live-content">
              <p>
                {confirm === 'confirm'
                  ? 'Each successful row will be saved independently. You can track successes and failures here.'
                  : confirm === 'retry'
                    ? 'Pending and failed rows return to validation. Correct any errors and confirm again.'
                    : 'This stops work that has not yet committed. It does not undo saved records.'}
              </p>
              {error && <p role="alert">{error}</p>}
              <div className="live-actions">
                <Button disabled={busy} variant="secondary" onClick={() => setConfirm(null)}>
                  Go back
                </Button>
                <Button disabled={busy} onClick={() => void action()}>
                  {busy ? 'Saving…' : 'Continue'}
                </Button>
              </div>
            </div>
          </Modal>
        )}
      </div>
      </Panel>
    </LoadingOverlay>
  );
}
function RowEditor({
  job,
  row,
  schoolId,
  close,
  saved,
}: {
  job: ImportDetail;
  row: ImportDetail['rows'][number];
  schoolId: string;
  close: () => void;
  saved: () => void;
}) {
  const [cells, setCells] = useState(
      row.cells.map((cell, index) => formatRosterCell(job.columns[index], cell)),
    ),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const dirty =
      JSON.stringify(cells) !==
      JSON.stringify(row.cells.map((cell, index) => formatRosterCell(job.columns[index], cell))),
    guard = useDraftGuard(dirty && !busy, close);
  return (
    <Modal
      open
      className="import-row-modal"
      title={guard.confirming ? 'Discard row edits?' : `Correct row ${row.number}`}
      description="Saving runs validation again. No roster records are created yet."
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
          className="live-form import-row-form"
          data-unsaved={dirty}
          onSubmit={async (event) => {
            event.preventDefault();
            setBusy(true);
            try {
              await onboardingApi.correct(schoolId, job, row.number, cells);
              guard.complete(() => {
                saved();
                close();
              });
            } catch (cause) {
              setError(accessError(cause));
            } finally {
              setBusy(false);
            }
          }}
        >
          {job.columns.map((column, index) => (
            <label key={column}>
              {column}
              <input
                maxLength={300}
                disabled={busy}
                value={cells[index] ?? ''}
                onChange={(event) =>
                  setCells((old) =>
                    old.map((value, i) => (i === index ? event.target.value : value)),
                  )
                }
              />
            </label>
          ))}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="modal-actions">
            <Button type="button" variant="secondary" disabled={busy} onClick={guard.requestClose}>
              Cancel
            </Button>
            <Button disabled={busy || !dirty}>{busy ? 'Validating…' : 'Save correction'}</Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
