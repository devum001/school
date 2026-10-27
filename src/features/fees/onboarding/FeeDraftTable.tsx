import { useState } from 'react';
import { Button, EmptyState } from '../../../components/ui/Primitives';
import CalendarDateInput from '../../../components/ui/CalendarDateInput';
import type { FeeContext } from '../../../services/feeService';
import type {
  FeeDraftPage,
  FeeDraftRow,
  FeeDraftValues,
} from '../../../services/feeOnboardingService';
import { money } from '../../../lib/config';
import { titleCase } from '../../../lib/displayFormat';
export default function FeeDraftTable({
  data,
  context,
  changes,
  selected,
  setSelected,
  edit,
  disabled,
  canApprove,
}: {
  data: FeeDraftPage;
  context: FeeContext;
  changes: Record<string, FeeDraftValues>;
  selected: string[];
  setSelected: (ids: string[]) => void;
  edit: (row: FeeDraftRow, field: keyof FeeDraftValues, value: number | string) => void;
  disabled: boolean;
  canApprove: boolean;
}) {
  const [expanded, setExpanded] = useState('');
  const editable = data.items.filter((r) => !r.configured && r.outcome !== 'saved');
  const cell = (
    row: FeeDraftRow,
    field: 'baseFee' | 'concession' | 'scholarship' | 'openingPaid' | 'oldDues',
    label: string,
  ) => {
    const value = changes[row.id]?.[field] ?? row[field];
    return row.configured || row.outcome === 'saved' ? (
      money(Math.max(0, value))
    ) : (
      <input
        aria-label={`${label} for ${row.code}`}
        aria-invalid={!!row.error}
        type="number"
        min="0"
        max="10000000"
        step="0.01"
        value={value < 0 ? '' : value / 100}
        placeholder="Not set"
        disabled={disabled || (!canApprove && ['concession', 'scholarship'].includes(field))}
        onChange={(e) => edit(row, field, Math.round(Number(e.target.value) * 100))}
      />
    );
  };
  return (
    <div
      className="table-wrap fee-onboarding-grid"
      role="region"
      aria-label="Editable fee draft"
      tabIndex={0}
    >
      <table>
        <thead>
          <tr>
            <th>
              <input
                type="checkbox"
                aria-label="Select this page"
                disabled={disabled || !editable.length}
                checked={!!editable.length && editable.every((r) => selected.includes(r.id))}
                onChange={(e) =>
                  setSelected(
                    e.target.checked
                      ? [...new Set([...selected, ...editable.map((r) => r.id)])]
                      : selected.filter((id) => !editable.some((r) => r.id === id)),
                  )
                }
              />
            </th>
            <th>Student / class</th>
            <th className="currency-cell">Base fee ₹</th>
            <th className="currency-cell">Concession ₹</th>
            <th className="currency-cell">Scholarship ₹</th>
            <th className="currency-cell">Already paid ₹</th>
            <th className="currency-cell">Old dues ₹</th>
            <th className="currency-cell">Final fee</th>
            <th className="currency-cell">Remaining</th>
            <th>Payment details</th>
          </tr>
        </thead>
        <tbody>
          {data.items.map((row) => {
            const values = { ...row, ...changes[row.id] },
              net = Math.max(0, values.baseFee - values.concession - values.scholarship);
            const readOnly = disabled || row.configured || row.outcome === 'saved';
            return (
              <DraftRow
                key={row.id}
                row={row}
                expanded={expanded === row.id}
                main={
                  <>
                    <td>
                      <input
                        type="checkbox"
                        aria-label={`Select ${row.code}`}
                        disabled={readOnly}
                        checked={selected.includes(row.id)}
                        onChange={(e) =>
                          setSelected(
                            e.target.checked
                              ? [...selected, row.id]
                              : selected.filter((id) => id !== row.id),
                          )
                        }
                      />
                    </td>
                    <th scope="row">
                      <strong>{titleCase(row.name)}</strong>
                      <small>
                        {row.code} · {context.classes.find((c) => c.id === row.classId)?.name}
                        {row.sectionId
                          ? ` · ${context.sections.find((s) => s.id === row.sectionId)?.name || ''}`
                          : ''}
                      </small>
                      <small>
                        {row.configured
                          ? 'Already configured · protected'
                          : row.outcome === 'saved'
                            ? 'Activated'
                            : row.error || 'Draft'}
                      </small>
                    </th>
                    <td className="currency-cell">{cell(row, 'baseFee', 'Base fee')}</td>
                    <td className="currency-cell">{cell(row, 'concession', 'Concession')}</td>
                    <td className="currency-cell">{cell(row, 'scholarship', 'Scholarship')}</td>
                    <td className="currency-cell">{cell(row, 'openingPaid', 'Already paid')}</td>
                    <td className="currency-cell">{cell(row, 'oldDues', 'Old dues')}</td>
                    <td className="currency-cell">{values.baseFee < 0 ? 'Not set' : money(net)}</td>
                    <td>
                      {row.configured
                        ? 'See ledger'
                        : money(
                            Math.max(
                              0,
                              net - values.openingPaid + values.oldDues + row.existingOldDues,
                            ),
                          )}
                      {row.existingOldDues > 0 && (
                        <small>
                          Includes {money(row.existingOldDues)} already recorded old dues
                        </small>
                      )}
                    </td>
                    <td>
                      {!row.configured && (
                        <Button
                          variant="secondary"
                          onClick={() => setExpanded(expanded === row.id ? '' : row.id)}
                        >
                          {values.count === 1 ? 'Single balance' : `${values.count} installments`}
                        </Button>
                      )}
                    </td>
                  </>
                }
                details={
                  <div className="fee-draft-row-details">
                    <label className="field">
                      Installments
                      <input
                        aria-label={`Installments for ${row.code}`}
                        type="number"
                        min="1"
                        max="60"
                        value={values.count}
                        disabled={readOnly}
                        onChange={(e) => edit(row, 'count', Number(e.target.value))}
                      />
                    </label>
                    {values.count > 1 && (
                      <label className="field">
                        Interval
                        <select
                          value={values.interval}
                          disabled={readOnly}
                          onChange={(e) => edit(row, 'interval', Number(e.target.value))}
                        >
                          <option value={1}>Monthly</option>
                          <option value={3}>Quarterly</option>
                          <option value={6}>Every six months</option>
                          <option value={12}>Yearly</option>
                        </select>
                      </label>
                    )}
                    <label className="field">
                      {values.count === 1 ? 'Due date' : 'First due date'}
                      <CalendarDateInput
                        value={values.dueDate}
                        disabled={readOnly}
                        onChange={(e) => edit(row, 'dueDate', e.target.value)}
                      />
                    </label>
                    <label className="field">
                      Note (optional)
                      <input
                        value={values.reason}
                        maxLength={300}
                        disabled={readOnly}
                        onChange={(e) => edit(row, 'reason', e.target.value)}
                      />
                    </label>
                    <p>
                      The final fee is split equally; rounding differences go into the first
                      installments. Custom unequal schedules remain available in the student ledger
                      after activation.
                    </p>
                  </div>
                }
              />
            );
          })}
        </tbody>
      </table>
      {!data.items.length && (
        <EmptyState
          title="No matching students"
          description="Change your filters to see other students in this draft."
        />
      )}
    </div>
  );
}
function DraftRow({
  row,
  expanded,
  main,
  details,
}: {
  row: FeeDraftRow;
  expanded: boolean;
  main: React.ReactNode;
  details: React.ReactNode;
}) {
  return (
    <>
      <tr className={row.error ? 'fee-draft-error-row' : ''}>{main}</tr>
      {expanded && (
        <tr>
          <td colSpan={10}>{details}</td>
        </tr>
      )}
    </>
  );
}
