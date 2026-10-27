import ImportSteps from './ImportSteps';
import { autoCapitalizeName, formatRosterCell, formatCalendarDate, formatBirthDateInput } from '../../lib/displayFormat';
import { productApi } from '../../services/productService';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  FileSpreadsheet,
  RefreshCw,
  Search,
  XCircle,
} from 'lucide-react';
import { Button, LoadingOverlay, Modal, Panel } from '../../components/ui/Primitives';
import { onboardingApi, type ImportDetail } from '../../services/onboardingService';
import { accessError } from '../../services/schoolAccessService';
import { ApiError, apiService, isCancelled } from '../../services/apiService';
import { downloadText } from '../../lib/liveRosterImport';
import { useDraftGuard } from '../academics/useDraftGuard';
import './import.css';


const RELATIONSHIP_OPTIONS = [
  'Father',
  'Mother',
  'Guardian',
  'Uncle',
  'Aunt',
  'Brother',
  'Sister',
  'Grandfather',
  'Grandmother',
  'Self',
  'Parent',
  'Other',
];

export default function ImportJob({
  schoolId,
  jobId,
  fileName,
  close,
  onDone,
  backLabel = 'Back to directory',
  wizard = false,
}: {
  schoolId: string;
  jobId: string;
  fileName?: string;
  close: () => void;
  onDone?: () => void;
  backLabel?: string;
  wizard?: boolean;
}) {
  const [reviewed, setReviewed] = useState(false);
  const [onlyErrors, setOnlyErrors] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [job, setJob] = useState<ImportDetail>(),
    [activeCell, setActiveCell] = useState<{ rowNum: number; colIdx: number } | null>(null),
    [cellDraft, setCellDraft] = useState(''),
    [savingCell, setSavingCell] = useState(false),
    [offset, setOffset] = useState(0),
    [attempt, setAttempt] = useState(0),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [editing, setEditing] = useState<ImportDetail['rows'][number] | null>(null),
    [confirm, setConfirm] = useState<'confirm' | 'cancel' | 'retry' | null>(null);
  const reload = useCallback(() => setAttempt((value) => value + 1), []);
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [suggestionIdx, setSuggestionIdx] = useState(0);
  const [schoolClasses, setSchoolClasses] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    if (!schoolId || !job?.academicYearId) return;
    const controller = new AbortController();
    productApi
      .studentContext(schoolId, job.academicYearId, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted && data.classes) {
          setSchoolClasses(data.classes.map((c) => ({ id: c.id, name: c.name })));
        }
      })
      .catch(() => {});
    return () => controller.abort();
  }, [schoolId, job?.academicYearId]);


  const commitCellEdit = useCallback(
    async (rowNum: number, colIdx: number, nextValue: string) => {
      if (!job) return;
      const row = job.rows.find((r) => r.number === rowNum);
      if (!row) return;

      const colName = job.columns[colIdx]?.trim().toLowerCase() ?? '';
      let cleanVal = nextValue.trim();

      // Normalize date if date column
      if (['birth date', 'dob', 'date of birth', 'joined on', 'date of joining'].includes(colName)) {
        cleanVal = formatCalendarDate(cleanVal) || cleanVal;
      }

      const currentVal = row.cells[colIdx] ?? '';
      if (currentVal.trim() === cleanVal) return;

      const updatedCells = [...row.cells];
      updatedCells[colIdx] = cleanVal;
      row.cells = updatedCells;
      setJob({ ...job });

      try {
        setSavingCell(true);
        await onboardingApi.correct(schoolId, job, row.number, updatedCells);
        reload();
      } catch (err) {
        console.error('Cell auto-save failed:', err);
      } finally {
        setSavingCell(false);
      }
    },
    [job, schoolId, reload],
  );

  
  const classColIndex = useMemo(
    () => job?.columns.findIndex((c) => c.trim().toLowerCase() === 'class') ?? -1,
    [job?.columns],
  );

  const availableClasses = useMemo(() => {
    if (!job || classColIndex < 0) return [];
    return [
      ...new Set(
        job.rows
          .map((r) => formatRosterCell('Class', r.cells[classColIndex] ?? '').trim())
          .filter(Boolean),
      ),
    ];
  }, [job, classColIndex]);

  const activeColName =
    activeCell && job ? job.columns[activeCell.colIdx]?.trim().toLowerCase() ?? '' : '';
  const isRelCol =
    [
      'relationship',
      'guardian relation',
      'guardian relationship',
      'relation',
    ].includes(activeColName) || activeColName.includes('relation');
  const isClassCol =
    ['class', 'grade', 'standard'].includes(activeColName) ||
    activeColName.startsWith('class') ||
    activeColName.startsWith('grade') ||
    activeColName.includes('class');
  const isDateCol =
    [
      'birth date',
      'dob',
      'date of birth',
      'joined on',
      'date of joining',
    ].includes(activeColName) ||
    activeColName.includes('birth') ||
    activeColName.includes('dob');

  const activeSuggestions = useMemo(() => {
    if (!activeCell || !job) return [];
    const q = cellDraft.trim().toLowerCase();
    if (isRelCol) {
      if (!q) return RELATIONSHIP_OPTIONS;
      return RELATIONSHIP_OPTIONS.filter((opt) => opt.toLowerCase().includes(q)).sort((a, b) => {
        const aStarts = a.toLowerCase().startsWith(q);
        const bStarts = b.toLowerCase().startsWith(q);
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
        return a.localeCompare(b);
      });
    }
    if (isClassCol) {
      const listSet = new Set<string>();
      listSet.add('Nursery');
      listSet.add('LKG');
      listSet.add('UKG');
      for (let i = 1; i <= 12; i++) {
        listSet.add(`Class ${i}`);
      }
      schoolClasses.forEach((c) => {
        if (c.name) listSet.add(c.name);
      });
      availableClasses.forEach((c) => {
        if (c) listSet.add(c);
      });
      const all = Array.from(listSet);
      if (!q) return all;
      const num = q.match(/\d+/)?.[0];
      return all
        .filter((c) => {
          const cLower = c.toLowerCase();
          if (cLower.includes(q)) return true;
          if (num && cLower.includes(num)) return true;
          return false;
        })
        .sort((a, b) => {
          const aLower = a.toLowerCase();
          const bLower = b.toLowerCase();
          if (num) {
            const aNum = aLower.match(/\d+/)?.[0];
            const bNum = bLower.match(/\d+/)?.[0];
            if (aNum === num && bNum !== num) return -1;
            if (bNum === num && aNum !== num) return 1;
          }
          if (aLower.startsWith(q) && !bLower.startsWith(q)) return -1;
          if (bLower.startsWith(q) && !aLower.startsWith(q)) return 1;
          return a.localeCompare(b, undefined, { numeric: true });
        });
    }
    return [];
  }, [activeCell, job, cellDraft, isRelCol, isClassCol, schoolClasses, availableClasses]);

  useEffect(() => {
    setSuggestionIdx(0);
  }, [activeCell?.rowNum, activeCell?.colIdx, cellDraft]);

  const handleCellKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    rowNum: number,
    colIdx: number,
    filteredRowsList: ImportDetail['rows'],
  ) => {
    if (!job) return;
    const input = e.currentTarget;
    const currentFilteredIdx = filteredRowsList.findIndex((r) => r.number === rowNum);
    const numCols = job.columns.length;

    // Arrow keys for suggestions dropdown
    if (activeSuggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSuggestionIdx((i) => (i + 1) % activeSuggestions.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSuggestionIdx((i) => (i - 1 + activeSuggestions.length) % activeSuggestions.length);
        return;
      }
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      let finalVal = cellDraft;
      if (activeSuggestions.length > 0) {
        finalVal = activeSuggestions[suggestionIdx] ?? activeSuggestions[0] ?? cellDraft;
      } else if (isDateCol) {
        finalVal = formatCalendarDate(cellDraft) || cellDraft;
      }
      void commitCellEdit(rowNum, colIdx, finalVal);
      if (currentFilteredIdx < filteredRowsList.length - 1) {
        const nextRow = filteredRowsList[currentFilteredIdx + 1];
        setActiveCell({ rowNum: nextRow.number, colIdx });
        setCellDraft(nextRow.cells[colIdx] ?? '');
      } else {
        setActiveCell(null);
      }
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      setActiveCell(null);
      return;
    }

    if (e.key === 'Tab') {
      e.preventDefault();
      let finalVal = cellDraft;
      if (activeSuggestions.length > 0) {
        finalVal = activeSuggestions[suggestionIdx] ?? activeSuggestions[0] ?? cellDraft;
      } else if (isDateCol) {
        finalVal = formatCalendarDate(cellDraft) || cellDraft;
      }
      void commitCellEdit(rowNum, colIdx, finalVal);
      if (!e.shiftKey) {
        if (colIdx < numCols - 1) {
          setActiveCell({ rowNum, colIdx: colIdx + 1 });
          const curRow = filteredRowsList[currentFilteredIdx];
          setCellDraft(curRow.cells[colIdx + 1] ?? '');
        } else if (currentFilteredIdx < filteredRowsList.length - 1) {
          const nextRow = filteredRowsList[currentFilteredIdx + 1];
          setActiveCell({ rowNum: nextRow.number, colIdx: 0 });
          setCellDraft(nextRow.cells[0] ?? '');
        }
      } else {
        if (colIdx > 0) {
          setActiveCell({ rowNum, colIdx: colIdx - 1 });
          const curRow = filteredRowsList[currentFilteredIdx];
          setCellDraft(curRow.cells[colIdx - 1] ?? '');
        } else if (currentFilteredIdx > 0) {
          const prevRow = filteredRowsList[currentFilteredIdx - 1];
          setActiveCell({ rowNum: prevRow.number, colIdx: numCols - 1 });
          setCellDraft(prevRow.cells[numCols - 1] ?? '');
        }
      }
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      void commitCellEdit(rowNum, colIdx, cellDraft);
      if (currentFilteredIdx > 0) {
        const prevRow = filteredRowsList[currentFilteredIdx - 1];
        setActiveCell({ rowNum: prevRow.number, colIdx });
        setCellDraft(prevRow.cells[colIdx] ?? '');
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      void commitCellEdit(rowNum, colIdx, cellDraft);
      if (currentFilteredIdx < filteredRowsList.length - 1) {
        const nextRow = filteredRowsList[currentFilteredIdx + 1];
        setActiveCell({ rowNum: nextRow.number, colIdx });
        setCellDraft(nextRow.cells[colIdx] ?? '');
      }
      return;
    }

    if (e.key === 'ArrowLeft') {
      const isAtStart = input.selectionStart === 0 && input.selectionEnd === 0;
      const isAllSelected =
        input.selectionStart === 0 && input.selectionEnd === input.value.length;
      if (isAtStart || isAllSelected) {
        e.preventDefault();
        void commitCellEdit(rowNum, colIdx, cellDraft);
        if (colIdx > 0) {
          setActiveCell({ rowNum, colIdx: colIdx - 1 });
          const curRow = filteredRowsList[currentFilteredIdx];
          setCellDraft(curRow.cells[colIdx - 1] ?? '');
        }
      }
      return;
    }

    if (e.key === 'ArrowRight') {
      const isAtEnd =
        input.selectionStart === input.value.length &&
        input.selectionEnd === input.value.length;
      const isAllSelected =
        input.selectionStart === 0 && input.selectionEnd === input.value.length;
      if (isAtEnd || isAllSelected) {
        e.preventDefault();
        void commitCellEdit(rowNum, colIdx, cellDraft);
        if (colIdx < numCols - 1) {
          setActiveCell({ rowNum, colIdx: colIdx + 1 });
          const curRow = filteredRowsList[currentFilteredIdx];
          setCellDraft(curRow.cells[colIdx + 1] ?? '');
        }
      }
      return;
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function poll() {
      try {
        const data = await onboardingApi.job(schoolId, jobId, offset, controller.signal);
        if (controller.signal.aborted) return;
        setJob(data);
        if (data.status === 'completed') apiService.invalidateReads();
        setError('');
        if (['validating', 'queued', 'processing'].includes(data.status))
          timer = setTimeout(() => {
            void poll();
          }, 1500);
      } catch (cause) {
        if (!isCancelled(cause) && !controller.signal.aborted) {
          setError(
            'Import status could not be loaded. Saved rows are safe; checking again automatically.',
          );
          timer = setTimeout(() => {
            void poll();
          }, 5000);
        }
      }
    }
    void poll();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [schoolId, jobId, offset, attempt]);

  async function action(command = confirm) {
    if (!job || !command) return;
    setBusy(true);
    setError('');
    try {
      await onboardingApi.action(schoolId, job, command);
      setConfirm(null);
      reload();
    } catch (cause) {
      if (cause instanceof ApiError && (cause.status === 0 || cause.status >= 500)) {
        setConfirm(null);
        setError(
          'The response was interrupted. Checking the saved import before offering another action.',
        );
        reload();
      } else setError(accessError(cause));
    } finally {
      setBusy(false);
    }
  }


  const filteredRows = useMemo(() => {
    if (!job) return [];
    return job.rows.filter((row) => {
      if (onlyErrors && !row.errors.length) return false;
      if (
        classFilter &&
        classColIndex >= 0 &&
        formatRosterCell('Class', row.cells[classColIndex] ?? '').trim() !== classFilter
      )
        return false;
      if (searchQuery.trim()) {
        const needle = searchQuery.trim().toLowerCase();
        const hay = row.cells.join(' ').toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [job, onlyErrors, classFilter, classColIndex, searchQuery]);

  const isStep3 = Boolean(job && (reviewed || !['validating', 'draft'].includes(job.status)));
  const progressValue = job
    ? job.status === 'validating'
      ? job.checked
      : job.status === 'draft'
        ? job.total - job.invalid
        : job.processed
    : 0;
  const progressPct = job && job.total > 0 ? Math.round((progressValue / job.total) * 100) : 100;
  const statusLabel = job
    ? job.status === 'draft'
      ? 'Ready'
      : job.status.charAt(0).toUpperCase() + job.status.slice(1)
    : '';

  return (
    <LoadingOverlay
      loading={!job && !error}
      size="xl"
      label="Loading import…"
      message="Loading import…"
    >
      <Panel
        className="import-job"
        title={wizard ? 'Student import' : 'Saved import'}
        subtitle="You can leave this page and return through Import history. Processing continues in the background."
      >
        <div className="live-content">
          {!wizard && (
            <Button variant="secondary" onClick={close}>
              {backLabel}
            </Button>
          )}
          {error && (
            <div style={{ padding: '12px 24px 0' }}>
              <p role="alert" className="form-error">
                {error}
              </p>
              <Button variant="secondary" onClick={reload}>
                Retry loading import
              </Button>
            </div>
          )}
          {!job && !error && <div style={{ minHeight: 180 }} />}
          {job && (
            <>
              <div className="import-step2-body">
                {wizard && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: 10,
                    }}
                  >
                    <span className="import-file-chip" data-pill={isStep3 ? 'round' : undefined}>
                      <FileSpreadsheet size={13} aria-hidden="true" />
                      <span>
                        {fileName || `${job.kind}-import.xlsx`}
                        {isStep3 ? ` • ${job.total} rows` : ''}
                      </span>
                    </span>
                    <p role="status" className="sr-only">
                      {job.status === 'validating'
                        ? `${job.checked} of ${job.total} rows validated`
                        : job.status === 'draft'
                          ? `${job.total} rows previewed`
                          : `${job.processed} of ${job.total} rows processed`}{' '}
                      · {job.invalid} rows need attention
                    </p>
                  </div>
                )}

                {wizard && <ImportSteps step={isStep3 ? 3 : 2} validated />}

                {!isStep3 ? (
                  <>
                    <div className="import-review-toolbar">
                      <div className="import-summary-pills">
                        <div className="import-pill-badge">
                          <strong>{job.total}</strong> Total Rows
                        </div>
                        <div className="import-pill-badge" data-tone="valid">
                          <CheckCircle2 size={13} aria-hidden="true" />
                          <span>{Math.max(0, job.total - job.invalid)} Valid</span>
                        </div>
                        <label
                          className="import-pill-badge"
                          data-tone="attention"
                          title="Filter rows needing attention"
                        >
                          <input
                            type="checkbox"
                            checked={onlyErrors}
                            onChange={(e) => setOnlyErrors(e.target.checked)}
                          />
                          <span>{job.invalid} Attention Needed</span>
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
                            onChange={(e) => setSearchQuery(e.target.value)}
                          />
                        </div>
                        <select
                          className="import-review-class-select"
                          aria-label="Filter preview by class"
                          value={classFilter}
                          onChange={(e) => setClassFilter(e.target.value)}
                        >
                          <option value="">All Classes</option>
                          {availableClasses.map((cls) => (
                            <option key={cls} value={cls}>
                              {cls}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="import-table-card">
                      <div
                        className="onboarding-table import-preview"
                        role="region"
                        aria-label="Import preview and validation"
                        tabIndex={0}
                      >
                        <table>
                          <caption>Import preview and validation</caption>
                          <thead>
                            <tr>
                              <th className="import-row-num-cell">#</th>
                              {job.columns.map((column) => (
                                <th key={column}>{column}</th>
                              ))}
                              <th>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredRows.map((row) => (
                              <tr
                                key={row.number}
                                data-row-error={row.errors.length > 0 ? 'true' : undefined}
                              >
                                <th scope="row" className="import-row-num-cell">
                                  {row.number}
                                  {row.outcome !== 'pending' && <small>{row.outcome}</small>}
                                </th>
                                {row.cells.map((cell, index) => {
                                  const isCellActive =
                                    activeCell?.rowNum === row.number &&
                                    activeCell?.colIdx === index;
                                  const colName = job.columns[index]?.trim().toLowerCase() ?? '';
                                  const isDate = ['birth date', 'dob', 'date of birth', 'joined on', 'date of joining'].includes(colName);
                                  const showSuggestions = isCellActive && activeSuggestions.length > 0;

                                  return isCellActive ? (
                                    <td
                                      key={index}
                                      className="import-cell-active"
                                      style={
                                        index === 0
                                          ? { fontWeight: 600 }
                                          : undefined
                                      }
                                    >
                                      <input
                                        ref={(el) => {
                                          if (el && document.activeElement !== el) {
                                            el.focus();
                                            el.select();
                                          }
                                        }}
                                        className="import-cell-inline-input"
                                        value={cellDraft}
                                        placeholder={isDate ? 'DD-MM-YYYY' : undefined}
                                        onChange={(e) => {
                                          const isNameCol = ['student name', 'name', 'guardian name', 'first name', 'last name'].includes(colName);
                                          let val = e.target.value;
                                          if (isDate) val = formatBirthDateInput(val, cellDraft);
                                          else if (isNameCol) val = autoCapitalizeName(val);
                                          setCellDraft(val);
                                        }}
                                        onBlur={() => {
                                          blurTimerRef.current = setTimeout(() => {
                                            let finalVal = cellDraft;
                                            if (isDate) {
                                              finalVal = formatCalendarDate(cellDraft) || cellDraft;
                                            }
                                            void commitCellEdit(row.number, index, finalVal);
                                            setActiveCell(null);
                                          }, 150);
                                        }}
                                        onKeyDown={(e) =>
                                          handleCellKeyDown(e, row.number, index, filteredRows)
                                        }
                                      />
                                      {showSuggestions && (
                                        <div
                                          className="import-cell-suggestions"
                                          role="listbox"
                                          onMouseDown={(e) => e.preventDefault()}
                                        >
                                          {activeSuggestions.map((suggestion, sIdx) => {
                                            const isSelected = sIdx === suggestionIdx;
                                            return (
                                              <button
                                                key={suggestion}
                                                type="button"
                                                className={`import-cell-suggestion-item ${isSelected ? 'is-selected' : ''}`}
                                                onClick={() => {
                                                  if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
                                                  setCellDraft(suggestion);
                                                  void commitCellEdit(row.number, index, suggestion);
                                                  setActiveCell(null);
                                                }}
                                              >
                                                <span>{suggestion}</span>
                                                {isSelected && <kbd>Enter ↵</kbd>}
                                              </button>
                                            );
                                          })}
                                        </div>
                                      )}
                                    </td>
                                  ) : (
                                    <td
                                      key={index}
                                      className="import-cell-editable"
                                      title="Click to edit (navigate with ↑ ↓ ← → or Tab / Enter)"
                                      onClick={() => {
                                        if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
                                        if (job.status === 'draft') {
                                          if (
                                            activeCell &&
                                            (activeCell.rowNum !== row.number ||
                                              activeCell.colIdx !== index)
                                          ) {
                                            void commitCellEdit(
                                              activeCell.rowNum,
                                              activeCell.colIdx,
                                              cellDraft,
                                            );
                                          }
                                          setActiveCell({ rowNum: row.number, colIdx: index });
                                          setCellDraft(cell ?? '');
                                        }
                                      }}
                                      style={
                                        index === 0
                                          ? { fontWeight: 600, color: '#0f172a' }
                                          : undefined
                                      }
                                    >
                                      {formatRosterCell(job.columns[index], cell) || '—'}
                                      {index === 0 &&
                                        row.errors.map((message) => (
                                          <p className="sr-only" key={message}>
                                            {message}
                                          </p>
                                        ))}
                                    </td>
                                  );
                                })}
                                <td>
                                  {row.errors.length === 0 ? (
                                    <span className="import-status-badge" data-valid="true">
                                      <Check size={10} strokeWidth={3} aria-hidden="true" />
                                      Valid
                                    </span>
                                  ) : (
                                    <span
                                      className="import-status-badge"
                                      data-valid="false"
                                      title={row.errors.join(' · ')}
                                    >
                                      <AlertCircle size={11} aria-hidden="true" />
                                      {row.errors[0]}
                                    </span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <div className="import-table-footer">
                        <span>
                          Showing {filteredRows.length} of {job.total} rows
                          {job.total > 50
                            ? ` (Rows ${job.total ? offset + 1 : 0}–${offset + job.rows.length})`
                            : ''}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          {savingCell && <span style={{ color: 'var(--green-hover)', fontSize: 11, fontWeight: 600 }}>Saving edit…</span>}
                          {(onlyErrors || searchQuery || classFilter) && (
                            <button
                              type="button"
                              className="import-view-all-link"
                              onClick={() => {
                                setOnlyErrors(false);
                                setSearchQuery('');
                                setClassFilter('');
                              }}
                            >
                              View all {job.total} rows
                            </button>
                          )}
                          {job.total > 50 && (
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
                                disabled={job.nextOffset === null}
                                onClick={() => setOffset(job.nextOffset!)}
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
                        {job.total} Total Rows
                      </div>
                      <div className="import-step3-pill" data-tone="valid">
                        <Check size={11} strokeWidth={3} aria-hidden="true" />
                        {Math.max(0, job.total - job.invalid)} Valid
                      </div>
                      <div className="import-step3-pill">
                        <Check
                          size={11}
                          strokeWidth={3}
                          style={{ color: '#059669' }}
                          aria-hidden="true"
                        />
                        {job.invalid} Attention Needed
                      </div>
                    </div>

                    <div className="import-submit-hero">
                      <div>
                        <div className="import-submit-headline">
                          <span className="import-pulse-dot" aria-hidden="true" />
                          <span>
                            {job.kind === 'staff' ? 'Staff' : 'Student'} import • {statusLabel}
                          </span>
                        </div>
                        <div className="import-submit-sub">
                          {job.mode === 'create'
                            ? 'Create new records; identical records are skipped.'
                            : 'Update matching profiles; blank optional cells clear existing values.'}
                        </div>
                      </div>

                      <div className="import-bar-track" aria-label="Import progress">
                        <div
                          className="import-bar-fill"
                          style={{ width: `${Math.max(8, progressPct)}%` }}
                        />
                      </div>

                      <div className="import-breakdown-grid roster-totals">
                        {(['created', 'updated', 'skipped', 'failed', 'pending'] as const).map(
                          (key) => (
                            <div key={key} className="import-breakdown-card" data-metric={key}>
                              <strong>{job.counts[key]}</strong>
                              <span>{key.charAt(0).toUpperCase() + key.slice(1)}</span>
                            </div>
                          ),
                        )}
                      </div>

                      {job.message && <p role="alert">{job.message}</p>}
                    </div>
                  </>
                )}
              </div>

              <footer className="import-modal-footer">
                <div>
                  {isStep3 && job.status === 'draft' ? (
                    <button
                      type="button"
                      className="import-white-btn"
                      disabled={busy}
                      onClick={() => setReviewed(false)}
                    >
                      <ArrowLeft size={12} aria-hidden="true" />
                      <span>Back to Review</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="import-cancel-btn"
                      disabled={busy}
                      onClick={close}
                    >
                      <ArrowLeft size={12} aria-hidden="true" />
                      <span>{backLabel}</span>
                    </button>
                  )}
                </div>

                <div className="import-footer-right">
                  {!isStep3 && (
                    <button
                      type="button"
                      className="import-white-btn"
                      disabled={busy}
                      onClick={async () => {
                        try {
                          downloadText(
                            `${job.kind}-results.csv`,
                            (await onboardingApi.results(schoolId, job.id)).csv,
                          );
                        } catch (cause) {
                          setError(accessError(cause));
                        }
                      }}
                    >
                      <FileSpreadsheet size={13} aria-hidden="true" />
                      <span>Export Error Rows (.csv)</span>
                    </button>
                  )}

                  {['paused', 'cancelled', 'completed'].includes(job.status) &&
                    (job.status === 'paused' ||
                      job.counts.failed > 0 ||
                      job.counts.pending > 0) && (
                      <button
                        type="button"
                        className="import-white-btn"
                        disabled={busy}
                        onClick={() => setConfirm('retry')}
                      >
                        <RefreshCw size={13} aria-hidden="true" />
                        <span>Revalidate remaining rows</span>
                      </button>
                    )}

                  {isStep3 && !['completed', 'cancelled', 'draft'].includes(job.status) && (
                    <button
                      type="button"
                      className="import-white-btn"
                      disabled={busy}
                      onClick={() => setConfirm('cancel')}
                    >
                      <XCircle size={13} aria-hidden="true" />
                      <span>Cancel remaining rows</span>
                    </button>
                  )}

                  {job.status === 'draft' ? (
                    <button
                      type="button"
                      className="import-primary-btn"
                      disabled={busy || job.invalid > 0 || !!error}
                      onClick={() => {
                        if (wizard) {
                          if (reviewed) void action('confirm');
                          else setReviewed(true);
                        } else setConfirm('confirm');
                      }}
                    >
                      <span>
                        {wizard
                          ? reviewed
                            ? 'Import students'
                            : 'Proceed to Submit'
                          : 'Confirm import'}
                      </span>
                      <ArrowRight size={12} aria-hidden="true" />
                    </button>
                  ) : (
                    job.status === 'completed' && (
                      <button
                        type="button"
                        className="import-primary-btn"
                        onClick={() => (onDone ? onDone() : close())}
                      >
                        <span>View Enrolled Students</span>
                        <ArrowRight size={12} aria-hidden="true" />
                      </button>
                    )
                  )}
                </div>
              </footer>

              {editing && (
                <RowEditor
                  job={job}
                  row={editing}
                  schoolId={schoolId}
                  close={() => setEditing(null)}
                  saved={reload}
                />
              )}
            </>
          )}
          {confirm && (
            <Modal
              open
              title={
                confirm === 'confirm'
                  ? 'Start this import?'
                  : confirm === 'retry'
                    ? 'Revalidate remaining rows?'
                    : 'Cancel remaining rows?'
              }
              description="Already committed records are kept. Every remaining row is checked again before it is written."
              onClose={() => {
                if (!busy) setConfirm(null);
              }}
            >
              <div className="live-content">
                <p>
                  {confirm === 'confirm'
                    ? 'Validated rows save in small batches; conflicts are isolated to individual rows. You can track successes and failures here.'
                    : confirm === 'retry'
                      ? 'Pending and failed rows return to validation. Correct any errors and confirm again.'
                      : 'This stops work that has not yet committed. It does not undo saved records.'}
                </p>
                {error && <p role="alert">{error}</p>}
                <div className="live-actions">
                  <Button disabled={busy} variant="secondary" onClick={() => setConfirm(null)}>
                    Go back
                  </Button>
                  <Button disabled={busy} onClick={() => void action()}>
                    {busy ? 'Saving…' : 'Continue'}
                  </Button>
                </div>
              </div>
            </Modal>
          )}
        </div>
      </Panel>
    </LoadingOverlay>
  );
}

function RowEditor({
  job,
  row,
  schoolId,
  close,
  saved,
}: {
  job: ImportDetail;
  row: ImportDetail['rows'][number];
  schoolId: string;
  close: () => void;
  saved: () => void;
}) {
  const [cells, setCells] = useState(
      row.cells.map((cell, index) => formatRosterCell(job.columns[index], cell)),
    ),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const dirty =
      JSON.stringify(cells) !==
      JSON.stringify(row.cells.map((cell, index) => formatRosterCell(job.columns[index], cell))),
    guard = useDraftGuard(dirty && !busy, close);
  return (
    <Modal
      open
      className="import-row-modal"
      title={guard.confirming ? 'Discard row edits?' : `Correct row ${row.number}`}
      description="Saving runs validation again. No roster records are created yet."
      onClose={() => {
        if (!busy) guard.requestClose();
      }}
    >
      {guard.confirming ? (
        <div className="live-content">
          <Button onClick={guard.keepEditing}>Keep editing</Button>
          <Button variant="danger" onClick={guard.discard}>
            Discard
          </Button>
        </div>
      ) : (
        <form
          className="live-form import-row-form"
          data-unsaved={dirty}
          onSubmit={async (event) => {
            event.preventDefault();
            setBusy(true);
            try {
              await onboardingApi.correct(schoolId, job, row.number, cells);
              guard.complete(() => {
                saved();
                close();
              });
            } catch (cause) {
              setError(accessError(cause));
            } finally {
              setBusy(false);
            }
          }}
        >
          {job.columns.map((column, index) => (
            <label key={column}>
              {column}
              <input
                maxLength={300}
                disabled={busy}
                value={cells[index] ?? ''}
                onChange={(event) =>
                  setCells((old) =>
                    old.map((value, i) => (i === index ? event.target.value : value)),
                  )
                }
              />
            </label>
          ))}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="modal-actions">
            <Button type="button" variant="secondary" disabled={busy} onClick={guard.requestClose}>
              Cancel
            </Button>
            <Button disabled={busy || !dirty}>{busy ? 'Validating…' : 'Save correction'}</Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
