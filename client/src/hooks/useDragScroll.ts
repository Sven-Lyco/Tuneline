import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Enables drag-to-scroll on a horizontally scrollable container.
 * Also converts vertical wheel events to horizontal scroll.
 *
 * Usage:
 *   const { ref, dragProps, isDragging } = useDragScroll();
 *   <div ref={ref} {...dragProps} style={{ cursor: isDragging ? 'grabbing' : 'grab' }} />
 */
export function useDragScroll<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null);
  const startX = useRef(0);
  const scrollLeft = useRef(0);
  const [isDragging, setIsDragging] = useState(false);
  const hasDragged = useRef(false);

  // Must be non-passive to call preventDefault() on wheel events.
  // React's synthetic onWheel is always passive in React 17+, so we wire this up manually.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      if (e.deltaY !== 0 && e.deltaX === 0) {
        e.preventDefault();
        el.scrollLeft += e.deltaY;
      }
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    setIsDragging(true);
    hasDragged.current = false;
    startX.current = e.pageX - el.offsetLeft;
    scrollLeft.current = el.scrollLeft;
  }, []);

  const onMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging) return;
      const el = ref.current;
      if (!el) return;
      const x = e.pageX - el.offsetLeft;
      const delta = x - startX.current;
      if (Math.abs(delta) > 3) hasDragged.current = true;
      el.scrollLeft = scrollLeft.current - delta;
    },
    [isDragging]
  );

  const stopDrag = useCallback(() => {
    setIsDragging(false);
  }, []);

  /**
   * Wrap child onClick handlers: suppress the click if the user just dragged.
   */
  const suppressClickIfDragged = useCallback((handler?: () => void) => {
    return () => {
      if (hasDragged.current) return;
      handler?.();
    };
  }, []);

  const dragProps = {
    onMouseDown,
    onMouseMove,
    onMouseUp: stopDrag,
    onMouseLeave: stopDrag,
  };

  return { ref, dragProps, isDragging, suppressClickIfDragged };
}
