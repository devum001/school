import { useState, useEffect, useMemo } from 'react';
import { Button, Modal } from '../../components/ui/Primitives';
import { useFeedback } from '../../app/useFeedback';
import {
  getFestivalForDate,
  getSavedHolidays,
  getCustomHolidayTitles,
  saveHolidayDates,
  fetchHolidaysFromCloud,
  getCachedCloudFestivals,
  getAllFestivalsForYear,
} from '../../lib/indianHolidays';
import { ChevronLeft, ChevronRight, Plus, CloudDownload, Download } from 'lucide-react';
import './school-calendar.css';

interface SchoolCalendarSettingsProps {
  initialHolidays?: string[];
  workingDays?: string[]; // e.g. ['Monday', 'Tuesday', 'Wednesday', 'Thursday']
  onSave?: (holidays: string[]) => Promise<void> | void;
  canManage?: boolean;
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function SchoolCalendarSettings({
  initialHolidays = [],
  workingDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  onSave,
  canManage = true,
}: SchoolCalendarSettingsProps) {
  const notify = useFeedback();
  const todayStr = new Date().toISOString().slice(0, 10);
  const [currentMonth, setCurrentMonth] = useState(todayStr.slice(0, 7)); // 'YYYY-MM'
  const [holidays, setHolidays] = useState<string[]>(() => {
    if (initialHolidays && initialHolidays.length > 0) return initialHolidays;
    return getSavedHolidays();
  });
  const [customTitles, setCustomTitles] = useState<Record<string, string>>(() => {
    return getCustomHolidayTitles();
  });

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [modalTitle, setModalTitle] = useState('');
  const [rangeModalOpen, setRangeModalOpen] = useState(false);
  const [rangeStart, setRangeStart] = useState('');
  const [rangeEnd, setRangeEnd] = useState('');
  const [rangeTitle, setRangeTitle] = useState('School Vacation');
  const [saving, setSaving] = useState(false);
  const [syncingCloud, setSyncingCloud] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [selectedImportDates, setSelectedImportDates] = useState<string[]>([]);
  const [, setCloudSyncVersion] = useState(0);

  // Month navigation calculations
  const [yearNum, monthNum] = currentMonth.split('-').map(Number);
  const daysInMonth = new Date(yearNum, monthNum, 0).getDate();
  const firstDayOfWeek = (new Date(yearNum, monthNum - 1, 1).getDay() + 6) % 7; // 0 for Monday

  // Background auto-sync: automatically check and cache holidays for the active year without blocking UI
  useEffect(() => {
    const cached = getCachedCloudFestivals(yearNum);
    if (!cached || Object.keys(cached).length === 0) {
      void fetchHolidaysFromCloud(yearNum).then(() => {
        setCloudSyncVersion((v) => v + 1);
      });
    }
  }, [yearNum]);

  // Listen for background updates
  useEffect(() => {
    function onCloudUpdated() {
      setCloudSyncVersion((v) => v + 1);
    }
    window.addEventListener('schoolwell_cloud_festivals_updated', onCloudUpdated);
    return () => window.removeEventListener('schoolwell_cloud_festivals_updated', onCloudUpdated);
  }, []);

  const yearFestivalsList = useMemo(() => {
    return getAllFestivalsForYear(yearNum);
  }, [yearNum, currentMonth]);

  const monthLabel = new Date(yearNum, monthNum - 1, 1).toLocaleString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  function prevMonth() {
    let y = yearNum;
    let m = monthNum - 1;
    if (m < 1) {
      m = 12;
      y -= 1;
    }
    setCurrentMonth(`${y}-${String(m).padStart(2, '0')}`);
  }

  function nextMonth() {
    let y = yearNum;
    let m = monthNum + 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
    setCurrentMonth(`${y}-${String(m).padStart(2, '0')}`);
  }

  function goToToday() {
    setCurrentMonth(todayStr.slice(0, 7));
  }

  // Click on a calendar day
  function handleDateClick(dateStr: string) {
    if (!canManage) return;
    const isHoliday = holidays.includes(dateStr);
    const existingTitle = customTitles[dateStr] || getFestivalForDate(dateStr)?.title || 'School Holiday';
    setSelectedDate(dateStr);
    setModalTitle(isHoliday ? existingTitle : existingTitle);
  }

  // Toggle or update single holiday
  function handleSaveSingleDate() {
    if (!selectedDate) return;
    const isCurrentlyHoliday = holidays.includes(selectedDate);
    let nextHolidays: string[];
    let nextTitles = { ...customTitles };

    if (isCurrentlyHoliday && !modalTitle.trim()) {
      // Remove holiday
      nextHolidays = holidays.filter((d) => d !== selectedDate);
      delete nextTitles[selectedDate];
    } else {
      // Add or update holiday
      if (!isCurrentlyHoliday) {
        nextHolidays = [...holidays, selectedDate].sort();
      } else {
        nextHolidays = [...holidays];
      }
      if (modalTitle.trim()) {
        nextTitles[selectedDate] = modalTitle.trim();
      }
    }

    setCustomTitles(nextTitles);
    setHolidays(nextHolidays);
    setSelectedDate(null);
    saveHolidayDates(nextHolidays, nextTitles);
    try {
      void onSave?.(nextHolidays);
    } catch {}
    notify(`Holiday updated for ${selectedDate}.`);
  }

  function handleRemoveHoliday(dateStr: string) {
    const nextHolidays = holidays.filter((d) => d !== dateStr);
    const nextTitles = { ...customTitles };
    delete nextTitles[dateStr];
    setCustomTitles(nextTitles);
    setHolidays(nextHolidays);
    setSelectedDate(null);
    saveHolidayDates(nextHolidays, nextTitles);
    try {
      void onSave?.(nextHolidays);
    } catch {}
    notify(`Removed holiday for ${dateStr}.`);
  }

  // Add multi-day holiday / vacation range
  function handleAddRange() {
    if (!rangeStart || !rangeEnd || rangeStart > rangeEnd) {
      notify('Please select a valid date range.');
      return;
    }

    const datesToAdd: string[] = [];
    const curr = new Date(rangeStart);
    const end = new Date(rangeEnd);

    while (curr <= end) {
      datesToAdd.push(curr.toISOString().slice(0, 10));
      curr.setDate(curr.getDate() + 1);
    }

    const uniqueSet = new Set([...holidays, ...datesToAdd]);
    const nextHolidays = Array.from(uniqueSet).sort();

    const nextTitles = { ...customTitles };
    for (const d of datesToAdd) {
      nextTitles[d] = rangeTitle.trim() || 'School Vacation';
    }

    setCustomTitles(nextTitles);
    setHolidays(nextHolidays);
    saveHolidayDates(nextHolidays, nextTitles);
    try {
      void onSave?.(nextHolidays);
    } catch {}

    setRangeModalOpen(false);
    setRangeStart('');
    setRangeEnd('');
    notify(`Added vacation range (${datesToAdd.length} days).`);
  }

  // Persist holidays to backend / settings
  async function handlePersistAll() {
    saveHolidayDates(holidays, customTitles);
    if (!onSave) {
      notify('School calendar & holidays saved locally!');
      return;
    }
    setSaving(true);
    try {
      await onSave(holidays);
      notify('School calendar & holidays saved successfully!');
    } catch (err: any) {
      notify(err?.message || 'Failed to save calendar settings.');
    } finally {
      setSaving(false);
    }
  }

  // Explicit sync from cloud API / database
  async function handleSyncOnlineHolidays() {
    setSyncingCloud(true);
    try {
      const res = await fetchHolidaysFromCloud(yearNum);
      setCloudSyncVersion((v) => v + 1);
      notify(
        `Synced ${res.count} government holidays & festivals for ${yearNum}! (${
          res.source === 'api' ? 'Official Online Feed' : 'Verified Offline Database'
        })`,
      );
    } catch (err: any) {
      notify(err?.message || 'Failed to sync online holidays.');
    } finally {
      setSyncingCloud(false);
    }
  }

  // Open batch import modal
  function handleOpenImportModal() {
    const unimported = yearFestivalsList
      .filter((f) => !holidays.includes(f.date))
      .map((f) => f.date);
    // Pre-select unimported or all
    setSelectedImportDates(unimported.length > 0 ? unimported : yearFestivalsList.map((f) => f.date));
    setImportModalOpen(true);
  }

  // Confirm batch import
  function handleConfirmImportHolidays() {
    if (selectedImportDates.length === 0) return;
    const festMap = new Map(yearFestivalsList.map((f) => [f.date, f.title]));
    const nextHolidays = Array.from(new Set([...holidays, ...selectedImportDates])).sort();
    const nextTitles = { ...customTitles };

    selectedImportDates.forEach((d) => {
      if (!nextTitles[d]) {
        nextTitles[d] = festMap.get(d) || 'School Holiday';
      }
    });

    setHolidays(nextHolidays);
    setCustomTitles(nextTitles);
    saveHolidayDates(nextHolidays, nextTitles);
    try {
      void onSave?.(nextHolidays);
    } catch {}

    setImportModalOpen(false);
    notify(`Imported ${selectedImportDates.length} holidays into school calendar!`);
  }

  return (
    <div className="school-calendar-settings">
      {/* Sleek Toolbar: Month Switcher & Actions */}
      <div
        className="calendar-toolbar"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          paddingBottom: '14px',
          borderBottom: '1px solid var(--border, #e2e8f0)',
        }}
      >
        {/* Month Navigator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              background: 'var(--surface-muted, #f1f5f9)',
              borderRadius: '8px',
              border: '1px solid var(--border, #e2e8f0)',
              padding: '3px 4px',
              gap: '2px',
            }}
          >
            <button
              type="button"
              onClick={prevMonth}
              aria-label="Previous Month"
              className="calendar-nav-btn"
              style={{
                background: 'transparent',
                border: 'none',
                borderRadius: '6px',
                padding: '6px 8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text, #334155)',
              }}
            >
              <ChevronLeft size={16} />
            </button>
            <span
              style={{
                fontSize: '14px',
                fontWeight: 600,
                color: 'var(--text, #0f172a)',
                padding: '2px 14px',
                minWidth: '130px',
                textAlign: 'center',
                userSelect: 'none',
              }}
            >
              {monthLabel}
            </span>
            <button
              type="button"
              onClick={nextMonth}
              aria-label="Next Month"
              className="calendar-nav-btn"
              style={{
                background: 'transparent',
                border: 'none',
                borderRadius: '6px',
                padding: '6px 8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text, #334155)',
              }}
            >
              <ChevronRight size={16} />
            </button>
          </div>
          {currentMonth !== todayStr.slice(0, 7) && (
            <button
              type="button"
              onClick={goToToday}
              className="calendar-nav-btn"
              style={{
                background: 'var(--surface, #ffffff)',
                border: '1px solid var(--border, #cbd5e1)',
                borderRadius: '6px',
                padding: '5px 12px',
                fontSize: '12px',
                fontWeight: 500,
                cursor: 'pointer',
                color: 'var(--muted, #475569)',
              }}
            >
              Today
            </button>
          )}
        </div>

        {/* Action Buttons */}
        {canManage && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <Button
              variant="secondary"
              onClick={handleSyncOnlineHolidays}
              disabled={syncingCloud}
              title={`Sync latest approved government holidays and festivals from cloud for ${yearNum}`}
            >
              <CloudDownload size={15} style={{ marginRight: 6 }} />
              {syncingCloud ? 'Syncing...' : 'Auto-Sync Holidays'}
            </Button>
            <Button
              variant="secondary"
              onClick={handleOpenImportModal}
              title={`Import all or selected government & festival holidays for ${yearNum} as official school holidays in 1 click`}
            >
              <Download size={15} style={{ marginRight: 6 }} />
              Import Govt Holidays
            </Button>
            <Button variant="secondary" onClick={() => setRangeModalOpen(true)}>
              <Plus size={15} style={{ marginRight: 4 }} />
              Add Vacation Range
            </Button>
            {onSave && (
              <Button onClick={handlePersistAll} disabled={saving}>
                {saving ? 'Saving…' : 'Save Calendar'}
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Calendar Grid Container */}
      <div
        className="school-calendar-grid-wrap"
        style={{
          border: '1px solid var(--border, #e2e8f0)',
          borderRadius: '8px',
          overflow: 'hidden',
          background: 'var(--border, #e2e8f0)',
          display: 'flex',
          flexDirection: 'column',
          gap: '1px',
        }}
      >
        {/* Days of Week Header */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            background: 'var(--surface-muted, #f8fafc)',
            textAlign: 'center',
            fontWeight: 600,
            fontSize: '12px',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            color: 'var(--muted, #64748b)',
            padding: '10px 0',
          }}
        >
          {WEEKDAYS.map((day) => (
            <div key={day} style={{ color: day === 'Sun' ? '#ef4444' : undefined }}>
              {day}
            </div>
          ))}
        </div>

        {/* Days Matrix */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            gap: '1px',
            background: 'var(--border, #e2e8f0)',
          }}
        >
          {/* Empty cells for leading offset */}
          {Array.from({ length: firstDayOfWeek }).map((_, i) => (
            <div
              key={`empty-${i}`}
              style={{
                background: 'var(--surface-subtle, #f8fafc)',
                minHeight: '115px',
              }}
            />
          ))}

          {/* Month Day Cells */}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const dayNum = i + 1;
            const dateStr = `${currentMonth}-${String(dayNum).padStart(2, '0')}`;
            const dayDate = new Date(yearNum, monthNum - 1, dayNum);
            const dayOfWeek = dayDate.getDay();
            const dayName = dayDate.toLocaleDateString('en-US', { weekday: 'long' });
            const isWorkingDay = workingDays.includes(dayName);
            const isWeeklyOff = !isWorkingDay;
            const isToday = dateStr === todayStr;
            const isSunday = dayOfWeek === 0;
            const isCustomHoliday = holidays.includes(dateStr);
            const festival = getFestivalForDate(dateStr);
            const customTitle = customTitles[dateStr];

            return (
              <div
                key={dateStr}
                onClick={() => handleDateClick(dateStr)}
                style={{
                  background: isToday ? '#f0fdf4' : isWeeklyOff ? '#f8fafc' : '#ffffff',
                  minHeight: '115px',
                  padding: '10px 12px',
                  cursor: canManage ? 'pointer' : 'default',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  outline: isToday ? '2px solid #10b981' : undefined,
                  outlineOffset: '-2px',
                  position: 'relative',
                  transition: 'background 0.15s ease',
                  boxSizing: 'border-box',
                }}
                className={`calendar-day-cell ${isWeeklyOff ? 'is-weekly-off' : ''}`}
                title={canManage ? (isWeeklyOff ? 'Weekly off (Click to manage custom holiday)' : 'Click to manage holiday') : undefined}
              >
                {/* Date Number Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                  <span
                    style={{
                      fontSize: '14px',
                      fontWeight: isToday ? 700 : 600,
                      color: isToday ? '#15803d' : isSunday ? '#ef4444' : isWeeklyOff ? '#64748b' : '#1e293b',
                    }}
                  >
                    {dayNum}
                  </span>
                  {isToday && (
                    <span
                      style={{
                        fontSize: '10px',
                        fontWeight: 600,
                        background: '#10b981',
                        color: '#ffffff',
                        padding: '1px 6px',
                        borderRadius: '4px',
                        lineHeight: 1.2,
                      }}
                    >
                      Today
                    </span>
                  )}
                </div>

                {/* Non-working / Weekly Off Tag from School Timing */}
                {isWeeklyOff && (
                  <div
                    style={{
                      fontSize: '11.5px',
                      fontWeight: 500,
                      padding: '4px 8px',
                      borderRadius: '6px',
                      background: '#f1f5f9',
                      color: '#475569',
                      border: '1px solid #e2e8f0',
                      lineHeight: 1.3,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      boxSizing: 'border-box',
                    }}
                    title="Weekly Off (Non-working day in School Timing)"
                  >
                    Weekly Off
                  </div>
                )}

                {/* Manually Marked School Holiday */}
                {isCustomHoliday && (
                  <div
                    style={{
                      fontSize: '11.5px',
                      fontWeight: 600,
                      padding: '4px 8px',
                      borderRadius: '6px',
                      background: '#ede9fe',
                      color: '#5b21b6',
                      border: '1px solid #ddd6fe',
                      lineHeight: 1.3,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      boxSizing: 'border-box',
                    }}
                    title={customTitle || festival?.title || 'School Holiday'}
                  >
                    🏫 {customTitle || festival?.title || 'School Holiday'}
                  </div>
                )}

                {/* Festival Tag: If not manually marked, show as informational notice (not a school holiday until marked) */}
                {festival && !isCustomHoliday && (
                  <div
                    style={{
                      fontSize: '11px',
                      fontWeight: 500,
                      padding: '4px 8px',
                      borderRadius: '6px',
                      background: '#fffbeb',
                      color: '#92400e',
                      border: '1px dashed #fde68a',
                      lineHeight: 1.3,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      boxSizing: 'border-box',
                    }}
                    title={`${festival.title} (Festival info · Not marked as school holiday)`}
                  >
                    🎉 {festival.title}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Single Day Click Modal */}
      {selectedDate && (
        <Modal
          open
          title={`Manage Holiday · ${selectedDate}`}
          description="Mark as school holiday or update leave details for this date."
          onClose={() => setSelectedDate(null)}
        >
          <div style={{ margin: '16px 0', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '14px', fontWeight: 500 }}>
              Holiday Reason / Title
              <input
                type="text"
                value={modalTitle}
                onChange={(e) => setModalTitle(e.target.value)}
                placeholder="e.g. Founder's Day / Exam Prep Off / Local Festival"
                className="form-input"
                style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #d1d5db' }}
              />
            </label>
            {getFestivalForDate(selectedDate) && (
              <div style={{ fontSize: '13px', background: '#fef3c7', padding: '8px 12px', borderRadius: '6px', color: '#92400e' }}>
                🎉 Pre-marked Festival: <strong>{getFestivalForDate(selectedDate)?.title}</strong>
              </div>
            )}
          </div>
          <div className="modal-actions" style={{ display: 'flex', justifyContent: 'space-between', gap: '10px' }}>
            {holidays.includes(selectedDate) ? (
              <Button variant="danger" onClick={() => handleRemoveHoliday(selectedDate)}>
                Remove Holiday
              </Button>
            ) : <div />}
            <div style={{ display: 'flex', gap: '8px' }}>
              <Button variant="secondary" onClick={() => setSelectedDate(null)}>
                Cancel
              </Button>
              <Button onClick={handleSaveSingleDate}>
                {holidays.includes(selectedDate) ? 'Update Title' : 'Mark as Holiday'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Multi-day Vacation Range Modal */}
      {rangeModalOpen && (
        <Modal
          open
          title="Add School Vacation / Holiday Range"
          description="Add a range of consecutive dates as holidays (e.g., Summer/Winter Vacation)."
          onClose={() => setRangeModalOpen(false)}
        >
          <div style={{ margin: '16px 0', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '14px', fontWeight: 500 }}>
              Vacation Title
              <input
                type="text"
                value={rangeTitle}
                onChange={(e) => setRangeTitle(e.target.value)}
                placeholder="e.g. Winter Break / Diwali Vacation"
                className="form-input"
                style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #d1d5db' }}
              />
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '14px', fontWeight: 500 }}>
                Start Date
                <input
                  type="date"
                  value={rangeStart}
                  onChange={(e) => setRangeStart(e.target.value)}
                  className="form-input"
                  style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #d1d5db' }}
                />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '14px', fontWeight: 500 }}>
                End Date
                <input
                  type="date"
                  value={rangeEnd}
                  onChange={(e) => setRangeEnd(e.target.value)}
                  className="form-input"
                  style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #d1d5db' }}
                />
              </label>
            </div>
          </div>
          <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <Button variant="secondary" onClick={() => setRangeModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddRange}>Add Vacation Dates</Button>
          </div>
        </Modal>
      )}

      {/* Batch Import Government & Festival Holidays Modal */}
      {importModalOpen && (
        <Modal
          open
          title={`Import ${yearNum} Government & Festival Holidays`}
          description={`Select which official gazetted holidays & festivals to mark as closed school holidays for ${yearNum}. Staff & student attendance registers will automatically treat these as school holidays.`}
          onClose={() => setImportModalOpen(false)}
        >
          <div style={{ margin: '14px 0', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text, #1e293b)' }}>
                {selectedImportDates.length} of {yearFestivalsList.length} holidays selected
              </span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setSelectedImportDates(yearFestivalsList.map((f) => f.date))}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: 'var(--primary, #059669)',
                    cursor: 'pointer',
                    padding: 0,
                  }}
                >
                  Select All
                </button>
                <span style={{ color: '#cbd5e1' }}>|</span>
                <button
                  type="button"
                  onClick={() => setSelectedImportDates([])}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: '12px',
                    fontWeight: 500,
                    color: 'var(--muted, #64748b)',
                    cursor: 'pointer',
                    padding: 0,
                  }}
                >
                  Clear All
                </button>
              </div>
            </div>

            <div
              style={{
                maxHeight: '320px',
                overflowY: 'auto',
                border: '1px solid var(--border, #e2e8f0)',
                borderRadius: '8px',
                padding: '6px',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                background: 'var(--surface-subtle, #f8fafc)',
              }}
            >
              {yearFestivalsList.map((fest) => {
                const isSelected = selectedImportDates.includes(fest.date);
                const isAlreadyHoliday = holidays.includes(fest.date);
                const [y, m, d] = fest.date.split('-').map(Number);
                const formattedDate = new Date(y, m - 1, d).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  weekday: 'short',
                });

                return (
                  <label
                    key={fest.date}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 10px',
                      borderRadius: '6px',
                      background: isSelected ? '#ffffff' : 'transparent',
                      border: isSelected ? '1px solid #cbd5e1' : '1px solid transparent',
                      cursor: 'pointer',
                      transition: 'background 0.1s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedImportDates((prev) => [...prev, fest.date]);
                          } else {
                            setSelectedImportDates((prev) => prev.filter((d) => d !== fest.date));
                          }
                        }}
                        style={{ cursor: 'pointer', width: '15px', height: '15px' }}
                      />
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b' }}>
                          {fest.type === 'national' ? '🇮🇳 ' : '🎉 '}
                          {fest.title}
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>
                          {formattedDate} ({fest.date})
                        </div>
                      </div>
                    </div>
                    <div>
                      {isAlreadyHoliday ? (
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 500,
                            padding: '2px 6px',
                            borderRadius: '4px',
                            background: '#ede9fe',
                            color: '#6d28d9',
                          }}
                        >
                          Already marked
                        </span>
                      ) : (
                        <span
                          style={{
                            fontSize: '10.5px',
                            fontWeight: 500,
                            padding: '2px 6px',
                            borderRadius: '4px',
                            background: fest.type === 'national' ? '#ecfdf5' : '#fffbeb',
                            color: fest.type === 'national' ? '#047857' : '#b45309',
                          }}
                        >
                          {fest.type === 'national' ? 'National' : 'Gazetted'}
                        </span>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '8px',
                marginTop: '12px',
                paddingTop: '10px',
                borderTop: '1px solid var(--border, #e2e8f0)',
              }}
            >
              <Button variant="secondary" onClick={() => setImportModalOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleConfirmImportHolidays} disabled={selectedImportDates.length === 0}>
                Import {selectedImportDates.length} Holidays
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
