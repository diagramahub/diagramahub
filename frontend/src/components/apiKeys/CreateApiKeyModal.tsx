import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import apiService from '../../services/api';
import { useDialogA11y } from '../../hooks/useDialogA11y';
import { apiErrorMessage } from '../../utils/apiError';
import { API_KEY_AREAS, AREA_LEVELS, levelLabel, matchingPreset, presetPermissions, snippet, type ApiKeyPreset } from '../../utils/apiKeys';
import type { AccessLevel, ApiKeyPermissions, CreateApiTokenRequest, CreatedApiToken } from '../../types/apiTokens';

const EXPIRATIONS: CreateApiTokenRequest['expires_in_days'][] = [30, 90, 365, null];

interface CreateApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
  baseUrl: string;
}

/** Create an API key: name, expiration and access per area; then show it once. */
export function CreateApiKeyModal({ isOpen, onClose, onCreated, baseUrl }: CreateApiKeyModalProps) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [expiresIn, setExpiresIn] = useState<CreateApiTokenRequest['expires_in_days']>(90);
  const [permissions, setPermissions] = useState<ApiKeyPermissions>(presetPermissions('read'));
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedApiToken | null>(null);
  const [copied, setCopied] = useState(false);

  const reset = () => {
    setName('');
    setExpiresIn(90);
    setPermissions(presetPermissions('read'));
    setError(null);
    setCreated(null);
    setCopied(false);
  };
  const close = () => {
    if (creating) return;
    reset();
    onClose();
  };
  const panelRef = useDialogA11y(isOpen, close, !creating);

  if (!isOpen) return null;

  const preset = matchingPreset(permissions);
  const hasAccess = API_KEY_AREAS.some((area) => permissions[area] !== 'none');

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !hasAccess) return;
    setCreating(true);
    setError(null);
    try {
      setCreated(await apiService.createApiToken({ name: name.trim(), permissions, expires_in_days: expiresIn }));
      onCreated();
    } catch (err: unknown) {
      setError(apiErrorMessage(err) || t('apiKeys.createError'));
    } finally {
      setCreating(false);
    }
  };

  const copy = async () => {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created.token);
      setCopied(true);
    } catch {
      /* the key stays selectable in the field */
    }
  };

  const segment = (on: boolean, level: AccessLevel) =>
    `h-7 px-2.5 text-xs font-medium rounded transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/50 ${
      on
        ? level === 'none'
          ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white'
          : level === 'read'
            ? 'bg-purple-600 text-white shadow-sm'
            : 'bg-amber-500 text-white shadow-sm'
        : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100'
    }`;

  const presetButton = (value: ApiKeyPreset | null, label: string) => (
    <button
      type="button"
      onClick={() => value && setPermissions(presetPermissions(value))}
      disabled={value === null}
      aria-pressed={preset === value}
      className={`h-8 px-3 rounded-md border text-xs font-medium whitespace-nowrap transition-colors disabled:cursor-default ${
        preset === value
          ? 'border-purple-500 bg-purple-50 text-purple-700 dark:border-purple-400 dark:bg-purple-500/10 dark:text-purple-300'
          : 'border-gray-200 text-gray-600 hover:border-gray-300 dark:border-gray-800 dark:text-gray-300 dark:hover:border-gray-700'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2 sm:p-6">
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="api-key-dialog-title"
        className="bg-white dark:bg-gray-900 rounded-xl shadow-lg ring-1 ring-black/5 dark:ring-white/10 w-full max-w-2xl max-h-[92vh] flex flex-col"
      >
        <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-800">
          <h3 id="api-key-dialog-title" className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {created ? t('apiKeys.createdTitle') : t('apiKeys.createTitle')}
          </h3>
          {!created && <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{t('apiKeys.createSubtitle')}</p>}
        </div>

        {created ? (
          <>
            <div className="px-5 py-4 space-y-4 overflow-y-auto">
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 px-4 py-3 rounded-lg text-sm" role="status">
                {t('apiKeys.copyNow')}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={created.token}
                  onFocus={(e) => e.currentTarget.select()}
                  aria-label={t('apiKeys.keyLabel')}
                  className="input font-mono text-xs bg-gray-50 dark:bg-gray-950"
                />
                <button type="button" onClick={copy} className="btn btn-secondary flex-shrink-0">
                  {copied ? t('apiKeys.copied') : t('apiKeys.copy')}
                </button>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{t('apiKeys.tryIt')}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{t('apiKeys.tryItHint')}</p>
                <pre className="mt-2 text-xs leading-5 font-mono bg-gray-50 dark:bg-gray-950 text-gray-800 dark:text-gray-200 rounded-lg border border-gray-200 dark:border-gray-800 p-3 overflow-x-auto">
                  {`export DIAGRAMAHUB_API_KEY="${created.token}"\n${snippet({ method: 'GET', path: created.permissions.projects !== 'none' ? '/projects' : '/diagrams/recent' }, baseUrl, 'curl')}`}
                </pre>
              </div>
            </div>
            <div className="px-5 py-3 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950/50 rounded-b-xl flex justify-end">
              <button type="button" onClick={close} className="btn btn-primary">{t('apiKeys.done')}</button>
            </div>
          </>
        ) : (
          <form onSubmit={create} className="flex flex-col min-h-0">
            <div className="px-5 py-4 space-y-5 overflow-y-auto">
              <div className="grid sm:grid-cols-[1fr_11rem] gap-4">
                <div>
                  <label htmlFor="api-key-name" className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">
                    {t('apiKeys.name')} <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="api-key-name"
                    type="text"
                    value={name}
                    maxLength={60}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t('apiKeys.namePlaceholder')}
                    className="input"
                    autoFocus
                  />
                </div>
                <div>
                  <label htmlFor="api-key-expiry" className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">
                    {t('apiKeys.expiration')}
                  </label>
                  <select
                    id="api-key-expiry"
                    value={expiresIn === null ? 'never' : String(expiresIn)}
                    onChange={(e) => setExpiresIn(e.target.value === 'never' ? null : (Number(e.target.value) as 30 | 90 | 365))}
                    className="input"
                  >
                    {EXPIRATIONS.map((days) => (
                      <option key={days ?? 'never'} value={days === null ? 'never' : String(days)}>
                        {days === null ? t('apiKeys.never') : t('apiKeys.days', { count: days })}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <fieldset>
                <div className="flex flex-wrap items-end justify-between gap-2">
                  <legend className="text-sm font-medium text-gray-900 dark:text-gray-100">{t('apiKeys.permissions')}</legend>
                  <div className="flex flex-wrap gap-1.5">
                    {presetButton('read', t('apiKeys.presets.read'))}
                    {presetButton('write', t('apiKeys.presets.write'))}
                    {presetButton(null, t('apiKeys.presets.custom'))}
                  </div>
                </div>
                <ul className="mt-3 divide-y divide-gray-200 dark:divide-gray-800 rounded-lg border border-gray-200 dark:border-gray-800">
                  {API_KEY_AREAS.map((area) => (
                    <li key={area} className="px-3 py-2.5 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{t(`apiKeys.areas.${area}.name`)}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{t(`apiKeys.areas.${area}.description`)}</p>
                      </div>
                      <div role="radiogroup" aria-label={t(`apiKeys.areas.${area}.name`)} className="inline-flex self-start sm:self-auto rounded-md bg-gray-100 dark:bg-gray-800 p-0.5">
                        {AREA_LEVELS[area].map((level) => (
                          <button
                            key={level}
                            type="button"
                            role="radio"
                            aria-checked={permissions[area] === level}
                            onClick={() => setPermissions((p) => ({ ...p, [area]: level }))}
                            className={segment(permissions[area] === level, level)}
                          >
                            {levelLabel(t, area, level)}
                          </button>
                        ))}
                      </div>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">{t('apiKeys.permissionsHint')}</p>
                {!hasAccess && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{t('apiKeys.noAccess')}</p>}
              </fieldset>
              {error && <p className="text-sm text-red-600 dark:text-red-400" role="alert">{error}</p>}
            </div>
            <div className="px-5 py-3 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950/50 rounded-b-xl flex gap-2 justify-end">
              <button type="button" onClick={close} disabled={creating} className="btn btn-secondary">{t('common.cancel')}</button>
              <button type="submit" disabled={creating || !name.trim() || !hasAccess} className="btn btn-primary">
                {creating ? t('apiKeys.creating') : t('apiKeys.create')}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
