import { Component, type ErrorInfo, type ReactNode } from 'react';
import { withTranslation, type WithTranslation } from 'react-i18next';
import { CHUNK_RELOAD_KEY, isChunkLoadError, shouldAutoReload } from '../utils/chunkError';

interface RouteErrorBoundaryProps extends WithTranslation {
  children: ReactNode;
}

interface RouteErrorBoundaryState {
  error: Error | null;
}

function readLastReload(): number | null {
  try {
    const value = sessionStorage.getItem(CHUNK_RELOAD_KEY);
    return value ? Number(value) : null;
  } catch {
    return null;
  }
}

/**
 * Catches render errors of a route so one broken page doesn't blank the app.
 *
 * A route chunk that fails to load (usually a deploy replaced it) reloads the
 * page once to fetch the new build; any other error shows a message with a
 * reload button. Error boundaries must be class components.
 */
class RouteErrorBoundaryBase extends Component<RouteErrorBoundaryProps, RouteErrorBoundaryState> {
  state: RouteErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): RouteErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    if (isChunkLoadError(error) && shouldAutoReload(readLastReload(), Date.now())) {
      try {
        sessionStorage.setItem(CHUNK_RELOAD_KEY, String(Date.now()));
      } catch {
        /* storage blocked: still reload once */
      }
      window.location.reload();
      return;
    }
    console.error('Route error:', error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    const { t, children } = this.props;
    if (!error) return children;
    const chunk = isChunkLoadError(error);
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4" role="alert">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6 max-w-md w-full text-center">
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {chunk ? t('errorBoundary.chunkTitle') : t('errorBoundary.title')}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            {chunk ? t('errorBoundary.chunkMessage') : t('errorBoundary.message')}
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-5 bg-purple-600 text-white btn-glass py-3 px-6 rounded-lg font-semibold hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 transition-colors"
          >
            {t('errorBoundary.reload')}
          </button>
        </div>
      </div>
    );
  }
}

export const RouteErrorBoundary = withTranslation()(RouteErrorBoundaryBase);
