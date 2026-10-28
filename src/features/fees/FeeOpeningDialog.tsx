import { useState } from 'react';
import { Button, Modal, LoadingOverlay } from '../../components/ui/Primitives';
import CalendarDateInput from '../../components/ui/CalendarDateInput';
import { feeApi, type FeeContext, type FeeStudentRow } from '../../services/feeService';
import { titleCase } from '../../lib/displayFormat';
import { money } from '../../lib/config';
import { AmountField } from './FeeSetupDialog';
export default function FeeOpeningDialog({
  schoolId,
  context,
  students,
  close,
  saved,
}: {
  schoolId: string;
  context: FeeContext;
  students: FeeStudentRow[];
  close: () => void;
  saved: () => void;
}) {
  const year = context.years.find((y) => y.id === context.yearId)!;
  const [yearName, setYearName] = useState(''),
    [start, setStart] = useState(''),
    [end, setEnd] = useState(''),
    [asOf, setAsOf] = useState(context.today),
    [amounts, setAmounts] = useState(students.map((s) => ({ studentId: s.id, amount: 0 }))),
    [common, setCommon] = useState(0),
    [review, setReview] = useState(false),
    [page, setPage] = useState(0),
    [busy, setBusy] = useState(false),
    [savedCount, setSavedCount] = useState(0),
    [error, setError] = useState('');
  const rows = amounts
    .filter((a) => a.amount > 0)
    .map((a) => ({ ...a, yearName, start, end, asOf }));
  return (
    <Modal
      open
      wide
      title="Bring forward previous-year dues"
      description="Enter only the unpaid balance. This does not record a new payment or recreate old charges."
      onClose={() => {
        if (
          !busy &&
          (!review || window.confirm('Leave opening balances? Saved batches will remain.'))
        )
          close();
      }}
    >
      <form
        className="fee-dialog"
        data-unsaved="true"
        onSubmit={async (e) => {
          e.preventDefault();
          setError('');
          if (!rows.length || start >= end || end >= year.start || asOf < end) {
            setError(
              'Choose a previous period ending before this academic year, and enter at least one outstanding balance.',
            );
            return;
          }
          if (!review) {
            setReview(true);
            return;
          }
          setBusy(true);
          try {
            for (let i = savedCount; i < rows.length; i += 25) {
              const batch = rows.slice(i, i + 25);
              await feeApi.opening(schoolId, context.yearId, batch);
              setSavedCount(i + batch.length);
            }
            saved();
            close();
          } catch (e) {
            setError(e instanceof Error ? e.message : 'Unable to confirm opening balances.');
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy && (
          <LoadingOverlay loading={busy} local label="Saving previous dues…">
            <div />
          </LoadingOverlay>
        )}{' '}
        {!review ? (
          <>
            <div className="fee-callout">
              <p>
                Use one source year at a time. Existing charges for the same period are protected
                against duplicate opening dues. Leave zero for students with no old balance.
              </p>
            </div>
            <div className="fee-form-grid">
              <label className="field">
                Previous academic year label
                <input
                  required
                  maxLength={80}
                  placeholder="2025–26"
                  value={yearName}
                  onChange={(e) => setYearName(e.target.value)}
                />
              </label>
              <label className="field">
                Period starts
                <CalendarDateInput
                  required
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                />
              </label>
              <label className="field">
                Period ends
                <CalendarDateInput
                  required
                  value={end}
                  max={year.start}
                  onChange={(e) => setEnd(e.target.value)}
                />
              </label>
              <label className="field">
                Balance as of
                <CalendarDateInput
                  required
                  value={asOf}
                  max={context.today}
                  onChange={(e) => setAsOf(e.target.value)}
                />
              </label>
            </div>
            <div className="fee-inline">
              <AmountField label="Apply common balance (₹)" value={common} onChange={setCommon} />
              <Button
                type="button"
                variant="secondary"
                onClick={() => setAmounts((old) => old.map((a) => ({ ...a, amount: common })))}
              >
                Apply to selected students
              </Button>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Admission number</th>
                    <th className="currency-cell">Previous-year outstanding (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {students.slice(page * 50, (page + 1) * 50).map((s, index) => {
                    const i = page * 50 + index;
                    return (
                      <tr key={s.id}>
                        <th>{titleCase(s.name)}</th>
                        <td>{s.code}</td>
                        <td>
                          <input
                            aria-label={`${s.code} old dues`}
                            type="number"
                            min={0}
                            max={10000000}
                            step="0.01"
                            value={amounts[i].amount / 100}
                            onChange={(e) =>
                              setAmounts((old) =>
                                old.map((a, j) =>
                                  i === j
                                    ? { ...a, amount: Math.round(Number(e.target.value) * 100) }
                                    : a,
                                ),
                              )
                            }
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {students.length > 50 && (
              <div className="fee-pagination">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={!page}
                  onClick={() => setPage(page - 1)}
                >
                  Previous students
                </Button>
                <span>
                  {page * 50 + 1}–{Math.min((page + 1) * 50, students.length)} of {students.length}
                </span>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={(page + 1) * 50 >= students.length}
                  onClick={() => setPage(page + 1)}
                >
                  Next students
                </Button>
              </div>
            )}
          </>
        ) : (
          <div className="fee-confirm">
            <h3>Confirm {yearName} opening balances</h3>
            <p>
              {rows.length} students · {money(rows.reduce((s, r) => s + r.amount, 0))} outstanding
            </p>
            <p>
              This is separate from current-year fees and will be available for payment allocation.
            </p>
            <p role="status">
              {savedCount} of {rows.length} saved
            </p>
          </div>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <footer className="modal-actions">
          {review && !savedCount && (
            <Button
              type="button"
              variant="secondary"
              disabled={busy}
              onClick={() => setReview(false)}
            >
              Back to balances
            </Button>
          )}
          <Button disabled={busy}>
            {busy ? 'Saving…' : review ? 'Confirm opening balances' : 'Review balances'}
          </Button>
        </footer>
      </form>
    </Modal>
  );
}
