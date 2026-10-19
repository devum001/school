import { useEffect, useMemo, useRef, useState } from 'react';
import { useSchool } from '../../app/useSchool';
import { useFeedback } from '../../app/useFeedback';
import { AppIcon, Badge, Button, Modal } from '../../components/ui/Primitives';
import { testRoster } from '../../lib/academics';
import { downloadCsv } from '../../lib/download';
import {
  marksImportEntries,
  marksImportTemplate,
  parseMarksCsv,
  previewMarksImport,
} from '../../lib/marksImport';
import { repository } from '../../lib/repository';
import { downloadStudentWorkbook, readStudentWorkbook, type ExcelCell } from '../../lib/xlsx';
import type { DemoState, Examination, RosterEntry } from '../../types/domain';
import { useDraftGuard } from './useDraftGuard';

const statusLabels = {
  new: 'New result',
  update: 'Update result',
  unchanged: 'No change',
  skip: 'Skipped — kept',
  error: 'Needs correction',
};

export default function ImportMarksDialog({
  exam,
  students,
  onClose,
}: {
  exam: Examination;
  students: RosterEntry[];
  onClose: () => void;
}) {
  const state = useSchool();
  const notify = useFeedback();
  const [grid, setGrid] = useState<ExcelCell[][] | null>(null);
  const [fileName, setFileName] = useState('');
  const [reading, setReading] = useState(false);
  const [error, setError] = useState('');
  const request = useRef(0);
  const guard = useDraftGuard(Boolean(grid) || reading, onClose);
  const scopeSections = useMemo(
    () => new Set(students.map((student) => student.enrollment.sectionId)),
    [students],
  );
  const context = (snapshot: DemoState) => {
    const current = snapshot.exams.find(
      (test) =>
        test.id === exam.id &&
        test.schoolId === snapshot.school.id &&
        test.academicYearId === snapshot.academicYear.id,
    );
    if (!current)
      throw new Error(
        'This test is no longer available. Close this preview and select another test.',
      );
    if (
      current.classId !== exam.classId ||
      current.sectionId !== exam.sectionId ||
      JSON.stringify(current.subjects) !== JSON.stringify(exam.subjects)
    )
      throw new Error(
        'The test setup changed. Close this preview and download its updated marks template.',
      );
    return {
      exam: current,
      students: testRoster(snapshot, current).filter((student) =>
        scopeSections.has(student.enrollment.sectionId),
      ),
    };
  };
  let contextError = '';
  let currentContext: ReturnType<typeof context> | null = null;
  try {
    currentContext = context(state);
  } catch (cause) {
    contextError = cause instanceof Error ? cause.message : 'Unable to find the test roster.';
  }
  const preview =
    grid && currentContext
      ? previewMarksImport(currentContext.exam, currentContext.students, state.results, grid)
      : null;
  const changes = (preview?.newCount ?? 0) + (preview?.updateCount ?? 0);
  const className =
    state.classes.find((item) => item.id === exam.classId)?.name ??
    students[0]?.className ??
    'Selected class';
  const sectionNames = [...new Set(students.map((student) => student.sectionName))]
    .sort()
    .join(', ');
  const instructions = [
    `${exam.name} · ${className} · Sections: ${sectionNames} · ${state.academicYear.name}`,
    'Keep Section, Roll No. and Student Name unchanged. Download a fresh template if the student roster changes.',
    ...exam.subjects.map(
      (subject) => `${subject.name}: enter a plain number from 0 to ${subject.maxMarks}.`,
    ),
    'Absent: Yes = did not take the test. Leave marks blank or zero for an absent student.',
    'A completely blank marks row with Absent No is skipped. Existing marks and pending results are kept.',
    'Only populated imported rows replace existing results. Zero is a real mark. No formulas. Maximum 1,000 student rows.',
    'Upload this file into this same test, class and section selection. Preview all changes before confirming.',
  ];
  useEffect(
    () => () => {
      request.current++;
    },
    [],
  );

  const downloadTemplate = (format: 'xlsx' | 'csv') => {
    try {
      const fresh = context(repository.getSnapshot());
      const template = marksImportTemplate(fresh.exam, fresh.students);
      const filename = `Marks-${className}-${exam.name}`
        .replace(/[^a-zA-Z0-9 _-]/g, '')
        .replace(/\s+/g, '-');
      if (format === 'xlsx')
        downloadStudentWorkbook(`${filename}.xlsx`, template, instructions, 'Marks');
      else downloadCsv(`${filename}.csv`, template[0].map(String), template.slice(1));
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to download the marks template.');
    }
  };
  return (
    <Modal
      open
      wide
      onClose={guard.confirming ? guard.keepEditing : guard.requestClose}
      title={guard.confirming ? 'Close this marks import?' : 'Import marks from Excel / CSV'}
      description={
        guard.confirming
          ? 'Your file has not been saved. Keep reviewing, or discard this preview.'
          : `${exam.name} · ${className} · Sections ${sectionNames}. Match students using section, roll number and name.`
      }
    >
      {guard.confirming ? (
        <div className="modal-actions">
          <Button variant="secondary" onClick={guard.keepEditing}>
            Keep reviewing
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              request.current++;
              guard.discard();
            }}
          >
            Discard preview
          </Button>
        </div>
      ) : (
        <>
          <div className="marks-import-steps">
            <div>
              <h3>1. Download this test's roster</h3>
              <p>
                Download the student list, then fill in the subject marks.
              </p>
              <div className="marks-import-template-actions">
                <Button
                  variant="secondary"
                  disabled={Boolean(contextError)}
                  onClick={() => downloadTemplate('xlsx')}
                >
                  <AppIcon name="download" size={16} /> Excel template
                </Button>
                <Button
                  variant="secondary"
                  disabled={Boolean(contextError)}
                  onClick={() => downloadTemplate('csv')}
                >
                  <AppIcon name="download" size={16} /> CSV template
                </Button>
              </div>
            </div>
            <div>
              <h3>2. Upload and review</h3>
              <label className="student-timing-field">
                Marks file (.xlsx or .csv, up to 10 MB)
                <input
                  aria-label="Upload marks file"
                  type="file"
                  accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
                  onChange={async (event) => {
                    const file = event.target.files?.[0];
                    const attempt = ++request.current;
                    setGrid(null);
                    setError('');
                    setFileName(file?.name ?? '');
                    if (!file) {
                      setReading(false);
                      return;
                    }
                    setReading(true);
                    try {
                      if (file.size > 10 * 1024 * 1024)
                        throw new Error('Choose an Excel or CSV file under 10 MB.');
                      if (!/\.(xlsx|csv)$/i.test(file.name))
                        throw new Error('Choose an Excel .xlsx or CSV file.');
                      const cells = /\.xlsx$/i.test(file.name)
                        ? await readStudentWorkbook(file)
                        : parseMarksCsv(await file.text());
                      if (attempt !== request.current) return;
                      setGrid(cells);
                    } catch (cause) {
                      if (attempt === request.current)
                        setError(
                          cause instanceof Error
                            ? cause.message
                            : 'Unable to read this file. Use the template for this test.',
                        );
                    } finally {
                      if (attempt === request.current) setReading(false);
                    }
                  }}
                />
              </label>
            </div>
          </div>
          <p className="marks-import-note">
            <strong>Blank rows keep saved results.</strong> 0 = scored zero. Absent Yes = did not
            take the test. Review changes before confirming.
          </p>
          <p className="muted">
            Keep section, roll number and name unchanged. If rolls have changed, download a fresh
            template. Up to 1,000 students per file.
          </p>
          <p className="muted">
            Subject limits:{' '}
            {exam.subjects.map((subject) => `${subject.name} / ${subject.maxMarks}`).join(' · ')}
          </p>
          {reading && (
            <p role="status">
              <AppIcon name="upload" size={16} /> Reading and validating {fileName}…
            </p>
          )}
          {preview && (
            <>
              <div className="marks-import-summary" role="status">
                <strong>{fileName}</strong>
                <Badge tone="blue">
                  {preview.newCount} new · {preview.updateCount} updates
                </Badge>
                <span>
                  {preview.unchangedCount} unchanged · {preview.skippedCount} skipped
                </span>
              </div>
              {preview.errors.length > 0 && (
                <div className="import-errors" role="alert">
                  <strong>No marks will be saved until every error is fixed.</strong>
                  <ul>
                    {preview.errors.slice(0, 15).map((message, index) => (
                      <li key={`${index}-${message}`}>{message}</li>
                    ))}
                  </ul>
                  {preview.errors.length > 15 && (
                    <p>
                      Showing the first 15 of {preview.errors.length} errors. Correct the file and
                      upload it again.
                    </p>
                  )}
                </div>
              )}
              {!preview.errors.length && !changes && (
                <p className="marks-import-note">
                  Nothing to update. Rows are blank or already match the saved results.
                </p>
              )}
              {preview.rows.length > 0 && (
                <div
                  className="import-preview-scroll marks-import-preview"
                  tabIndex={0}
                  role="region"
                  aria-label="Marks import preview"
                >
                  <table className="import-preview">
                    <caption>Review student matches and marks before importing</caption>
                    <thead>
                      <tr>
                        <th scope="col">File row</th>
                        <th scope="col">Section / Roll No.</th>
                        <th scope="col">Student</th>
                        <th scope="col">Currently saved</th>
                        <th scope="col">After import</th>
                        <th scope="col">Check</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.rows.slice(0, 100).map((row) => (
                        <tr key={row.row}>
                          <td>{row.row}</td>
                          <td>
                            {row.section || '—'} / {row.roll || '—'}
                          </td>
                          <td>{row.studentName || '—'}</td>
                          <td>{row.before}</td>
                          <td>{row.after}</td>
                          <td>
                            <Badge
                              tone={
                                row.errors.length
                                  ? 'danger'
                                  : row.status === 'skip' || row.status === 'unchanged'
                                    ? 'neutral'
                                    : 'green'
                              }
                            >
                              {statusLabels[row.status]}
                            </Badge>
                            {row.errors.map((message) => (
                              <small key={message}>{message}</small>
                            ))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {preview.rows.length > 100 && (
                <p className="muted">
                  Showing the first 100 of {preview.rows.length} rows. All rows are validated; all{' '}
                  {changes} changed results will be imported.
                </p>
              )}
            </>
          )}
          {(contextError || error) && (
            <p className="form-error" role="alert">
              {contextError || error}
            </p>
          )}
          <div className="modal-actions">
            <Button variant="secondary" onClick={guard.requestClose}>
              Cancel
            </Button>
            <Button
              disabled={
                !grid ||
                !preview ||
                preview.errors.length > 0 ||
                !changes ||
                reading ||
                Boolean(contextError)
              }
              onClick={() => {
                if (!grid) return;
                try {
                  const snapshot = repository.getSnapshot();
                  const fresh = context(snapshot);
                  const checked = previewMarksImport(
                    fresh.exam,
                    fresh.students,
                    snapshot.results,
                    grid,
                  );
                  const entries = marksImportEntries(checked);
                  repository.saveTestMarks(fresh.exam.id, entries);
                  notify(
                    `${entries.length} student ${entries.length === 1 ? 'result' : 'results'} imported. Student reports and class results are up to date.`,
                  );
                  request.current++;
                  onClose();
                } catch (cause) {
                  setError(
                    cause instanceof Error
                      ? cause.message
                      : 'Unable to save imported marks. No marks were changed.',
                  );
                }
              }}
            >
              <AppIcon name="save" size={16} />
              Confirm import{changes ? ` (${changes})` : ''}
            </Button>
          </div>
        </>
      )}
    </Modal>
  );
}
