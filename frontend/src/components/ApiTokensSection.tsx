import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import apiService from '../services/api';
import type { ApiToken, ApiTokenScope, CreateApiTokenRequest, CreatedApiToken } from '../types/apiTokens';
import { dateLocale } from '../utils/locale';
import { apiErrorMessage } from '../utils/apiError';
import ConfirmModal from './ConfirmModal';

const EXPIRATIONS: CreateApiTokenRequest['expires_in_days'][] = [30, 90, 365, null];

const inputClass =
  'w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-gray-700 dark:text-gray-100';
const primaryButtonClass =
  'bg-purple-600 text-white btn-glass py-3 px-6 rounded-lg font-semibold hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors';
const secondaryButtonClass =
  'px-6 py-3 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 font-semibold hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors';

/** Settings section to create, list and revoke personal API tokens. */
export function ApiTokensSection() {
  const { t, i18n } = useTranslation();
  const [tokens, setTokens] = useState<ApiToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [scope, setScope] = useState<ApiTokenScope>('read');
  const [expiresIn, setExpiresIn] = useState<CreateApiTokenRequest['expires_in_days']>(90);
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<CreatedApiToken | null>(null);
  const [copied, setCopied] = useState(false);
  const [toRevoke, setToRevoke] = useState<ApiToken | null>(null);

  const load = useCallback(async () => {
    try {
      setTokens(await apiService.listApiTokens());
      setError(null);
    } catch {
      setError(t('apiTokens.loadError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!showCreate) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !creating) closeCreate();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [showCreate, creating]);

  const formatDate = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString(dateLocale(i18n.language), { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

  const closeCreate = () => {
    setShowCreate(false);
    setCreated(null);
    setCopied(false);
    setName('');
    setScope('read');
    setExpiresIn(90);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const token = await apiService.createApiToken({ name: name.trim(), scope, expires_in_days: expiresIn });
      setCreated(token);
      await load();
    } catch (err: unknown) {
      setError(apiErrorMessage(err) || t('apiTokens.createError'));
    } finally {
      setCreating(false);
    }
  };

  const handleCopy = async () => {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created.token);
      setCopied(true);
    } catch {
      /* the token stays selectable in the field */
    }
  };

  const handleRevoke = async () => {
    if (!toRevoke) return;
    try {
      await apiService.revokeApiToken(toRevoke.id);
      setTokens((prev) => prev.filter((tk) => tk.id !== toRevoke.id));
    } catch {
      setError(t('apiTokens.revokeError'));
    } finally {
      setToRevoke(null);
    }
  };

  const expired = (tk: ApiToken) => tk.expires_at !== null && new Date(tk.expires_at) <= new Date();

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
      <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100">{t('apiTokens.title')}</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{t('apiTokens.subtitle')}</p>
          </div>
          <button type="button" onClick={() => setShowCreate(true)} className={`${primaryButtonClass} self-start sm:self-auto flex-shrink-0`}>
            {t('apiTokens.create')}
          </button>
        </div>
      </div>

      <div className="px-4 sm:px-6 py-4">
        {error && !showCreate && (
          <div className="mb-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}
        {loading ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('common.loading')}</p>
        ) : tokens.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('apiTokens.empty')}</p>
        ) : (
          <ul className="divide-y divide-gray-200 dark:divide-gray-700">
            {tokens.map((tk) => (
              <li key={tk.id} className="py-3 flex flex-col sm:flex-row sm:items-center gap-2 justify-between">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-gray-100">
                    <span className="truncate">{tk.name}</span>
                    <span
                      className={`px-1.5 py-0.5 text-[10px] font-semibold rounded-full ${
                        tk.scope === 'write'
                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                          : 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300'
                      }`}
                    >
                      {t(`apiTokens.scope.${tk.scope}`)}
                    </span>
                    {expired(tk) && (
                      <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded-full bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                        {t('apiTokens.expired')}
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                    <span className="font-mono">{tk.token_hint}</span>
                    {' · '}
                    {t('apiTokens.createdOn', { date: formatDate(tk.created_at) })}
                    {' · '}
                    {tk.expires_at ? t('apiTokens.expiresOn', { date: formatDate(tk.expires_at) }) : t('apiTokens.neverExpires')}
                    {' · '}
                    {tk.last_used_at ? t('apiTokens.lastUsed', { date: formatDate(tk.last_used_at) }) : t('apiTokens.neverUsed')}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setToRevoke(tk)}
                  className="self-start sm:self-auto px-3 py-2 text-sm font-medium text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 focus:outline-none focus:ring-2 focus:ring-red-500 transition-colors"
                >
                  {t('apiTokens.revoke')}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {showCreate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true" aria-labelledby="api-token-dialog-title">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h3 id="api-token-dialog-title" className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {created ? t('apiTokens.createdTitle') : t('apiTokens.createTitle')}
              </h3>
            </div>

            {created ? (
              <>
                <div className="px-6 py-4 space-y-3">
                  <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 px-4 py-3 rounded-lg text-sm">
                    {t('apiTokens.copyNow')}
                  </div>
                  <input
                    type="text"
                    readOnly
                    value={created.token}
                    onFocus={(e) => e.currentTarget.select()}
                    aria-label={t('apiTokens.tokenLabel')}
                    className={`${inputClass} font-mono text-xs bg-gray-50 dark:bg-gray-700`}
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400">{t('apiTokens.usage')}</p>
                  <code className="block text-[11px] bg-gray-50 dark:bg-gray-900 text-gray-700 dark:text-gray-300 rounded px-2 py-1.5 overflow-x-auto">
                    curl -H "Authorization: Bearer {created.token_hint}" …/api/v1/projects
                  </code>
                </div>
                <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900/50 rounded-b-lg flex gap-3 justify-end">
                  <button type="button" onClick={handleCopy} className={secondaryButtonClass}>
                    {copied ? t('apiTokens.copied') : t('apiTokens.copy')}
                  </button>
                  <button type="button" onClick={closeCreate} className={primaryButtonClass}>
                    {t('apiTokens.done')}
                  </button>
                </div>
              </>
            ) : (
              <form onSubmit={handleCreate}>
                <div className="px-6 py-4 space-y-4">
                  <div>
                    <label htmlFor="api-token-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {t('apiTokens.name')} <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="api-token-name"
                      type="text"
                      value={name}
                      maxLength={60}
                      onChange={(e) => setName(e.target.value)}
                      placeholder={t('apiTokens.namePlaceholder')}
                      className={inputClass}
                      autoFocus
                    />
                  </div>
                  <fieldset>
                    <legend className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('apiTokens.access')}</legend>
                    {(['read', 'write'] as ApiTokenScope[]).map((value) => (
                      <label key={value} className="flex items-start gap-2 py-1 text-sm text-gray-700 dark:text-gray-300">
                        <input
                          type="radio"
                          name="api-token-scope"
                          value={value}
                          checked={scope === value}
                          onChange={() => setScope(value)}
                          className="mt-0.5 text-purple-600 focus:ring-purple-500"
                        />
                        <span>
                          <span className="font-medium">{t(`apiTokens.scope.${value}`)}</span>
                          <span className="block text-xs text-gray-500 dark:text-gray-400">{t(`apiTokens.scopeDesc.${value}`)}</span>
                        </span>
                      </label>
                    ))}
                  </fieldset>
                  <div>
                    <label htmlFor="api-token-expiry" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {t('apiTokens.expiration')}
                    </label>
                    <select
                      id="api-token-expiry"
                      value={expiresIn === null ? 'never' : String(expiresIn)}
                      onChange={(e) => setExpiresIn(e.target.value === 'never' ? null : (Number(e.target.value) as 30 | 90 | 365))}
                      className={inputClass}
                    >
                      {EXPIRATIONS.map((days) => (
                        <option key={days ?? 'never'} value={days === null ? 'never' : String(days)}>
                          {days === null ? t('apiTokens.never') : t('apiTokens.days', { count: days })}
                        </option>
                      ))}
                    </select>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{t('apiTokens.reach')}</p>
                  {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
                </div>
                <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900/50 rounded-b-lg flex gap-3 justify-end">
                  <button type="button" onClick={closeCreate} disabled={creating} className={secondaryButtonClass}>
                    {t('common.cancel')}
                  </button>
                  <button type="submit" disabled={creating || !name.trim()} className={primaryButtonClass}>
                    {creating ? t('apiTokens.creating') : t('apiTokens.create')}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={toRevoke !== null}
        onClose={() => setToRevoke(null)}
        onConfirm={handleRevoke}
        title={t('apiTokens.revokeTitle')}
        message={t('apiTokens.revokeMessage', { name: toRevoke?.name ?? '' })}
        confirmText={t('apiTokens.revoke')}
        isDangerous
      />
    </div>
  );
}
