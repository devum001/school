import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AppIcon,
  Avatar,
  Badge,
  Button,
  EmptyState,
  LoadingOverlay,
  Panel,
  PickerInput,
} from '../../components/ui/Primitives';
import { useFeedback } from '../../app/useFeedback';
import { useToday } from '../../app/useToday';
import {
  liveHrAdapter,
  rupees,
  type HrAdapter,
  type HrEmployment,
  type HrStaff,
  type HrWorkspace,
} from '../../services/hrService';
import EmploymentDialog from './EmploymentDialog';
import { Search, AlertCircle } from 'lucide-react';
import './salary-setup.css';

interface SalaryRow {
  staff: HrStaff;
  employment?: HrEmployment;
  basic: string; // in Rupees
  allowance: string;
  bonus: string;
  deduction: string;
  attendanceMode: 'none' | 'manual' | 'punch';
  endedOn: string;
  userId?: string;
  dirty: boolean;
  configured: boolean;
}

const toPaise = (val: string | number) => {
  const num = Number(String(val ?? '').replace(/,/g, '').trim());
  return Number.isFinite(num) && num >= 0 ? Math.round(num * 100) : 0;
};

const formatRupees = (paise: number) => {
  return rupees(paise);
};

export default function SalarySetupWorkspace({
  schoolId,
  permissions = [],
}: {
  schoolId?: string;
  permissions?: readonly string[];
}) {
  const today = useToday();
  const notify = useFeedback();
  const currentMonthStr = today.slice(0, 7);

  const [month, setMonth] = useState(currentMonthStr);
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'configured' | 'pending'>('all');
  const [search, setSearch] = useState('');

  const [loading, setLoading] = useState(true);
  const [savingAll, setSavingAll] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const [hrData, setHrData] = useState<HrWorkspace | null>(null);
  const [rowsById, setRowsById] = useState<Record<string, SalaryRow>>({});
  const [orderedIds, setOrderedIds] = useState<string[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [editingStaff, setEditingStaff] = useState<HrStaff | null>(null);

  // Quick Bulk Bar state
  const [bulkBasic, setBulkBasic] = useState('');
  const [bulkAllowance, setBulkAllowance] = useState('');
  const [bulkBonus, setBulkBonus] = useState('');
  const [bulkDeduction, setBulkDeduction] = useState('');
  const [bulkAttendanceMode, setBulkAttendanceMode] = useState<'keep' | 'punch' | 'manual' | 'none'>('keep');
  const [bulkReason, setBulkReason] = useState('Bulk salary setup');

  const adapter = useMemo<HrAdapter | null>(() => {
    return schoolId ? liveHrAdapter(schoolId) : null;
  }, [schoolId]);

  const loadData = useCallback(async () => {
    if (!adapter) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const data = await adapter.load(month, false, new AbortController().signal);
      setHrData(data);

      const map: Record<string, SalaryRow> = {};
      const ids: string[] = [];

      for (const s of data.staff) {
        if (s.status === 'archived') continue;
        ids.push(s.id);
        const emp = data.employment.find((e) => e.staffId === s.id);
        const latestSalary = emp?.salaries.filter((sal) => sal.effectiveMonth <= month).at(-1);
        const hasSalary = Boolean(latestSalary && latestSalary.basic > 0);

        const currentPolicy = emp?.policies?.length
          ? (emp.policies.filter((p) => p.effectiveMonth <= month).at(-1)?.attendanceMode ?? 'none')
          : (emp?.attendanceMode ?? (s.teaching ? 'punch' : 'none'));

        map[s.id] = {
          staff: s,
          employment: emp,
          basic: latestSalary ? String(latestSalary.basic / 100) : '',
          allowance: latestSalary?.allowance ? String(latestSalary.allowance / 100) : '',
          bonus: latestSalary?.bonus ? String(latestSalary.bonus / 100) : '',
          deduction: latestSalary?.deduction ? String(latestSalary.deduction / 100) : '',
          attendanceMode: (currentPolicy as 'none' | 'manual' | 'punch') || 'none',
          endedOn: emp?.endedOn ?? '',
          userId: s.userId ?? '',
          dirty: false,
          configured: hasSalary,
        };
      }

      setRowsById(map);
      setOrderedIds(ids);
    } catch (err: any) {
      setError(err?.message || 'Unable to load staff payroll data.');
    } finally {
      setLoading(false);
    }
  }, [adapter, month]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Filtered rows
  const visibleRows = useMemo(() => {
    return orderedIds
      .map((id) => rowsById[id])
      .filter((row): row is SalaryRow => Boolean(row))
      .filter((row) => {
        if (departmentFilter && row.staff.department !== departmentFilter) return false;
        if (statusFilter === 'configured' && !row.configured) return false;
        if (statusFilter === 'pending' && row.configured) return false;
        if (search.trim()) {
          const q = search.toLowerCase();
          const matchName = row.staff.name.toLowerCase().includes(q);
          const matchCode = (row.staff.code || '').toLowerCase().includes(q);
          const matchDesignation = (row.staff.designation || '').toLowerCase().includes(q);
          const matchDept = (row.staff.department || '').toLowerCase().includes(q);
          if (!matchName && !matchCode && !matchDesignation && !matchDept) return false;
        }
        return true;
      });
  }, [orderedIds, rowsById, departmentFilter, statusFilter, search]);

  const departments = useMemo(() => {
    if (hrData?.settings?.departments?.length) {
      return hrData.settings.departments;
    }
    const depts = new Set<string>();
    for (const r of Object.values(rowsById)) {
      if (r.staff.department) depts.add(r.staff.department);
    }
    return Array.from(depts);
  }, [hrData, rowsById]);

  // Statistics
  const configuredCount = useMemo(() => {
    return Object.values(rowsById).filter((r) => r.configured).length;
  }, [rowsById]);

  const totalStaffCount = orderedIds.length;
  const dirtyCount = useMemo(() => {
    return Object.values(rowsById).filter((r) => r.dirty).length;
  }, [rowsById]);

  // Update a single field in a row
  const updateRowField = (id: string, field: keyof SalaryRow, value: any) => {
    setRowsById((prev) => {
      const existing = prev[id];
      if (!existing) return prev;
      return {
        ...prev,
        [id]: {
          ...existing,
          [field]: value,
          dirty: true,
        },
      };
    });
  };

  // Bulk Apply
  const applyBulkToSelected = (targetIds: string[]) => {
    if (targetIds.length <= 1) {
      notify('Select more than 1 staff member to apply bulk changes.');
      return;
    }

    setRowsById((prev) => {
      const next = { ...prev };
      for (const id of targetIds) {
        const row = next[id];
        if (!row) continue;
        next[id] = {
          ...row,
          basic: bulkBasic !== '' ? bulkBasic : row.basic,
          allowance: bulkAllowance !== '' ? bulkAllowance : row.allowance,
          bonus: bulkBonus !== '' ? bulkBonus : row.bonus,
          deduction: bulkDeduction !== '' ? bulkDeduction : row.deduction,
          attendanceMode: bulkAttendanceMode !== 'keep' ? bulkAttendanceMode : row.attendanceMode,
          dirty: true,
        };
      }
      return next;
    });

    notify(`Applied bulk values to ${targetIds.length} staff members. Review and click 'Save Changes'.`);
  };

  // Individual Save
  const saveSingleRow = async (id: string) => {
    const row = rowsById[id];
    if (!row || !adapter) return;

    setSavingId(id);
    try {
      const basicPaise = toPaise(row.basic);
      const allowancePaise = toPaise(row.allowance);
      const bonusPaise = toPaise(row.bonus);
      const deductionPaise = toPaise(row.deduction);

      await adapter.save(
        `/staff/${row.staff.id}/employment`,
        {
          revision: row.employment?.revision ?? 0,
          attendanceMode: row.attendanceMode,
          endedOn: row.endedOn || '',
          userId: row.userId || undefined,
          effectiveMonth: month,
          basic: basicPaise,
          allowance: allowancePaise,
          bonus: bonusPaise,
          deduction: deductionPaise,
          reason: bulkReason || 'Salary setup via Finance',
        },
        'PUT',
      );

      if (basicPaise > 0) {
        try {
          await adapter.save(`/staff/${row.staff.id}/payroll`, {
            month,
            revision: 0,
            adjustment: 0,
            advanceRecovery: 0,
            note: 'Draft from salary setup',
          });
        } catch (e) {
          console.warn('Auto draft creation notice:', e);
        }
      }

      setRowsById((prev) => ({
        ...prev,
        [id]: {
          ...prev[id],
          dirty: false,
          configured: basicPaise > 0,
        },
      }));

      notify(`Salary setup saved for ${row.staff.name}`);
    } catch (err: any) {
      notify(err?.message || `Failed to save salary for ${row.staff.name}`);
    } finally {
      setSavingId(null);
    }
  };

  // Bulk Save All Dirty
  const saveAllDirtyRows = async () => {
    if (!adapter) return;
    const dirtyRows = Object.values(rowsById).filter((r) => r.dirty);
    if (!dirtyRows.length) {
      notify('No unsaved changes to persist.');
      return;
    }

    setSavingAll(true);
    let successCount = 0;
    let failureCount = 0;

    for (const row of dirtyRows) {
      try {
        const basicPaise = toPaise(row.basic);
        const allowancePaise = toPaise(row.allowance);
        const bonusPaise = toPaise(row.bonus);
        const deductionPaise = toPaise(row.deduction);

        await adapter.save(
          `/staff/${row.staff.id}/employment`,
          {
            revision: row.employment?.revision ?? 0,
            attendanceMode: row.attendanceMode,
            endedOn: row.endedOn || '',
            userId: row.userId || undefined,
            effectiveMonth: month,
            basic: basicPaise,
            allowance: allowancePaise,
            bonus: bonusPaise,
            deduction: deductionPaise,
            reason: bulkReason || 'Bulk salary setup via Finance',
          },
          'PUT',
        );

        if (basicPaise > 0) {
          try {
            await adapter.save(`/staff/${row.staff.id}/payroll`, {
              month,
              revision: 0,
              adjustment: 0,
              advanceRecovery: 0,
              note: 'Bulk draft from salary setup',
            });
          } catch {
            // best-effort draft
          }
        }

        setRowsById((prev) => ({
          ...prev,
          [row.staff.id]: {
            ...prev[row.staff.id],
            dirty: false,
            configured: basicPaise > 0,
          },
        }));

        successCount++;
      } catch {
        failureCount++;
      }
    }

    setSavingAll(false);
    if (failureCount === 0) {
      notify(`Successfully saved salary setup for ${successCount} staff members!`);
    } else {
      notify(`Saved ${successCount} staff members. ${failureCount} failed.`);
    }
  };

  return (
    <div className="salary-setup-workspace">
      {/* Overview Stat Banner */}
      <div className="salary-setup-top-bar">
        <div className="salary-setup-headings">
          <h2>Staff Salary Setup</h2>
          <p>
            Configure monthly basic salary, allowances, deductions and attendance rules for your school staff in individual or bulk mode.
          </p>
        </div>
        <div className="salary-setup-badge-row">
          <Badge tone={configuredCount === totalStaffCount ? 'present' : 'amber'}>
            {configuredCount} of {totalStaffCount} Configured
          </Badge>
          {dirtyCount > 0 && (
            <Badge tone="blue">
              {dirtyCount} Unsaved Changes
            </Badge>
          )}
        </div>
      </div>

      {/* Filter and Action Toolbar */}
      <Panel className="salary-setup-toolbar-panel">
        <div className="salary-setup-toolbar">
          <label className="salary-setup-filter">
            <span>Effective Month</span>
            <PickerInput
              type="month"
              aria-label="Effective Month"
              value={month}
              onChange={(e) => {
                if (e.target.value) setMonth(e.target.value);
              }}
            />
          </label>

          <label className="salary-setup-filter">
            <span>Department</span>
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              aria-label="Filter by department"
            >
              <option value="">All departments</option>
              {departments.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </label>

          <label className="salary-setup-filter">
            <span>Status</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              aria-label="Filter by status"
            >
              <option value="all">All Staff ({totalStaffCount})</option>
              <option value="configured">Configured ({configuredCount})</option>
              <option value="pending">Pending Setup ({totalStaffCount - configuredCount})</option>
            </select>
          </label>

          <div className="salary-setup-search-wrap">
            <Search size={16} className="search-icon" />
            <input
              type="search"
              placeholder="Search by name, code, designation…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search staff"
            />
          </div>

          <div className="salary-setup-actions-wrap">
            {dirtyCount > 0 && (
              <Button onClick={saveAllDirtyRows} disabled={savingAll}>
                <AppIcon name="save" size={15} />
                {savingAll ? 'Saving All...' : `Save All Changes (${dirtyCount})`}
              </Button>
            )}
          </div>
        </div>

        {/* Quick Bulk Fill Box - Triggers only when more than 1 staff is selected */}
        {selectedIds.length > 1 && (
          <div className="salary-bulk-box">
            <div className="salary-bulk-box-header">
              <div>
                <strong>Quick Bulk Fill</strong>
                <p>Values entered here will be applied to the {selectedIds.length} selected staff members.</p>
              </div>
              <div className="bulk-selection-note">
                <span>Selected: <strong>{selectedIds.length}</strong> staff</span>
              </div>
            </div>

            <div className="salary-bulk-grid">
              <label>
                <span>Basic Salary (₹)</span>
                <input
                  type="number"
                  placeholder="e.g. 25000"
                  value={bulkBasic}
                  onChange={(e) => setBulkBasic(e.target.value)}
                  min={0}
                />
              </label>

              <label>
                <span>Allowances (₹)</span>
                <input
                  type="number"
                  placeholder="e.g. 3000"
                  value={bulkAllowance}
                  onChange={(e) => setBulkAllowance(e.target.value)}
                  min={0}
                />
              </label>

              <label>
                <span>Bonus (₹)</span>
                <input
                  type="number"
                  placeholder="e.g. 0"
                  value={bulkBonus}
                  onChange={(e) => setBulkBonus(e.target.value)}
                  min={0}
                />
              </label>

              <label>
                <span>Regular Deduction (₹)</span>
                <input
                  type="number"
                  placeholder="e.g. 500"
                  value={bulkDeduction}
                  onChange={(e) => setBulkDeduction(e.target.value)}
                  min={0}
                />
              </label>

              <label>
                <span>Attendance Mode</span>
                <select
                  value={bulkAttendanceMode}
                  onChange={(e) => setBulkAttendanceMode(e.target.value as any)}
                >
                  <option value="keep">Keep Current Method</option>
                  <option value="punch">Teacher Punch (GPS / Wi-Fi)</option>
                  <option value="manual">Admin Marks Attendance</option>
                  <option value="none">Salary Only (No Attendance)</option>
                </select>
              </label>

              <label>
                <span>Reason / Note</span>
                <input
                  type="text"
                  placeholder="e.g. Annual revision"
                  value={bulkReason}
                  onChange={(e) => setBulkReason(e.target.value)}
                />
              </label>
            </div>

            <div className="salary-bulk-actions">
              <Button
                onClick={() => applyBulkToSelected(selectedIds)}
              >
                Apply to Selected ({selectedIds.length} Staff)
              </Button>
            </div>
          </div>
        )}
      </Panel>

      {/* Main Staff Salary Table */}
      <Panel>
        <LoadingOverlay loading={loading} label="Loading staff salary structures…">
          {error ? (
            <div className="salary-setup-error">
              <AlertCircle size={20} />
              <p>{error}</p>
              <Button variant="secondary" onClick={loadData}>
                Retry
              </Button>
            </div>
          ) : visibleRows.length === 0 ? (
            <EmptyState
              title="No staff members found"
              description="No staff members match the selected department, status or search filters."
            />
          ) : (
            <div className="table-wrap salary-setup-table-wrap">
              <table className="salary-setup-table">
                <thead>
                  <tr>
                    <th style={{ width: 44 }}>
                      <input
                        type="checkbox"
                        aria-label="Select all visible staff"
                        checked={
                          visibleRows.length > 0 &&
                          visibleRows.every((r) => selectedIds.includes(r.staff.id))
                        }
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedIds(visibleRows.map((r) => r.staff.id));
                          } else {
                            setSelectedIds([]);
                          }
                        }}
                      />
                    </th>
                    <th style={{ minWidth: 220 }}>Staff Member</th>
                    <th style={{ width: 140 }}>Basic Salary (₹)</th>
                    <th style={{ width: 130 }}>Allowances (₹)</th>
                    <th style={{ width: 120 }}>Bonus (₹)</th>
                    <th style={{ width: 130 }}>Deductions (₹)</th>
                    <th style={{ width: 150 }}>Net Salary</th>
                    <th style={{ width: 180 }}>Attendance Mode</th>
                    <th style={{ width: 110 }}>Status</th>
                    <th style={{ width: 160, textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map((row) => {
                    const basicPaise = toPaise(row.basic);
                    const allowancePaise = toPaise(row.allowance);
                    const bonusPaise = toPaise(row.bonus);
                    const deductionPaise = toPaise(row.deduction);
                    const netPaise = Math.max(0, basicPaise + allowancePaise + bonusPaise - deductionPaise);
                    const isSelected = selectedIds.includes(row.staff.id);
                    const isSavingThis = savingId === row.staff.id;

                    return (
                      <tr
                        key={row.staff.id}
                        className={`${row.dirty ? 'row-dirty' : ''} ${isSelected ? 'row-selected' : ''}`}
                      >
                        <td>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            aria-label={`Select ${row.staff.name}`}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedIds((prev) => [...prev, row.staff.id]);
                              } else {
                                setSelectedIds((prev) => prev.filter((id) => id !== row.staff.id));
                              }
                            }}
                          />
                        </td>
                        <td>
                          <div className="salary-staff-profile">
                            <Avatar name={row.staff.name} />
                            <div className="salary-staff-info">
                              <strong>{row.staff.name}</strong>
                              <span className="staff-meta">
                                {row.staff.code ? `#${row.staff.code} · ` : ''}
                                {row.staff.designation || (row.staff.teaching ? 'Teacher' : 'Staff')}
                              </span>
                              {row.staff.department && (
                                <span className="dept-tag">{row.staff.department}</span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td>
                          <input
                            type="number"
                            className="salary-inline-input"
                            placeholder="0"
                            min={0}
                            value={row.basic}
                            onChange={(e) => updateRowField(row.staff.id, 'basic', e.target.value)}
                            aria-label={`Basic salary for ${row.staff.name}`}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            className="salary-inline-input"
                            placeholder="0"
                            min={0}
                            value={row.allowance}
                            onChange={(e) => updateRowField(row.staff.id, 'allowance', e.target.value)}
                            aria-label={`Allowances for ${row.staff.name}`}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            className="salary-inline-input"
                            placeholder="0"
                            min={0}
                            value={row.bonus}
                            onChange={(e) => updateRowField(row.staff.id, 'bonus', e.target.value)}
                            aria-label={`Bonus for ${row.staff.name}`}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            className="salary-inline-input"
                            placeholder="0"
                            min={0}
                            value={row.deduction}
                            onChange={(e) => updateRowField(row.staff.id, 'deduction', e.target.value)}
                            aria-label={`Deductions for ${row.staff.name}`}
                          />
                        </td>
                        <td>
                          <div className="salary-net-display">
                            <strong>{formatRupees(netPaise)}</strong>
                            <small className="muted">/ month</small>
                          </div>
                        </td>
                        <td>
                          <select
                            className="salary-inline-select"
                            value={row.attendanceMode}
                            onChange={(e) => updateRowField(row.staff.id, 'attendanceMode', e.target.value)}
                            aria-label={`Attendance mode for ${row.staff.name}`}
                          >
                            <option value="punch">Teacher Punch (GPS)</option>
                            <option value="manual">Admin Attendance</option>
                            <option value="none">Salary Only</option>
                          </select>
                        </td>
                        <td>
                          {row.dirty ? (
                            <Badge tone="blue">Unsaved</Badge>
                          ) : row.configured ? (
                            <Badge tone="present">Configured</Badge>
                          ) : (
                            <Badge tone="amber">Pending</Badge>
                          )}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div className="salary-row-actions">
                            {row.dirty && (
                              <Button
                                onClick={() => saveSingleRow(row.staff.id)}
                                disabled={isSavingThis}
                              >
                                {isSavingThis ? 'Saving…' : 'Save'}
                              </Button>
                            )}
                            <Button
                              variant="secondary"
                              onClick={() => setEditingStaff(row.staff)}
                              title="Full employment & history details"
                            >
                              Details
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </LoadingOverlay>
      </Panel>

      {/* Deep Details / Employment Dialog */}
      {editingStaff && adapter && (
        <EmploymentDialog
          adapter={adapter}
          staff={editingStaff}
          employment={rowsById[editingStaff.id]?.employment}
          month={month}
          canLink={permissions.includes('staff.manage')}
          close={() => setEditingStaff(null)}
          saved={() => {
            setEditingStaff(null);
            void loadData();
          }}
        />
      )}
    </div>
  );
}
