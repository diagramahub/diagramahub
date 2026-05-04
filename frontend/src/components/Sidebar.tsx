import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import Tooltip from './Tooltip';
import LanguageSelector from './LanguageSelector';
import PremiumAvatar from './PremiumAvatar';
import apiService from '../services/api';
import { Project } from '../types/project';

interface NavItem {
  key: string;
  labelKey: string;
  path: string;
  icon: React.ReactNode;
  adminOnly?: boolean;
}

const SIDEBAR_COLLAPSED_KEY = 'sidebar_collapsed';
const RECENT_PROJECTS_KEY = 'recent_projects';
const MAX_RECENT_PROJECTS = 5;

// --- SVG Icons (Heroicons style: w-5 h-5, stroke="currentColor") ---

function DashboardIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
    </svg>
  );
}

function ProfileIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  );
}

function AISettingsIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  );
}

function IntegrationsIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
    </svg>
  );
}

function SubscriptionIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </svg>
  );
}

function CollapseIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
    </svg>
  );
}

function ExpandIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M13 5l7 7-7 7M5 5l7 7-7 7" />
    </svg>
  );
}

function HamburgerIcon() {
  return (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

// --- Navigation items ---

const MAIN_NAV_ITEMS: NavItem[] = [
  { key: 'dashboard', labelKey: 'sidebar.dashboard', path: '/dashboard', icon: <DashboardIcon /> },
  { key: 'aiSettings', labelKey: 'sidebar.aiSettings', path: '/settings', icon: <AISettingsIcon /> },
  { key: 'subscription', labelKey: 'sidebar.subscription', path: '/subscription', icon: <SubscriptionIcon /> },
];

const ADMIN_NAV_ITEMS: NavItem[] = [
  { key: 'userManagement', labelKey: 'sidebar.userManagement', path: '/admin/users', icon: <UsersIcon />, adminOnly: true },
  { key: 'plans', labelKey: 'sidebar.plans', path: '/admin/plans', icon: <SubscriptionIcon />, adminOnly: true },
  { key: 'integrations', labelKey: 'sidebar.integrations', path: '/integrations', icon: <IntegrationsIcon />, adminOnly: true },
];

// --- Helper: read/write localStorage safely ---

function readLocalStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeLocalStorage(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // localStorage unavailable (private mode) — silently ignore
  }
}

// --- Sidebar Component ---

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  // Collapsed state persisted in localStorage
  const [isExpanded, setIsExpanded] = useState(() => {
    return !readLocalStorage<boolean>(SIDEBAR_COLLAPSED_KEY, false);
  });

  // Mobile overlay state
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // Recent projects
  const [recentProjects, setRecentProjects] = useState<Project[]>([]);

  // Persist collapsed state
  const toggleExpanded = useCallback(() => {
    setIsExpanded((prev) => {
      const next = !prev;
      writeLocalStorage(SIDEBAR_COLLAPSED_KEY, !next);
      return next;
    });
  }, []);

  // Close mobile overlay when route changes
  useEffect(() => {
    setIsMobileOpen(false);
  }, [location.pathname]);

  // Fetch recent projects
  useEffect(() => {
    let cancelled = false;

    async function fetchRecentProjects() {
      try {
        const recentIds = readLocalStorage<string[]>(RECENT_PROJECTS_KEY, []);
        if (recentIds.length === 0) {
          // Fallback: fetch all projects and take the most recently updated
          const allProjects = await apiService.getProjects();
          const sorted = [...allProjects]
            .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
            .slice(0, MAX_RECENT_PROJECTS);
          if (!cancelled) setRecentProjects(sorted);
          return;
        }

        // Fetch all projects and filter by recent IDs, preserving order
        const allProjects = await apiService.getProjects();
        const projectMap = new Map(allProjects.map((p) => [p.id, p]));
        const recent = recentIds
          .map((id) => projectMap.get(id))
          .filter((p): p is Project => p !== undefined)
          .slice(0, MAX_RECENT_PROJECTS);

        if (!cancelled) setRecentProjects(recent);
      } catch {
        // Error loading projects — show empty section
        if (!cancelled) setRecentProjects([]);
      }
    }

    fetchRecentProjects();
    return () => { cancelled = true; };
  }, [location.pathname]);

  // Filter nav items by role
  const isAdmin = user?.role === 'admin';

  // Check if a nav item is active
  const isActive = (path: string) => location.pathname === path;

  // Handle logout
  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Handle project click — track in recent projects
  const handleProjectClick = (projectId: string) => {
    // Update recent projects in localStorage
    const recentIds = readLocalStorage<string[]>(RECENT_PROJECTS_KEY, []);
    const updated = [projectId, ...recentIds.filter((id) => id !== projectId)].slice(0, MAX_RECENT_PROJECTS);
    writeLocalStorage(RECENT_PROJECTS_KEY, updated);
    navigate(`/projects/${projectId}`);
  };

  // --- Render helpers ---

  const renderNavItem = (item: NavItem) => {
    const active = isActive(item.path);
    const label = t(item.labelKey);

    const button = (
      <button
        key={item.key}
        onClick={() => navigate(item.path)}
        className={`
          w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors duration-200
          ${active
            ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
            : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700/50'
          }
          ${!isExpanded ? 'justify-center' : ''}
        `}
        aria-label={label}
        aria-current={active ? 'page' : undefined}
      >
        <span className="flex-shrink-0">{item.icon}</span>
        {isExpanded && (
          <span className="text-sm font-medium truncate">{label}</span>
        )}
      </button>
    );

    if (!isExpanded) {
      return (
        <Tooltip key={item.key} content={label} position="right">
          {button}
        </Tooltip>
      );
    }

    return button;
  };

  const renderRecentProjects = () => {
    if (recentProjects.length === 0) {
      if (isExpanded) {
        return (
          <p className="text-xs text-gray-400 dark:text-gray-500 px-3 py-1">
            {t('sidebar.noRecentProjects')}
          </p>
        );
      }
      return null;
    }

    return recentProjects.map((project) => {
      const projectButton = (
        <button
          key={project.id}
          onClick={() => handleProjectClick(project.id)}
          className={`
            w-full flex items-center gap-3 px-3 py-1.5 rounded-lg transition-colors duration-200
            text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700/50
            ${!isExpanded ? 'justify-center' : ''}
          `}
          aria-label={project.name}
        >
          <span className="flex-shrink-0 text-sm">{project.emoji || '📁'}</span>
          {isExpanded && (
            <span className="text-sm truncate">{project.name}</span>
          )}
        </button>
      );

      if (!isExpanded) {
        return (
          <Tooltip key={project.id} content={project.name} position="right">
            {projectButton}
          </Tooltip>
        );
      }

      return projectButton;
    });
  };

  // --- Sidebar content (shared between desktop and mobile) ---

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Top zone: Logo */}
      <div className={`flex items-center h-14 border-b border-gray-200 dark:border-gray-700 ${isExpanded ? 'px-4' : 'px-2 justify-center'}`}>
        <button
          onClick={() => navigate('/dashboard')}
          className="transition-opacity hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-purple-500 rounded-lg"
          aria-label="DiagramaHub"
        >
          {isExpanded ? (
            <span
              className="text-lg font-bold"
              style={{
                background: 'linear-gradient(135deg, #7c3aed, #a855f7, #9333ea)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              DiagramaHub
            </span>
          ) : (
            <span
              className="text-xl font-bold"
              style={{
                background: 'linear-gradient(135deg, #7c3aed, #a855f7, #9333ea)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              DH
            </span>
          )}
        </button>
      </div>

      {/* Navigation zone */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-1">
        {/* Main nav items */}
        {MAIN_NAV_ITEMS.map(renderNavItem)}

        {/* Admin section */}
        {isAdmin && (
          <>
            <div className="my-3 border-t border-gray-200 dark:border-gray-700" />
            {isExpanded && (
              <div className="px-3 mb-1">
                <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                  {t('sidebar.administration')}
                </span>
              </div>
            )}
            {!isExpanded && (
              <Tooltip content={t('sidebar.administration')} position="right">
                <div className="flex justify-center px-3 mb-1">
                  <svg className="w-4 h-4 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
              </Tooltip>
            )}
            {ADMIN_NAV_ITEMS.map(renderNavItem)}
          </>
        )}

        {/* Divider */}
        <div className="my-3 border-t border-gray-200 dark:border-gray-700" />

        {/* Recent projects section */}
        {isExpanded && (
          <div className="flex items-center justify-between px-3 mb-1">
            <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
              {t('sidebar.recentProjects')}
            </span>
            <button
              onClick={() => navigate('/dashboard')}
              className="text-xs text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300 font-medium"
            >
              {t('sidebar.viewAll')}
            </button>
          </div>
        )}
        {!isExpanded && (
          <Tooltip content={t('sidebar.recentProjects')} position="right">
            <div className="flex justify-center px-3 mb-1">
              <FolderIcon />
            </div>
          </Tooltip>
        )}
        {renderRecentProjects()}
      </nav>

      {/* Bottom zone */}
      <div className="border-t border-gray-200 dark:border-gray-700 px-2 py-3 space-y-2">
        {/* Theme toggle */}
        {isExpanded ? (
          <button
            onClick={toggleTheme}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700/50 transition-colors duration-200"
            aria-label={theme === 'light' ? t('sidebar.darkMode') : t('sidebar.lightMode')}
          >
            <span className="flex-shrink-0">{theme === 'light' ? <MoonIcon /> : <SunIcon />}</span>
            <span className="text-sm font-medium">
              {theme === 'light' ? t('sidebar.darkMode') : t('sidebar.lightMode')}
            </span>
          </button>
        ) : (
          <Tooltip content={theme === 'light' ? t('sidebar.darkMode') : t('sidebar.lightMode')} position="right">
            <button
              onClick={toggleTheme}
              className="w-full flex items-center justify-center px-3 py-2 rounded-lg text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700/50 transition-colors duration-200"
              aria-label={theme === 'light' ? t('sidebar.darkMode') : t('sidebar.lightMode')}
            >
              {theme === 'light' ? <MoonIcon /> : <SunIcon />}
            </button>
          </Tooltip>
        )}

        {/* Language selector */}
        {isExpanded && (
          <div className="px-1">
            <LanguageSelector />
          </div>
        )}

        {/* User info + logout */}
        {isExpanded ? (
          <div className="flex items-center gap-2 px-3 py-2">
            <button
              onClick={() => navigate('/profile')}
              className="flex-shrink-0 rounded-full hover:ring-2 hover:ring-purple-400 transition-all"
              aria-label={t('sidebar.profile')}
            >
              <PremiumAvatar size="sm" />
            </button>
            <button
              onClick={() => navigate('/profile')}
              className="flex-1 min-w-0 text-left hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
              aria-label={t('sidebar.profile')}
            >
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                {user?.full_name || user?.email || ''}
              </p>
            </button>
            <Tooltip content={t('common.logout')} position="top">
              <button
                onClick={handleLogout}
                className="flex-shrink-0 p-1 rounded-lg text-gray-500 hover:text-red-600 hover:bg-red-50 dark:text-gray-400 dark:hover:text-red-400 dark:hover:bg-red-900/20 transition-colors duration-200"
                aria-label={t('common.logout')}
              >
                <LogoutIcon />
              </button>
            </Tooltip>
          </div>
        ) : (
          <Tooltip content={t('sidebar.profile')} position="right">
            <button
              onClick={() => navigate('/profile')}
              className="w-full flex justify-center py-2"
              aria-label={t('sidebar.profile')}
            >
              <PremiumAvatar size="sm" />
            </button>
          </Tooltip>
        )}

        {/* Collapse/expand toggle */}
        <div className="hidden md:block">
          {isExpanded ? (
            <button
              onClick={toggleExpanded}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700/50 transition-colors duration-200"
              aria-label={t('sidebar.collapse')}
            >
              <span className="flex-shrink-0"><CollapseIcon /></span>
              <span className="text-sm">{t('sidebar.collapse')}</span>
            </button>
          ) : (
            <Tooltip content={t('sidebar.expand')} position="right">
              <button
                onClick={toggleExpanded}
                className="w-full flex items-center justify-center px-3 py-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700/50 transition-colors duration-200"
                aria-label={t('sidebar.expand')}
              >
                <ExpandIcon />
              </button>
            </Tooltip>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile hamburger button */}
      <button
        onClick={() => setIsMobileOpen(true)}
        className="fixed top-3 left-3 z-40 md:hidden p-2 rounded-lg bg-white dark:bg-gray-800 shadow-md border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        aria-label={t('sidebar.openMenu')}
      >
        <HamburgerIcon />
      </button>

      {/* Mobile overlay backdrop */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setIsMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Mobile sidebar overlay */}
      <aside
        className={`
          fixed top-0 left-0 z-50 h-full w-60 bg-white dark:bg-gray-800
          transform transition-transform duration-200 ease-in-out
          md:hidden
          ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
        role="navigation"
        aria-label="Sidebar"
      >
        {sidebarContent}
      </aside>

      {/* Desktop sidebar */}
      <aside
        className={`
          hidden md:flex flex-col fixed top-0 left-0 h-full z-30
          bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700
          transition-all duration-200 ease-in-out
          ${isExpanded ? 'w-60' : 'w-16'}
        `}
        role="navigation"
        aria-label="Sidebar"
      >
        {sidebarContent}
      </aside>
    </>
  );
}
