import { useEffect, useRef } from 'react';

/**
 * Centres a horizontal scroller whenever `key` changes to a non-null value — e.g. at the start
 * of each turn, so long timelines don't stay wherever they were last swiped to.
 *
 * With `selector` the matching child is centred (and nothing happens if there is none);
 * without it, the middle of the content is.
 */
export function useCenterScroll<T extends HTMLElement = HTMLDivElement>(
  key: string | null,
  selector?: string
) {
  const ref = useRef<T>(null);

  useEffect(() => {
    const scroller = ref.current;
    if (key === null || !scroller) return;

    let left = (scroller.scrollWidth - scroller.clientWidth) / 2;
    if (selector) {
      const target = scroller.querySelector<HTMLElement>(selector);
      if (!target) return;
      const box = scroller.getBoundingClientRect();
      const rect = target.getBoundingClientRect();
      left = scroller.scrollLeft + rect.left - box.left - (scroller.clientWidth - rect.width) / 2;
    }

    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    scroller.scrollTo({ left, behavior: reduceMotion ? 'auto' : 'smooth' });
  }, [key, selector]);

  return ref;
}
