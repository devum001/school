import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';

import { useSchool } from '../../app/useSchool';

import { useFeedback } from '../../app/useFeedback';

import { AppIcon, Button, Modal, SearchInput } from '../../components/ui/Primitives';

import { examSections, sheetDraft } from '../../lib/academicSheets';

import { repository } from '../../lib/repository';

import { previewSheetImport, sheetTemplate } from '../../lib/sheetImport';

import { parseMarksCsv } from '../../lib/marksImport';

import { downloadCsv } from '../../lib/download';

import { downloadStudentWorkbook, readStudentWorkbook } from '../../lib/xlsx';

import type { Examination, RosterEntry } from '../../types/domain';

import { sectionLabel } from '../../lib/schoolLabels';
import { examClasses } from '../../lib/testScope';

import { useDraftGuard } from './useDraftGuard';

export default function MarksDialog({
  exam,
  students,
  studentId,
  onClose,
}: {
  exam: Examination;
  students: RosterEntry[];
  studentId?: string;
  onClose: () => void;
}) {
  const state = useSchool(),
    notify = useFeedback();

  const classes = examClasses(state, exam);
  const sections = examSections(state, exam, '');

  const [section, setSection] = useState(
    students.find((r) => r.student.id === studentId)?.enrollment.sectionId ??
      students[0]?.enrollment.sectionId ??
      sections[0]?.id ??
      '',
  );

  const [drafts, setDrafts] = useState(() =>
    Object.fromEntries(sections.map((s) => [s.id, sheetDraft(state, exam, s.id)])),
  );

  const [initial] = useState(() => JSON.stringify(drafts));

  const [query, setQuery] = useState(''),
    [error, setError] = useState('');

  const [preview, setPreview] = useState<ReturnType<typeof previewSheetImport> | null>(null);

  const [reading, setReading] = useState(false);

  const request = useRef(0);
  const sampleDownload = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const closeOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !sampleDownload.current?.contains(event.target))
        sampleDownload.current?.removeAttribute('open');
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && sampleDownload.current?.open) {
        event.preventDefault();
        event.stopPropagation();
        sampleDownload.current.removeAttribute('open');
        sampleDownload.current.querySelector('summary')?.focus();
      }
    };
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('keydown', closeOnEscape, true);
    return () => {
      document.removeEventListener('pointerdown', closeOutside);
      document.removeEventListener('keydown', closeOnEscape, true);
    };
  }, []);

  const guard = useDraftGuard(
    JSON.stringify(drafts) !== initial || Boolean(preview) || reading,
    onClose,
  );

  const scopeClass = sections.find((s) => s.id === section)?.classId ?? classes[0]?.id ?? '';
  const draft = drafts[section];

  const update = (next: typeof draft) => setDrafts((prev) => ({ ...prev, [section]: next }));

  const setCell = (id: string, index: number, value: string) =>
    update({
      ...draft,
      rows: draft.rows.map((r) =>
        r.enrollmentId === id
          ? { ...r, cells: r.cells.map((cell, i) => (i === index ? value : cell)) }
          : r,
      ),
    });

  const changeSection = (id: string) => {
    if (preview || reading) {
      setError('Apply or cancel the import preview before switching sections.');
      return;
    }
    setSection(id);
    setQuery('');
    setError('');
  };

  const template = (format: 'xlsx' | 'csv') => {
    sampleDownload.current?.removeAttribute('open');
    sampleDownload.current?.querySelector('summary')?.focus();
    const grid = sheetTemplate(draft.columns, draft.students),
      filename =
        `Marks-${exam.name}-${state.classes.find((c) => c.id === scopeClass)?.name ?? ''}-${sectionLabel(sections.find((s) => s.id === section)?.name ?? '')}`.replace(
          /[^a-zA-Z0-9-]/g,
          '-',
        );

    if (format === 'csv') downloadCsv(`${filename}.csv`, grid[0].map(String), grid.slice(1));
    else
      downloadStudentWorkbook(
        `${filename}.xlsx`,
        grid,
        [
          'Fill maximum marks in the second row. Number = marks; A = absent; blank = pending.',
          'A completely blank subject column is excluded. Blank student rows in an import keep existing marks.',
          'Keep Class, Section, Roll No. and Student Name unchanged. Import this file into the same class and section.',
        ],
        'Marks',
      );
  };

  return (
    <Modal
      open
      wide
      onClose={guard.confirming ? guard.keepEditing : guard.requestClose}

      title={guard.confirming ? 'Discard marks changes?' : exam.name}

      description={
        guard.confirming
          ? 'Your changes have not been saved.'
          : `${state.classes.find((c) => c.id === scopeClass)?.name ?? 'Class marks'} · Enter maximum marks and student marks below.`
      }
    >
      {guard.confirming ? (
        <div className="modal-actions">
          <Button variant="secondary" onClick={guard.keepEditing}>
            Keep editing
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              request.current++;
              guard.discard();
            }}
          >
            Discard changes
          </Button>
        </div>
      ) : (
        <>
          <div className="marks-scope-selectors">
            <label className="field">
              Class
              <select
                aria-label="Marks class"
                value={scopeClass}
                onChange={(e) =>
                  changeSection(sections.find((s) => s.classId === e.target.value)?.id ?? '')
                }
              >
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Section
              <select
                aria-label="Marks section"
                value={section}
                onChange={(e) => changeSection(e.target.value)}
              >
                {sections
                  .filter((s) => s.classId === scopeClass)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {sectionLabel(s.name)}
                      {JSON.stringify(drafts[s.id]) !== JSON.stringify(JSON.parse(initial)[s.id])
                        ? ' •'
                        : ''}
                    </option>
                  ))}
              </select>
            </label>
          </div>

          {draft && (
            <>
              <div className="sheet-tools">
                <SearchInput
                  value={query}
                  onChange={setQuery}
                  placeholder="Search name or roll number…"
                />
                <div className="inline-actions">
                  <details
                    className="sample-download"
                    ref={sampleDownload}
                    onBlur={(event) => {
                      if (!event.currentTarget.contains(event.relatedTarget))
                        event.currentTarget.removeAttribute('open');
                    }}
                  >
                    <summary className="button secondary">
                      <AppIcon name="download" size={16} />
                      Download sample Excel / CSV
                      <ChevronDown size={16} aria-hidden="true" />
                    </summary>
                    <div className="sample-download-options" role="group" aria-label="Sample file formats">
                      <Button variant="ghost" onClick={() => template('xlsx')}>
                        Excel (.xlsx)
                      </Button>
                      <Button variant="ghost" onClick={() => template('csv')}>
                        CSV (.csv)
                      </Button>
                    </div>
                  </details>
                  <label className="button secondary sheet-upload">
                    <AppIcon name="upload" size={16} />
                    {reading ? 'Reading…' : 'Import Excel / CSV'}
                    <input
                      type="file"
                      accept=".xlsx,.csv"
                      disabled={reading}
                      aria-label="Import marks file"
                      onChange={async (event) => {
                        const file = event.target.files?.[0];
                        event.target.value = '';
                        if (!file) return;

                        if (file.size > 10 * 1024 * 1024) {
                          setError('Choose a file up to 10 MB.');
                          return;
                        }

                        const token = ++request.current;
                        setReading(true);
                        setError('');

                        try {
                          const grid = file.name.toLowerCase().endsWith('.csv')
                            ? parseMarksCsv(await file.text())
                            : await readStudentWorkbook(file);
                          if (token === request.current)
                            setPreview(
                              previewSheetImport(draft.columns, draft.rows, draft.students, grid),
                            );
                        } catch (cause) {
                          if (token === request.current)
                            setError(
                              cause instanceof Error ? cause.message : 'Unable to read this file.',
                            );
                        } finally {
                          if (token === request.current) setReading(false);
                        }
                      }}
                    />
                  </label>
                </div>
              </div>

              <p className="sheet-legend">
                <strong>Number</strong> = marks · <strong>A</strong> = absent ·{' '}
                <strong>Blank</strong> = pending. A whole subject column left blank is excluded from
                the test.
              </p>

              {preview && (
                <section className="sheet-import-preview" aria-label="Import preview">
                  <h3>Review {preview.changes.length} student rows</h3>
                  <p>
                    Populated rows replace their subject marks. Blank rows keep existing marks.
                    Changes are saved only with Save Marks.
                  </p>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Roll No.</th>
                          <th>Student</th>
                          {draft.columns.map((c) => (
                            <th key={c.subjectId}>{c.name}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {preview.changes.map((r) => (
                          <tr key={r.roll}>
                            <td>{r.roll}</td>
                            <td>{r.name}</td>
                            {r.cells.map((c, i) => (
                              <td key={i}>{c || 'Pending'}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="inline-actions">
                    <Button variant="secondary" onClick={() => setPreview(null)}>
                      Cancel import
                    </Button>
                    <Button
                      onClick={() => {
                        update({ ...draft, columns: preview.columns, rows: preview.rows });
                        setPreview(null);
                      }}
                    >
                      Apply to sheet
                    </Button>
                  </div>
                </section>
              )}

              <div
                className="table-wrap marks-spreadsheet"
                role="region"
                aria-label="Marks sheet"
                tabIndex={0}
              >
                <table>
                  <thead>
                    <tr>
                      <th>Roll No.</th>
                      <th>Student</th>
                      {draft.columns.map((c, i) => (
                        <th key={c.subjectId}>
                          <span>{c.name}</span>
                          <label>
                            Max marks
                            <input
                              aria-label={`${c.name} maximum marks`}
                              inputMode="decimal"
                              value={c.maximum}
                              disabled={Boolean(preview)}
                              onChange={(e) =>
                                update({
                                  ...draft,
                                  columns: draft.columns.map((col, index) =>
                                    index === i ? { ...col, maximum: e.target.value } : col,
                                  ),
                                })
                              }
                            />
                          </label>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {draft.students
                      .filter((s) =>
                        `${s.student.name} ${s.enrollment.rollNumber}`
                          .toLowerCase()
                          .includes(query.toLowerCase()),
                      )
                      .map((student) => {
                        const row = draft.rows.find(
                          (r) => r.enrollmentId === student.enrollment.id,
                        )!;

                        return (
                          <tr
                            key={row.enrollmentId}
                            className={student.student.id === studentId ? 'targeted-student' : ''}
                          >
                            <td>{student.enrollment.rollNumber}</td>
                            <th scope="row">{student.student.name}</th>
                            {draft.columns.map((c, i) => (
                              <td key={c.subjectId}>
                                <input
                                  aria-label={`${student.student.name} ${c.name} marks`}
                                  value={row.cells[i]}
                                  disabled={Boolean(preview)}
                                  autoFocus={student.student.id === studentId && i === 0}
                                  className={
                                    row.cells[i].toUpperCase() === 'A' ? 'cell-absent' : ''
                                  }
                                  onChange={(e) => setCell(row.enrollmentId, i, e.target.value)}
                                  onPaste={(event) => {
                                    const text = event.clipboardData.getData('text');
                                    if (!text.includes('\t') && !text.trimEnd().includes('\n'))
                                      return;
                                    event.preventDefault();

                                    const start = draft.rows.findIndex(
                                        (r) => r.enrollmentId === row.enrollmentId,
                                      ),
                                      pasted = text
                                        .replace(/\r/g, '')
                                        .replace(/\n$/, '')
                                        .split('\n')
                                        .map((line) => line.split('\t'));

                                    if (query) {
                                      setError(
                                        'Clear the student search before pasting multiple rows.',
                                      );
                                      return;
                                    }

                                    if (
                                      start + pasted.length > draft.rows.length ||
                                      pasted.some((line) => i + line.length > draft.columns.length)
                                    ) {
                                      setError(
                                        'The pasted cells exceed this sheet. Start at the correct subject and student.',
                                      );
                                      return;
                                    }

                                    update({
                                      ...draft,
                                      rows: draft.rows.map((r, index) =>
                                        index >= start && index < start + pasted.length
                                          ? {
                                              ...r,
                                              cells: r.cells.map((cell, col) =>
                                                col >= i && col < i + pasted[index - start].length
                                                  ? pasted[index - start][col - i].trim()
                                                  : cell,
                                              ),
                                            }
                                          : r,
                                      ),
                                    });
                                  }}
                                  onKeyDown={(event) => {
                                    if (event.key === 'Enter') {
                                      event.preventDefault();
                                      const index = draft.students.findIndex(
                                          (s) => s.enrollment.id === row.enrollmentId,
                                        ),
                                        next = draft.students[index + 1];
                                      if (next)
                                        document
                                          .getElementsByName(
                                            `${next.enrollment.id}-${c.subjectId}`,
                                          )[0]
                                          ?.focus();
                                    }
                                  }}
                                  name={`${row.enrollmentId}-${c.subjectId}`}
                                />
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>

              {!draft.students.length && (
                <p className="panel-note">No active students in this section.</p>
              )}
            </>
          )}

          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}

          <div className="modal-actions sheet-save">
            <span>Save Marks saves all changed sections together.</span>
            <Button variant="secondary" onClick={guard.requestClose}>
              Cancel
            </Button>
            <Button
              disabled={Boolean(preview) || reading || JSON.stringify(drafts) === initial}
              onClick={() => {
                try {
                  const original: typeof drafts = JSON.parse(initial);

                  repository.saveMarksSheets(
                    exam.id,
                    Object.entries(drafts)
                      .filter(([id, d]) => JSON.stringify(d) !== JSON.stringify(original[id]))
                      .map(([sectionId, d]) => ({ sectionId, columns: d.columns, rows: d.rows })),
                  );

                  notify('Marks saved. Results and student histories updated.');
                  guard.complete();
                } catch (cause) {
                  setError(cause instanceof Error ? cause.message : 'Unable to save marks.');
                }
              }}
            >
              <AppIcon name="save" size={16} />
              Save Marks
            </Button>
          </div>
        </>
      )}
    </Modal>
  );
}
