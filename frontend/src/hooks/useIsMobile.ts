import { useState, useEffect } from 'react';

/**
 * Returns true when the viewport is below 768px (mobile breakpoint).
 * Updates on window resize.
 */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < 768;
  });

  useEffect(() => {
    const mql = window.matchMedia('(max-width: 767px)');
    const handleChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    setIsMobile(mql.matches);
    mql.addEventListener('change', handleChange);
    return () => mql.removeEventListener('change', handleChange);
  }, []);

  return isMobile;
}
