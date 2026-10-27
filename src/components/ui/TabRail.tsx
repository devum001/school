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
  const [position, setPosition] = useState<RailPosition>({
    overflowing: false,
    atStart: true,
    atEnd: true,
  });

  const isDragging = useRef(false);
  const startX = useRef(0);
  const startScrollLeft = useRef(0);
  const dragDistance = useRef(0);

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
    if (item.left < bounds.left + 16 || item.right > bounds.right - 16) {
      selected.scrollIntoView({
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
        block: 'nearest',
        inline: 'center',
      });
    }
  }, []);

  useLayoutEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const refresh = () => {
      reveal();
      measure();
    };
    refresh();
    const observer = new ResizeObserver(() => {
      measure();
    });
    const resize = () => {
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
  }, [children, measure, reveal]);

  function slide(direction: number) {
    const element = viewport.current;
    if (!element) return;
    const step = Math.max(element.clientWidth * 0.75, 200);
    element.scrollBy({
      left: direction * step,
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    });
  }

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const element = viewport.current;
    if (!element) return;
    isDragging.current = true;
    startX.current = e.pageX;
    startScrollLeft.current = element.scrollLeft;
    dragDistance.current = 0;
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging.current) return;
    const element = viewport.current;
    if (!element) return;
    const delta = e.pageX - startX.current;
    dragDistance.current = Math.abs(delta);
    element.scrollLeft = startScrollLeft.current - delta;
  };

  const handleMouseUp = () => {
    isDragging.current = false;
  };

  const handleClickCapture = (e: React.MouseEvent<HTMLDivElement>) => {
    if (dragDistance.current > 5) {
      e.preventDefault();
      e.stopPropagation();
      dragDistance.current = 0;
    }
  };

  return (
    <div
      className={`tab-rail ${variant} ${className}`}
      data-overflow={position.overflowing}
      data-at-start={position.atStart}
      data-at-end={position.atEnd}
    >
      <button
        type="button"
        className="tab-rail-arrow prev"
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
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onClickCapture={handleClickCapture}
        onFocusCapture={(event) => {
          reveal(event.target.closest<HTMLElement>('[role="tab"]'));
          measure();
        }}
        onDragStart={(event) => event.preventDefault()}
      >
        {children}
      </div>
      <button
        type="button"
        className="tab-rail-arrow next"
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
