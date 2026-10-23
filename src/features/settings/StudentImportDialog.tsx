import ImportSteps from '../setup/ImportSteps';
import { formatRosterCell, formatCalendarDate, titleCase } from '../../lib/displayFormat';
import { useDraftGuard } from '../academics/useDraftGuard';
import { useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  FileSpreadsheet,
  FolderOpen,
  Info,
  Pen,
  RefreshCw,
  Search,
  Trash2,
  UploadCloud,
} from 'lucide-react';
import { useSchool } from '../../app/useSchool';
import { useFeedback } from '../../app/useFeedback';
import { Button, Modal } from '../../components/ui/Primitives';
import { repository } from '../../lib/repository';
import { previewStudentImport, type StudentImportPreview } from '../../lib/studentImport';
import { readStudentWorkbook, type ExcelCell } from '../../lib/xlsx';
import { downloadClassStudentTemplate } from '../../lib/studentTemplate';
import { sectionLabel } from '../../lib/schoolLabels';
import '../setup/import.css';

function formatByteSize(bytes: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export default function StudentImportDialog({
  classId,
  presentation = 'dialog',
  onClose,
}: {
  classId: string;
  presentation?: 'dialog' | 'page';
  onClose: () => void;
}) {
  const state = useSchool(),
    notify = useFeedback();
  const schoolClass = state.classes.find((c) => c.id === classId);
  const sections = state.sections.filter(
    (s) => s.schoolId === state.school.id && s.classId === classId,
  );
  const [offset, setOffset] = useState(0);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [onlyErrors, setOnlyErrors] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [editingRow, setEditingRow] = useState<number | null>(null);
  const [rowCells, setRowCells] = useState<string[]>([]);
  const [target, setTarget] = useState(classId);
  const [duplicateMode, setDuplicateMode] = useState<'keep' | 'update'>('keep');
  const [grid, setGrid] = useState<ExcelCell[][] | null>(null);
  const [preview, setPreview] = useState<StudentImportPreview | null>(null);
  const [fileName, setFileName] = useState('');
  const [fileBytes, setFileBytes] = useState(0);
  const [reading, setReading] = useState(false),
    [error, setError] = useState('');
  const guard = useDraftGuard(!!grid || reading, onClose);
  const discard = guard.confirming;
  const request = useRef(0);
  const close = guard.requestClose;

  async function handleFileChange(file: File | undefined) {
    const attempt = ++request.current;
    setGrid(null);
    setOffset(0);
    setPreview(null);
    setError('');
    setFileName(file?.name ?? '');
    setFileBytes(file?.size ?? 0);
    if (!file) {
      setReading(false);
      return;
    }
    setReading(true);
    try {
      const cells = await readStudentWorkbook(file);
      if (attempt !== request.current) return;
      setGrid(cells);
      setPreview(previewStudentImport(repository.getSnapshot(), target, cells));
    } catch (cause) {
      if (attempt === request.current)
        setError(
          cause instanceof Error
            ? cause.message
            : 'Unable to read this workbook. Use the sample Excel file.',
        );
    } finally {
      if (attempt === request.current) setReading(false);
    }
  }

  const filteredPreviewRows = useMemo(() => {
    if (!preview) return [];
    return preview.rows.filter((row) => {
      if (onlyErrors && !row.error) return false;
      if (classFilter && row.input.classId !== classFilter) return false;
      if (searchQuery.trim()) {
        const needle = searchQuery.trim().toLowerCase();
        const hay =
          `${row.input.name} ${row.input.admissionNumber} ${row.input.rollNumber} ${row.input.guardian?.name ?? ''}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [preview, onlyErrors, classFilter, searchQuery]);

  const previewClassIds = useMemo(() => {
    if (!preview) return [];
    return [...new Set(preview.rows.map((r) => r.input.classId).filter(Boolean))];
  }, [preview]);

  return (
    <Modal
      open
      wide
      className="student-import-modal"
      presentation={presentation}
      onClose={discard ? guard.keepEditing : close}
      title={discard ? 'Close this import preview?' : 'Import students from Excel'}
      description={
        discard
          ? 'The file has not been saved. You can choose it again later.'
          : 'Import several classes in one workbook. Class and Section columns route each row. Preview and validate before adding students.'
      }
    >
      {discard ? (
        <div className="import-modal-footer">
          <Button variant="secondary" onClick={guard.keepEditing}>
            Keep reviewing
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              request.current++;
              guard.discard();
            }}
          >
            Close preview
          </Button>
        </div>
      ) : (
        <div
          className="student-import-content"
          data-import-wide={step > 1 ? 'true' : undefined}
        >
          {step === 1 && (
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
                  title="Download the official Excel template"
                  onClick={() =>
                    downloadClassStudentTemplate(
                      schoolClass?.name ?? '',
                      sections.map((s) => s.name),
                    )
                  }
                >
                  <FileSpreadsheet size={14} aria-hidden="true" />
                  <span>Download Sample Excel</span>
                </button>
              </div>

              <div className="import-step1-body">
                <ImportSteps step={1} validated={Boolean(preview)} />

                <section aria-labelledby="demo-upload-heading" className="import-step1-section">
                  <div className="import-section-head">
                    <h3 className="import-section-title" id="demo-upload-heading">
                      Upload Workbook
                    </h3>
                    <span className="import-spec-pill">.xlsx • Max 1,000 rows • 1 MiB</span>
                  </div>

                  {!preview ? (
                    <label
                      className="import-dropzone-empty student-timing-field"
                      data-purpose="file-dropzone"
                    >
                      <span className="sr-only">Excel file (.xlsx)</span>
                      <span className="import-dropzone-cloud" aria-hidden="true">
                        <UploadCloud size={20} />
                      </span>
                      <div>
                        <p className="import-dropzone-title">
                          {reading ? (
                            `Reading and validating ${fileName}…`
                          ) : (
                            <>
                              <span className="import-choose-link">Choose Excel file</span> or drag
                              &amp; drop here
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
                        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                        onChange={async (event) => {
                          const file = event.target.files?.[0];
                          event.target.value = '';
                          await handleFileChange(file);
                        }}
                      />
                    </label>
                  ) : (
                    <div
                      className="import-dropzone-filled"
                      data-has-errors={preview.errors.length > 0 ? 'true' : undefined}
                      data-purpose="file-dropzone"
                    >
                      <div className="import-file-info">
                        <span className="import-file-icon-box" aria-hidden="true">
                          <FileSpreadsheet size={22} />
                        </span>
                        <div className="import-file-details">
                          <div className="import-file-name-row">
                            <strong>{fileName}</strong>
                            <span
                              className="import-validated-pill"
                              data-warn={preview.errors.length > 0 ? 'true' : undefined}
                            >
                              <CheckCircle2 size={11} aria-hidden="true" />
                              {preview.errors.length > 0 ? 'Needs Review' : 'Validated'}
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
                            <span>{preview.rows.length} rows detected</span>
                            <span>•</span>
                            <span className="import-ready-text">
                              {preview.errors.length
                                ? `${preview.errors.length} need correction`
                                : 'Ready to process'}
                            </span>
                          </p>
                        </div>
                      </div>
                      <div className="import-file-actions">
                        <label className="import-replace-btn student-timing-field">
                          <RefreshCw size={12} aria-hidden="true" />
                          <span>Replace file</span>
                          <input
                            className="import-file-hidden"
                            aria-label="Excel file (.xlsx)"
                            type="file"
                            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                            onChange={async (event) => {
                              const file = event.target.files?.[0];
                              event.target.value = '';
                              await handleFileChange(file);
                            }}
                          />
                        </label>
                        <button
                          type="button"
                          className="import-remove-btn"
                          title="Remove file"
                          aria-label="Remove selected file"
                          onClick={() => {
                            setGrid(null);
                            setPreview(null);
                            setFileName('');
                            setFileBytes(0);
                            setOffset(0);
                            setError('');
                          }}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  )}
                  {reading && <p role="status">Reading and validating {fileName}…</p>}
                </section>

                <section aria-labelledby="demo-settings-heading" className="import-step1-section">
                  <div className="import-section-head">
                    <h3 className="import-section-title" id="demo-settings-heading">
                      Class Routing &amp; Duplicate Handling
                    </h3>
                  </div>

                  <div className="import-config-grid">
                    <div className="import-select-group">
                      <label htmlFor="demo-class-routing-select">
                        Which classes are in this file?
                      </label>
                      <select
                        id="demo-class-routing-select"
                        aria-label="Default class for older workbooks without a Class column"
                        value={target}
                        disabled={reading}
                        onChange={(e) => {
                          setTarget(e.target.value);
                          setGrid(null);
                          setOffset(0);
                          setPreview(null);
                        }}
                      >
                        {state.classes
                          .filter((c) => c.schoolId === state.school.id)
                          .map((c) => (
                            <option key={c.id} value={c.id}>
                              Use the Class column (default: {c.name})
                            </option>
                          ))}
                      </select>
                    </div>

                    <div className="import-select-group">
                      <label htmlFor="demo-duplicate-select">
                        If an admission number already exists
                      </label>
                      <select
                        id="demo-duplicate-select"
                        value={duplicateMode}
                        disabled={reading}
                        onChange={(e) => setDuplicateMode(e.target.value as 'keep' | 'update')}
                      >
                        <option value="keep">Keep existing students unchanged</option>
                        <option value="update">Overwrite existing student details</option>
                      </select>
                    </div>
                  </div>

                  <div className="import-info-callout" data-purpose="info-callout">
                    <CheckCircle2 size={15} aria-hidden="true" />
                    <span>
                      Add new students and skip identical records. Existing students with different
                      details are automatically flagged for review.
                    </span>
                  </div>
                </section>

                {error && (
                  <div style={{ marginTop: 14 }}>
                    <p className="form-error" role="alert">
                      {error}
                    </p>
                  </div>
                )}
              </div>
            </>
          )}

          {preview && step > 1 && (
            <div className="import-step2-body">
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 10,
                }}
              >
                <span className="import-file-chip" data-pill={step === 3 ? 'round' : undefined}>
                  <FileSpreadsheet size={13} aria-hidden="true" />
                  <span>
                    {fileName}
                    {step === 3 ? ` • ${preview.rows.length} rows` : ''}
                  </span>
                </span>
                <p className="sr-only">
                  {preview.rows.length} students ·{' '}
                  {preview.errors.length
                    ? `${preview.errors.length} ${preview.errors.length === 1 ? 'row needs' : 'rows need'} correction`
                    : 'Ready to import'}{' '}
                  · {fileName}
                </p>
              </div>

              <ImportSteps step={step} validated />

              {step === 2 ? (
                <>
                  <div className="import-review-toolbar">
                    <div className="import-summary-pills">
                      <div className="import-pill-badge">
                        <strong>{preview.rows.length}</strong> Total Rows
                      </div>
                      <div className="import-pill-badge" data-tone="valid">
                        <CheckCircle2 size={13} aria-hidden="true" />
                        <span>{preview.rows.filter((r) => !r.error).length} Valid</span>
                      </div>
                      <label className="import-pill-badge" data-tone="attention">
                        <input
                          type="checkbox"
                          checked={onlyErrors}
                          onChange={(e) => {
                            setOnlyErrors(e.target.checked);
                            setOffset(0);
                          }}
                        />
                        <span>{preview.errors.length} Attention Needed</span>
                      </label>
                    </div>

                    <div className="import-review-filters">
                      <div className="import-review-search">
                        <Search size={13} aria-hidden="true" />
                        <input
                          type="search"
                          aria-label="Search preview rows"
                          placeholder="Search student, admission #, or guardian..."
                          value={searchQuery}
                          onChange={(e) => {
                            setSearchQuery(e.target.value);
                            setOffset(0);
                          }}
                        />
                      </div>
                      <select
                        className="import-review-class-select"
                        aria-label="Filter preview by class"
                        value={classFilter}
                        onChange={(e) => {
                          setClassFilter(e.target.value);
                          setOffset(0);
                        }}
                      >
                        <option value="">All Classes</option>
                        {previewClassIds.map((cid) => (
                          <option key={cid} value={cid}>
                            {state.classes.find((c) => c.id === cid)?.name ?? cid}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {preview.errors.length > 0 && (
                    <div className="sr-only" role="alert">
                      <strong>
                        Edit the flagged rows below, or go back and choose a corrected file.
                      </strong>
                      <ul>
                        {preview.errors.slice(0, 20).map((message) => (
                          <li key={message}>{message}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="import-table-card">
                    <div
                      className="import-preview-scroll"
                      tabIndex={0}
                      role="region"
                      aria-label="Scrollable student import preview"
                    >
                      <table className="import-preview">
                        <caption>Student import preview</caption>
                        <thead>
                          <tr>
                            <th scope="col" className="import-row-num-cell">
                              #
                            </th>
                            <th scope="col">Student Name</th>
                            <th scope="col">Admission Number</th>
                            <th scope="col">Birth Date</th>
                            <th scope="col">Guardian Name</th>
                            <th scope="col">Parent Mobile</th>
                            <th scope="col">Roll Number</th>
                            <th scope="col">Section</th>
                            <th scope="col">Class</th>
                            <th scope="col">Status</th>
                            <th scope="col">Corrections</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredPreviewRows.slice(offset, offset + 50).map((row) => (
                            <tr key={row.row} data-row-error={Boolean(row.error)}>
                              <td className="import-row-num-cell">{row.row}</td>
                              <td style={{ fontWeight: 600, color: '#0f172a' }}>
                                {titleCase(row.input.name) || '—'}
                              </td>
                              <td>{row.input.admissionNumber || '—'}</td>
                              <td>{formatCalendarDate(row.input.birthDate)}</td>
                              <td>{titleCase(row.input.guardian?.name || '') || '—'}</td>
                              <td>{row.input.guardian?.contact || '—'}</td>
                              <td>{row.input.rollNumber || '—'}</td>
                              <td>
                                {row.input.sectionId
                                  ? sectionLabel(
                                      state.sections.find((s) => s.id === row.input.sectionId)
                                        ?.name,
                                    )
                                  : '—'}
                              </td>
                              <td>
                                {state.classes.find((c) => c.id === row.input.classId)?.name ||
                                  'Unknown class'}
                              </td>
                              <td>
                                {!row.error ? (
                                  <span className="import-status-badge" data-valid="true">
                                    <Check size={10} strokeWidth={3} aria-hidden="true" />
                                    Valid
                                  </span>
                                ) : (
                                  <span className="import-status-badge" data-valid="false">
                                    <AlertCircle size={11} aria-hidden="true" />
                                    {row.error}
                                  </span>
                                )}
                              </td>
                              <td>
                                <button
                                  type="button"
                                  className="import-inline-edit-btn"
                                  onClick={() => {
                                    setEditingRow(row.row);
                                    setRowCells(
                                      (grid?.[0] ?? []).map((header, index) => {
                                        const value =
                                          String(header) === 'Birth Date'
                                            ? row.input.birthDate
                                            : String(grid?.[row.row - 1][index] ?? '');
                                        return formatRosterCell(String(header), value);
                                      }),
                                    );
                                  }}
                                >
                                  <Pen size={10} aria-hidden="true" />
                                  <span>Edit row {row.row}</span>
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="import-table-footer">
                      <span>
                        Showing {Math.min(50, filteredPreviewRows.length)} of {preview.rows.length}{' '}
                        rows
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {(onlyErrors || searchQuery || classFilter) && (
                          <button
                            type="button"
                            className="import-view-all-link"
                            onClick={() => {
                              setOnlyErrors(false);
                              setSearchQuery('');
                              setClassFilter('');
                              setOffset(0);
                            }}
                          >
                            View all {preview.rows.length} rows
                          </button>
                        )}
                        {filteredPreviewRows.length > 50 && (
                          <>
                            <button
                              type="button"
                              className="import-view-all-link"
                              disabled={!offset}
                              onClick={() => setOffset(Math.max(0, offset - 50))}
                            >
                              Previous rows
                            </button>
                            <button
                              type="button"
                              className="import-view-all-link"
                              disabled={offset + 50 >= filteredPreviewRows.length}
                              onClick={() => setOffset(offset + 50)}
                            >
                              Next rows
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="import-step3-badges-row">
                    <div className="import-step3-pill">
                      <span className="import-dot-slate" aria-hidden="true" />
                      {preview.rows.length} Total Rows
                    </div>
                    <div className="import-step3-pill" data-tone="valid">
                      <Check size={11} strokeWidth={3} aria-hidden="true" />
                      {preview.rows.filter((r) => !r.error).length} Valid
                    </div>
                    <div className="import-step3-pill">
                      <Check
                        size={11}
                        strokeWidth={3}
                        style={{ color: '#059669' }}
                        aria-hidden="true"
                      />
                      {preview.errors.length} Attention Needed
                    </div>
                  </div>

                  <div className="import-submit-hero">
                    <div>
                      <div className="import-submit-headline">
                        <span className="import-pulse-dot" aria-hidden="true" />
                        <span>Student import • Ready</span>
                      </div>
                      <div className="import-submit-sub">
                        Create new records; identical records are skipped.
                      </div>
                    </div>

                    <div className="import-bar-track">
                      <div className="import-bar-fill" style={{ width: '100%' }} />
                    </div>

                    <div className="import-breakdown-grid">
                      <div className="import-breakdown-card" data-metric="created">
                        <strong>{preview.rows.length}</strong>
                        <span>Created</span>
                      </div>
                      <div className="import-breakdown-card" data-metric="updated">
                        <strong>0</strong>
                        <span>Updated</span>
                      </div>
                      <div className="import-breakdown-card" data-metric="skipped">
                        <strong>0</strong>
                        <span>Skipped</span>
                      </div>
                      <div className="import-breakdown-card" data-metric="failed">
                        <strong>{preview.errors.length}</strong>
                        <span>Failed</span>
                      </div>
                      <div className="import-breakdown-card" data-metric="pending">
                        <strong>0</strong>
                        <span>Pending</span>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {error && (
                <p className="form-error" role="alert">
                  {error}
                </p>
              )}
            </div>
          )}

          <footer className="import-modal-footer">
            {step === 1 ? (
              <button type="button" className="import-cancel-btn" onClick={close}>
                Cancel
              </button>
            ) : step === 2 ? (
              <button type="button" className="import-cancel-btn" onClick={() => setStep(1)}>
                <ArrowLeft size={12} aria-hidden="true" />
                <span>Back to Upload</span>
              </button>
            ) : (
              <button type="button" className="import-white-btn" onClick={() => setStep(2)}>
                <ArrowLeft size={12} aria-hidden="true" />
                <span>Back to Review</span>
              </button>
            )}

            <div className="import-footer-right">
              <button
                type="button"
                className="import-primary-btn"
                data-dark={step === 1 && !preview ? 'true' : undefined}
                disabled={!grid || !preview || (step > 1 && preview.errors.length > 0) || reading}
                onClick={() => {
                  if (!grid || !preview) return;
                  if (step < 3) {
                    setStep(step === 1 ? 2 : 3);
                    return;
                  }
                  try {
                    repository.importStudents(target, grid);
                    notify(`${preview.rows.length} students imported into their classes.`);
                    request.current++;
                    guard.complete();
                  } catch (cause) {
                    setError(cause instanceof Error ? cause.message : 'Unable to save students.');
                  }
                }}
              >
                <span>
                  {step === 1
                    ? 'Continue to Review'
                    : step === 2
                      ? 'Proceed to Submit'
                      : `Import ${preview?.rows.length ?? ''} students`}
                </span>
                <ArrowRight size={12} aria-hidden="true" />
              </button>
            </div>
          </footer>

          {editingRow !== null && grid && (
            <Modal
              open
              className="import-row-modal"
              title={`Correct row ${editingRow}`}
              description="Edit the workbook values. Saving validates the full preview before import."
              onClose={() => setEditingRow(null)}
            >
              <form
                className="live-form import-row-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  const next = grid.map((row, index) =>
                    index === editingRow - 1 ? rowCells : row,
                  );
                  try {
                    setPreview(previewStudentImport(repository.getSnapshot(), target, next));
                    setGrid(next);
                    setEditingRow(null);
                    setError('');
                  } catch (cause) {
                    setError(cause instanceof Error ? cause.message : 'Check row values.');
                  }
                }}
              >
                {grid[0].map((header, index) => (
                  <label key={String(header)}>
                    {String(header)}
                    <input
                      value={rowCells[index] ?? ''}
                      maxLength={300}
                      onChange={(event) =>
                        setRowCells((old) =>
                          old.map((cell, i) => (i === index ? event.target.value : cell)),
                        )
                      }
                    />
                  </label>
                ))}
                <div className="modal-actions">
                  <Button type="button" variant="secondary" onClick={() => setEditingRow(null)}>
                    Cancel
                  </Button>
                  <Button>Save correction</Button>
                </div>
              </form>
            </Modal>
          )}
        </div>
      )}
    </Modal>
  );
}
