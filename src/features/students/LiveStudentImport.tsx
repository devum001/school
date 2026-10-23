import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ArrowRight,
  CheckCircle2,
  Download,
  FileSpreadsheet,
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
    [fileName, setFileName] = useState('');
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
      <div className="student-import-content" data-unsaved={(!!grid || busy) && !jobId}>
        {guard.confirming ? (
          <div className="modal-actions">
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
                backLabel="Back to file selection"
                close={() => {
                  setGrid(null);
                  openJob(null);
                }}
              />
            ) : (
              <>
                <ImportSteps step={1} />
                <div className="import-template-banner">
                  <div className="import-template-banner-left">
                    <span className="import-template-icon" aria-hidden="true">
                      <FileSpreadsheet size={18} />
                    </span>
                    <div className="import-template-banner-copy">
                      <strong>Need the template?</strong>
                      <span>
                        Ensure your columns match: Class, Section, Admission No, Roll No, Birth Date
                        &amp; Guardian Name.
                      </span>
                    </div>
                  </div>
                  <Button
                    variant="secondary"
                    disabled={busy}
                    onClick={() => downloadClassStudentTemplate(name, sections)}
                  >
                    <Download size={14} aria-hidden="true" />
                    Download Sample Excel
                  </Button>
                </div>

                {!grid ? (
                  <label className="import-dropzone-empty">
                    <span className="sr-only">Excel file (.xlsx)</span>
                    <span className="import-dropzone-cloud" aria-hidden="true">
                      <UploadCloud size={22} />
                    </span>
                    <span className="import-dropzone-title">
                      {busy ? 'Reading workbook…' : 'Choose Excel file or drag & drop here'}
                    </span>
                    <p className="import-dropzone-sub">
                      Supports .xlsx up to 1,000 rows (Max 1 MiB)
                    </p>
                    <span className="import-browse-btn" aria-hidden="true">
                      Browse File
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
                  <div className="import-dropzone-filled">
                    <div className="import-file-info">
                      <span className="import-file-icon-box" aria-hidden="true">
                        <CheckCircle2 size={22} />
                      </span>
                      <div className="import-file-details">
                        <div className="import-file-name-row">
                          <strong>{fileName}</strong>
                          <span className="import-validated-pill">Validated</span>
                        </div>
                        <p role="status" className="import-file-meta">
                          ✓ {fileName} · {grid.length - 1} rows selected. Preview before importing.
                        </p>
                      </div>
                    </div>
                    <div className="import-file-actions">
                      <label className="import-replace-btn">
                        <RefreshCw size={13} aria-hidden="true" />
                        Replace file
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
                          setError('');
                        }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                )}

                <div className="import-config-grid">
                  <div className="import-config-card">
                    <div className="import-config-card-head">
                      <label className="field" style={{ width: '100%' }}>
                        <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <strong style={{ color: '#1e293b', fontSize: 12 }}>
                            Which classes are in this file?
                          </strong>
                          <span className="import-config-tag">Class Routing</span>
                        </span>
                        <select
                          value={scope}
                          disabled={busy}
                          onChange={(e) => setScope(e.target.value)}
                        >
                          <option value="workbook">Use the Class column</option>
                          {name && <option value="selected">Only the selected class: {name}</option>}
                        </select>
                      </label>
                    </div>
                    <small>
                      Read the Class column for each student, or restrict the file to this class.
                    </small>
                  </div>

                  <div className="import-config-card">
                    <div className="import-config-card-head">
                      <label className="field" style={{ width: '100%' }}>
                        <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <strong style={{ color: '#1e293b', fontSize: 12 }}>
                            If an admission number already exists
                          </strong>
                          <span className="import-config-tag">Duplicate Handling</span>
                        </span>
                        <select
                          value={mode}
                          disabled={busy}
                          onChange={(e) => setMode(e.target.value as 'create' | 'update')}
                        >
                          <option value="create">Keep existing students unchanged</option>
                          <option value="update">Update existing student details</option>
                        </select>
                      </label>
                    </div>
                    <small>
                      Match by the numeric part of Admission Number: SH-12 and AB-12 identify the
                      same record.
                    </small>
                  </div>
                </div>

                <div className="import-info-strip">
                  <Info size={16} aria-hidden="true" style={{ flexShrink: 0 }} />
                  <p>
                    {mode === 'update'
                      ? 'Add new students and update matching profiles. Blank optional cells clear existing values. Existing classes and roll numbers stay unchanged.'
                      : 'Add new students and skip identical records. Existing students with different details are flagged for review.'}
                  </p>
                </div>

                {error && (
                  <p role="alert" className="form-error">
                    {error}
                  </p>
                )}

                <div className="modal-actions">
                  <Button variant="secondary" disabled={busy} onClick={guard.requestClose}>
                    Cancel
                  </Button>
                  <Button
                    disabled={busy || !grid}
                    onClick={async () => {
                      if (!grid || busy) return;
                      setBusy(true);
                      setError('');
                      try {
                        const column = grid[0].findIndex((h) => h.trim().toLowerCase() === 'class');
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
                    {busy ? 'Preparing preview…' : 'Next: preview'}
                    {!busy && <ArrowRight size={14} aria-hidden="true" />}
                  </Button>
                </div>
                <History schoolId={schoolId} kind="students" openJob={openJob} />
              </>
            )}
            {jobId && (
              <div className="modal-actions">
                <Button onClick={guard.requestClose}>Back to class students</Button>
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
