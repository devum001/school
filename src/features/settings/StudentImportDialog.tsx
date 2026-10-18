import { useDraftGuard } from '../academics/useDraftGuard';
import { useRef, useState } from 'react';
import { useSchool } from '../../app/useSchool';
import { useFeedback } from '../../app/useFeedback';
import { Button, Modal } from '../../components/ui/Primitives';
import { repository } from '../../lib/repository';
import { previewStudentImport, type StudentImportPreview } from '../../lib/studentImport';
import { readStudentWorkbook, type ExcelCell } from '../../lib/xlsx';
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
      presentation={presentation}
      onClose={discard ? guard.keepEditing : close}
      title={discard ? 'Close this import preview?' : 'Import students from Excel'}
      description={
        discard
          ? 'The file has not been saved. You can choose it again later.'
          : `${schoolClass?.name} · All sections. Each row uses its Section column. Preview and validate before adding students.`
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
        <>
          <label className="student-timing-field">
            Excel file (.xlsx)
            <input
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                const attempt = ++request.current;
                setGrid(null);
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
                  setPreview(previewStudentImport(repository.getSnapshot(), classId, cells));
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
          <p className="class-timetable-note">
            Use the Students sheet. Fill Admission Number, Roll Number and Section for every
            student. Dates: YYYY-MM-DD or Excel date cells. Import up to 1,000 students across this
            class's sections at once.
          </p>
          {reading && <p role="status">Reading and validating {fileName}…</p>}
          {preview && (
            <>
              <p className="import-summary">
                {preview.rows.length} students ·{' '}
                {preview.errors.length
                  ? `${preview.errors.length} ${preview.errors.length === 1 ? 'row needs' : 'rows need'} correction`
                  : 'Ready to import'}{' '}
                · {fileName}
              </p>
              {preview.errors.length > 0 && (
                <div className="import-errors" role="alert">
                  <strong>Fix these rows in Excel and choose the file again.</strong>
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
                      <th scope="col">Section</th>
                      <th scope="col">Admission number</th>
                      <th scope="col">Birth date</th>
                      <th scope="col">Check</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.slice(0, 50).map((row) => (
                      <tr key={row.row}>
                        <td>{row.row}</td>
                        <td>
                          {Number.isFinite(row.input.rollNumber) ? row.input.rollNumber : '—'}
                        </td>
                        <td>{row.input.name || '—'}</td>
                        <td>
                          {sectionLabel(
                            sections.find((item) => item.id === row.input.sectionId)?.name,
                          )}
                        </td>
                        <td>{row.input.admissionNumber || '—'}</td>
                        <td>{row.input.birthDate}</td>
                        <td>{row.error ?? 'Ready'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {preview.rows.length > 50 && (
                <p className="class-timetable-note">
                  Showing the first 50 students. All {preview.rows.length} validated students will
                  be imported.
                </p>
              )}
            </>
          )}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="modal-actions">
            <Button variant="secondary" onClick={close}>
              Cancel
            </Button>
            <Button
              disabled={!grid || !preview || preview.errors.length > 0 || reading}
              onClick={() => {
                if (!grid || !preview) return;
                try {
                  repository.importStudents(classId, grid);
                  notify(`${preview.rows.length} students imported into ${schoolClass?.name}.`);
                  request.current++;
                  guard.complete();
                } catch (cause) {
                  setError(cause instanceof Error ? cause.message : 'Unable to save students.');
                }
              }}
            >
              Import {preview?.rows.length ?? ''} students
            </Button>
          </div>
        </>
      )}
    </Modal>
  );
}
