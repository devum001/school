import { useState } from 'react';
import { Button, LoadingOverlay, Panel } from '../../../components/ui/Primitives';
import { feeOnboardingApi, type FeeDraftFilters } from '../../../services/feeOnboardingService';
import type { FeeContext } from '../../../services/feeService';
import { FEE_SHEET_HEADERS, parseFeeSheet, pastedFeeSheet } from '../../../lib/feeOnboardingSheet';
import { readStudentWorkbook, studentWorkbook } from '../../../lib/xlsx';
import { formatCalendarDate, titleCase } from '../../../lib/displayFormat';
import { downloadCsv } from '../../../lib/download';
export default function FeeDraftTransfer({
  schoolId,
  draft,
  context,
  filters,
  disabled,
  change,
  refreshed,
}: {
  schoolId: string;
  draft: string;
  context: FeeContext;
  filters: FeeDraftFilters;
  disabled: boolean;
  change: (
    action: string,
    body: object,
    refresh?: boolean,
  ) => Promise<{ errors?: string[]; applied?: number } | null>;
  refreshed: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [progress, setProgress] = useState(''),
    [paste, setPaste] = useState('');
  const transfer = async (rows: ReturnType<typeof parseFeeSheet>) => {
    for (let index = 0; index < rows.length; index += 500) {
      setProgress(
        `Saving draft rows ${index + 1}–${Math.min(index + 500, rows.length)} of ${rows.length}`,
      );
      const result = await change('sheet', { rows: rows.slice(index, index + 500) }, false);
      if (!result)
        throw new Error(
          'Upload stopped. Earlier batches remain in the draft. Review the error below and retry the same corrected file.',
        );
      if (result.errors?.length) {
        downloadCsv(
          'fee-upload-errors.csv',
          ['Issue'],
          result.errors.map((e) => [e]),
        );
        throw new Error(
          'Some admission numbers could not be matched. No rows from that batch were applied. Review the saved upload issues below.',
        );
      }
    }
    setProgress(`${rows.length} rows saved to draft. Review and validate before activating fees.`);
    setPaste('');
  };
  const task = async (work: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await work();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to finish the transfer.');
    } finally {
      setBusy(false);
      await refreshed();
    }
  };
  return (
    <Panel
      title="Bring existing records (optional)"
      subtitle="Use one worksheet or paste spreadsheet rows. No spreadsheet is needed if the class defaults cover your students."
    >
      <div className="fee-draft-form">
        <LoadingOverlay loading={busy} label={progress || 'Preparing fee records…'}>
          <div />
        </LoadingOverlay>
        <div className="fee-inline">
          <Button
            variant="secondary"
            disabled={disabled || busy}
            onClick={() =>
              void task(async () => {
                const records: (string | number)[][] = [FEE_SHEET_HEADERS];
                let revision: number | undefined;
                for (let page = 1; ; page++) {
                  setProgress(`Preparing worksheet · page ${page}`);
                  const result = await feeOnboardingApi.rows(schoolId, draft, {
                    ...filters,
                    page,
                    export: true,
                  });
                  if (revision !== undefined && revision !== result.revision)
                    throw new Error(
                      'The draft changed during export. Download it again for a consistent worksheet.',
                    );
                  revision = result.revision;
                  result.items
                    .filter((r) => !r.configured && r.outcome !== 'saved')
                    .forEach((r) =>
                      records.push([
                        r.code,
                        titleCase(r.name),
                        context.classes.find((c) => c.id === r.classId)?.name ?? '',
                        context.sections.find((s) => s.id === r.sectionId)?.name ?? '',
                        r.baseFee < 0 ? '' : r.baseFee / 100,
                        r.concession / 100,
                        r.scholarship / 100,
                        r.openingPaid / 100,
                        r.oldDues / 100,
                        r.count,
                        r.interval,
                        formatCalendarDate(r.dueDate),
                        r.reason,
                      ]),
                    );
                  if (page * result.pageSize >= result.total) break;
                }
                if (records.length === 1)
                  throw new Error('No editable students match these filters.');
                const blob = studentWorkbook(
                  records,
                  [
                    'Admission Number identifies the student. Names and class labels are reference only.',
                    'Amounts are rupees. Blank keeps the draft value; 0 explicitly clears an amount.',
                    'Already Paid means current-year money collected before this app. Old Dues means additional unpaid debt for the old period configured in this draft.',
                    'Use DD-MM-YYYY for dates. One row per admission number. Up to 10,000 students.',
                    'Installments: 1 for a single balance, otherwise 2–60. Interval Months: 1, 3, 6 or 12.',
                  ],
                  'Fees',
                );
                const url = URL.createObjectURL(blob),
                  a = document.createElement('a');
                a.href = url;
                a.download = 'student-fee-setup.xlsx';
                a.click();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
                setProgress(`${records.length - 1} students exported.`);
              })
            }
          >
            Download current student worksheet
          </Button>
          <label className="button secondary document-upload-control">
            Upload completed worksheet
            <input
              type="file"
              aria-label="Upload fee worksheet"
              accept=".xlsx"
              disabled={disabled || busy}
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (!file) return;
                void task(async () => {
                  if (file.size > 8 * 1024 * 1024) throw new Error('Use a worksheet up to 8 MiB.');
                  setProgress('Checking worksheet…');
                  await transfer(
                    parseFeeSheet(
                      await readStudentWorkbook(file, { maxRows: 10000, sheetName: 'Fees' }),
                    ),
                  );
                });
              }}
            />
          </label>
        </div>
        <details>
          <summary>Paste rows from Excel instead</summary>
          <p>Copy the header and rows from the fee worksheet. Columns must be separated by tabs.</p>
          <textarea
            aria-label="Paste fee spreadsheet rows"
            rows={5}
            value={paste}
            disabled={disabled || busy}
            onChange={(e) => setPaste(e.target.value)}
          />
          <Button
            variant="secondary"
            disabled={disabled || busy || !paste.trim()}
            onClick={() => void task(async () => transfer(parseFeeSheet(pastedFeeSheet(paste))))}
          >
            Save pasted rows to draft
          </Button>
        </details>
        {progress && <p role="status">{progress}</p>}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
      </div>
    </Panel>
  );
}
