import type { KeyboardEvent } from 'react';
export function tabKeyboard<T extends string>(
  event: KeyboardEvent<HTMLButtonElement>,
  index: number,
  tabs: readonly T[],
  select: (tab: T) => void,
  id: (tab: T, index: number) => string,
) {
  if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return;
  event.preventDefault();
  const next =
    event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? tabs.length - 1
        : (index + (event.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length;
  select(tabs[next]);
  document.getElementById(id(tabs[next], next))?.focus();
}
