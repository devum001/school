import { useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';

export interface FloatingStickyTableHeaderProps {
  tableWrapRef: RefObject<HTMLElement | null>;
  theadRef: RefObject<HTMLTableSectionElement | null>;
  children: (colWidths: number[]) => ReactNode;
  minWidth?: number;
}

export function FloatingStickyTableHeader({
  tableWrapRef,
  theadRef,
  children,
  minWidth,
}: FloatingStickyTableHeaderProps) {
  const [isSticky, setIsSticky] = useState(false);
  const [layout, setLayout] = useState<{
    left: number;
    width: number;
    tableWidth: number;
    colWidths: number[];
  } | null>(null);

  const headerContentRef = useRef<HTMLDivElement>(null);
  const outerRef = useRef<HTMLDivElement>(null);
  const isStickyRef = useRef(false);
  isStickyRef.current = isSticky;
  const touchStartX = useRef<number | null>(null);

  const measureLayout = useCallback(() => {
    const wrap = tableWrapRef.current;
    const thead = theadRef.current;
    if (!wrap || !thead) return;

    const wrapRect = wrap.getBoundingClientRect();
    const table = wrap.querySelector('table');
    const tableWidth = table ? table.offsetWidth : (minWidth || 1000);
    const ths = Array.from(thead.querySelectorAll('th'));
    const colWidths = ths.map((th) => th.getBoundingClientRect().width);

    if (outerRef.current) {
      outerRef.current.style.left = `${wrapRect.left}px`;
      outerRef.current.style.width = `${wrapRect.width}px`;
    }

    setLayout({
      left: wrapRect.left,
      width: wrapRect.width,
      tableWidth,
      colWidths,
    });
  }, [tableWrapRef, theadRef, minWidth]);

  const syncTransform = useCallback(() => {
    const wrap = tableWrapRef.current;
    const content = headerContentRef.current;
    if (wrap && content) {
      content.style.transform = `translate3d(-${wrap.scrollLeft}px, 0, 0)`;
    }
  }, [tableWrapRef]);

  useEffect(() => {
    const wrap = tableWrapRef.current;
    const thead = theadRef.current;
    if (!wrap || !thead) return;

    let ticking = false;

    const checkSticky = () => {
      const wrapRect = wrap.getBoundingClientRect();
      const theadRect = thead.getBoundingClientRect();
      const shouldStick = theadRect.top <= 0 && wrapRect.bottom > 60;

      if (shouldStick !== isStickyRef.current) {
        if (shouldStick) {
          measureLayout();
        }
        setIsSticky(shouldStick);
      } else if (shouldStick && outerRef.current) {
        outerRef.current.style.left = `${wrapRect.left}px`;
        outerRef.current.style.width = `${wrapRect.width}px`;
      }
      ticking = false;
    };

    const onWindowScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(checkSticky);
        ticking = true;
      }
    };

    window.addEventListener('scroll', onWindowScroll, { passive: true });
    window.addEventListener('resize', measureLayout, { passive: true });
    return () => {
      window.removeEventListener('scroll', onWindowScroll);
      window.removeEventListener('resize', measureLayout);
    };
  }, [measureLayout, tableWrapRef, theadRef]);

  useEffect(() => {
    const wrap = tableWrapRef.current;
    if (!wrap) return;

    const onWrapScroll = () => {
      if (!isStickyRef.current) return;
      syncTransform();
    };

    wrap.addEventListener('scroll', onWrapScroll, { passive: true });
    return () => wrap.removeEventListener('scroll', onWrapScroll);
  }, [syncTransform, tableWrapRef]);

  const onHeaderWheel = (e: React.WheelEvent) => {
    const wrap = tableWrapRef.current;
    if (wrap && Math.abs(e.deltaX) > 0) {
      wrap.scrollLeft += e.deltaX;
    }
  };

  const onHeaderTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      touchStartX.current = e.touches[0].clientX;
    }
  };

  const onHeaderTouchMove = (e: React.TouchEvent) => {
    if (touchStartX.current === null || e.touches.length !== 1) return;
    const currentX = e.touches[0].clientX;
    const deltaX = touchStartX.current - currentX;
    touchStartX.current = currentX;
    const wrap = tableWrapRef.current;
    if (wrap) {
      wrap.scrollLeft += deltaX;
    }
  };

  const onHeaderTouchEnd = () => {
    touchStartX.current = null;
  };

  if (!isSticky || !layout) return null;

  return (
    <div
      ref={outerRef}
      className="fee-floating-sticky-header"
      onWheel={onHeaderWheel}
      onTouchStart={onHeaderTouchStart}
      onTouchMove={onHeaderTouchMove}
      onTouchEnd={onHeaderTouchEnd}
      style={{
        position: 'fixed',
        top: 0,
        left: layout.left,
        width: layout.width,
        zIndex: 40,
        overflow: 'hidden',
        pointerEvents: 'auto',
      }}
    >
      <div
        ref={headerContentRef}
        className="fee-floating-scroll-container"
        style={{
          width: layout.tableWidth,
          willChange: 'transform',
        }}
      >
        <table
          style={{
            width: layout.tableWidth,
            minWidth: minWidth,
            tableLayout: 'fixed',
            borderCollapse: 'collapse',
          }}
        >
          {children(layout.colWidths)}
        </table>
      </div>
    </div>
  );
}
