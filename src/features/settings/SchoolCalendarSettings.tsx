import { useState } from 'react';
import { Button, Modal } from '../../components/ui/Primitives';
import { useFeedback } from '../../app/useFeedback';
import {
  getFestivalForDate,
  getSavedHolidays,
  getCustomHolidayTitles,
  saveHolidayDates,
} from '../../lib/indianHolidays';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import './school-calendar.css';

interface SchoolCalendarSettingsProps {
  initialHolidays?: string[];
  workingDays?: number[]; // [1, 2, 3, 4, 5, 6] (0 = Sun, 1 = Mon, etc.)
  onSave?: (holidays: string[]) => Promise<void> | void;
  canManage?: boolean;
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function SchoolCalendarSettings({
  initialHolidays = [],
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

  // Month navigation calculations
  const [yearNum, monthNum] = currentMonth.split('-').map(Number);
  const daysInMonth = new Date(yearNum, monthNum, 0).getDate();
  const firstDayOfWeek = (new Date(yearNum, monthNum - 1, 1).getDay() + 6) % 7; // 0 for Monday

  const monthLabel = new Date(yearNum, monthNum - 1, 1).toLocaleString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  function prevMonth() {
    const d = new Date(yearNum, monthNum - 2, 1);
    setCurrentMonth(d.toISOString().slice(0, 7));
  }

  function nextMonth() {
    const d = new Date(yearNum, monthNum, 1);
    setCurrentMonth(d.toISOString().slice(0, 7));
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
          <h2
            style={{
              fontSize: '18px',
              fontWeight: 600,
              color: 'var(--text, #0f172a)',
              margin: 0,
              minWidth: '150px',
            }}
          >
            {monthLabel}
          </h2>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              background: 'var(--surface-muted, #f1f5f9)',
              borderRadius: '6px',
              padding: '2px',
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
                borderRadius: '4px',
                padding: '6px 8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                color: 'var(--text, #334155)',
              }}
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              onClick={goToToday}
              className="calendar-nav-btn"
              style={{
                background: 'transparent',
                border: 'none',
                borderRadius: '4px',
                padding: '4px 8px',
                fontSize: '12px',
                fontWeight: 500,
                cursor: 'pointer',
                color: 'var(--muted, #475569)',
              }}
            >
              Today
            </button>
            <button
              type="button"
              onClick={nextMonth}
              aria-label="Next Month"
              className="calendar-nav-btn"
              style={{
                background: 'transparent',
                border: 'none',
                borderRadius: '4px',
                padding: '6px 8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                color: 'var(--text, #334155)',
              }}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        {canManage && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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
                minHeight: '105px',
              }}
            />
          ))}

          {/* Month Day Cells */}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const dayNum = i + 1;
            const dateStr = `${currentMonth}-${String(dayNum).padStart(2, '0')}`;
            const dayOfWeek = new Date(yearNum, monthNum - 1, dayNum).getDay();
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
                  background: isToday ? '#f0fdf4' : '#ffffff',
                  minHeight: '105px',
                  padding: '8px',
                  cursor: canManage ? 'pointer' : 'default',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                  outline: isToday ? '2px solid #10b981' : undefined,
                  outlineOffset: '-2px',
                  position: 'relative',
                  transition: 'background 0.15s ease',
                }}
                className="calendar-day-cell"
                title={canManage ? 'Click to manage holiday' : undefined}
              >
                {/* Date Number Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span
                    style={{
                      fontSize: '13px',
                      fontWeight: isToday ? 700 : 500,
                      color: isToday ? '#15803d' : isSunday ? '#ef4444' : '#1e293b',
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
                        padding: '1px 5px',
                        borderRadius: '4px',
                        lineHeight: 1.2,
                      }}
                    >
                      Today
                    </span>
                  )}
                </div>

                {/* Festival / National Holiday Tag */}
                {festival && (
                  <div
                    style={{
                      fontSize: '11px',
                      fontWeight: 500,
                      padding: '3px 6px',
                      borderRadius: '4px',
                      background: festival.type === 'national' ? '#dcfce7' : '#fef3c7',
                      color: festival.type === 'national' ? '#166534' : '#92400e',
                      border: festival.type === 'national' ? '1px solid #bbf7d0' : '1px solid #fde68a',
                      lineHeight: 1.25,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                    title={festival.title}
                  >
                    {festival.title}
                  </div>
                )}

                {/* Custom School Holiday Tag */}
                {isCustomHoliday && (
                  <div
                    style={{
                      fontSize: '11px',
                      fontWeight: 500,
                      padding: '3px 6px',
                      borderRadius: '4px',
                      background: '#ede9fe',
                      color: '#5b21b6',
                      border: '1px solid #ddd6fe',
                      lineHeight: 1.25,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                    title={customTitle || 'School Holiday'}
                  >
                    🏫 {customTitle || 'School Holiday'}
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
    </div>
  );
}
