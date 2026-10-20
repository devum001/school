import CalendarDateInput from './CalendarDateInput';
import * as Dialog from '@radix-ui/react-dialog';
import { X, ArrowUpRight } from 'lucide-react';
import type { ReactNode, ButtonHTMLAttributes, InputHTMLAttributes } from 'react';
import { Link } from 'react-router-dom';
import { initials } from '../../lib/config';
import { AppIcon } from './AppIcon';
export { AppIcon, iconNames, type IconName, type AppIconProps } from './AppIcon';
export function Button({
  children,
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
}) {
  return (
    <button className={`button ${variant} ${className}`} {...props}>
      {children}
    </button>
  );
}
type PickerInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  type: 'date' | 'month' | 'time' | 'datetime-local';
};

function openNativePicker(input: HTMLInputElement): boolean {
  if (input.disabled || input.readOnly || typeof input.showPicker !== 'function') return false;
  try {
    input.showPicker();
    return true;
  } catch {
    // Keep native editing available when the browser blocks or lacks a popup picker.
    return false;
  }
}

export function PickerInput({ type, onClick, onKeyDown, ...props }: PickerInputProps) {
  if (type === 'date' || type === 'datetime-local')
    return <CalendarDateInput type={type} {...props} onClick={onClick} onKeyDown={onKeyDown} />;
  return (
    <input
      {...props}
      type={type}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented && openNativePicker(event.currentTarget))
          event.preventDefault();
      }}
      onKeyDown={(event) => {
        onKeyDown?.(event);
        if (
          !event.defaultPrevented &&
          event.key === 'Enter' &&
          openNativePicker(event.currentTarget)
        )
          event.preventDefault();
      }}
    />
  );
}

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: string }) {
  return <span className={`badge ${tone}`}>{children}</span>;
}
export function Avatar({ name, large = false }: { name: string; large?: boolean }) {
  return (
    <span className={`avatar ${large ? 'large' : ''}`} aria-hidden="true">
      {initials(name)}
    </span>
  );
}
export function PageHeading({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  );
}
export function Panel({
  title,
  subtitle,
  action,
  children,
  className = '',
}: {
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel ${className}`}>
      {title && (
        <div className="panel-heading">
          <div>
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
export function StatCard({
  label,
  value,
  detail,
  icon,
  href,
  tone = 'blue',
}: {
  label: string;
  value: ReactNode;
  detail: ReactNode;
  icon?: ReactNode;
  href?: string;
  tone?: string;
}) {
  const content = (
    <>
      <div className="stat-top">
        <span>{label}</span>
        {icon && <span className={`stat-icon ${tone}`}>{icon}</span>}
      </div>
      <strong className="stat-value">{value}</strong>
      <div className="stat-detail">
        {detail}
        {href && <ArrowUpRight size={14} />}
      </div>
    </>
  );
  return href ? (
    <Link className={`panel stat-card ${tone}`} to={href}>
      {content}
    </Link>
  ) : (
    <div className={`panel stat-card ${tone}`}>{content}</div>
  );
}
export function SearchInput({
  value,
  onChange,
  placeholder = 'Search students…',
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="search-input">
      <AppIcon name="search" size={18} aria-hidden="true" />
      <input
        aria-label={placeholder}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
export function EmptyState({
  title = 'No records found',
  description = 'Try another search or update your filters.',
  action,
  icon,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="empty-state">
      {icon ?? <AppIcon name="inbox" size={36} />}
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  wide = false,
  presentation = 'dialog',
  className = '',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  children: ReactNode;
  wide?: boolean;
  presentation?: 'dialog' | 'page';
  className?: string;
}) {
  if (presentation === 'page')
    return open ? (
      <section className="panel routed-form" aria-label={title}>
        <div className="routed-form-heading">
          <div>
            <h1>{title}</h1>
            {description && <p>{description}</p>}
          </div>
          <button className="button secondary" type="button" onClick={onClose}>
            Back
          </button>
        </div>
        {children}
      </section>
    ) : null;
  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="modal-overlay" />
        <Dialog.Content className={`modal ${wide ? 'wide' : ''} ${className}`}>
          <div className="modal-heading">
            <div>
              <Dialog.Title>{title}</Dialog.Title>
              <Dialog.Description>{description}</Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button className="icon-button" aria-label="Close dialog">
                <X size={20} />
              </button>
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
