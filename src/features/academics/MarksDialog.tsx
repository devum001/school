import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';

import { useSchool } from '../../app/useSchool';

import { useFeedback } from '../../app/useFeedback';

import { AppIcon, Button, Modal, SearchInput } from '../../components/ui/Primitives';

import { sortMarksRoster } from '../../lib/marksRoster';
import { assessmentMaximum } from '../../lib/assessmentMaximums';
import { sheetDraft } from '../../lib/academicSheets';

import { useSchoolFeature } from '../../app/schoolFeatureContext';
import { repository } from '../../lib/repository';

import { previewSheetImport, sheetTemplate } from '../../lib/sheetImport';

import { parseMarksCsv } from '../../lib/marksImport';

import { downloadCsv } from '../../lib/download';

import { downloadStudentWorkbook, readStudentWorkbook } from '../../lib/xlsx';

import type { Examination, RosterEntry } from '../../types/domain';

import { examGroups } from '../../lib/academicGroups';
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
  const feature = useSchoolFeature();
  const data = feature ?? repository;
  const [saving, setSaving] = useState(false);
  const state = useSchool(),
    notify = useFeedback();

  const classes = examClasses(state, exam);
  const sections = examGroups(state, exam);
  const initialStudent = students.find((r) => r.student.id === studentId) ?? students[0];

  const [scopeClass, setScopeClass] = useState(
    initialStudent?.enrollment.classId ?? classes[0]?.id ?? '',
  );
  const [section, setSection] = useState(
    studentId
      ? (sections.find(
          (s) =>
            s.classId === initialStudent?.enrollment.classId &&
            s.sectionId === initialStudent?.enrollment.sectionId,
        )?.key ?? '')
      : '',
  );

  const [drafts, setDrafts] = useState(() =>
    Object.fromEntries(
      sections.map((s) => {
        const draft = sheetDraft(state, exam, s.sectionId, s.classId);
        const indexes = draft.columns
          .map((c, i) => ({ c, i }))
          .filter(
            ({ c }) =>
              !feature?.canMarkSubject ||
              feature.canMarkSubject(s.classId, s.sectionId, c.subjectId, c.name),
          );
        return [
          s.key,
          {
            ...draft,
            columns: indexes.map(({ c }) => c),
            rows: draft.rows.map((r) => ({ ...r, cells: indexes.map(({ i }) => r.cells[i]) })),
          },
        ];
      }),
    ),
  );

  const [initial] = useState(() => JSON.stringify(drafts));

  const [query, setQuery] = useState(''),
    [error, setError] = useState('');

  const [preview, setPreview] = useState<ReturnType<typeof previewSheetImport> | null>(null);

  const [assessmentConfirmed, setAssessmentConfirmed] = useState(false);
  const [replaceConfirmed, setReplaceConfirmed] = useState(false);
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

  const visibleGroups = sections.filter(
    (s) => s.classId === scopeClass && (!section || s.key === section),
  );
  const groupDrafts = visibleGroups.map((s) => drafts[s.key]);
  const columns = groupDrafts
    .flatMap((d) => d.columns)
    .filter((c, i, all) => all.findIndex((v) => v.subjectId === c.subjectId) === i);
  const visibleStudents = sortMarksRoster(groupDrafts.flatMap((d) => d.students));
  const draft = {
    columns,
    students: visibleStudents,
    rows: visibleStudents.map((s) => {
      const original = groupDrafts.find((d) =>
        d.students.some((v) => v.enrollment.id === s.enrollment.id),
      )!;
      const row = original.rows.find((r) => r.enrollmentId === s.enrollment.id)!;
      return {
        enrollmentId: row.enrollmentId,
        cells: columns.map((c) => {
          const index = original.columns.findIndex((v) => v.subjectId === c.subjectId);
          return index < 0 ? '' : row.cells[index];
        }),
      };
    }),
  };
  const canEditCell = (student: RosterEntry, subjectId: string, subjectName?: string) =>
    !feature?.canMarkSubject ||
    feature.canMarkSubject(
      student.enrollment.classId,
      student.enrollment.sectionId,
      subjectId,
      subjectName ?? columns.find((col) => col.subjectId === subjectId)?.name,
    );
  const update = (next: typeof draft) =>
    setDrafts((prev) => {
      const updated = { ...prev };
      for (const group of sections.filter((g) => g.classId === scopeClass)) {
        const original = prev[group.key];
        updated[group.key] = {
          ...original,
          columns: original.columns.map((c) => ({
            ...c,
            maximum: next.columns.find((v) => v.subjectId === c.subjectId)?.maximum ?? c.maximum,
          })),
          rows: original.rows.map((r) => {
            const row = next.rows.find((v) => v.enrollmentId === r.enrollmentId);
            return !row
              ? r
              : {
                  ...r,
                  cells: original.columns.map(
                    (c) =>
                      row.cells[next.columns.findIndex((v) => v.subjectId === c.subjectId)] ?? '',
                  ),
                };
          }),
        };
      }
      return updated;
    });

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
    const grid = sheetTemplate(draft.columns, draft.students, {
        schoolId: state.school.id,
        academicYearId: state.academicYear.id,
        examId: exam.id,
        classId: scopeClass,
      }),
      filename =
        `Marks-${exam.name}-${state.classes.find((c) => c.id === scopeClass)?.name ?? ''}-${sections.find((s) => s.key === section)?.label ?? ''}`.replace(
          /[^a-zA-Z0-9-]/g,
          '-',
        );

    if (format === 'csv') downloadCsv(`${filename}.csv`, grid[0].map(String), grid.slice(1));
    else
      downloadStudentWorkbook(
        `${filename}.xlsx`,
        grid,
        [
          'Keep preset maximum marks unchanged; only fill an empty maximum. Number = marks; A = absent; blank = pending.',
          'Blank student rows in an import keep existing marks. Included subjects without marks remain pending.',
          'Keep Admission Number, Class, Section, Roll No., Student Name and Assessment Reference unchanged. Import into the same assessment and class.',
        ],
        'Marks',
      );
  };

  return (
    <Modal
      open
      wide
      onClose={() => {
        if (!saving) (guard.confirming ? guard.keepEditing : guard.requestClose)();
      }}

      title={guard.confirming ? 'Discard marks changes?' : exam.name}

      description={
        guard.confirming
          ? 'Your changes have not been saved.'
          : `${state.classes.find((c) => c.id === scopeClass)?.name ?? 'Class marks'} · ${exam.kind || 'Assessment'} · Maximum marks apply across all sections.`
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
                disabled={saving}
                onChange={(e) => {
                  if (preview || reading) {
                    setError('Apply or cancel the import preview before switching classes.');
                    return;
                  }
                  setScopeClass(e.target.value);
                  changeSection('');
                }}
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
                disabled={saving}
                onChange={(e) => changeSection(e.target.value)}
              >
                <option value="">All sections</option>
                {sections
                  .filter((s) => s.classId === scopeClass)
                  .map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.label}
                      {JSON.stringify(drafts[s.key]) !== JSON.stringify(JSON.parse(initial)[s.key])
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
                    <div
                      className="sample-download-options"
                      role="group"
                      aria-label="Sample file formats"
                    >
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
                      disabled={reading || saving}
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
                        setPreview(null);
                        setReplaceConfirmed(false);
                        setAssessmentConfirmed(false);
                        setError('');

                        try {
                          const grid = file.name.toLowerCase().endsWith('.csv')
                            ? parseMarksCsv(await file.text())
                            : await readStudentWorkbook(file);
                          if (token === request.current) {
                            setReplaceConfirmed(false);
                            setAssessmentConfirmed(false);
                            setPreview(
                              previewSheetImport(draft.columns, draft.rows, draft.students, grid, {
                                schoolId: state.school.id,
                                academicYearId: state.academicYear.id,
                                examId: exam.id,
                                classId: scopeClass,
                              }),
                            );
                          }
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
                <strong>Blank</strong> = pending. Choose included subjects in Edit Test. Configured
                subjects remain pending until marks are entered.
              </p>

              {preview && (
                <section className="sheet-import-preview" aria-label="Import preview">
                  <h3>Review {preview.changes.length} student rows</h3>
                  <p>
                    Populated rows replace their subject marks. Blank rows keep existing marks.
                    Changes are saved only with Save Marks. {preview.changes.length} prepared ·{' '}
                    {preview.overwritten} replacing saved rows · {preview.skipped} blank rows
                    skipped · {preview.issues.length} rejected. Any rejected row blocks the import.
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
                          <tr key={r.enrollmentId}>
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
                  {preview.issues.length > 0 && (
                    <ul className="form-error" role="alert">
                      {preview.issues.map((v) => (
                        <li key={v.row}>
                          Row {v.row}: {v.message}
                        </li>
                      ))}
                    </ul>
                  )}
                  {!preview.assessmentVerified && (
                    <label className="live-check">
                      <input
                        type="checkbox"
                        checked={assessmentConfirmed}
                        onChange={(e) => setAssessmentConfirmed(e.target.checked)}
                      />
                      This older file has no assessment reference. I confirm these marks belong to{' '}
                      {exam.name}, {state.classes.find((c) => c.id === scopeClass)?.name},{' '}
                      {state.academicYear.name}.
                    </label>
                  )}
                  {preview.overwritten > 0 && (
                    <label className="live-check">
                      <input
                        type="checkbox"
                        checked={replaceConfirmed}
                        onChange={(e) => setReplaceConfirmed(e.target.checked)}
                      />
                      Replace saved marks in {preview.overwritten} existing student rows. Review the
                      changes before applying.
                    </label>
                  )}
                  <div className="inline-actions">
                    <Button variant="secondary" onClick={() => setPreview(null)}>
                      Cancel import
                    </Button>
                    <Button
                      disabled={
                        preview.issues.length > 0 ||
                        (!preview.assessmentVerified && !assessmentConfirmed) ||
                        (preview.overwritten > 0 && !replaceConfirmed)
                      }
                      onClick={() => {
                        if (
                          preview.rows.some((r) => {
                            const student = draft.students.find(
                              (s) => s.enrollment.id === r.enrollmentId,
                            )!;
                            return r.cells.some(
                              (v, i) => v && !canEditCell(student, draft.columns[i].subjectId),
                            );
                          })
                        ) {
                          setError(
                            'This file includes marks outside your current subject assignments.',
                          );
                          return;
                        }
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
                      <th>Section</th>
                      {draft.columns.map((c, i) => (
                        <th key={c.subjectId}>
                          <span>{c.name}</span>
                          <label>
                            Max marks
                            <input
                              aria-label={`${c.name} maximum marks`}
                              inputMode="decimal"
                              value={c.maximum}
                              disabled={
                                saving ||
                                Boolean(preview) ||
                                assessmentMaximum(state, exam, scopeClass, c) !== undefined
                              }
                              title="Use Edit Test to change a saved maximum across every section."
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
                            <td>{student.sectionName || 'Without section'}</td>
                            {draft.columns.map((c, i) => (
                              <td key={c.subjectId}>
                                <input
                                  aria-label={`${student.student.name} ${c.name} marks`}
                                  value={row.cells[i]}
                                  disabled={
                                    saving || Boolean(preview) || !canEditCell(student, c.subjectId)
                                  }
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

                                    if (
                                      pasted.some((line, rowIndex) =>
                                        line.some(
                                          (_, colIndex) =>
                                            !canEditCell(
                                              draft.students[start + rowIndex],
                                              draft.columns[i + colIndex].subjectId,
                                            ),
                                        ),
                                      )
                                    ) {
                                      setError(
                                        'The pasted cells include subjects outside your current assignments.',
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
                                    if (
                                      event.nativeEvent.isComposing ||
                                      event.altKey ||
                                      event.ctrlKey ||
                                      event.metaKey ||
                                      (event.shiftKey && event.key !== 'Enter')
                                    )
                                      return;
                                    const directions: Record<string, [number, number] | undefined> =
                                      {
                                        ArrowUp: [-1, 0],
                                        ArrowDown: [1, 0],
                                        ArrowLeft: [0, -1],
                                        ArrowRight: [0, 1],
                                        Enter: [event.shiftKey ? -1 : 1, 0],
                                      };
                                    const direction = directions[event.key];
                                    if (!direction) return;
                                    event.preventDefault();
                                    const body = event.currentTarget.closest('tbody');
                                    if (!body) return;
                                    const visibleRows = Array.from(body.rows);
                                    const index = visibleRows.findIndex((tr) =>
                                      tr.contains(event.currentTarget),
                                    );
                                    const next =
                                      visibleRows[
                                        index + direction[0]
                                      ]?.querySelectorAll<HTMLInputElement>('input')[
                                        i + direction[1]
                                      ];
                                    if (!next || next.disabled) return;
                                    const table = body.closest('table');
                                    const studentCell = visibleRows[index].cells[1];
                                    // Keep the focused marks clear of the sticky headings and student columns.
                                    next.style.scrollMarginTop = `${table?.tHead?.offsetHeight ?? 0}px`;
                                    next.style.scrollMarginLeft =
                                      getComputedStyle(studentCell).position === 'sticky'
                                        ? `${visibleRows[index].cells[0].offsetWidth + studentCell.offsetWidth}px`
                                        : '0px';
                                    next.focus({ preventScroll: true });
                                    next.select();
                                    next.scrollIntoView({ block: 'nearest', inline: 'nearest' });
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
                <p className="panel-note">No active students in this group.</p>
              )}
            </>
          )}

          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}

          <div className="modal-actions sheet-save">
            <span>Save Marks saves all changed class and section sheets together.</span>
            <Button variant="secondary" disabled={saving} onClick={guard.requestClose}>
              Cancel
            </Button>
            <Button
              disabled={saving || Boolean(preview) || reading || JSON.stringify(drafts) === initial}
              onClick={async () => {
                if (saving) return;
                setSaving(true);
                try {
                  const original: typeof drafts = JSON.parse(initial);

                  await data.saveMarksSheets(
                    exam.id,
                    Object.entries(drafts)
                      .filter(([id, d]) => JSON.stringify(d) !== JSON.stringify(original[id]))
                      .map(([key, d]) => {
                        const group = sections.find((s) => s.key === key)!;
                        return {
                          classId: group.classId,
                          sectionId: group.sectionId,
                          columns: d.columns,
                          rows: d.rows,
                        };
                      }),
                  );

                  notify('Marks saved. Results and student histories updated.');
                  guard.complete();
                } catch (cause) {
                  setError(cause instanceof Error ? cause.message : 'Unable to save marks.');
                } finally {
                  setSaving(false);
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
