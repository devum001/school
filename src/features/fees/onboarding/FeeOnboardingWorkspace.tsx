import { useDraftGuard } from '../../academics/useDraftGuard';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button, LoadingOverlay, Panel, StatCard } from '../../../components/ui/Primitives';
import SectionNavigation from '../../../components/shared/SectionNavigation';
import { orderedClasses } from '../../../lib/schoolLabels';
import { money } from '../../../lib/config';
import { downloadCsv } from '../../../lib/download';
import type { FeeContext } from '../../../services/feeService';
import {
  feeOnboardingApi as api,
  type FeeDraftSummary,
  type FeeDraftPage,
  type FeeDraftFilters,
  type FeeDraftValues,
  type FeeDraftRow,
} from '../../../services/feeOnboardingService';
import FeeDraftRules from './FeeDraftRules';
import FeeDraftTable from './FeeDraftTable';
import FeeDraftTransfer from './FeeDraftTransfer';
import FeeDraftReview from './FeeDraftReview';
import { apiService } from '../../../services/apiService';
import './fee-onboarding.css';
export default function FeeOnboardingWorkspace({
  schoolId,
  context,
  permissions,
}: {
  schoolId: string;
  context: FeeContext;
  permissions: readonly string[];
}) {
  const [params, setParams] = useSearchParams(),
    draft = params.get('draft') || '';
  const [items, setItems] = useState<Awaited<ReturnType<typeof api.list>>>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState('');
  useEffect(() => {
    if (draft) return;
    let active = true;
    api
      .list(schoolId, context.yearId)
      .then((v) => {
        if (active) setItems(v);
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [schoolId, context.yearId, draft]);
  const open = (id: string) =>
    setParams((old) => {
      const next = new URLSearchParams(old);
      next.set('draft', id);
      return next;
    });
  if (draft)
    return (
      <FeeDraftEditor
        key={`${schoolId}:${context.yearId}:${draft}`}
        schoolId={schoolId}
        draft={draft}
        context={context}
        canApprove={permissions.includes('fees.approve')}
        back={() =>
          setParams((old) => {
            const next = new URLSearchParams(old);
            next.delete('draft');
            return next;
          })
        }
      />
    );
  const active = items.find((i) => i.active),
    closed = context.years.find((y) => y.id === context.yearId)?.status === 'closed';
  return (
    <LoadingOverlay loading={loading} label="Loading school fee drafts…">
      <Panel
        title="Set up fees for your whole school"
        subtitle="Class defaults → review exceptions → activate. You can leave and return without losing your saved draft."
      >
        <div className="fee-draft-form">
          <div className="fee-onboarding-intro">
            <div>
              <strong>1. Common fees</strong>
              <p>Set the usual fee and payment arrangement for groups of classes.</p>
            </div>
            <div>
              <strong>2. Exceptions & old records</strong>
              <p>
                Edit students directly, apply group discounts, or bring one completed worksheet.
              </p>
            </div>
            <div>
              <strong>3. Activate in the background</strong>
              <p>Review totals and errors. Safe batches continue even when you close the page.</p>
            </div>
          </div>
          <p>
            Existing fee agreements and receipts are protected. This flow sets up students who do
            not have current-year fees yet.
          </p>
          <Button
            disabled={loading || closed}
            onClick={() => {
              if (active) {
                open(active.id);
                return;
              }
              setLoading(true);
              setError('');
              api
                .create(schoolId, context.yearId)
                .then((r) => open(r.id))
                .catch((e) => setError(e.message))
                .finally(() => setLoading(false));
            }}
          >
            {active ? 'Resume saved fee draft' : 'Prepare school fee draft'}
          </Button>
          {!!items.length && (
            <details>
              <summary>Recent fee drafts</summary>
              {items.map((item) => (
                <p key={item.id}>
                  <Button variant="secondary" onClick={() => open(item.id)}>
                    {item.status === 'completed'
                      ? 'View completed setup'
                      : `Open ${item.status} draft`}
                  </Button>
                </p>
              ))}
            </details>
          )}
          {closed && <p>This academic year is closed. Select an open year to set up fees.</p>}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
        </div>
      </Panel>
    </LoadingOverlay>
  );
}
function FeeDraftEditor({
  schoolId,
  draft,
  context,
  canApprove,
  back,
}: {
  schoolId: string;
  draft: string;
  context: FeeContext;
  canApprove: boolean;
  back: () => void;
}) {
  const [summary, setSummary] = useState<FeeDraftSummary>(),
    [page, setPage] = useState<FeeDraftPage>();
  const [filters, setFilters] = useState<FeeDraftFilters>({
    classId: '',
    sectionId: '',
    search: '',
    filter: '',
    page: 1,
  });
  const [search, setSearch] = useState(''),
    [step, setStep] = useState('defaults'),
    [selected, setSelected] = useState<string[]>([]);
  const [changes, setChanges] = useState<Record<string, FeeDraftValues>>({}),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState('');
  const version = useRef(0),
    busyRef = useRef(false),
    requestSequence = useRef(0),
    savedCount = useRef<number | undefined>(undefined);
  const refresh = useCallback(
    async (signal?: AbortSignal) => {
      const sequence = ++requestSequence.current;
      try {
        const [next, students] = await Promise.all([
          api.summary(schoolId, draft, signal),
          api.rows(schoolId, draft, filters, signal),
        ]);
        if (signal?.aborted || sequence !== requestSequence.current) return;
        if (next.job.academicYearId !== context.yearId)
          throw new Error(
            'This draft belongs to another academic year. Return and select its year.',
          );
        if (savedCount.current !== next.totals.saved && next.totals.saved > 0)
          apiService.invalidateReads();
        savedCount.current = next.totals.saved;
        version.current = next.job.revision;
        setSummary(next);
        setPage(students);
      } catch (e) {
        if (!signal?.aborted && sequence === requestSequence.current)
          setError(e instanceof Error ? e.message : 'Unable to load this draft.');
      } finally {
        if (!signal?.aborted && sequence === requestSequence.current) setLoading(false);
      }
    },
    [schoolId, draft, filters, context.yearId],
  );
  useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve().then(() => {
      if (!controller.signal.aborted) return refresh(controller.signal);
    });
    return () => controller.abort();
  }, [refresh]);
  const working =
    !!summary && ['preparing', 'validating', 'processing'].includes(summary.job.status);
  useEffect(() => {
    if (!working) return;
    const timer = setInterval(() => {
      if (!busyRef.current) void refresh();
    }, 1500);
    return () => clearInterval(timer);
  }, [working, refresh]);
  useEffect(() => {
    const timer = setTimeout(() => setFilters((f) => ({ ...f, search, page: 1 })), 300);
    return () => clearTimeout(timer);
  }, [search]);
  const change = useCallback(
    async (action: string, body: object, reload = true) => {
      if (busyRef.current) return null;
      busyRef.current = true;
      setBusy(true);
      setError('');
      requestSequence.current++;
      try {
        const result = await api.change(schoolId, draft, action, {
          ...body,
          revision: version.current,
        });
        version.current = result.revision;
        if (reload) await refresh();
        return result;
      } catch (e) {
        const message =
          e instanceof Error
            ? e.message
            : 'Save could not be confirmed. Reload and review your draft.';
        await refresh();
        setError(message);
        return null;
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [schoolId, draft, refresh],
  );
  const save = useCallback(async () => {
    if (!page || !Object.keys(changes).length) return true;
    const result = await change('rows', {
      rows: Object.entries(changes).map(([id, values]) => ({
        id,
        revision: page.items.find((r) => r.id === id)?.revision ?? -1,
        values,
      })),
    });
    if (result) setChanges({});
    return !!result;
  }, [page, changes, change]);
  useEffect(() => {
    if (!Object.keys(changes).length || busy || error) return;
    const timer = setTimeout(() => {
      void save();
    }, 1000);
    return () => clearTimeout(timer);
  }, [changes, save, busy, error]);
  const dirty = !!Object.keys(changes).length;
  const guard = useDraftGuard(dirty, back);
  const changeFilter = (values: Partial<FeeDraftFilters>) => {
    if (dirty || busy) return;
    setFilters((f) => ({ ...f, ...values, page: 1 }));
    setSelected([]);
  };
  const edit = (row: FeeDraftRow, field: keyof FeeDraftValues, value: number | string) => {
    setError('');
    setChanges((c) => ({ ...c, [row.id]: { ...c[row.id], [field]: value } }));
  };
  if (!summary || !page)
    return (
      <LoadingOverlay loading={loading} label="Loading fee draft…">
        <Panel>
          <Button variant="secondary" onClick={back}>
            Back to fee setup
          </Button>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <Button variant="secondary" onClick={() => void refresh()}>
            Retry
          </Button>
        </Panel>
      </LoadingOverlay>
    );
  const { job, totals } = summary,
    editable = ['draft', 'ready'].includes(job.status),
    disabled = busy || !editable;
  const apply = async (body: object) => {
    if (!(await save())) return false;
    const result = await change('bulk', body);
    if (result) {
      setSelected([]);
      setStep('students');
    }
    return !!result;
  };
  const action = async (name: string) => {
    if (await save()) await change(`actions/${name}`, {});
  };
  return (
    <div className="fee-onboarding-workspace" data-unsaved={dirty}>
      {guard.confirming && (
        <Panel title="Some edits are not saved yet">
          <div className="fee-draft-form">
            <p>Keep editing while the draft saves, or leave and discard only the unsaved edits.</p>
            <Button onClick={guard.keepEditing}>Keep editing</Button>
            <Button variant="secondary" onClick={guard.discard}>
              Discard unsaved edits and leave
            </Button>
          </div>
        </Panel>
      )}
      <div className="fee-draft-heading">
        <Button variant="secondary" disabled={dirty || busy} onClick={back}>
          ← Fee drafts
        </Button>
        <div>
          <h2>School fee setup</h2>
          <p>
            {context.years.find((y) => y.id === context.yearId)?.name} ·{' '}
            {totals.total.toLocaleString('en-IN')} students
          </p>
        </div>
        <span role="status">
          {busy
            ? 'Saving…'
            : dirty
              ? 'Unsaved edits · saving shortly'
              : working
                ? 'Background work in progress'
                : 'Draft saved'}
        </span>
        {dirty && (
          <Button variant="secondary" disabled={busy} onClick={() => void save()}>
            Save now
          </Button>
        )}
      </div>
      <div className="stats-grid four">
        <StatCard
          label="To set up"
          value={totals.total - totals.skipped - totals.saved}
          detail={`${totals.skipped} already configured`}
        />
        <StatCard
          label="Agreed fees"
          value={money(totals.net)}
          detail="Students included in this setup"
        />
        <StatCard
          label="Already paid"
          value={money(totals.alreadyPaid)}
          detail="Historical money, not new collections"
        />
        <StatCard
          label="Old dues to add"
          value={money(totals.oldDues)}
          detail={`${totals.saved} students activated`}
        />
      </div>
      {working && (
        <Panel
          title={
            job.status === 'preparing'
              ? 'Preparing the student list'
              : job.status === 'validating'
                ? 'Checking every fee arrangement'
                : 'Activating fees safely'
          }
        >
          <div className="fee-draft-form">
            <progress
              aria-label="Fee onboarding progress"
              max={Math.max(1, totals.total - totals.skipped)}
              value={
                job.status === 'processing'
                  ? totals.saved
                  : job.status === 'validating'
                    ? job.checked
                    : undefined
              }
            />
            <p>
              {job.status === 'processing'
                ? `${totals.saved} activated`
                : job.status === 'validating'
                  ? `${job.checked} checked`
                  : `${totals.total} students prepared`}
              . You can leave this page. Saved progress survives refreshes and restarts.
            </p>
            <Button variant="secondary" disabled={busy} onClick={() => void action('pause')}>
              Pause background work
            </Button>
          </div>
        </Panel>
      )}
      {job.status === 'paused' && (
        <Panel title="Setup paused">
          <div className="fee-draft-form">
            <p>{job.message || 'Your progress is saved.'}</p>
            <Button disabled={busy} onClick={() => void action('resume')}>
              Resume background work
            </Button>
            <Button variant="secondary" disabled={busy} onClick={() => void action('cancel')}>
              Cancel remaining setup
            </Button>
          </div>
        </Panel>
      )}
      {job.status === 'completed' && (
        <Panel title="School fees are ready">
          <div className="fee-draft-form">
            <p>
              {totals.saved} students activated. Existing agreements were preserved. Open Student
              Fees to collect payments and issue receipts.
            </p>
          </div>
        </Panel>
      )}
      <SectionNavigation
        label="Fee setup steps"
        items={[
          { id: 'defaults', label: '1. Common fees' },
          { id: 'students', label: '2. Review students' },
          { id: 'activate', label: '3. Review & activate' },
        ]}
        value={step}
        onChange={(value) => {
          if (!dirty && !busy) setStep(value);
        }}
      />
      {step !== 'activate' && (
        <div className="fee-filter-bar">
          <label className="filter-label">
            <span>Class</span>
            <select
              aria-label="Class"
              disabled={dirty || busy}
              value={filters.classId}
              onChange={(e) => changeFilter({ classId: e.target.value, sectionId: '' })}
            >
              <option value="">All classes</option>
              {orderedClasses(context.classes).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="filter-label">
            <span>Section</span>
            <select
              aria-label="Section"
              disabled={dirty || busy || !filters.classId}
              value={filters.sectionId}
              onChange={(e) => changeFilter({ sectionId: e.target.value })}
            >
              <option value="">Whole class</option>
              {context.sections
                .filter((s) => s.classId === filters.classId)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
            </select>
          </label>
          <label className="filter-label">
            <span>Show</span>
            <select
              aria-label="Show students"
              disabled={dirty || busy}
              value={filters.filter}
              onChange={(e) => changeFilter({ filter: e.target.value })}
            >
              <option value="">All students</option>
              <option value="needs-setup">Needs a fee amount</option>
              <option value="concession">Has concession / scholarship</option>
              <option value="old-dues">Has old dues to add</option>
              <option value="errors">Needs correction</option>
            </select>
          </label>
          <label className="filter-label">
            <span>Find student</span>
            <input
              value={search}
              disabled={dirty || busy}
              placeholder="Name or admission number"
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <Button variant="secondary" disabled={busy || dirty} onClick={() => void refresh()}>
            Refresh
          </Button>
        </div>
      )}
      {step === 'defaults' && (
        <FeeDraftRules
          key={filters.classId}
          context={context}
          filters={filters}
          selected={selected}
          canApprove={canApprove}
          disabled={disabled || dirty}
          apply={apply}
        />
      )}
      {step === 'students' && (
        <>
          <Panel
            title="Adjust exceptions directly"
            subtitle="Edits save automatically to your draft. No fees are activated until you review and confirm."
          >
            {!!selected.length && (
              <div className="fee-bulk-bar">
                <strong>{selected.length} selected</strong>
                <Button disabled={dirty || busy} onClick={() => setStep('defaults')}>
                  Apply group changes
                </Button>
                <Button variant="secondary" onClick={() => setSelected([])}>
                  Clear selection
                </Button>
              </div>
            )}
            <FeeDraftTable
              data={page}
              context={context}
              changes={changes}
              selected={selected}
              setSelected={(ids) => {
                if (ids.length > 500) {
                  setError(
                    'Select up to 500 individual students, or use class filters to change the whole group.',
                  );
                  return;
                }
                setSelected(ids);
              }}
              edit={edit}
              disabled={disabled}
              canApprove={canApprove}
            />
            <div className="pagination">
              <Button
                variant="secondary"
                disabled={dirty || busy || filters.page === 1}
                onClick={() => setFilters((f) => ({ ...f, page: f.page - 1 }))}
              >
                Previous
              </Button>
              <span>
                Page {filters.page} · {page.total.toLocaleString('en-IN')} matching students
              </span>
              <Button
                variant="secondary"
                disabled={dirty || busy || filters.page * page.pageSize >= page.total}
                onClick={() => setFilters((f) => ({ ...f, page: f.page + 1 }))}
              >
                Next
              </Button>
            </div>
          </Panel>
          <FeeDraftTransfer
            schoolId={schoolId}
            draft={draft}
            context={context}
            filters={filters}
            disabled={disabled || dirty}
            change={change}
            refreshed={refresh}
          />
        </>
      )}
      {step === 'activate' && (
        <FeeDraftReview
          summary={summary}
          schoolId={schoolId}
          draft={draft}
          today={context.today}
          disabled={disabled || dirty}
          busy={busy}
          change={change}
          action={action}
          reportError={setError}
          reviewProblems={() => {
            setFilters((f) => ({ ...f, filter: 'errors', page: 1 }));
            setStep('students');
          }}
        />
      )}
      {editable && (
        <details className="fee-draft-period">
          <summary>Cancel this setup</summary>
          <p>Stops this draft. Any students already activated and their payments stay unchanged.</p>
          <Button
            variant="secondary"
            disabled={busy || dirty}
            onClick={() => void action('cancel')}
          >
            Cancel remaining setup
          </Button>
        </details>
      )}
      {!!job.sheetErrors.length && (
        <Panel title="Worksheet rows need attention">
          <div className="fee-draft-form">
            <p>
              The rejected upload batch was not applied. Correct and upload it again, or explicitly
              discard those rejected rows.
            </p>
            <ul>
              {job.sheetErrors.slice(0, 10).map((issue, i) => (
                <li key={i}>{issue}</li>
              ))}
            </ul>
            <Button
              variant="secondary"
              onClick={() =>
                downloadCsv(
                  'fee-sheet-errors.csv',
                  ['Issue'],
                  job.sheetErrors.map((e) => [e]),
                )
              }
            >
              Download upload issues
            </Button>
            <Button
              variant="secondary"
              disabled={disabled || dirty}
              onClick={() => void action('clear-sheet-errors')}
            >
              Discard rejected upload rows
            </Button>
          </div>
        </Panel>
      )}
      {job.message && job.status !== 'paused' && <p role="status">{job.message}</p>}
      {error && (
        <div className="form-error" role="alert">
          {error}
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => {
              setError('');
              void refresh();
            }}
          >
            Reload saved draft
          </Button>
        </div>
      )}
    </div>
  );
}
