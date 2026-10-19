import { useCallback, useLayoutEffect, useRef, useState, type HTMLAttributes } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

type RailPosition = { overflowing: boolean; atStart: boolean; atEnd: boolean };

export default function TabRail({
  children,
  className = '',
  variant = 'primary',
  'aria-label': label = 'Navigation',
  ...props
}: HTMLAttributes<HTMLDivElement> & { variant?: 'primary' | 'secondary' }) {
  const viewport = useRef<HTMLDivElement>(null);
  const scrollEdge = useRef<number | null>(null);
  const [position, setPosition] = useState<RailPosition>({
    overflowing: false,
    atStart: true,
    atEnd: true,
  });
  const measure = useCallback(() => {
    const element = viewport.current;
    if (!element) return;
    const remaining = element.scrollWidth - element.clientWidth;
    const next = {
      overflowing: remaining > 1,
      atStart: element.scrollLeft <= 1,
      atEnd: element.scrollLeft >= remaining - 1,
    };
    setPosition((previous) =>
      previous.overflowing === next.overflowing &&
      previous.atStart === next.atStart &&
      previous.atEnd === next.atEnd
        ? previous
        : next,
    );
  }, []);
  const reveal = useCallback((tab?: HTMLElement | null) => {
    const element = viewport.current;
    if (!element) return;
    const selected = tab ?? element.querySelector<HTMLElement>('[aria-selected="true"]');
    if (!selected) return;
    const bounds = element.getBoundingClientRect();
    const item = selected.getBoundingClientRect();
    if (item.left < bounds.left) element.scrollLeft += item.left - bounds.left - 3;
    else if (item.right > bounds.right) element.scrollLeft += item.right - bounds.right + 3;
  }, []);

  const scrollToEdge = useCallback(() => {
    const element = viewport.current;
    if (!element || scrollEdge.current === null) return;
    const left = scrollEdge.current > 0 ? element.scrollWidth - element.clientWidth : 0;
    if (Math.abs(element.scrollLeft - left) > 1)
      element.scrollTo({
        left,
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      });
  }, []);

  useLayoutEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const refresh = () => {
      reveal();
      measure();
    };
    scrollEdge.current = null;
    refresh();
    const observer = new ResizeObserver(() => {
      // Arrow visibility changes the viewport width; keep the requested edge in view.
      if (scrollEdge.current !== null) scrollToEdge();
      else reveal();
      measure();
    });
    const resize = () => {
      scrollEdge.current = null;
      refresh();
    };
    window.addEventListener('resize', resize);
    observer.observe(element);
    if (element.parentElement) observer.observe(element.parentElement);
    for (const tab of element.children) observer.observe(tab);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', resize);
    };
  }, [children, measure, reveal, scrollToEdge]);

  function slide(direction: number) {
    const element = viewport.current;
    if (!element) return;
    scrollEdge.current = direction;
    scrollToEdge();
  }

  return (
    <div className={`tab-rail ${variant} ${className}`} data-overflow={position.overflowing}>
      <button
        type="button"
        className="tab-rail-arrow"
        aria-label={`Scroll ${label} tabs left`}
        disabled={position.atStart}
        hidden={!position.overflowing || position.atStart}
        onClick={() => slide(-1)}
      >
        <ChevronLeft size={18} aria-hidden="true" />
      </button>
      <div
        {...props}
        ref={viewport}
        className="tab-rail-viewport"
        role="tablist"
        aria-label={label}
        onScroll={measure}
        onFocusCapture={(event) => {
          scrollEdge.current = null;
          reveal(event.target.closest<HTMLElement>('[role="tab"]'));
          measure();
        }}
        onDragStart={(event) => event.preventDefault()}
      >
        {children}
      </div>
      <button
        type="button"
        className="tab-rail-arrow"
        aria-label={`Scroll ${label} tabs right`}
        disabled={position.atEnd}
        hidden={!position.overflowing || position.atEnd}
        onClick={() => slide(1)}
      >
        <ChevronRight size={18} aria-hidden="true" />
      </button>
    </div>
  );
}
