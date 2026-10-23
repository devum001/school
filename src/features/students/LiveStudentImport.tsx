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
import { STUDENT_IMPORT_HEADERS, downloadClassStudentTemplate } from '../../lib/studentTemplate';
import { readRosterFile } from '../../lib/liveRosterImport';
import { classNameKey } from '../../lib/classNames';
import ImportSteps from '../setup/ImportSteps';
import ImportJob from '../setup/ImportJob';
import { History } from '../setup/RosterWorkspace';
import { useDraftGuard } from '../academics/useDraftGuard';
import '../setup/import.css';

function formatByteSize(bytes: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export default function LiveStudentImport({
  schoolId,
  yearId,
  name,
  sections,
  close,
}: {
  schoolId: string;
  yearId: string;
  name: string;
  sections: string[];
  close: () => void;
}) {
  const [params, setParams] = useSearchParams();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const [grid, setGrid] = useState<string[][] | null>(null),
    [fileName, setFileName] = useState(''),
    [fileBytes, setFileBytes] = useState(0);
  const [mode, setMode] = useState<'create' | 'update'>('create'),
    [scope, setScope] = useState('workbook');
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
      setGrid(await readRosterFile(file, 'students', STUDENT_IMPORT_HEADERS));
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
      title={guard.confirming ? 'Discard selected workbook?' : 'Import students from Excel'}
      description="Preview the file, check each row, then confirm import. Class and Section columns determine each student's destination."
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
                schoolId={schoolId}
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
                      <strong>Class, Section, Admission No, Roll No, Birth Date</strong>
                    </span>
                  </span>
                  <button
                    type="button"
                    className="import-sample-btn"
                    disabled={busy}
                    title="Download the official Excel template"
                    onClick={() => downloadClassStudentTemplate(name, sections)}
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
                        Upload Workbook
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
                            Supports Microsoft Excel spreadsheet (.xlsx, .xls)
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
                          accept=".xlsx"
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
                              accept=".xlsx"
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
                        Class Routing &amp; Duplicate Handling
                      </h3>
                    </div>

                    <div className="import-config-grid">
                      <div className="import-select-group">
                        <label htmlFor="live-class-routing-select">
                          Which classes are in this file?
                        </label>
                        <select
                          id="live-class-routing-select"
                          value={scope}
                          disabled={busy}
                          onChange={(e) => setScope(e.target.value)}
                        >
                          <option value="workbook">Use the Class column</option>
                          {name && <option value="selected">Only the selected class: {name}</option>}
                        </select>
                      </div>

                      <div className="import-select-group">
                        <label htmlFor="live-duplicate-handling-select">
                          If an admission number already exists
                        </label>
                        <select
                          id="live-duplicate-handling-select"
                          value={mode}
                          disabled={busy}
                          onChange={(e) => setMode(e.target.value as 'create' | 'update')}
                        >
                          <option value="create">Keep existing students unchanged</option>
                          <option value="update">Update existing student details</option>
                        </select>
                      </div>
                    </div>

                    <div className="import-info-callout" data-purpose="info-callout">
                      <CheckCircle2 size={15} aria-hidden="true" />
                      <span>
                        {mode === 'update'
                          ? 'Add new students and update matching profiles. Blank optional cells clear existing values. Existing classes and roll numbers stay unchanged.'
                          : 'Add new students and skip identical records. Existing students with different details are automatically flagged for review.'}
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
                      <History schoolId={schoolId} kind="students" openJob={openJob} />
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
                          const column = grid[0].findIndex(
                            (h) => h.trim().toLowerCase() === 'class',
                          );
                          if (
                            scope === 'selected' &&
                            grid
                              .slice(1)
                              .some(
                                (row) =>
                                  row.some(Boolean) &&
                                  classNameKey(row[column] ?? '') !== classNameKey(name),
                              )
                          )
                            throw new Error(
                              `This import is restricted to ${name}. Choose Use the Class column to import several classes.`,
                            );
                          const job = await onboardingApi.preview(
                            schoolId,
                            yearId,
                            'students',
                            mode,
                            grid,
                            { format: 'school-students-v2' },
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
