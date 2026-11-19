import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import apiService from '../../../services/api';
import { AdminUserMfaInfo, AdminUserStatusResult } from '../../../types/auth';
import { apiErrorMessage } from '../../../utils/apiError';
import { useDialogA11y } from '../../../hooks/useDialogA11y';
import ConfirmModal from '../../ConfirmModal';
import { BlockUserModal, DeleteUserModal } from './UserActionModals';
import { UserBillingPanel } from './UserBillingPanel';
import { DIAGRAM_TYPE_LABELS, formatDate, mfaMethodLabel } from '../../../utils/adminUsers';
import { AIProviderLogo, ShieldIcon, ShieldOffIcon, Spinner, StatusPill, UserAvatar } from './shared';

type DrawerTab = 'summary' | 'payments';
type SubModal = 'block' | 'delete' | 'resetMfa' | null;

interface UserDetailDrawerProps {
  user: AdminUserMfaInfo;
  /** The signed-in admin: they cannot block or delete themselves. */
  isSelf: boolean;
  onClose: () => void;
  onStatusChanged: (result: AdminUserStatusResult) => void;
  onDeleted: (subscriptionCancelled: boolean) => void;
  onMfaReset: (message: string) => void;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{title}</h3>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-gray-500 dark:text-gray-400">{label}</dt>
      <dd className="mt-0.5 text-sm text-gray-900 dark:text-gray-100">{children}</dd>
    </div>
  );
}

/** Side panel with a user's account, usage, security and payments, plus block / delete. */
export function UserDetailDrawer({ user, isSelf, onClose, onStatusChanged, onDeleted, onMfaReset }: UserDetailDrawerProps) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const [tab, setTab] = useState<DrawerTab>('summary');
  const [subModal, setSubModal] = useState<SubModal>(null);
  const [unblocking, setUnblocking] = useState(false);
  const [error, setError] = useState('');
  // The drawer hands Escape and focus to the dialog on top of it while one is open.
  const panelRef = useDialogA11y<HTMLDivElement>(subModal === null, onClose, !unblocking);

  useEffect(() => {
    setTab('summary');
    setError('');
  }, [user.id]);

  // Keep the page behind from scrolling while the panel is open.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  const unblock = async () => {
    setUnblocking(true);
    setError('');
    try {
      onStatusChanged(await apiService.adminSetUserStatus(user.id, true));
    } catch (err: unknown) {
      setError(apiErrorMessage(err) || t('admin.users.errorStatus'));
    } finally {
      setUnblocking(false);
    }
  };

  const resetMfa = async () => {
    try {
      const response = await apiService.adminResetUserMfa(user.id);
      onMfaReset(response.message);
    } catch (err: unknown) {
      setError(apiErrorMessage(err) || t('admin.users.errorResetting'));
    }
  };

  const typeCounts = Object.entries(user.diagram_type_counts || {});

  return createPortal(
    <>
      <div className="fixed inset-0 z-50 bg-black/40" aria-hidden="true" onClick={subModal ? undefined : onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="user-drawer-title"
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-xl flex-col bg-white shadow-lg ring-1 ring-black/5 dark:bg-gray-900 dark:ring-white/10"
      >
        {/* Header */}
        <div className="flex items-start gap-3 border-b border-gray-200 px-5 py-4 dark:border-gray-800">
          <UserAvatar name={user.full_name} email={user.email} size="lg" />
          <div className="min-w-0 flex-1">
            <h2 id="user-drawer-title" className="truncate text-base font-semibold text-gray-900 dark:text-gray-100">
              {user.full_name || user.email}
            </h2>
            <p className="truncate text-sm text-gray-500 dark:text-gray-400">{user.email}</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <StatusPill tone={user.is_active ? 'green' : 'red'}>
                {user.is_active ? t('admin.users.statusActive') : t('admin.users.statusBlocked')}
              </StatusPill>
              {user.role === 'admin' && <span className="badge">{t('admin.users.admin')}</span>}
              {user.is_paying && <StatusPill tone="green">{t('admin.users.paying')}</StatusPill>}
            </div>
          </div>
          <button type="button" onClick={onClose} className="btn btn-ghost btn-sm !px-2" aria-label={t('admin.users.close')}>
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div role="tablist" aria-label={t('common.tabs')} className="flex gap-1 border-b border-gray-200 px-5 dark:border-gray-800">
          {(['summary', 'payments'] as DrawerTab[]).map((id) => (
            <button
              key={id}
              type="button"
              role="tab"
              id={`user-tab-${id}`}
              aria-selected={tab === id}
              aria-controls={`user-tabpanel-${id}`}
              onClick={() => setTab(id)}
              className={`relative -mb-px border-b-2 px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/50 ${
                tab === id
                  ? 'border-purple-600 text-gray-900 dark:border-purple-400 dark:text-gray-100'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
              }`}
            >
              {id === 'summary' ? t('admin.users.tabSummary') : t('admin.users.tabPayments')}
            </button>
          ))}
        </div>

        {/* Body */}
        <div
          role="tabpanel"
          id={`user-tabpanel-${tab}`}
          aria-labelledby={`user-tab-${tab}`}
          className="flex-1 overflow-y-auto px-5 py-5"
        >
          {error && (
            <p className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-700 dark:bg-red-900/20 dark:text-red-400">
              {error}
            </p>
          )}

          {tab === 'payments' ? (
            <UserBillingPanel userId={user.id} />
          ) : (
            <div className="space-y-6">
              {!user.is_active && (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-700 dark:bg-red-900/20 dark:text-red-300">
                  <p>
                    {t('admin.users.blockedInfo', {
                      date: formatDate(user.blocked_at, lang),
                      by: user.blocked_by || '—',
                    })}
                  </p>
                  {user.blocked_reason && <p className="mt-0.5">{t('admin.users.blockedReason', { reason: user.blocked_reason })}</p>}
                </div>
              )}

              <Section title={t('admin.users.sectionAccount')}>
                <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
                  <Field label={t('admin.users.role')}>{user.role === 'admin' ? t('admin.users.admin') : t('admin.users.columnUser')}</Field>
                  <Field label={t('admin.users.columnPlan')}>{user.plan_name || t('admin.users.freePlan')}</Field>
                  <Field label={t('admin.users.registeredAt')}>{formatDate(user.created_at, lang)}</Field>
                  <Field label={t('admin.users.lastLogin')}>{formatDate(user.last_login_at, lang, t('admin.users.never'))}</Field>
                </dl>
              </Section>

              <Section title={t('admin.users.sectionUsage')}>
                <div className="flex flex-wrap items-center gap-1.5 text-sm">
                  <span className="rounded-md bg-gray-100 px-2 py-1 text-gray-700 dark:bg-gray-800 dark:text-gray-200">
                    <strong className="tabular-nums">{user.project_count}</strong> {user.project_count === 1 ? t('admin.users.project') : t('admin.users.projects')}
                  </span>
                  <span className="rounded-md bg-gray-100 px-2 py-1 text-gray-700 dark:bg-gray-800 dark:text-gray-200">
                    <strong className="tabular-nums">{user.diagram_count}</strong> {user.diagram_count === 1 ? t('admin.users.diagram') : t('admin.users.diagrams')}
                  </span>
                  {typeCounts.map(([type, count]) => (
                    <span key={type} className="rounded-md px-2 py-1 text-xs text-gray-600 ring-1 ring-inset ring-gray-200 dark:text-gray-300 dark:ring-gray-700">
                      {count} {DIAGRAM_TYPE_LABELS[type] || type.toUpperCase()}
                    </span>
                  ))}
                </div>
              </Section>

              <Section title={t('admin.users.sectionAi')}>
                {user.connected_ai_models.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400">{t('admin.users.noAiModels')}</p>
                ) : (
                  <ul className="space-y-1.5">
                    {user.connected_ai_models.map((model) => (
                      <li key={`${model.provider}-${model.model}`} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                        <AIProviderLogo provider={model.provider} />
                        <span className="font-medium capitalize">{model.display_name || model.provider}</span>
                        <span className="truncate text-gray-500 dark:text-gray-400">{model.model}</span>
                        {model.is_default && <span className="badge ml-auto">{t('admin.users.defaultModel')}</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </Section>

              <Section title={t('admin.users.sectionSecurity')}>
                <div className="flex items-center justify-between gap-3">
                  {user.mfa_enabled ? (
                    <div className="flex items-center gap-2 text-sm">
                      <ShieldIcon className="h-5 w-5 text-green-600 dark:text-green-400" />
                      <span>
                        <span className="font-medium text-gray-900 dark:text-gray-100">MFA · {user.mfa_methods.map(mfaMethodLabel).join(', ')}</span>
                        <span className="block text-xs text-gray-500 dark:text-gray-400">
                          {user.mfa_default_method && `${t('admin.users.defaultMethod', { method: mfaMethodLabel(user.mfa_default_method) })} · `}
                          {t('admin.users.recoveryCodes', { count: user.recovery_codes_remaining })}
                        </span>
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                      <ShieldOffIcon className="h-5 w-5" />
                      MFA · {t('admin.users.noMfa')}
                    </div>
                  )}
                  {user.mfa_enabled && (
                    <button type="button" onClick={() => setSubModal('resetMfa')} className="btn btn-danger btn-sm shrink-0">
                      {t('admin.users.resetMfa')}
                    </button>
                  )}
                </div>
              </Section>

              <Section title={t('admin.users.sectionDanger')}>
                {isSelf ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400">{t('admin.users.selfActionsDisabled')}</p>
                ) : (
                  <div className="divide-y divide-gray-200 rounded-lg border border-gray-200 dark:divide-gray-800 dark:border-gray-800">
                    <div className="flex items-center justify-between gap-3 px-4 py-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {user.is_active ? t('admin.users.block') : t('admin.users.unblock')}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {user.is_active ? t('admin.users.blockDescription') : t('admin.users.unblockDescription')}
                        </p>
                      </div>
                      {user.is_active ? (
                        <button type="button" onClick={() => setSubModal('block')} className="btn btn-danger btn-sm shrink-0">
                          {t('admin.users.block')}
                        </button>
                      ) : (
                        <button type="button" onClick={unblock} disabled={unblocking} className="btn btn-secondary btn-sm shrink-0">
                          {unblocking && <Spinner />}
                          {t('admin.users.unblock')}
                        </button>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-3 px-4 py-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{t('admin.users.delete')}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{t('admin.users.deleteDescription')}</p>
                      </div>
                      <button type="button" onClick={() => setSubModal('delete')} className="btn btn-danger btn-sm shrink-0">
                        {t('admin.users.delete')}
                      </button>
                    </div>
                  </div>
                )}
              </Section>
            </div>
          )}
        </div>
      </div>

      {subModal === 'block' && (
        <BlockUserModal
          user={user}
          onClose={() => setSubModal(null)}
          onBlocked={(result) => {
            setSubModal(null);
            onStatusChanged(result);
          }}
        />
      )}
      {subModal === 'delete' && (
        <DeleteUserModal user={user} onClose={() => setSubModal(null)} onDeleted={onDeleted} />
      )}
      <ConfirmModal
        isOpen={subModal === 'resetMfa'}
        onClose={() => setSubModal(null)}
        onConfirm={resetMfa}
        title={t('admin.users.resetMfa')}
        message={t('admin.users.resetMfaMessage', { email: user.email })}
        confirmText={t('admin.users.resetMfa')}
        isDangerous
      />
    </>,
    document.body,
  );
}
