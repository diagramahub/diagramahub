import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useDialogA11y } from '../../hooks/useDialogA11y';
import { rememberReturnTo } from '../../utils/returnTo';

export type AccountGateReason = 'star' | 'fork' | 'comment' | 'report' | 'publish' | 'tabs';

interface SignInPromptModalProps {
  reason: AccountGateReason | null;
  onClose: () => void;
}

/** Asks an anonymous visitor to create an account (or sign in) and come back here. */
export function SignInPromptModal({ reason, onClose }: SignInPromptModalProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const panelRef = useDialogA11y(reason !== null, onClose);
  if (!reason) return null;

  const here = location.pathname + location.search;
  const go = (path: '/register' | '/login') => {
    rememberReturnTo(here);
    navigate(`${path}?next=${encodeURIComponent(here)}`);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="signin-prompt-title"
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-gray-900 rounded-xl shadow-lg ring-1 ring-black/5 dark:ring-white/10 w-full max-w-sm p-6 text-center"
      >
        <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-purple-100 text-purple-600 dark:bg-purple-500/15 dark:text-purple-300">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
          </svg>
        </div>
        <h2 id="signin-prompt-title" className="text-lg font-semibold text-gray-900 dark:text-gray-100">{t('community.signIn.title')}</h2>
        <p className="mt-1.5 text-sm text-gray-600 dark:text-gray-300">{t(`community.signIn.reasons.${reason}`)}</p>
        <div className="mt-5 flex flex-col gap-2">
          <button type="button" onClick={() => go('/register')} className="btn btn-primary w-full">{t('community.signIn.register')}</button>
          <button type="button" onClick={() => go('/login')} className="btn btn-secondary w-full">{t('community.signIn.login')}</button>
          <button type="button" onClick={onClose} className="btn btn-ghost w-full">{t('community.signIn.notNow')}</button>
        </div>
        <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">{t('community.signIn.comeBack')}</p>
      </div>
    </div>
  );
}
