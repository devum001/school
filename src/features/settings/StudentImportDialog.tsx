import ImportSteps from '../setup/ImportSteps';
import { formatRosterCell, formatCalendarDate, titleCase } from '../../lib/displayFormat';
import { useDraftGuard } from '../academics/useDraftGuard';
import { useRef, useState } from 'react';
import { useSchool } from '../../app/useSchool';
import { useFeedback } from '../../app/useFeedback';
import { Button, Modal } from '../../components/ui/Primitives';
import { repository } from '../../lib/repository';
import { previewStudentImport, type StudentImportPreview } from '../../lib/studentImport';
import { readStudentWorkbook, type ExcelCell } from '../../lib/xlsx';
import { downloadClassStudentTemplate } from '../../lib/studentTemplate';
import { sectionLabel } from '../../lib/schoolLabels';

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
                <div className="import-template-banner-copy">
                  <strong>Step 1: Download the sample Excel format</strong>
                  <p className="class-timetable-note">
                    Use the Students sheet. Fill Class, Admission Number and Roll Number for every
                    student. Leave Section blank when the class has no sections. Dates: DD-MM-YYYY
                    or Excel date cells. Import up to 1,000 students across classes at once.
                  </p>
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
                  Download Sample Excel
                </Button>
              </div>
              <div className="import-dropzone-card">
                <div className="import-dropzone-header">
                  <strong>Step 2: Select your Excel workbook (.xlsx)</strong>
                  <span className="import-dropzone-badge">.xlsx · Up to 1,000 students</span>
                </div>
                <label className="student-timing-field">
                  Excel file (.xlsx)
                  <input
                    type="file"
                    accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    onChange={async (event) => {
                      const file = event.target.files?.[0];
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
                    }}
                  />
                </label>
                {reading && <p role="status">Reading and validating {fileName}…</p>}
                {preview && !reading && (
                  <p role="status" className="import-file-ready">
                    <span>
                      ✓ {fileName} · {preview.rows.length} student rows loaded (
                      {preview.errors.length
                        ? `${preview.errors.length} need correction`
                        : 'all rows valid'}
                      )
                    </span>
                  </p>
                )}
              </div>
              <div className="import-options-card">
                <h4 className="import-options-card-title">
                  Step 3: Default fallback class (optional)
                </h4>
                <label className="field">
                  Default class for older workbooks without a Class column
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
              </div>
            </>
          )}
          {preview && step > 1 && (
            <>
              <div className="import-kpi-strip">
                <div className="import-kpi-box">
                  <strong>{preview.rows.length}</strong>
                  <span>Total students in {fileName || 'workbook'}</span>
                </div>
                <div className="import-kpi-box" data-tone="success">
                  <strong>{preview.rows.filter((r) => !r.error).length}</strong>
                  <span>Valid & ready</span>
                </div>
                <div
                  className="import-kpi-box"
                  data-tone={preview.errors.length > 0 ? 'danger' : undefined}
                >
                  <strong>{preview.errors.length}</strong>
                  <span>Rows needing correction</span>
                </div>
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
                      {preview.rows.slice(offset, offset + 50).map((row) => (
                        <tr key={row.row} data-row-error={Boolean(row.error)}>
                          <td>{row.row}</td>
                          <td>{row.input.rollNumber || '—'}</td>
                          <td>{titleCase(row.input.name) || '—'}</td>
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
                            <span
                              className="import-status-badge"
                              data-valid={!row.error}
                            >
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
              {step === 2 && preview.rows.length > 50 && (
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
                    disabled={offset + 50 >= preview.rows.length}
                    onClick={() => setOffset(offset + 50)}
                  >
                    Next rows
                  </Button>
                </div>
              )}
              {preview.rows.length > 50 && (
                <p className="class-timetable-note">
                  Showing rows {offset + 1}–{Math.min(offset + 50, preview.rows.length)}. All{' '}
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
          {step === 3 && (
            <div className="import-submit-card">
              <strong>Ready to enroll {preview?.rows.length} students</strong>
              <p>
                Import {preview?.rows.length} students into the classes shown in the preview.
                Admission numbers match by numeric part across your school; roll numbers within each
                class and section.
              </p>
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
            </Button>
          </div>
          {editingRow !== null && grid && (
            <Modal
              open
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
                <Button type="button" variant="secondary" onClick={() => setEditingRow(null)}>
                  Cancel
                </Button>
                <Button>Save correction</Button>
              </form>
            </Modal>
          )}
        </div>
      )}
    </Modal>
  );
}
