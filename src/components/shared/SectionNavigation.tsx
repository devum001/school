import TabRail from '../ui/TabRail';
import { useId } from 'react';
import { tabKeyboard } from '../../lib/tabKeyboard';

export interface SectionItem {
  id: string;
  label: string;
}
export default function SectionNavigation({
  items,
  value,
  onChange,
  label,
}: {
  items: readonly SectionItem[];
  value: string;
  onChange: (value: string) => void;
  label: string;
}) {
  const id = useId();
  return (
    <nav className="section-navigation" aria-label={label}>
      <TabRail variant="secondary" role="tablist" aria-label={label}>
        {items.map((item, index) => (
          <button
            type="button"
            role="tab"
            key={item.id}
            id={`${id}-${index}`}
            aria-selected={value === item.id}
            tabIndex={value === item.id ? 0 : -1}
            onClick={() => onChange(item.id)}
            onKeyDown={(event) =>
              tabKeyboard(
                event,
                index,
                items.map((entry) => entry.id),
                onChange,
                (_, i) => `${id}-${i}`,
              )
            }
          >
            {item.label}
          </button>
        ))}
      </TabRail>
    </nav>
  );
}
