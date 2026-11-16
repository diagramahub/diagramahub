import { useEffect, useRef, type RefObject } from 'react';

/**
 * Attach a wheel listener that can call `preventDefault()`.
 *
 * React registers `onWheel` as a passive listener, so `preventDefault()` there
 * is ignored ("Unable to preventDefault inside passive event listener") and the
 * page scrolls while zooming. This hook adds a native `{ passive: false }`
 * listener instead. `handler` may change every render; the latest one runs.
 *
 * @param ref Element that receives the wheel events
 * @param handler Wheel handler, or null to detach
 * @param remountKey Value that changes when the element may have been replaced
 */
export function useNonPassiveWheel<T extends HTMLElement>(
  ref: RefObject<T | null>,
  handler: ((event: WheelEvent) => void) | null,
  remountKey?: unknown,
): void {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;
  const enabled = handler !== null;

  useEffect(() => {
    const element = ref.current;
    if (!element || !enabled) return;
    const listener = (event: WheelEvent) => handlerRef.current?.(event);
    element.addEventListener('wheel', listener, { passive: false });
    return () => element.removeEventListener('wheel', listener);
  }, [ref, enabled, remountKey]);
}
