import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import SidebarLayout from '../SidebarLayout';
import LanguageSelector from '../LanguageSelector';
import ThemeToggleButton from '../ThemeToggleButton';
import { BrandLogo } from '../BrandLogo';
import { rememberReturnTo } from '../../utils/returnTo';

/**
 * The community is public: signed-in users get the app's sidebar, anonymous
 * visitors a light header with sign-in and sign-up (both come back here).
 */
export function CommunityShell({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();
  const { t } = useTranslation();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" role="status" aria-label={t('common.loading')} />
      </div>
    );
  }
  if (isAuthenticated) return <SidebarLayout>{children}</SidebarLayout>;

  const here = location.pathname + location.search;
  const next = `?next=${encodeURIComponent(here)}`;
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col">
      <header className="sticky top-0 z-30 h-14 border-b border-gray-200 dark:border-gray-800 bg-white/90 dark:bg-gray-950/90 backdrop-blur">
        <div className="max-w-7xl mx-auto h-full px-4 sm:px-6 flex items-center gap-2 sm:gap-3">
          <Link to="/community" className="flex items-center gap-2 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500" aria-label={t('community.title')}>
            <BrandLogo size="md" markOnly className="sm:hidden" />
            <BrandLogo size="md" className="hidden sm:inline-flex" />
          </Link>
          <span className="hidden sm:inline text-gray-300 dark:text-gray-700" aria-hidden="true">/</span>
          <Link to="/community" className="hidden sm:inline text-sm font-medium text-gray-700 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white">
            {t('community.title')}
          </Link>
          <div className="ml-auto flex items-center gap-1 sm:gap-2 min-w-0">
            <span className="hidden sm:inline-flex"><LanguageSelector compact /></span>
            <ThemeToggleButton />
            <Link to={`/login${next}`} onClick={() => rememberReturnTo(here)} className="btn btn-ghost btn-sm">
              {t('community.signIn.login')}
            </Link>
            <Link to={`/register${next}`} onClick={() => rememberReturnTo(here)} className="btn btn-primary btn-sm">
              {t('community.signIn.registerShort')}
            </Link>
          </div>
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
