import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
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
                  <div className="import-template-banner-copy">
                    <strong>Step 1: Download the sample Excel format</strong>
                    <p>
                      Use the Students sheet. Fill Class (for example Class 12 or 12th), Admission
                      Number, Roll Number, Birth Date and Guardian Name. Leave Section blank only
                      for a class with no sections.
                    </p>
                  </div>
                  <Button
                    variant="secondary"
                    disabled={busy}
                    onClick={() => downloadClassStudentTemplate(name, sections)}
                  >
                    Download Sample Excel
                  </Button>
                </div>
                <div className="import-dropzone-card">
                  <div className="import-dropzone-header">
                    <strong>Step 2: Upload your filled Excel workbook</strong>
                    <span className="import-dropzone-badge">.xlsx · Max 1,000 rows · 1 MiB</span>
                  </div>
                  <label className="field">
                    Excel file (.xlsx)
                    <input
                      type="file"
                      accept=".xlsx"
                      disabled={busy}
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        e.target.value = '';
                        setGrid(null);
                        setError('');
                        setFileName(file?.name ?? '');
                        if (!file) return;
                        setBusy(true);
                        try {
                          setGrid(await readRosterFile(file, 'students', STUDENT_IMPORT_HEADERS));
                        } catch (cause) {
                          setError(
                            cause instanceof Error ? cause.message : 'Unable to read workbook.',
                          );
                        } finally {
                          setBusy(false);
                        }
                      }}
                    />
                  </label>
                  {grid && (
                    <p role="status" className="import-file-ready">
                      <span>
                        ✓ {fileName} · {grid.length - 1} rows selected. Preview before importing.
                      </span>
                    </p>
                  )}
                </div>
                <div className="import-options-card">
                  <h4 className="import-options-card-title">
                    Step 3: Choose class routing & duplicate handling
                  </h4>
                  <div className="student-timing-form-grid">
                    <label className="field">
                      Which classes are in this file?
                      <select
                        value={scope}
                        disabled={busy}
                        onChange={(e) => setScope(e.target.value)}
                      >
                        <option value="workbook">Use the Class column</option>
                        {name && <option value="selected">Only the selected class: {name}</option>}
                      </select>
                      <small>
                        Read the Class column for each student, or restrict the file to this class.
                      </small>
                    </label>
                    <label className="field">
                      If an admission number already exists
                      <select
                        value={mode}
                        disabled={busy}
                        onChange={(e) => setMode(e.target.value as 'create' | 'update')}
                      >
                        <option value="create">Keep existing students unchanged</option>
                        <option value="update">Update existing student details</option>
                      </select>
                      <small>
                        Match by the numeric part of Admission Number: SH-12 and AB-12 identify the
                        same record.
                      </small>
                    </label>
                  </div>
                  <p className="import-note">
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
