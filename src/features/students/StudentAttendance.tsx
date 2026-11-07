import { useToday } from '../../app/useToday';
import { useContext, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useSchool } from '../../app/useSchool';
import { SchoolContext } from '../live/schoolContext';
import { AppIcon, PickerInput, StatCard } from '../../components/ui/Primitives';
import { recordedAttendanceSummary } from '../../lib/selectors';
import { isDateHoliday } from '../../lib/indianHolidays';
import { formatCalendarDate } from '../../lib/displayFormat';
import '../hr/hr-personal-calendar.css';

const legends = [
  ['present', 'Present'],
  ['late', 'Late'],
  ['absent', 'Absent'],
  ['half-day', 'Half day'],
  ['holiday', 'School holiday'],
  ['off', 'Weekly off'],
  ['unmarked', 'Not marked'],
];

const DAY_MAP: Record<string, number> = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
};

export function StudentAttendance({ enrollmentId }: { enrollmentId: string }) {
  const state = useSchool();
  const liveSchool = useContext(SchoolContext);
  const today = useToday();
  const [selectedMonth, setMonth] = useState<string | null>(null);

  const month =
    selectedMonth && /^\d{4}-(0[1-9]|1[0-2])$/.test(selectedMonth)
      ? selectedMonth
      : today.slice(0, 7);

  const [year, m] = month.split('-').map(Number);
  const count = new Date(Date.UTC(year, m, 0)).getUTCDate();
  const offset = (new Date(Date.UTC(year, m - 1, 1)).getUTCDay() + 6) % 7;

  // School working days resolution
  const rawDays =
    liveSchool?.profile?.school?.hours?.days ??
    (state.school as any)?.hours?.days ??
    state.schoolHours?.days;

  const schoolWorkingDays: number[] = Array.isArray(rawDays) && rawDays.length > 0
    ? rawDays.map((d: string) => DAY_MAP[d]).filter((n: number | undefined): n is number => n !== undefined)
    : [1, 2, 3, 4, 5, 6];

  const records = state.attendance
    .filter((r) => r.enrollmentId === enrollmentId && r.date.startsWith(month))
    .sort((a, b) => b.date.localeCompare(a.date));

  // Build full month days
  const days = Array.from({ length: count }, (_, index) => {
    const date = `${month}-${String(index + 1).padStart(2, '0')}`;
    const dayOfWeek = new Date(Date.UTC(year, m - 1, index + 1)).getUTCDay();
    const isOff = !schoolWorkingDays.includes(dayOfWeek);
    const holidayInfo = isDateHoliday(date, state.holidays);
    const record = records.find((r) => r.date === date);

    let status = 'unmarked';
    let label = 'Not marked';

    if (date > today) {
      status = 'upcoming';
      label = 'Upcoming';
    } else if (holidayInfo.isHoliday) {
      status = 'holiday';
      label = holidayInfo.reason || 'School holiday';
    } else if (isOff) {
      status = 'off';
      label = 'Weekly off';
    } else if (record) {
      status = record.status;
      label =
        record.status === 'present'
          ? 'Present'
          : record.status === 'absent'
            ? 'Absent'
            : record.status === 'late'
              ? 'Late'
              : record.status === 'half-day'
                ? 'Half day'
                : 'Not marked';
    }

    return { date, status, label, holidayReason: holidayInfo.reason, dayOfWeek, isOff };
  });

  const summary = recordedAttendanceSummary(
    days.filter((day) => day.date <= today).map((day) => day.status as any),
  );

  const handlePrevMonth = () => {
    const prevDate = new Date(Date.UTC(year, m - 2, 1));
    const prevMonth = `${prevDate.getUTCFullYear()}-${String(prevDate.getUTCMonth() + 1).padStart(2, '0')}`;
    setMonth(prevMonth);
  };

  const handleNextMonth = () => {
    const nextDate = new Date(Date.UTC(year, m, 1));
    const nextMonth = `${nextDate.getUTCFullYear()}-${String(nextDate.getUTCMonth() + 1).padStart(2, '0')}`;
    setMonth(nextMonth);
  };

  const monthFormatted = new Intl.DateTimeFormat('en-IN', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, m - 1, 1)));

  return (
    <>
      <div className="stats-grid three" style={{ marginBottom: '20px' }}>
        <StatCard
          label="Present days"
          value={summary.present}
          detail={`${summary.late} late · ${summary['half-day']} half days`}
          icon={<AppIcon name="user-check" size={24} />}
          tone="green"
        />
        <StatCard
          label="Absent days"
          value={summary.absent}
          detail={`${summary.unmarked} not marked days`}
          icon={<AppIcon name="verified" size={24} />}
          tone="amber"
        />
        <StatCard
          label="Attendance rate"
          value={`${summary.percentage}%`}
          detail={`${summary.attended} attending / ${summary.marked} marked days`}
          icon={<AppIcon name="attendance" size={24} />}
        />
      </div>

      <div className="hr-personal-calendar-main">
        <div className="hr-calendar-header">
          <div className="hr-calendar-month-heading">
            <div className="hr-month-controls" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button
                type="button"
                className="button secondary hr-month-nav-btn"
                onClick={handlePrevMonth}
                aria-label="Previous month"
                style={{
                  padding: '6px 8px',
                  height: '36px',
                  minWidth: '34px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <ChevronLeft size={16} />
              </button>
              <label className="hr-month-corner" style={{ margin: 0 }}>
                <PickerInput
                  type="month"
                  required
                  aria-label="Attendance month"
                  value={month}
                  min={state.academicYear.start.slice(0, 7)}
                  max={today.slice(0, 7)}
                  onChange={(e) => {
                    if (e.target.value) {
                      setMonth(e.target.value);
                    }
                  }}
                />
              </label>
              <button
                type="button"
                className="button secondary hr-month-nav-btn"
                onClick={handleNextMonth}
                aria-label="Next month"
                disabled={month >= today.slice(0, 7)}
                style={{
                  padding: '6px 8px',
                  height: '36px',
                  minWidth: '34px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
          <div className="hr-calendar-actions">
            <span className="muted" style={{ fontSize: '13px', fontWeight: 500 }}>
              {monthFormatted}
            </span>
          </div>
        </div>

        <div className="hr-personal-calendar-grid">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d, index) => {
            const dayOfWeek = index === 6 ? 0 : index + 1;
            const isOff = !schoolWorkingDays.includes(dayOfWeek);
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
          {days.map((dayItem, i) => {
            const isSunday = dayItem.dayOfWeek === 0;
            return (
              <div
                key={dayItem.date}
                className={`hr-calendar-day hr-day-status-${dayItem.status} ${isSunday ? 'is-sunday' : ''}`}
                aria-label={`${formatCalendarDate(dayItem.date)}: ${dayItem.label}`}
                aria-current={dayItem.date === today ? 'date' : undefined}
              >
                <strong>{i + 1}</strong>
                {dayItem.label && <small className="hr-day-label">{dayItem.label}</small>}
              </div>
            );
          })}
        </div>

        <div className="hr-calendar-legend" aria-label="Attendance legend">
          {legends.map(([stateKey, name]) => (
            <span key={stateKey}>
              <i className={`hr-day-status-${stateKey}`} aria-hidden="true" />
              {name}
            </span>
          ))}
        </div>
      </div>
    </>
  );
}
