import { useState } from 'react';
import { Button, Panel } from '../../../components/ui/Primitives';
import CalendarDateInput from '../../../components/ui/CalendarDateInput';
import { orderedClasses } from '../../../lib/schoolLabels';
import type { FeeContext } from '../../../services/feeService';
import type { FeeDraftFilters, FeeDraftValues } from '../../../services/feeOnboardingService';
export default function FeeDraftRules({
  context,
  selected,
  filters,
  canApprove,
  disabled,
  apply,
}: {
  context: FeeContext;
  selected: string[];
  filters: FeeDraftFilters;
  canApprove: boolean;
  disabled: boolean;
  apply: (body: object) => Promise<boolean>;
}) {
  const [classIds, setClasses] = useState<string[]>(filters.classId ? [filters.classId] : []);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [arrangement, setArrangement] = useState(''),
    [count, setCount] = useState(3),
    [interval, setInterval] = useState(1),
    [date, setDate] = useState('');
  const [error, setError] = useState('');
  return (
    <Panel
      title="Set common fees once"
      subtitle="Apply a standard fee to classes, then adjust only the exceptions in the student table."
    >
      <form
        className="fee-draft-form"
        onSubmit={async (e) => {
          e.preventDefault();
          setError('');
          const values: FeeDraftValues = {};
          for (const [key, amount] of Object.entries(amounts))
            if (amount !== '') Object.assign(values, { [key]: Math.round(Number(amount) * 100) });
          if (arrangement)
            Object.assign(values, { count: arrangement === 'single' ? 1 : count, interval });
          if (date) values.dueDate = date;
          if (!Object.keys(values).length) {
            setError(
              'Enter at least one value to apply. Blank fields keep the current draft values.',
            );
            return;
          }
          await apply({
            classIds: selected.length ? [] : classIds,
            ids: selected,
            filter: selected.length ? '' : filters.filter,
            search: selected.length ? '' : filters.search,
            sectionId: selected.length || classIds.length !== 1 ? '' : filters.sectionId,
            values,
          });
        }}
      >
        {selected.length ? (
          <p>
            <strong>{selected.length} selected students</strong> will receive these changes.
          </p>
        ) : (
          <fieldset className="fee-draft-class-choices">
            <legend>Classes · leave unchecked to apply to all matching students</legend>
            {orderedClasses(context.classes).map((c) => (
              <label key={c.id}>
                <input
                  type="checkbox"
                  checked={classIds.includes(c.id)}
                  disabled={disabled}
                  onChange={(e) =>
                    setClasses(
                      e.target.checked ? [...classIds, c.id] : classIds.filter((id) => id !== c.id),
                    )
                  }
                />
                {c.name}
              </label>
            ))}
          </fieldset>
        )}
        <div className="fee-form-grid">
          {[
            ['baseFee', 'Base yearly fee (₹)'],
            ['concession', 'Concession (₹)'],
            ['scholarship', 'Scholarship (₹)'],
            ['openingPaid', 'Already paid before using this app (₹)'],
            ['oldDues', 'Old outstanding dues (₹)'],
          ].map(([key, label]) => (
            <label className="field" key={key}>
              {label}
              <input
                type="number"
                min="0"
                max="10000000"
                step="0.01"
                placeholder="Keep current value"
                value={amounts[key] ?? ''}
                disabled={disabled || (!canApprove && ['concession', 'scholarship'].includes(key))}
                onChange={(e) => setAmounts({ ...amounts, [key]: e.target.value })}
              />
            </label>
          ))}
          <label className="field">
            Payment arrangement
            <select
              value={arrangement}
              disabled={disabled}
              onChange={(e) => setArrangement(e.target.value)}
            >
              <option value="">Keep current arrangement</option>
              <option value="single">Single balance</option>
              <option value="installments">Split into installments</option>
            </select>
          </label>
          {arrangement === 'installments' && (
            <>
              <label className="field">
                Number of installments
                <input
                  type="number"
                  min="1"
                  max="60"
                  required
                  value={count}
                  disabled={disabled}
                  onChange={(e) => setCount(Number(e.target.value))}
                />
              </label>
              <label className="field">
                Interval
                <select
                  value={interval}
                  disabled={disabled}
                  onChange={(e) => setInterval(Number(e.target.value))}
                >
                  <option value={1}>Monthly</option>
                  <option value={3}>Quarterly</option>
                  <option value={6}>Every six months</option>
                  <option value={12}>Yearly</option>
                </select>
              </label>
            </>
          )}
          <label className="field">
            First due date (optional)
            <CalendarDateInput
              value={date}
              disabled={disabled}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
        </div>
        <p className="muted">
          New students start with a single balance; installments are optional. Blank keeps the
          current value. Zero removes an amount. Existing fee agreements and already activated
          students are protected. Your search and issue filters also apply.
        </p>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <Button disabled={disabled}>
          Apply to {selected.length ? `${selected.length} selected students` : 'matching classes'}
        </Button>
      </form>
    </Panel>
  );
}
