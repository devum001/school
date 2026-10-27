import TabRail from '../ui/TabRail';
import { useId } from 'react';
import { Link } from 'react-router-dom';
import { AppIcon, type IconName } from '../ui/AppIcon';
import { tabKeyboard } from '../../lib/tabKeyboard';

export interface SectionItem {
  id: string;
  label: string;
  icon?: IconName;
  to?: string;
  badge?: string | number;
}

export interface SectionNavigationProps {
  items: readonly SectionItem[];
  value: string;
  onChange?: (value: string) => void;
  label: string;
  className?: string;
  variant?: 'primary' | 'secondary';
}

export default function SectionNavigation({
  items,
  value,
  onChange,
  label,
  className = '',
  variant = 'primary',
}: SectionNavigationProps) {
  const id = useId();
  return (
    <nav className={`section-navigation ${className}`.trim()} aria-label={label}>
      <TabRail variant={variant} role="tablist" aria-label={label}>
        {items.map((item, index) => {
          const isSelected = value === item.id;
          const tabId = `${id}-${index}`;
          const content = (
            <>
              {item.icon && <AppIcon name={item.icon} size={18} />}
              <span className="tab-label">{item.label}</span>
              {item.badge !== undefined && <span className="tab-count">{item.badge}</span>}
            </>
          );

          if (item.to) {
            return (
              <Link
                key={item.id}
                id={tabId}
                to={item.to}
                role="tab"
                aria-selected={isSelected}
                tabIndex={isSelected ? 0 : -1}
                className={isSelected ? 'active' : ''}
              >
                {content}
              </Link>
            );
          }

          return (
            <button
              type="button"
              role="tab"
              key={item.id}
              id={tabId}
              aria-selected={isSelected}
              tabIndex={isSelected ? 0 : -1}
              className={isSelected ? 'active' : ''}
              onClick={() => onChange?.(item.id)}
              onKeyDown={(event) =>
                onChange &&
                tabKeyboard(
                  event,
                  index,
                  items.map((entry) => entry.id),
                  onChange,
                  (_, i) => `${id}-${i}`,
                )
              }
            >
              {content}
            </button>
          );
        })}
      </TabRail>
    </nav>
  );
}

export { SectionNavigation as SchoolTabs };
export type { SectionItem as SchoolTabItem };
