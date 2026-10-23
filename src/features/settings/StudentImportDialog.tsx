import ImportSteps from '../setup/ImportSteps';
import { formatRosterCell, formatCalendarDate, titleCase } from '../../lib/displayFormat';
import { useDraftGuard } from '../academics/useDraftGuard';
import { useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Info,
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
  const [grid, setGrid] = useState<ExcelCell[][] | null>(null);
  const [preview, setPreview] = useState<StudentImportPreview | null>(null);
  const [fileName, setFileName] = useState('');
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
          `${row.input.name} ${row.input.admissionNumber} ${row.input.rollNumber} ${row.input.guardian ?? ''}`.toLowerCase();
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
        <div className="modal-actions">
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
        <div className="student-import-content">
          <ImportSteps step={step} />
          {step === 1 && (
            <>
              <div className="import-template-banner">
                <div className="import-template-banner-left">
                  <span className="import-template-icon" aria-hidden="true">
                    <FileSpreadsheet size={18} />
                  </span>
                  <div className="import-template-banner-copy">
                    <strong>Need the template?</strong>
                    <span className="class-timetable-note">
                      Use the Students sheet. Fill Class, Admission Number and Roll Number for every
                      student. Leave Section blank when the class has no sections.
                    </span>
                  </div>
                </div>
                <Button
                  variant="secondary"
                  onClick={() =>
                    downloadClassStudentTemplate(
                      schoolClass?.name ?? '',
                      sections.map((s) => s.name),
                    )
                  }
                >
                  <Download size={14} aria-hidden="true" />
                  Download Sample Excel
                </Button>
              </div>

              {!preview ? (
                <label className="import-dropzone-empty student-timing-field">
                  <span className="sr-only">Excel file (.xlsx)</span>
                  <span className="import-dropzone-cloud" aria-hidden="true">
                    <UploadCloud size={22} />
                  </span>
                  <span className="import-dropzone-title">
                    {reading
                      ? `Reading and validating ${fileName}…`
                      : 'Choose Excel file or drag & drop here'}
                  </span>
                  <p className="import-dropzone-sub">
                    Supports .xlsx up to 1,000 students across classes at once
                  </p>
                  <span className="import-browse-btn" aria-hidden="true">
                    Browse File
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
                >
                  <div className="import-file-info">
                    <span className="import-file-icon-box" aria-hidden="true">
                      <CheckCircle2 size={22} />
                    </span>
                    <div className="import-file-details">
                      <div className="import-file-name-row">
                        <strong>{fileName}</strong>
                        <span
                          className="import-validated-pill"
                          data-warn={preview.errors.length > 0 ? 'true' : undefined}
                        >
                          {preview.errors.length > 0 ? 'Needs Review' : 'Validated'}
                        </span>
                      </div>
                      <p role="status" className="import-file-meta">
                        ✓ {fileName} · {preview.rows.length} student rows loaded (
                        {preview.errors.length
                          ? `${preview.errors.length} need correction`
                          : 'all rows valid'}
                        )
                      </p>
                    </div>
                  </div>
                  <div className="import-file-actions">
                    <label className="import-replace-btn student-timing-field">
                      <RefreshCw size={13} aria-hidden="true" />
                      Replace file
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
                        setOffset(0);
                        setError('');
                      }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              )}
              {reading && <p role="status">Reading and validating {fileName}…</p>}

              <div className="import-config-grid">
                <div className="import-config-card" style={{ gridColumn: '1 / -1' }}>
                  <label className="field">
                    <span
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <strong style={{ color: '#1e293b', fontSize: 12 }}>
                        Default class for older workbooks without a Class column
                      </strong>
                      <span className="import-config-tag">Class Routing</span>
                    </span>
                    <select
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
                            {c.name}
                          </option>
                        ))}
                    </select>
                  </label>
                  <small>
                    Rows with a Class column are routed to their matching class automatically.
                  </small>
                </div>
              </div>
            </>
          )}
          {preview && step > 1 && (
            <>
              <div className="import-review-toolbar">
                <div className="import-summary-pills">
                  <div className="import-pill-badge">
                    <span>Total Rows</span>
                    <strong>{preview.rows.length}</strong>
                  </div>
                  <div className="import-pill-badge" data-tone="valid">
                    <span className="import-pill-dot" aria-hidden="true" />
                    <span>Valid</span>
                    <strong>{preview.rows.filter((r) => !r.error).length}</strong>
                  </div>
                  <button
                    type="button"
                    className="import-pill-badge"
                    data-tone="attention"
                    data-active={onlyErrors ? 'true' : undefined}
                    onClick={() => {
                      setOnlyErrors((v) => !v);
                      setOffset(0);
                    }}
                  >
                    <span className="import-pill-dot" aria-hidden="true" />
                    <span>Attention Needed</span>
                    <strong>{preview.errors.length}</strong>
                  </button>
                </div>

                {step === 2 && (
                  <div className="import-review-filters">
                    <div className="import-review-search">
                      <Search size={14} aria-hidden="true" />
                      <input
                        type="search"
                        aria-label="Search preview rows"
                        placeholder="Search student, admission #, or roll…"
                        value={searchQuery}
                        onChange={(e) => {
                          setSearchQuery(e.target.value);
                          setOffset(0);
                        }}
                      />
                    </div>
                    {previewClassIds.length > 1 && (
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
                    )}
                  </div>
                )}
              </div>

              <p className="import-summary">
                {preview.rows.length} students ·{' '}
                {preview.errors.length
                  ? `${preview.errors.length} ${preview.errors.length === 1 ? 'row needs' : 'rows need'} correction`
                  : 'Ready to import'}{' '}
                · {fileName}
              </p>
              {preview.errors.length > 0 && (
                <div className="import-errors" role="alert">
                  <strong>
                    Edit the flagged rows below, or go back and choose a corrected file.
                  </strong>
                  <ul>
                    {preview.errors.slice(0, 20).map((message) => (
                      <li key={message}>{message}</li>
                    ))}
                  </ul>
                  {preview.errors.length > 20 && (
                    <p>Showing the first 20 errors of {preview.errors.length}.</p>
                  )}
                </div>
              )}
              {step === 2 && (
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
                        <th scope="col">Excel row</th>
                        <th scope="col">Roll</th>
                        <th scope="col">Student</th>
                        <th scope="col">Class</th>
                        <th scope="col">Section</th>
                        <th scope="col">Admission number</th>
                        <th scope="col">Birth date</th>
                        <th scope="col">Check</th>
                        <th scope="col">Corrections</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPreviewRows.slice(offset, offset + 50).map((row) => (
                        <tr key={row.row} data-row-error={Boolean(row.error)}>
                          <td>{row.row}</td>
                          <td>{row.input.rollNumber || '—'}</td>
                          <td>
                            <strong>{titleCase(row.input.name) || '—'}</strong>
                          </td>
                          <td>
                            {state.classes.find((c) => c.id === row.input.classId)?.name ||
                              'Unknown class'}
                          </td>
                          <td>
                            {row.input.sectionId
                              ? sectionLabel(
                                  state.sections.find((s) => s.id === row.input.sectionId)?.name,
                                )
                              : 'No section'}
                          </td>
                          <td>{row.input.admissionNumber || '—'}</td>
                          <td>{formatCalendarDate(row.input.birthDate)}</td>
                          <td>
                            <span className="import-status-badge" data-valid={!row.error}>
                              {row.error ?? 'Ready'}
                            </span>
                          </td>
                          <td>
                            <Button
                              variant="ghost"
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
                              Edit row {row.row}
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {step === 2 && filteredPreviewRows.length > 50 && (
                <div className="modal-actions">
                  <Button
                    variant="secondary"
                    disabled={!offset}
                    onClick={() => setOffset(Math.max(0, offset - 50))}
                  >
                    Previous rows
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={offset + 50 >= filteredPreviewRows.length}
                    onClick={() => setOffset(offset + 50)}
                  >
                    Next rows
                  </Button>
                </div>
              )}
              {filteredPreviewRows.length > 50 && (
                <p className="class-timetable-note">
                  Showing rows {offset + 1}–{Math.min(offset + 50, filteredPreviewRows.length)}. All{' '}
                  {preview.rows.length} validated students will be imported.
                </p>
              )}
            </>
          )}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          {step === 3 && preview && (
            <div className="import-submit-hero">
              <div className="import-submit-top">
                <div className="import-submit-title-group">
                  <div className="import-submit-status-row">
                    <span className="import-state-pill">
                      <span className="import-pill-dot" aria-hidden="true" />
                      Ready
                    </span>
                    <h3>Ready to enroll {preview.rows.length} students</h3>
                  </div>
                  <p>
                    Import {preview.rows.length} students into the classes shown in the preview.
                    Admission numbers match by numeric part across your school; roll numbers within
                    each class and section.
                  </p>
                </div>
              </div>

              <div className="import-breakdown-grid">
                <div className="import-breakdown-card" data-metric="pending">
                  <strong>{preview.rows.length}</strong>
                  <span>Ready to enroll</span>
                </div>
                <div className="import-breakdown-card" data-metric="updated">
                  <strong>{previewClassIds.length || 1}</strong>
                  <span>Classes covered</span>
                </div>
                <div className="import-breakdown-card" data-metric="failed">
                  <strong>{preview.errors.length}</strong>
                  <span>Validation errors</span>
                </div>
              </div>

              <div className="import-info-strip">
                <Info size={16} aria-hidden="true" style={{ flexShrink: 0 }} />
                <p>
                  All {preview.rows.length} rows have passed validation. Select Import{' '}
                  {preview.rows.length} students below to complete enrollment.
                </p>
              </div>
            </div>
          )}
          <div className="modal-actions">
            {step > 1 && (
              <Button variant="secondary" onClick={() => setStep(step === 3 ? 2 : 1)}>
                Back
              </Button>
            )}
            <Button variant="secondary" onClick={close}>
              Cancel
            </Button>
            <Button
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
              {step === 1
                ? 'Next: preview'
                : step === 2
                  ? 'Next: submit'
                  : `Import ${preview?.rows.length ?? ''} students`}
              {step < 3 && <ArrowRight size={14} aria-hidden="true" />}
            </Button>
          </div>
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
