import { useSearchParams } from 'react-router-dom';
import type { SectionItem } from '../../components/shared/SectionNavigation';

/** Each settings feature has its own URL, so refresh and browser Back keep its context. */
export function useSettingsSection(items: readonly SectionItem[]) {
  const [params, setParams] = useSearchParams();
  const section = items.find((item) => item.id === params.get('section'))?.id ?? items[0].id;
  const select = (id: string) =>
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        next.set('section', id);
        next.delete('action');
        return next;
      },
      { flushSync: true },
    );
  return {
    section,
    navigation: { items, value: section, onChange: select, variant: 'secondary' as const },
  };
}

/** These views keep the same parent form mounted, so its draft survives the view change. */
export function retainsSettingsDraft(
  current: { pathname: string; search: string },
  next: { pathname: string; search: string },
) {
  return (
    current.pathname === next.pathname &&
    new URLSearchParams(current.search).get('tab') === new URLSearchParams(next.search).get('tab')
  );
}
