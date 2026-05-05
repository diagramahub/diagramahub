import { useState, useEffect, useCallback } from 'react';
import Sidebar from './Sidebar';

const SIDEBAR_COLLAPSED_KEY = 'sidebar_collapsed';
const EXPANDED_WIDTH = 208;
const COLLAPSED_WIDTH = 64;

interface SidebarLayoutProps {
  children: React.ReactNode;
}

export default function SidebarLayout({ children }: SidebarLayoutProps) {
  // Read initial collapsed state from localStorage to match Sidebar's own state
  const [isCollapsed, setIsCollapsed] = useState(() => {
    try {
      const stored = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
      if (stored === null) return false;
      return JSON.parse(stored) as boolean;
    } catch {
      return false;
    }
  });

  // Track whether we're on mobile (< 768px)
  const [isMobile, setIsMobile] = useState(() => {
    return typeof window !== 'undefined' ? window.innerWidth < 768 : false;
  });

  // Listen for viewport changes
  useEffect(() => {
    const mql = window.matchMedia('(min-width: 768px)');
    const handleChange = (e: MediaQueryListEvent) => {
      setIsMobile(!e.matches);
    };
    mql.addEventListener('change', handleChange);
    return () => mql.removeEventListener('change', handleChange);
  }, []);

  // Sync collapsed state from localStorage.
  // StorageEvent only fires across tabs, so we also poll for same-tab changes
  // since the Sidebar component writes to localStorage on toggle.
  const syncCollapsedState = useCallback(() => {
    try {
      const stored = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
      const value = stored ? JSON.parse(stored) : false;
      setIsCollapsed((prev) => (prev !== value ? value : prev));
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === SIDEBAR_COLLAPSED_KEY) {
        syncCollapsedState();
      }
    };

    // Poll for same-tab localStorage changes
    const interval = setInterval(syncCollapsedState, 200);

    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener('storage', handleStorage);
      clearInterval(interval);
    };
  }, [syncCollapsedState]);

  // On mobile, no margin-left (sidebar is overlay). On desktop, dynamic margin.
  const marginLeft = isMobile ? 0 : isCollapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH;

  return (
    <div className="min-h-screen">
      <Sidebar />
      <div
        style={{
          marginLeft: `${marginLeft}px`,
          transition: 'margin-left 200ms ease-in-out',
        }}
      >
        {children}
      </div>
    </div>
  );
}
