import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { HrAdapter, HrWorkspace } from '../../services/hrService';
import { formatCalendarDate, titleCase } from '../../lib/displayFormat';
import {
  attendanceLabel,
  cancellableLeaveOn,
  canRequestArs,
  pendingLeaveOn,
} from './attendanceCalendarModel';
import CancelLeaveDialog from './CancelLeaveDialog';
import AttendanceDayDetail from './AttendanceDayDetail';
import ArsRequestDialog from './ArsRequestDialog';
import { Button, PickerInput } from '../../components/ui/Primitives';
import { isDateHoliday } from '../../lib/indianHolidays';
import './hr-personal-calendar.css';

const legends = [
  ['present', 'Present'],
  ['late', 'Late'],
  ['leave', 'On leave'],
  ['absent', 'Absent'],
  ['half-day', 'Half day'],
  ['holiday', 'School holiday'],
  ['off', 'Weekly off'],
  ['invalid', 'Invalid'],
];

function cellStatusLabel(state: string, holidayTitle?: string): string | null {
  switch (state) {
    case 'late':
      return 'Late';
    case 'leave':
      return 'On leave';
    case 'absent':
      return 'Absent';
    case 'half-day':
    case 'half-day-leave':
      return 'Half day';
    case 'holiday':
      return holidayTitle || 'School holiday';
    case 'off':
      return 'Weekly off';
    case 'invalid':
    case 'review':
      return 'Invalid';
    case 'present':
      return 'Present';
    default:
      return null;
  }
}

export default function AttendanceCalendar({
  data,
  month,
  onMonthChange,
  onRequestLeave,
  ars,
  hideMonthNavigation = false,
}: {
  data: HrWorkspace;
  month: string;
  label?: string;
  onMonthChange?: (month: string) => void;
  onRequestLeave?: () => void;
  ars?: { adapter: HrAdapter; saved: () => void };
  hideMonthNavigation?: boolean;
}) {
  const [selected, setSelected] = useState(
    data.today.startsWith(month) ? data.today : `${month}-01`,
  );
  const [requestDate, setRequestDate] = useState<string>();
  const [cancelLeave, setCancelLeave] = useState<HrWorkspace['leaves'][number]>();
  const [, setHolidayRev] = useState(0);

  useEffect(() => {
    const handleHolidayChange = () => setHolidayRev((r) => r + 1);
    window.addEventListener('schoolwell_holidays_changed', handleHolidayChange);
    return () => window.removeEventListener('schoolwell_holidays_changed', handleHolidayChange);
  }, []);

  const [year, m] = month.split('-').map(Number);
  const count = new Date(Date.UTC(year, m, 0)).getUTCDate();
  const offset = (new Date(Date.UTC(year, m - 1, 1)).getUTCDay() + 6) % 7;
  const date = selected.startsWith(month) ? selected : `${month}-01`;
  const day = data.attendance.find((d) => d.date === date);
  const status = attendanceLabel(date, data.today, day, data.leaves, data.settings);
  const selectedHoliday = isDateHoliday(date, data.settings?.holidays);
  const requests = data.attendanceRequests ?? [];
  const pending = requests.some((r) => r.date === date && r.status === 'pending');
  const requestDay = data.attendance.find((d) => d.date === requestDate);
  const activeLeaveOnSelected = cancellableLeaveOn(date, data.today, data.leaves);

  const monthFormatted = new Intl.DateTimeFormat('en-IN', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, m - 1, 1)));

  const dateRecord = data.attendance.find((d) => d.date === date);
  const dateEffectiveDay = dateRecord ?? (
    ['half-day', 'invalid', 'absent'].includes(status)
      ? { date, status: status as 'half-day' | 'invalid' | 'absent' }
      : undefined
  );
  const canSubmitArs = Boolean(
    ars && canRequestArs(dateEffectiveDay, data.today, requests, data.settings?.holidays)
  );

  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(() =>
    typeof document !== 'undefined' ? document.getElementById('hr-self-ars-portal-slot') : null
  );

  useEffect(() => {
    if (!portalTarget) {
      const id = requestAnimationFrame(() => {
        setPortalTarget(document.getElementById('hr-self-ars-portal-slot'));
      });
      return () => cancelAnimationFrame(id);
    }
  }, [portalTarget]);

  const renderSubmitArsButton = (isDesktop: boolean) => (
    <button
      type="button"
      className={`hr-submit-ars-btn ${isDesktop ? 'hr-submit-ars-desktop' : 'hr-submit-ars-mobile'} ${
        canSubmitArs ? 'is-active' : 'is-disabled'
      }`}
      onClick={handleOpenArs}
      disabled={!canSubmitArs}
      title={
        canSubmitArs
          ? `Submit ARS for ${date}`
          : pending
          ? 'ARS already pending for this date'
          : 'Select an absent, half-day, or invalid date to submit ARS'
      }
    >
      Submit ARS
    </button>
  );

  const handleOpenArs = () => {
    if (!canSubmitArs) return;
    setRequestDate(date);
  };

  const handlePrevMonth = () => {
    const prevDate = new Date(Date.UTC(year, m - 2, 1));
    const prevMonth = `${prevDate.getUTCFullYear()}-${String(prevDate.getUTCMonth() + 1).padStart(2, '0')}`;
    onMonthChange?.(prevMonth);
  };

  const handleNextMonth = () => {
    const nextDate = new Date(Date.UTC(year, m, 1));
    const nextMonth = `${nextDate.getUTCFullYear()}-${String(nextDate.getUTCMonth() + 1).padStart(2, '0')}`;
    onMonthChange?.(nextMonth);
  };

  return (
    <div className="hr-personal-calendar-layout">
      <div className="hr-personal-calendar-main">
        <div className="hr-calendar-header">
          <div className="hr-calendar-month-heading">
            {!hideMonthNavigation && onMonthChange ? (
              <div className="hr-month-controls" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  className="button secondary hr-month-nav-btn hr-month-nav-desktop"
                  onClick={handlePrevMonth}
                  aria-label="Previous month"
                  style={{ padding: '6px 8px', height: '36px', minWidth: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <ChevronLeft size={16} />
                </button>
                <label className="hr-month-corner" style={{ margin: 0 }}>
                  <PickerInput
                    type="month"
                    required
                    aria-label="Attendance month"
                    value={month}
                    onChange={(e) => {
                      if (e.target.value) onMonthChange(e.target.value);
                    }}
                  />
                </label>
                <button
                  type="button"
                  className="button secondary hr-month-nav-btn hr-month-nav-desktop"
                  onClick={handleNextMonth}
                  aria-label="Next month"
                  style={{ padding: '6px 8px', height: '36px', minWidth: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <ChevronRight size={16} />
                </button>
                {ars && renderSubmitArsButton(false)}
              </div>
            ) : (
              <div className="hr-month-controls" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3>{monthFormatted}</h3>
                {ars && renderSubmitArsButton(false)}
              </div>
            )}
          </div>
          <div className="hr-calendar-actions">
            {onRequestLeave && (
              <Button className="hr-request-leave-btn" onClick={onRequestLeave}>
                Request leave
              </Button>
            )}
          </div>
        </div>

        <div className="hr-personal-calendar-grid">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d, index) => {
            const dayOfWeek = index === 6 ? 0 : index + 1;
            const isOff = data.settings?.workingDays && !data.settings.workingDays.includes(dayOfWeek);
            return (
              <span
                className={`hr-calendar-weekday ${d === 'Sun' || isOff ? 'is-sunday' : ''}`}
                key={d}
                title={isOff ? `${d} (Weekly off)` : d}
              >
                {d}
              </span>
            );
          })}
          {Array.from({ length: offset }, (_, i) => (
            <span aria-hidden="true" key={'empty' + i} />
          ))}
          {Array.from({ length: count }, (_, i) => {
            const value = `${month}-${String(i + 1).padStart(2, '0')}`;
            const record = data.attendance.find((d) => d.date === value);
            const state = attendanceLabel(value, data.today, record, data.leaves, data.settings);
            const pendingLeave = pendingLeaveOn(value, data.today, data.leaves);
            const dayOfWeek = new Date(Date.UTC(year, m - 1, i + 1)).getUTCDay();
            const isSunday = dayOfWeek === 0;
            const holidayInfo = isDateHoliday(value, data.settings?.holidays);
            const statusText = cellStatusLabel(state, holidayInfo.isHoliday ? holidayInfo.reason : undefined);

            return (
              <button
                type="button"
                key={value}
                className={`hr-calendar-day hr-day-status-${state} ${isSunday ? 'is-sunday' : ''}`}
                aria-label={`${formatCalendarDate(value)}: ${titleCase(state)}${pendingLeave ? ', leave requested' : ''}`}
                aria-pressed={date === value}
                aria-current={value === data.today ? 'date' : undefined}
                onClick={() => {
                  setSelected(value);
                }}
              >
                <strong>{i + 1}</strong>
                {statusText && <small className="hr-day-label">{statusText}</small>}
                {pendingLeave && <span className="hr-pending-leave-dot" aria-hidden="true" />}
              </button>
            );
          })}
        </div>

        <div className="hr-calendar-legend" aria-label="Attendance legend">
          {legends.map(([state, name]) => (
            <span key={state}>
              <i className={`hr-day-status-${state}`} aria-hidden="true" />
              {name}
            </span>
          ))}
        </div>
      </div>

      <div className="hr-personal-calendar-sidebar">
        <AttendanceDayDetail
          date={date}
          day={day}
          status={status}
          timezone={data.timezone}
          ars={Boolean(ars)}
          pending={pending}
          holidayName={selectedHoliday.isHoliday ? selectedHoliday.reason : undefined}
        />
        {ars && activeLeaveOnSelected && (
          <div style={{ margin: '12px 0 0' }}>
            <p className="ars-pending-note" style={{ margin: '0 0 8px' }}>
              {activeLeaveOnSelected.status === 'approved'
                ? 'Approved leave · Click below to cancel your leave.'
                : 'Leave requested · Click below to cancel the pending request.'}
            </p>
            <Button
              type="button"
              className="secondary"
              style={{ width: '100%', fontSize: '12px', minHeight: '32px' }}
              onClick={() => setCancelLeave(activeLeaveOnSelected)}
            >
              Cancel leave
            </Button>
          </div>
        )}
      </div>

      {ars && cancelLeave && (
        <CancelLeaveDialog
          leave={cancelLeave}
          adapter={ars.adapter}
          close={() => setCancelLeave(undefined)}
          saved={() => {
            setCancelLeave(undefined);
            ars.saved();
          }}
        />
      )}
      {ars && requestDate && (
        <ArsRequestDialog
          day={
            requestDay ?? {
              date: requestDate,
              status: (status === 'absent' || status === 'half-day' || status === 'invalid'
                ? status
                : 'absent') as 'absent' | 'half-day' | 'invalid',
            }
          }
          timezone={data.timezone}
          adapter={ars.adapter}
          close={() => setRequestDate(undefined)}
          saved={() => {
            setRequestDate(undefined);
            ars.saved();
          }}
        />
      )}
      {ars && portalTarget && createPortal(renderSubmitArsButton(true), portalTarget)}
    </div>
  );
}
