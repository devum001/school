import { useEffect, useRef, useState, type ChangeEvent, type InputHTMLAttributes } from 'react';
import { CalendarDays } from 'lucide-react';
import {
  formatCalendarDate,
  parseCalendarDate,
  formatCalendarDateTime,
  parseCalendarDateTime,
} from '../../lib/displayFormat';
import './calendar-date.css';

export default function CalendarDateInput({
  type = 'date',
  value,
  defaultValue,
  onChange,
  min,
  max,
  className = '',
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & { type?: 'date' | 'datetime-local' }) {
  const calendar = useRef<HTMLInputElement>(null);
  const text = useRef<HTMLInputElement>(null);
  const parse = type === 'date' ? parseCalendarDate : parseCalendarDateTime;
  const format = type === 'date' ? formatCalendarDate : formatCalendarDateTime;
  const [localValue, setLocalValue] = useState(String(defaultValue ?? ''));
  const currentValue = value === undefined ? localValue : String(value);
  const iso = parse(currentValue);
  const openCalendar = () => {
    if (props.disabled || props.readOnly || !calendar.current?.showPicker) return false;
    try {
      calendar.current.showPicker();
      return true;
    } catch {
      return false;
    }
  };
  useEffect(() => {
    const raw = currentValue;
    text.current?.setCustomValidity(
      raw && (!iso || (min && iso < String(min)) || (max && iso > String(max)))
        ? 'Enter a valid DD-MM-YYYY date within the allowed range.'
        : '',
    );
  }, [currentValue, iso, min, max]);
  const change = (event: ChangeEvent<HTMLInputElement>) => {
    const raw = event.target.value;
    const parsed = parse(raw);
    if (value === undefined) setLocalValue(parsed ?? raw);
    text.current?.setCustomValidity(
      raw && (!parsed || (min && parsed < String(min)) || (max && parsed > String(max)))
        ? 'Enter a valid DD-MM-YYYY date within the allowed range.'
        : '',
    );
    onChange?.({
      ...event,
      target: { ...event.target, value: parsed ?? raw },
      currentTarget: { ...event.currentTarget, value: parsed ?? raw },
    });
  };
  return (
    <span className="calendar-date-control">
      <input
        {...props}
        ref={text}
        type="text"
        className={className}
        inputMode="numeric"
        placeholder={type === 'date' ? 'DD-MM-YYYY' : 'DD-MM-YYYY HH:mm'}
        pattern={
          type === 'date'
            ? '[0-9]{2}-[0-9]{2}-[0-9]{4}'
            : '[0-9]{2}-[0-9]{2}-[0-9]{4} [0-9]{2}:[0-9]{2}'
        }
        maxLength={type === 'date' ? 10 : 16}
        value={format(currentValue)}
        onChange={change}
        onClick={(event) => {
          props.onClick?.(event);
          if (!event.defaultPrevented && openCalendar()) event.preventDefault();
        }}
        onKeyDown={(event) => {
          props.onKeyDown?.(event);
          if (!event.defaultPrevented && event.key === 'Enter' && openCalendar())
            event.preventDefault();
        }}
      />
      <button
        type="button"
        className="calendar-date-button"
        aria-label="Open calendar"
        disabled={props.disabled || props.readOnly}
        onClick={() => {
          if (!openCalendar()) text.current?.focus();
        }}
      >
        <CalendarDays size={18} />
      </button>
      <input
        ref={calendar}
        type={type}
        className="calendar-date-native"
        aria-hidden="true"
        tabIndex={-1}
        value={iso ?? ''}
        min={min}
        max={max}
        disabled={props.disabled || props.readOnly}
        onChange={change}
      />
    </span>
  );
}
