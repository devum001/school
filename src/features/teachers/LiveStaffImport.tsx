import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ArrowRight,
  CheckCircle2,
  FileSpreadsheet,
  FolderOpen,
  Info,
  RefreshCw,
  Trash2,
  UploadCloud,
} from 'lucide-react';
import { Button, Modal } from '../../components/ui/Primitives';
import { onboardingApi } from '../../services/onboardingService';
import { downloadRosterTemplate, readRosterFile } from '../../lib/liveRosterImport';
import ImportSteps from '../setup/ImportSteps';
import ImportJob from '../setup/ImportJob';
import { History } from '../setup/RosterWorkspace';
import { useDraftGuard } from '../academics/useDraftGuard';
import type { SchoolAccess } from '../../services/schoolAccessService';
import '../setup/import.css';

function formatByteSize(bytes: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export default function LiveStaffImport({
  access,
  yearId,
  teachersOnly = false,
  close,
}: {
  access: SchoolAccess;
  yearId: string | null;
  teachersOnly?: boolean;
  close: () => void;
}) {
  const [params, setParams] = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [grid, setGrid] = useState<string[][] | null>(null);
  const [fileName, setFileName] = useState('');
  const [fileBytes, setFileBytes] = useState(0);
  const [mode, setMode] = useState<'create' | 'update'>('create');
  const jobId = params.get('import');
  const guard = useDraftGuard((!!grid || busy) && !jobId, close);

  function openJob(id: string | null) {
    guard.complete(() =>
      setParams((previous) => {
        const next = new URLSearchParams(previous);
        if (id) next.set('import', id);
        else next.delete('import');
        return next;
      }),
    );
  }

  async function handleFileSelect(file: File | undefined) {
    setGrid(null);
    setError('');
    setFileName(file?.name ?? '');
    setFileBytes(file?.size ?? 0);
    if (!file) return;
    setBusy(true);
    try {
      setGrid(await readRosterFile(file, 'staff'));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to read workbook.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      wide
      className="student-import-modal"
      title={
        guard.confirming
          ? 'Discard selected workbook?'
          : teachersOnly
            ? 'Import teachers from Excel'
            : 'Import staff from Excel'
      }
      description="Preview the file, check each row, then confirm import. Profiles and assignments are created according to column values."
      onClose={() => {
        if (!busy) (guard.confirming ? guard.keepEditing : guard.requestClose)();
      }}
    >
      <div
        className="student-import-content"
        data-import-wide={jobId ? 'true' : undefined}
        data-unsaved={(!!grid || busy) && !jobId}
      >
        {guard.confirming ? (
          <div className="import-modal-footer">
            <Button onClick={guard.keepEditing}>Keep reviewing</Button>
            <Button variant="danger" onClick={guard.discard}>
              Discard workbook
            </Button>
          </div>
        ) : (
          <>
            {jobId ? (
              <ImportJob
                wizard
                key={jobId}
                schoolId={access.schoolId}
                jobId={jobId}
                fileName={fileName}
                backLabel="Back to Upload"
                close={() => {
                  setGrid(null);
                  openJob(null);
                }}
                onDone={guard.requestClose}
              />
            ) : (
              <>
                <div className="import-header-subbar">
                  <span className="import-header-hint">
                    <Info size={14} aria-hidden="true" />
                    <span>
                      Ensure your columns match:{' '}
                      <strong>Name, Employee Code, Mobile, Email, Department, Designation</strong>
                    </span>
                  </span>
                  <button
                    type="button"
                    className="import-sample-btn"
                    disabled={busy}
                    title="Download official staff Excel template"
                    onClick={() => downloadRosterTemplate('staff', 'xlsx')}
                  >
                    <FileSpreadsheet size={14} aria-hidden="true" />
                    <span>Download Sample Excel</span>
                  </button>
                </div>

                <div className="import-step1-body">
                  <ImportSteps step={1} validated={Boolean(grid)} />

                  <section aria-labelledby="upload-heading" className="import-step1-section">
                    <div className="import-section-head">
                      <h3 className="import-section-title" id="upload-heading">
                        Upload Staff Workbook
                      </h3>
                      <span className="import-spec-pill">.xlsx • Max 1,000 rows • 1 MiB</span>
                    </div>

                    {!grid ? (
                      <label className="import-dropzone-empty" data-purpose="file-dropzone">
                        <span className="sr-only">Excel file (.xlsx)</span>
                        <span className="import-dropzone-cloud" aria-hidden="true">
                          <UploadCloud size={20} />
                        </span>
                        <div>
                          <p className="import-dropzone-title">
                            {busy ? (
                              'Reading workbook…'
                            ) : (
                              <>
                                <span className="import-choose-link">Choose Excel file</span> or
                                drag &amp; drop here
                              </>
                            )}
                          </p>
                          <p className="import-dropzone-sub">
                            Supports Microsoft Excel spreadsheet (.xlsx, .xls, .csv)
                          </p>
                        </div>
                        <span className="import-browse-btn" aria-hidden="true">
                          <FolderOpen size={14} />
                          <span>Browse File</span>
                        </span>
                        <input
                          className="import-file-hidden"
                          aria-label="Excel file (.xlsx)"
                          type="file"
                          accept=".xlsx,.xls,.csv"
                          disabled={busy}
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            e.target.value = '';
                            await handleFileSelect(file);
                          }}
                        />
                      </label>
                    ) : (
                      <div className="import-dropzone-filled" data-purpose="file-dropzone">
                        <div className="import-file-info">
                          <span className="import-file-icon-box" aria-hidden="true">
                            <FileSpreadsheet size={22} />
                          </span>
                          <div className="import-file-details">
                            <div className="import-file-name-row">
                              <strong>{fileName}</strong>
                              <span className="import-validated-pill">
                                <CheckCircle2 size={11} aria-hidden="true" />
                                Validated
                              </span>
                            </div>
                            <p role="status" className="import-file-meta">
                              {fileBytes > 0 && (
                                <>
                                  <span style={{ fontWeight: 500, color: '#475569' }}>
                                    {formatByteSize(fileBytes)}
                                  </span>
                                  <span>•</span>
                                </>
                              )}
                              <span>{grid.length - 1} rows detected</span>
                              <span>•</span>
                              <span className="import-ready-text">Ready to process</span>
                            </p>
                          </div>
                        </div>
                        <div className="import-file-actions">
                          <label className="import-replace-btn">
                            <RefreshCw size={12} aria-hidden="true" />
                            <span>Replace file</span>
                            <input
                              className="import-file-hidden"
                              aria-label="Excel file (.xlsx)"
                              type="file"
                              accept=".xlsx,.xls,.csv"
                              disabled={busy}
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                e.target.value = '';
                                await handleFileSelect(file);
                              }}
                            />
                          </label>
                          <button
                            type="button"
                            className="import-remove-btn"
                            title="Remove file"
                            aria-label="Remove selected file"
                            disabled={busy}
                            onClick={() => {
                              setGrid(null);
                              setFileName('');
                              setFileBytes(0);
                              setError('');
                            }}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    )}
                  </section>

                  <section aria-labelledby="settings-heading" className="import-step1-section">
                    <div className="import-section-head">
                      <h3 className="import-section-title" id="settings-heading">
                        Duplicate &amp; Existing Record Handling
                      </h3>
                    </div>

                    <div className="import-config-grid">
                      <div className="import-select-group">
                        <label htmlFor="live-staff-duplicate-select">
                          If an employee code or email already exists
                        </label>
                        <select
                          id="live-staff-duplicate-select"
                          value={mode}
                          disabled={busy}
                          onChange={(e) => setMode(e.target.value as 'create' | 'update')}
                        >
                          <option value="create">Keep existing staff unchanged</option>
                          <option value="update">Update existing staff details</option>
                        </select>
                      </div>
                    </div>

                    <div className="import-info-callout" data-purpose="info-callout">
                      <CheckCircle2 size={15} aria-hidden="true" />
                      <span>
                        {mode === 'update'
                          ? 'Add new staff and update matching employee records. Blank optional cells keep existing values.'
                          : 'Add new staff members and skip duplicate codes or emails. Does not create login accounts.'}
                      </span>
                    </div>
                  </section>

                  {error && (
                    <div style={{ marginTop: 14 }}>
                      <p role="alert" className="form-error">
                        {error}
                      </p>
                    </div>
                  )}

                  <details className="import-history-drawer">
                    <summary>Saved imports</summary>
                    <div style={{ marginTop: 10 }}>
                      <History schoolId={access.schoolId} kind="staff" openJob={openJob} />
                    </div>
                  </details>
                </div>

                <footer className="import-modal-footer">
                  <button
                    type="button"
                    className="import-cancel-btn"
                    disabled={busy}
                    onClick={guard.requestClose}
                  >
                    Cancel
                  </button>
                  <div className="import-footer-right">
                    <button
                      type="button"
                      className="import-primary-btn"
                      data-dark={!grid ? 'true' : undefined}
                      disabled={busy || !grid}
                      onClick={async () => {
                        if (!grid || busy) return;
                        setBusy(true);
                        setError('');
                        try {
                          const job = await onboardingApi.preview(
                            access.schoolId,
                            yearId ?? '',
                            'staff',
                            mode,
                            grid,
                          );
                          openJob(job.id);
                        } catch (cause) {
                          setError(
                            cause instanceof Error ? cause.message : 'Unable to preview workbook.',
                          );
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      <span>{busy ? 'Preparing preview…' : 'Continue to Review'}</span>
                      {!busy && <ArrowRight size={13} aria-hidden="true" />}
                    </button>
                  </div>
                </footer>
              </>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
