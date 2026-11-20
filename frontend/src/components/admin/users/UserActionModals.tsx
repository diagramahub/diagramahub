import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import apiService from '../../../services/api';
import { AdminUserMfaInfo, AdminUserStatusResult } from '../../../types/auth';
import { apiErrorMessage } from '../../../utils/apiError';
import { useDialogA11y } from '../../../hooks/useDialogA11y';
import { Spinner } from './shared';

interface ModalShellProps {
  title: string;
  onClose: () => void;
  busy: boolean;
  children: React.ReactNode;
  footer: React.ReactNode;
}

function ModalShell({ title, onClose, busy, children, footer }: ModalShellProps) {
  const panelRef = useDialogA11y<HTMLDivElement>(true, onClose, !busy);
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-user-modal-title"
        className="w-full max-w-md rounded-xl bg-white shadow-lg ring-1 ring-black/5 dark:bg-gray-900 dark:ring-white/10"
      >
        <div className="flex items-center gap-3 border-b border-gray-200 px-6 py-4 dark:border-gray-800">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
            <svg className="h-5 w-5 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </span>
          <h3 id="admin-user-modal-title" className="min-w-0 flex-1 break-words text-base font-semibold text-gray-900 dark:text-gray-100">
            {title}
          </h3>
        </div>
        <div className="space-y-3 px-6 py-4 text-sm">{children}</div>
        <div className="flex justify-end gap-2 rounded-b-xl bg-gray-50 px-6 py-4 dark:bg-gray-950/50">{footer}</div>
      </div>
    </div>
  );
}

function Warning({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
      {children}
    </p>
  );
}

interface BlockUserModalProps {
  user: AdminUserMfaInfo;
  onClose: () => void;
  onBlocked: (result: AdminUserStatusResult) => void;
}

/** Asks for an optional reason and blocks the account. */
export function BlockUserModal({ user, onClose, onBlocked }: BlockUserModalProps) {
  const { t } = useTranslation();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      onBlocked(await apiService.adminSetUserStatus(user.id, false, reason.trim()));
    } catch (err: unknown) {
      setError(apiErrorMessage(err) || t('admin.users.errorStatus'));
      setBusy(false);
    }
  };

  return (
    <ModalShell
      title={t('admin.users.blockTitle', { email: user.email })}
      onClose={onClose}
      busy={busy}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={busy} className="btn btn-secondary">
            {t('common.cancel')}
          </button>
          <button type="button" onClick={submit} disabled={busy} className="btn btn-destructive">
            {busy && <Spinner />}
            {busy ? t('common.processing') : t('admin.users.blockConfirm')}
          </button>
        </>
      }
    >
      <p className="text-gray-600 dark:text-gray-400">{t('admin.users.blockMessage')}</p>
      {user.is_paying && <Warning>{t('admin.users.blockPayingWarning')}</Warning>}
      <div>
        <label htmlFor="block-reason" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
          {t('admin.users.blockReasonLabel')}
        </label>
        <textarea
          id="block-reason"
          rows={3}
          maxLength={500}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="input h-auto py-2"
        />
      </div>
      {error && <p className="text-red-600 dark:text-red-400">{error}</p>}
    </ModalShell>
  );
}

interface DeleteUserModalProps {
  user: AdminUserMfaInfo;
  onClose: () => void;
  onDeleted: (subscriptionCancelled: boolean) => void;
}

/** Deletes the account once the admin retypes the user's email. */
export function DeleteUserModal({ user, onClose, onDeleted }: DeleteUserModalProps) {
  const { t } = useTranslation();
  const [confirmEmail, setConfirmEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const matches = confirmEmail.trim().toLowerCase() === user.email.toLowerCase();

  const submit = async () => {
    if (!matches) return;
    setBusy(true);
    setError('');
    try {
      const result = await apiService.adminDeleteUser(user.id, confirmEmail.trim());
      onDeleted(result.subscription_cancelled);
    } catch (err: unknown) {
      setError(apiErrorMessage(err) || t('admin.users.errorDeleting'));
      setBusy(false);
    }
  };

  return (
    <ModalShell
      title={t('admin.users.deleteTitle', { email: user.email })}
      onClose={onClose}
      busy={busy}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={busy} className="btn btn-secondary">
            {t('common.cancel')}
          </button>
          <button type="button" onClick={submit} disabled={busy || !matches} className="btn btn-destructive">
            {busy && <Spinner />}
            {busy ? t('common.processing') : t('admin.users.deleteConfirm')}
          </button>
        </>
      }
    >
      <p className="text-gray-600 dark:text-gray-400">{t('admin.users.deleteMessage')}</p>
      {user.is_paying && <Warning>{t('admin.users.deletePayingWarning')}</Warning>}
      <div>
        <label htmlFor="delete-confirm-email" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
          {t('admin.users.deleteConfirmLabel')}
        </label>
        <input
          id="delete-confirm-email"
          type="email"
          autoComplete="off"
          value={confirmEmail}
          placeholder={user.email}
          onChange={(e) => setConfirmEmail(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void submit();
          }}
          className="input"
        />
      </div>
      {error && <p className="text-red-600 dark:text-red-400">{error}</p>}
    </ModalShell>
  );
}
