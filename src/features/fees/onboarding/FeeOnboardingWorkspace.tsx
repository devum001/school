import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bus, Building2, Check, SlidersHorizontal, Sparkles } from 'lucide-react';
import { useFeedback } from '../../../app/useFeedback';
import {
  Button,
  EmptyState,
  LoadingOverlay,
  Panel,
  PickerInput,
} from '../../../components/ui/Primitives';
import { communicationError } from '../../../lib/communication';
import { money } from '../../../lib/config';
import { previousYearOpeningRow } from '../../../lib/feePlanDraft';
import { orderedClasses, sectionLabel } from '../../../lib/schoolLabels';
import {
  feeApi,
  makeInstallments,
  rebalanceInstallments,
  type FeeAgreement,
  type FeeContext,
  type FeeStudentRow,
} from '../../../services/feeService';
import FeeSetupDialog from '../FeeSetupDialog';
import './fee-onboarding.css';

type EditableRow = {
  student: FeeStudentRow;
  tuitionFee: string;
  transportActive: boolean;
  transportAnnualFee: string;
  transportMonths: number;
  transportFee: string;
  transportRoute: string;
  hostelActive: boolean;
  hostelAnnualFee: string;
  hostelMonths: number;
  hostelFee: string;
  hostelRoom: string;
  discountAmount: string;
  scholarshipAmount: string;
  discountNote: string;
  openingPaid: string;
  previousDueAmount: string;
  hasExistingPreviousDue: boolean;
  installmentCount: number;
  firstDueDate: string;
  dirty: boolean;
};

const toPaise = (value: string) => {
  const cleaned = String(value ?? '')
    .replace(/,/g, '')
    .trim();
  if (!cleaned) return 0;
  const num = Number(cleaned);
  return Number.isFinite(num) && num >= 0 ? Math.round(num * 100) : 0;
};

function createRowFromStudent(item: FeeStudentRow, defaultDueDate: string): EditableRow {
  const acc = item.account;
  const busPaise = acc?.transportFee ?? 0;
  const hostelPaise = acc?.hostelFee ?? 0;
  const tuitionPaise =
    acc?.tuitionFee !== undefined && acc.tuitionFee > 0
      ? acc.tuitionFee
      : acc
        ? Math.max(0, acc.baseFee - busPaise - hostelPaise)
        : 0;
  const tMonths = acc?.transportMonths || 12;
  const hMonths = acc?.hostelMonths || 12;
  const openingPaise = acc?.installments.reduce((s, i) => s + i.openingPaid, 0) ?? 0;

  return {
    student: item,
    tuitionFee: tuitionPaise > 0 ? String(tuitionPaise / 100) : '',
    transportActive: Boolean(acc?.transportActive || busPaise > 0),
    transportAnnualFee:
      busPaise > 0 && tMonths > 0 ? String(Math.round((busPaise / 100) * (12 / tMonths))) : '',
    transportMonths: tMonths,
    transportFee: busPaise > 0 ? String(busPaise / 100) : '',
    transportRoute: acc?.transportRoute ?? '',
    hostelActive: Boolean(acc?.hostelActive || hostelPaise > 0),
    hostelAnnualFee:
      hostelPaise > 0 && hMonths > 0
        ? String(Math.round((hostelPaise / 100) * (12 / hMonths)))
        : '',
    hostelMonths: hMonths,
    hostelFee: hostelPaise > 0 ? String(hostelPaise / 100) : '',
    hostelRoom: acc?.hostelRoom ?? '',
    discountAmount: (acc?.concession ?? 0) > 0 ? String((acc?.concession ?? 0) / 100) : '',
    scholarshipAmount: (acc?.scholarship ?? 0) > 0 ? String((acc?.scholarship ?? 0) / 100) : '',
    discountNote: acc?.reason ?? '',
    openingPaid: openingPaise > 0 ? String(openingPaise / 100) : '',
    previousDueAmount: item.oldDues > 0 ? String(item.oldDues / 100) : '',
    hasExistingPreviousDue: item.oldDues > 0,
    installmentCount: Math.max(1, acc?.installments.length || 1),
    firstDueDate: acc?.installments[0]?.dueDate || item.nextDue || defaultDueDate,
    dirty: false,
  };
}

function buildAgreementForRow(row: EditableRow, defaultDueDate: string): FeeAgreement | null {
  const tuitionPaise = toPaise(row.tuitionFee);
  const busPaise = row.transportActive ? toPaise(row.transportFee) : 0;
  const hostelPaise = row.hostelActive ? toPaise(row.hostelFee) : 0;
  const grossPaise = tuitionPaise + busPaise + hostelPaise;
  if (grossPaise <= 0) return null;

  const concessionPaise = Math.min(grossPaise, toPaise(row.discountAmount));
  const scholarshipPaise = Math.min(
    Math.max(0, grossPaise - concessionPaise),
    toPaise(row.scholarshipAmount),
  );
  const netPaise = Math.max(0, grossPaise - concessionPaise - scholarshipPaise);
  const openingPaise = Math.min(netPaise, toPaise(row.openingPaid));
  const dueStart = row.firstDueDate || defaultDueDate;
  const count = Math.max(1, row.installmentCount || 1);
  const existingInst = row.student.account?.installments ?? [];

  const seedInstallments =
    existingInst.length === count
      ? existingInst.map((i) => ({ id: i.id, amount: i.amount, dueDate: i.dueDate }))
      : makeInstallments(Math.max(netPaise, 100), count, dueStart, count <= 4 ? 3 : 1);

  const installments = rebalanceInstallments(
    netPaise,
    seedInstallments,
    existingInst,
    dueStart,
  );

  return {
    studentId: row.student.id,
    revision: row.student.account?.revision ?? -1,
    baseFee: grossPaise,
    tuitionFee: tuitionPaise,
    transportActive: Boolean(row.transportActive && busPaise > 0),
    transportFee: busPaise,
    transportRoute: row.transportActive ? row.transportRoute.trim() : '',
    transportMonths: row.transportActive ? row.transportMonths : 0,
    hostelActive: Boolean(row.hostelActive && hostelPaise > 0),
    hostelFee: hostelPaise,
    hostelRoom: row.hostelActive ? row.hostelRoom.trim() : '',
    hostelMonths: row.hostelActive ? row.hostelMonths : 0,
    concession: concessionPaise,
    scholarship: scholarshipPaise,
    reason: row.discountNote.trim(),
    openingPaid: openingPaise,
    asOf:
      openingPaise > 0
        ? row.student.account?.asOf || defaultDueDate
        : row.student.account?.asOf || '',
    installments,
  };
}

export default function FeeOnboardingWorkspace({
  schoolId,
  context,
  permissions,
}: {
  schoolId: string;
  context: FeeContext;
  permissions: readonly string[];
}) {
  const notify = useFeedback();
  const canApprove = permissions.includes('fees.approve');
  const year = context.years.find((y) => y.id === context.yearId);
  const defaultDueDate =
    year && context.today < year.start ? year.start : context.today;

  const sortedClasses = useMemo(
    () =>
      orderedClasses(
        context.classes.map((c, idx) => ({
          id: c.id,
          schoolId,
          name: c.name,
          sortOrder: idx + 1,
        })),
      ),
    [context.classes, schoolId],
  );

  const [classId, setClassId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [statusFilter, setStatusFilter] = useState<
    'all' | 'unconfigured' | 'configured' | 'bus' | 'hostel'
  >('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalMatching, setTotalMatching] = useState(0);

  const [rowsById, setRowsById] = useState<Record<string, EditableRow>>({});
  const [orderedIds, setOrderedIds] = useState<string[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingStudentId, setSavingStudentId] = useState<string | null>(null);
  const [error, setError] = useState('');

  // Quick Bulk Bar State
  const [bulkTuition, setBulkTuition] = useState('');
  const [bulkBusMode, setBulkBusMode] = useState<'keep' | 'enable' | 'disable'>('keep');
  const [bulkBusFee, setBulkBusFee] = useState('');
  const [bulkBusMonths, setBulkBusMonths] = useState(12);
  const [bulkHostelMode, setBulkHostelMode] = useState<'keep' | 'enable' | 'disable'>('keep');
  const [bulkHostelFee, setBulkHostelFee] = useState('');
  const [bulkHostelMonths, setBulkHostelMonths] = useState(12);
  const [bulkDiscount, setBulkDiscount] = useState('');
  const [bulkInstallments, setBulkInstallments] = useState(1);
  const [bulkFirstDue, setBulkFirstDue] = useState(defaultDueDate);

  const [detailStudent, setDetailStudent] = useState<FeeStudentRow | null>(null);

  const loadDirectory = useCallback(async () => {
    if (!context.yearId) return;
    setLoading(true);
    setError('');
    try {
      const res = await feeApi.directory(schoolId, {
        yearId: context.yearId,
        classId: classId || undefined,
        sectionId: sectionId || undefined,
        search: search.trim() || undefined,
        page,
      });
      const initialMap: Record<string, EditableRow> = {};
      const ids: string[] = [];
      for (const item of res.items) {
        ids.push(item.id);
        initialMap[item.id] = createRowFromStudent(item, defaultDueDate);
      }
      setOrderedIds(ids);
      setRowsById(initialMap);
      setTotalMatching(res.total);
      setSelectedIds((prev) => prev.filter((id) => initialMap[id]));
    } catch (err) {
      setError(communicationError(err));
    } finally {
      setLoading(false);
    }
  }, [classId, context.yearId, defaultDueDate, page, schoolId, search, sectionId]);

  useEffect(() => {
    void loadDirectory();
  }, [loadDirectory]);

  const visibleRows = useMemo(() => {
    return orderedIds
      .map((id) => rowsById[id])
      .filter((row): row is EditableRow => Boolean(row))
      .filter((row) => {
        if (statusFilter === 'unconfigured') return !row.student.configured;
        if (statusFilter === 'configured') return row.student.configured;
        if (statusFilter === 'bus') return row.transportActive;
        if (statusFilter === 'hostel') return row.hostelActive;
        return true;
      });
  }, [orderedIds, rowsById, statusFilter]);

  const dirtyRows = useMemo(
    () =>
      orderedIds
        .map((id) => rowsById[id])
        .filter((row): row is EditableRow => Boolean(row && row.dirty)),
    [orderedIds, rowsById],
  );

  const updateRow = (studentId: string, updater: (row: EditableRow) => EditableRow) => {
    setRowsById((prev) => {
      const current = prev[studentId];
      if (!current) return prev;
      return {
        ...prev,
        [studentId]: { ...updater(current), dirty: true },
      };
    });
  };

  const applyBulkToTargets = () => {
    const targetIds =
      selectedIds.length > 0 ? selectedIds : visibleRows.map((r) => r.student.id);
    if (targetIds.length === 0) {
      setError('No students match the current filter to apply bulk fee rules.');
      return;
    }
    setError('');
    setRowsById((prev) => {
      const next = { ...prev };
      for (const id of targetIds) {
        const row = next[id];
        if (!row) continue;
        const updated: EditableRow = { ...row, dirty: true };
        if (bulkTuition.trim() !== '') {
          updated.tuitionFee = bulkTuition.trim();
        }
        if (bulkBusMode === 'enable') {
          updated.transportActive = true;
          updated.transportMonths = bulkBusMonths;
          if (bulkBusFee.trim() !== '') {
            updated.transportFee = bulkBusFee.trim();
            updated.transportAnnualFee =
              bulkBusMonths === 12
                ? bulkBusFee.trim()
                : String(Math.round(Number(bulkBusFee) * (12 / bulkBusMonths)));
          }
        } else if (bulkBusMode === 'disable') {
          updated.transportActive = false;
          updated.transportFee = '';
        }
        if (bulkHostelMode === 'enable') {
          updated.hostelActive = true;
          updated.hostelMonths = bulkHostelMonths;
          if (bulkHostelFee.trim() !== '') {
            updated.hostelFee = bulkHostelFee.trim();
            updated.hostelAnnualFee =
              bulkHostelMonths === 12
                ? bulkHostelFee.trim()
                : String(Math.round(Number(bulkHostelFee) * (12 / bulkHostelMonths)));
          }
        } else if (bulkHostelMode === 'disable') {
          updated.hostelActive = false;
          updated.hostelFee = '';
        }
        if (bulkDiscount.trim() !== '' && canApprove) {
          updated.discountAmount = bulkDiscount.trim();
        }
        if (bulkInstallments >= 1) {
          updated.installmentCount = bulkInstallments;
        }
        if (bulkFirstDue) {
          updated.firstDueDate = bulkFirstDue;
        }
        next[id] = updated;
      }
      return next;
    });
    notify(
      `Applied fee values to ${targetIds.length} student${targetIds.length === 1 ? '' : 's'}. Review and click "Save All Changes" to commit.`,
    );
  };

  const saveSingleRow = async (row: EditableRow) => {
    setError('');
    setSavingStudentId(row.student.id);
    try {
      const agreement = buildAgreementForRow(row, defaultDueDate);
      const oldDuePaise = toPaise(row.previousDueAmount);
      if (!agreement && (row.hasExistingPreviousDue || oldDuePaise <= 0)) {
        setError(`Enter a tuition, bus, hostel, or previous-year fee for ${row.student.name}.`);
        return;
      }
      if (agreement) {
        await feeApi.agreements(schoolId, context.yearId, [agreement]);
      }
      if (!row.hasExistingPreviousDue && oldDuePaise > 0) {
        await feeApi.opening(schoolId, context.yearId, [
          previousYearOpeningRow(
            row.student.id,
            oldDuePaise,
            year?.start || context.today,
            context.today,
          ),
        ]);
      }
      notify(`Saved fee structure for ${row.student.name}.`);
      await loadDirectory();
    } catch (err) {
      setError(communicationError(err));
    } finally {
      setSavingStudentId(null);
    }
  };

  const saveAllDirtyRows = async () => {
    const targets =
      dirtyRows.length > 0
        ? dirtyRows
        : visibleRows.filter((r) => selectedIds.includes(r.student.id));
    if (targets.length === 0) {
      setError('Edit at least one student or apply bulk values first.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const agreements: FeeAgreement[] = [];
      const openingRows: ReturnType<typeof previousYearOpeningRow>[] = [];

      for (const row of targets) {
        const built = buildAgreementForRow(row, defaultDueDate);
        if (built) agreements.push(built);
        const oldDuePaise = toPaise(row.previousDueAmount);
        if (!row.hasExistingPreviousDue && oldDuePaise > 0) {
          openingRows.push(
            previousYearOpeningRow(
              row.student.id,
              oldDuePaise,
              year?.start || context.today,
              context.today,
            ),
          );
        }
      }

      if (agreements.length === 0 && openingRows.length === 0) {
        setError('Enter valid fee amounts greater than ₹0 before saving.');
        setSaving(false);
        return;
      }

      for (let i = 0; i < agreements.length; i += 25) {
        await feeApi.agreements(schoolId, context.yearId, agreements.slice(i, i + 25));
      }
      for (let i = 0; i < openingRows.length; i += 25) {
        await feeApi.opening(schoolId, context.yearId, openingRows.slice(i, i + 25));
      }

      notify(
        `Saved fee setup for ${Math.max(agreements.length, openingRows.length)} student${
          Math.max(agreements.length, openingRows.length) === 1 ? '' : 's'
        }.`,
      );
      await loadDirectory();
    } catch (err) {
      setError(communicationError(err));
    } finally {
      setSaving(false);
    }
  };

  const classNameFor = (cid?: string) =>
    context.classes.find((c) => c.id === cid)?.name ?? '';
  const sectionNameFor = (sid?: string) =>
    context.sections.find((s) => s.id === sid)?.name ?? '';

  return (
    <div className="fee-onboarding-workspace">
      <Panel
        title="School fee, bus & hostel setup (Single & Bulk)"
        subtitle="Select a class or students to apply common fees in bulk, or edit any student's Tuition, Bus (including mid-year stop), Hostel, Concession, and Previous Dues directly below."
      >
        <div className="fee-setup-top-stack">
          <div className="fee-filter-bar">
            <label className="field">
              <span>Class</span>
              <select
                aria-label="Class"
                value={classId}
                onChange={(e) => {
                  setClassId(e.target.value);
                  setSectionId('');
                  setPage(1);
                }}
              >
                <option value="">All classes</option>
                {sortedClasses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Section</span>
              <select
                aria-label="Section"
                value={sectionId}
                onChange={(e) => {
                  setSectionId(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">All sections</option>
                {context.sections
                  .filter((s) => !classId || s.classId === classId)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {sectionLabel(s.name)}
                    </option>
                  ))}
              </select>
            </label>
            <label className="field">
              <span>Filter students</span>
              <select
                aria-label="Show students"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
              >
                <option value="all">All students ({orderedIds.length})</option>
                <option value="unconfigured">Not configured yet</option>
                <option value="configured">Already configured</option>
                <option value="bus">Using school bus</option>
                <option value="hostel">Staying in hostel</option>
              </select>
            </label>
            <label className="field">
              <span>Search student</span>
              <input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Name or admission no."
              />
            </label>
          </div>

          <div className="fee-quick-bulk-box">
            <div className="fee-quick-bulk-header">
              <strong>
                <SlidersHorizontal size={15} /> Quick Bulk Fill (Apply to{' '}
                {selectedIds.length > 0
                  ? `${selectedIds.length} selected student${selectedIds.length === 1 ? '' : 's'}`
                  : `all ${visibleRows.length} shown student${visibleRows.length === 1 ? '' : 's'}`}
                )
              </strong>
              <span>
                Leave any box blank to keep each student&apos;s existing value unchanged.
              </span>
            </div>

            <div className="fee-quick-bulk-grid">
              <label className="field">
                <span>Tuition Fee (₹)</span>
                <input
                  type="number"
                  min={0}
                  placeholder="e.g. 24000"
                  value={bulkTuition}
                  onChange={(e) => setBulkTuition(e.target.value)}
                />
              </label>

              <label className="field">
                <span>School Bus</span>
                <div className="fee-inline-pair">
                  <select
                    aria-label="Bulk bus mode"
                    value={bulkBusMode}
                    onChange={(e) =>
                      setBulkBusMode(e.target.value as 'keep' | 'enable' | 'disable')
                    }
                  >
                    <option value="keep">No change</option>
                    <option value="enable">Add / Update Bus</option>
                    <option value="disable">No Bus (Remove)</option>
                  </select>
                  {bulkBusMode === 'enable' && (
                    <>
                      <input
                        aria-label="Bulk bus fee"
                        type="number"
                        min={0}
                        placeholder="Bus ₹"
                        value={bulkBusFee}
                        onChange={(e) => setBulkBusFee(e.target.value)}
                      />
                      <select
                        aria-label="Bulk bus months"
                        value={bulkBusMonths}
                        onChange={(e) => setBulkBusMonths(Number(e.target.value))}
                      >
                        {Array.from({ length: 12 }, (_, i) => 12 - i).map((m) => (
                          <option key={m} value={m}>
                            {m}m
                          </option>
                        ))}
                      </select>
                    </>
                  )}
                </div>
              </label>

              <label className="field">
                <span>Hostel Facility</span>
                <div className="fee-inline-pair">
                  <select
                    aria-label="Bulk hostel mode"
                    value={bulkHostelMode}
                    onChange={(e) =>
                      setBulkHostelMode(e.target.value as 'keep' | 'enable' | 'disable')
                    }
                  >
                    <option value="keep">No change</option>
                    <option value="enable">Add / Update Hostel</option>
                    <option value="disable">No Hostel (Remove)</option>
                  </select>
                  {bulkHostelMode === 'enable' && (
                    <>
                      <input
                        aria-label="Bulk hostel fee"
                        type="number"
                        min={0}
                        placeholder="Hostel ₹"
                        value={bulkHostelFee}
                        onChange={(e) => setBulkHostelFee(e.target.value)}
                      />
                      <select
                        aria-label="Bulk hostel months"
                        value={bulkHostelMonths}
                        onChange={(e) => setBulkHostelMonths(Number(e.target.value))}
                      >
                        {Array.from({ length: 12 }, (_, i) => 12 - i).map((m) => (
                          <option key={m} value={m}>
                            {m}m
                          </option>
                        ))}
                      </select>
                    </>
                  )}
                </div>
              </label>

              <label className="field">
                <span>Concession (₹)</span>
                <input
                  type="number"
                  min={0}
                  placeholder="0"
                  disabled={!canApprove}
                  value={bulkDiscount}
                  onChange={(e) => setBulkDiscount(e.target.value)}
                />
              </label>

              <label className="field">
                <span>Installments</span>
                <select
                  value={bulkInstallments}
                  onChange={(e) => setBulkInstallments(Number(e.target.value))}
                >
                  <option value={1}>One Time (1)</option>
                  <option value={2}>2 Installments</option>
                  <option value={3}>3 Installments (Term-wise)</option>
                  <option value={4}>4 Installments (Quarterly)</option>
                  <option value={6}>6 Installments</option>
                  <option value={12}>12 Installments (Monthly)</option>
                </select>
              </label>

              <label className="field">
                <span>First Due Date</span>
                <PickerInput
                  type="date"
                  value={bulkFirstDue}
                  onChange={(e) => setBulkFirstDue(e.target.value)}
                />
              </label>

              <div className="fee-quick-bulk-actions">
                <Button type="button" variant="secondary" onClick={applyBulkToTargets}>
                  <Sparkles size={15} /> Fill{' '}
                  {selectedIds.length > 0
                    ? `Selected (${selectedIds.length})`
                    : `Shown (${visibleRows.length})`}
                </Button>
                {dirtyRows.length > 0 && (
                  <Button type="button" disabled={saving} onClick={() => void saveAllDirtyRows()}>
                    <Check size={15} />{' '}
                    {saving ? 'Saving...' : `Save All Changes (${dirtyRows.length})`}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </Panel>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      <Panel
        title={`Student fee structure register (${visibleRows.length})`}
        subtitle="Edit any student's Tuition, Bus (toggle or reduce months if they leave mid-year), Hostel, Concession, or Previous Year Pending directly below."
        action={
          dirtyRows.length > 0 ? (
            <div className="fee-inline">
              <span className="panel-note">
                <strong>{dirtyRows.length}</strong> unsaved student change
                {dirtyRows.length === 1 ? '' : 's'}
              </span>
              <Button
                type="button"
                variant="secondary"
                disabled={saving}
                onClick={() => void loadDirectory()}
              >
                Discard edits
              </Button>
              <Button type="button" disabled={saving} onClick={() => void saveAllDirtyRows()}>
                {saving ? 'Saving...' : `Save All Changes (${dirtyRows.length})`}
              </Button>
            </div>
          ) : undefined
        }
      >
        <LoadingOverlay loading={loading} label="Loading students and fee structures…">
          {visibleRows.length === 0 && !loading ? (
            <EmptyState
              title="No students match this filter"
              description="Change the class, section, or status filter above to view students."
            />
          ) : (
            <>
              <div className="table-wrap fee-onboarding-grid">
                <table>
                  <thead>
                    <tr>
                      <th>
                        <input
                          type="checkbox"
                          aria-label="Select all shown students"
                          checked={
                            visibleRows.length > 0 &&
                            visibleRows.every((r) => selectedIds.includes(r.student.id))
                          }
                          onChange={(e) =>
                            setSelectedIds(
                              e.target.checked ? visibleRows.map((r) => r.student.id) : [],
                            )
                          }
                        />
                      </th>
                      <th>Student</th>
                      <th>Tuition Fee (₹)</th>
                      <th>
                        <span className="fee-th-icon">
                          <Bus size={14} /> Bus Service (₹ / Months)
                        </span>
                      </th>
                      <th>
                        <span className="fee-th-icon">
                          <Building2 size={14} /> Hostel (₹ / Months)
                        </span>
                      </th>
                      <th>Concession (₹)</th>
                      <th>Old Pending (₹)</th>
                      <th>Schedule</th>
                      <th className="currency-cell">Final Fee</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRows.map((row) => {
                      const id = row.student.id;
                      const tuitionP = toPaise(row.tuitionFee);
                      const busP = row.transportActive ? toPaise(row.transportFee) : 0;
                      const hostelP = row.hostelActive ? toPaise(row.hostelFee) : 0;
                      const discountP = toPaise(row.discountAmount);
                      const scholP = toPaise(row.scholarshipAmount);
                      const finalNetPaise = Math.max(
                        0,
                        tuitionP + busP + hostelP - discountP - scholP,
                      );
                      const settledPaise = row.student.paid;
                      const stateLabel = !row.student.configured
                        ? 'Not configured'
                        : row.student.overdue > 0
                          ? 'Overdue'
                          : row.student.outstanding === 0
                            ? 'Paid'
                            : 'Pending';

                      return (
                        <tr key={id} className={row.dirty ? 'fee-row-dirty' : ''}>
                          <td>
                            <input
                              type="checkbox"
                              aria-label={`Select ${row.student.name}`}
                              checked={selectedIds.includes(id)}
                              onChange={(e) =>
                                setSelectedIds((prev) =>
                                  e.target.checked
                                    ? [...prev, id]
                                    : prev.filter((item) => item !== id),
                                )
                              }
                            />
                          </td>
                          <th scope="row">
                            <strong>{row.student.name}</strong>
                            <small>
                              Adm {row.student.code} ·{' '}
                              {classNameFor(row.student.enrollment?.classId)}{' '}
                              {sectionNameFor(row.student.enrollment?.sectionId)}
                            </small>
                            <div
                              style={{ marginTop: 4, display: 'flex', gap: 6, flexWrap: 'wrap' }}
                            >
                              <span
                                className={`fee-status ${
                                  stateLabel === 'Paid'
                                    ? 'paid'
                                    : stateLabel === 'Overdue'
                                      ? 'overdue'
                                      : 'pending'
                                }`}
                              >
                                {stateLabel}
                              </span>
                              {settledPaise > 0 && (
                                <span className="fee-status paid">Paid {money(settledPaise)}</span>
                              )}
                            </div>
                          </th>

                          <td>
                            <input
                              aria-label={`Tuition fee for ${row.student.name}`}
                              type="number"
                              min={0}
                              placeholder="0"
                              value={row.tuitionFee}
                              onChange={(e) =>
                                updateRow(id, (r) => ({ ...r, tuitionFee: e.target.value }))
                              }
                            />
                          </td>

                          <td>
                            <div className="fee-cell-facility">
                              <label className="fee-cell-check">
                                <input
                                  type="checkbox"
                                  aria-label={`Bus active for ${row.student.name}`}
                                  checked={row.transportActive}
                                  onChange={(e) =>
                                    updateRow(id, (r) => ({
                                      ...r,
                                      transportActive: e.target.checked,
                                      transportMonths: r.transportMonths || 12,
                                    }))
                                  }
                                />
                                <span>{row.transportActive ? 'Bus On' : 'No Bus'}</span>
                              </label>
                              {row.transportActive && (
                                <div className="fee-cell-facility-inputs">
                                  <input
                                    aria-label={`Bus fee for ${row.student.name}`}
                                    type="number"
                                    min={0}
                                    placeholder="Bus ₹"
                                    value={row.transportFee}
                                    onChange={(e) =>
                                      updateRow(id, (r) => ({
                                        ...r,
                                        transportFee: e.target.value,
                                        transportAnnualFee:
                                          r.transportMonths === 12
                                            ? e.target.value
                                            : r.transportAnnualFee,
                                      }))
                                    }
                                  />
                                  <select
                                    aria-label={`Bus months for ${row.student.name}`}
                                    title="Active months (change if student joined or stopped bus mid-year)"
                                    value={row.transportMonths}
                                    onChange={(e) => {
                                      const m = Number(e.target.value);
                                      updateRow(id, (r) => {
                                        const yearly = Number(
                                          r.transportAnnualFee || r.transportFee || 0,
                                        );
                                        return {
                                          ...r,
                                          transportMonths: m,
                                          transportAnnualFee:
                                            r.transportAnnualFee || r.transportFee || '',
                                          transportFee:
                                            yearly > 0
                                              ? String(Math.round((yearly * m) / 12))
                                              : r.transportFee,
                                        };
                                      });
                                    }}
                                  >
                                    {Array.from({ length: 12 }, (_, i) => 12 - i).map((m) => (
                                      <option key={m} value={m}>
                                        {m}m
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              )}
                            </div>
                          </td>

                          <td>
                            <div className="fee-cell-facility">
                              <label className="fee-cell-check">
                                <input
                                  type="checkbox"
                                  aria-label={`Hostel active for ${row.student.name}`}
                                  checked={row.hostelActive}
                                  onChange={(e) =>
                                    updateRow(id, (r) => ({
                                      ...r,
                                      hostelActive: e.target.checked,
                                      hostelMonths: r.hostelMonths || 12,
                                    }))
                                  }
                                />
                                <span>{row.hostelActive ? 'Hostel On' : 'Day Scholar'}</span>
                              </label>
                              {row.hostelActive && (
                                <div className="fee-cell-facility-inputs">
                                  <input
                                    aria-label={`Hostel fee for ${row.student.name}`}
                                    type="number"
                                    min={0}
                                    placeholder="Hostel ₹"
                                    value={row.hostelFee}
                                    onChange={(e) =>
                                      updateRow(id, (r) => ({
                                        ...r,
                                        hostelFee: e.target.value,
                                        hostelAnnualFee:
                                          r.hostelMonths === 12
                                            ? e.target.value
                                            : r.hostelAnnualFee,
                                      }))
                                    }
                                  />
                                  <select
                                    aria-label={`Hostel months for ${row.student.name}`}
                                    title="Active months (change if student joined or left hostel mid-year)"
                                    value={row.hostelMonths}
                                    onChange={(e) => {
                                      const m = Number(e.target.value);
                                      updateRow(id, (r) => {
                                        const yearly = Number(
                                          r.hostelAnnualFee || r.hostelFee || 0,
                                        );
                                        return {
                                          ...r,
                                          hostelMonths: m,
                                          hostelAnnualFee:
                                            r.hostelAnnualFee || r.hostelFee || '',
                                          hostelFee:
                                            yearly > 0
                                              ? String(Math.round((yearly * m) / 12))
                                              : r.hostelFee,
                                        };
                                      });
                                    }}
                                  >
                                    {Array.from({ length: 12 }, (_, i) => 12 - i).map((m) => (
                                      <option key={m} value={m}>
                                        {m}m
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              )}
                            </div>
                          </td>

                          <td>
                            <input
                              aria-label={`Concession for ${row.student.name}`}
                              type="number"
                              min={0}
                              placeholder="0"
                              disabled={!canApprove}
                              value={row.discountAmount}
                              onChange={(e) =>
                                updateRow(id, (r) => ({ ...r, discountAmount: e.target.value }))
                              }
                            />
                          </td>

                          <td>
                            <input
                              aria-label={`Previous year pending for ${row.student.name}`}
                              type="number"
                              min={0}
                              placeholder="0"
                              disabled={row.hasExistingPreviousDue}
                              title={
                                row.hasExistingPreviousDue
                                  ? 'Previous-year due is already recorded in student ledger'
                                  : 'Add previous-year pending balance'
                              }
                              value={row.previousDueAmount}
                              onChange={(e) =>
                                updateRow(id, (r) => ({
                                  ...r,
                                  previousDueAmount: e.target.value,
                                }))
                              }
                            />
                          </td>

                          <td>
                            <select
                              aria-label={`Installments for ${row.student.name}`}
                              value={row.installmentCount}
                              onChange={(e) =>
                                updateRow(id, (r) => ({
                                  ...r,
                                  installmentCount: Number(e.target.value),
                                }))
                              }
                            >
                              <option value={1}>One Time (1)</option>
                              <option value={2}>2 Parts</option>
                              <option value={3}>3 Parts</option>
                              <option value={4}>4 Parts</option>
                              <option value={6}>6 Parts</option>
                              <option value={12}>12 Parts</option>
                            </select>
                          </td>

                          <td className="currency-cell">
                            <strong>{money(finalNetPaise)}</strong>
                            {(row.transportActive || row.hostelActive) && (
                              <small>
                                {row.transportActive ? `Bus ${money(busP)} ` : ''}
                                {row.hostelActive ? `Hostel ${money(hostelP)}` : ''}
                              </small>
                            )}
                          </td>

                          <td>
                            <div className="fee-row-actions">
                              <Button
                                type="button"
                                variant={row.dirty ? 'primary' : 'secondary'}
                                disabled={savingStudentId === id || saving}
                                onClick={() => void saveSingleRow(row)}
                              >
                                {savingStudentId === id ? 'Saving...' : 'Save'}
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                onClick={() => setDetailStudent(row.student)}
                              >
                                Schedule
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {totalMatching > 50 && (
                <div className="pagination">
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={page <= 1 || loading}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    Previous
                  </Button>
                  <span>
                    Page {page} · {totalMatching.toLocaleString('en-IN')} matching students
                  </span>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={page * 50 >= totalMatching || loading}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              )}
            </>
          )}
        </LoadingOverlay>
      </Panel>

      {detailStudent && (
        <FeeSetupDialog
          schoolId={schoolId}
          context={context}
          students={[detailStudent]}
          canApprove={canApprove}
          close={() => setDetailStudent(null)}
          saved={() => {
            setDetailStudent(null);
            void loadDirectory();
          }}
        />
      )}
    </div>
  );
}
