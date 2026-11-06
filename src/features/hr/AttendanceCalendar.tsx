import { useEffect, useState } from 'react';
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
import { Button } from '../../components/ui/Primitives';
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
}: {
  data: HrWorkspace;
  month: string;
  label?: string;
  onMonthChange?: (month: string) => void;
  onRequestLeave?: () => void;
  ars?: { adapter: HrAdapter; saved: () => void };
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
  const requests = data.attendanceRequests ?? [];
  const pending = requests.some((r) => r.date === date && r.status === 'pending');
  const requestDay = data.attendance.find((d) => d.date === requestDate);
  const activeLeaveOnSelected = cancellableLeaveOn(date, data.today, data.leaves);

  const monthFormatted = new Intl.DateTimeFormat('en-IN', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, m - 1, 1)));

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
            <h3>{monthFormatted}</h3>
            <div className="hr-month-arrows">
              <button
                type="button"
                className="hr-month-arrow-btn"
                onClick={handlePrevMonth}
                aria-label="Previous month"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                type="button"
                className="hr-month-arrow-btn"
                onClick={handleNextMonth}
                aria-label="Next month"
              >
                <ChevronRight size={16} />
              </button>
            </div>
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
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
            <span
              className={`hr-calendar-weekday ${d === 'Sun' ? 'is-sunday' : ''}`}
              key={d}
            >
              {d}
            </span>
          ))}
          {Array.from({ length: offset }, (_, i) => (
            <span aria-hidden="true" key={'empty' + i} />
          ))}
          {Array.from({ length: count }, (_, i) => {
            const value = `${month}-${String(i + 1).padStart(2, '0')}`;
            const record = data.attendance.find((d) => d.date === value);
            const state = attendanceLabel(value, data.today, record, data.leaves, data.settings);
            const pendingLeave = pendingLeaveOn(value, data.today, data.leaves);
            const cancellableLeave = cancellableLeaveOn(value, data.today, data.leaves);
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
                  if (ars && cancellableLeave) setCancelLeave(cancellableLeave);
                  else if (
                    ars &&
                    canRequestArs(record, data.today, requests, data.settings?.holidays)
                  )
                    setRequestDate(value);
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
        />
        {ars && activeLeaveOnSelected && (
          <p className="ars-pending-note" style={{ margin: '12px 0 0' }}>
            {activeLeaveOnSelected.status === 'approved'
              ? 'Approved leave · select this date to cancel your leave.'
              : 'Leave requested · select this date to cancel the pending request.'}
          </p>
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
          day={requestDay ?? { date: requestDate }}
          timezone={data.timezone}
          adapter={ars.adapter}
          close={() => setRequestDate(undefined)}
          saved={() => {
            setRequestDate(undefined);
            ars.saved();
          }}
        />
      )}
    </div>
  );
}
