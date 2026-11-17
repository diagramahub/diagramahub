import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import apiService from '../services/api';
import ConfirmModal from '../components/ConfirmModal';
import { CreateApiKeyModal } from '../components/apiKeys/CreateApiKeyModal';
import { API_KEY_AREAS, API_REFERENCE, RECIPES, grantedAreas, levelLabel, snippet, type HttpMethod, type SnippetLanguage } from '../utils/apiKeys';
import { API_URL } from '../utils/runtimeConfig';
import { dateLocale } from '../utils/locale';
import type { AccessLevel, ApiKeyArea, ApiToken } from '../types/apiTokens';

const BASE_URL = `${API_URL.replace(/\/$/, '')}/api/v1`;
const LANGUAGES: { id: SnippetLanguage; label: string }[] = [
  { id: 'curl', label: 'cURL' },
  { id: 'javascript', label: 'JavaScript' },
  { id: 'python', label: 'Python' },
];

const METHOD_CLASS: Record<HttpMethod, string> = {
  GET: 'text-emerald-700 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-500/10',
  POST: 'text-blue-700 bg-blue-50 dark:text-blue-300 dark:bg-blue-500/10',
  PUT: 'text-amber-700 bg-amber-50 dark:text-amber-300 dark:bg-amber-500/10',
  DELETE: 'text-red-700 bg-red-50 dark:text-red-300 dark:bg-red-500/10',
};

function MethodBadge({ method }: { method: HttpMethod }) {
  return <span className={`inline-block w-14 text-center rounded px-1 py-0.5 text-[10px] font-bold font-mono ${METHOD_CLASS[method]}`}>{method}</span>;
}

function PermissionChip({ area, level }: { area: ApiKeyArea; level: AccessLevel }) {
  const { t } = useTranslation();
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset ${
        level === 'write'
          ? 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30'
          : 'bg-purple-50 text-purple-700 ring-purple-200 dark:bg-purple-500/10 dark:text-purple-300 dark:ring-purple-500/30'
      }`}
    >
      {t(`apiKeys.areas.${area}.name`)} · {levelLabel(t, area, level).toLowerCase()}
    </span>
  );
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          /* clipboard blocked */
        }
      }}
      className="btn btn-ghost btn-sm"
      aria-label={label}
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
      </svg>
      {copied ? t('apiKeys.copied') : t('apiKeys.copy')}
    </button>
  );
}

/** API keys: create and revoke them, and learn how to use them. */
export default function ApiKeysPage() {
  const { t, i18n } = useTranslation();
  const [keys, setKeys] = useState<ApiToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [toRevoke, setToRevoke] = useState<ApiToken | null>(null);
  const [language, setLanguage] = useState<SnippetLanguage>('curl');
  const [recipeKey, setRecipeKey] = useState(RECIPES[0].key);
  const recipe = RECIPES.find((r) => r.key === recipeKey) ?? RECIPES[0];

  const load = useCallback(async () => {
    try {
      setKeys(await apiService.listApiTokens());
      setError(null);
    } catch {
      setError(t('apiKeys.loadError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const formatDate = (iso: string) => new Date(iso).toLocaleDateString(dateLocale(i18n.language), { day: 'numeric', month: 'short', year: 'numeric' });
  const expired = (k: ApiToken) => k.expires_at !== null && new Date(k.expires_at) <= new Date();

  const revoke = async () => {
    if (!toRevoke) return;
    try {
      await apiService.revokeApiToken(toRevoke.id);
      setKeys((prev) => prev.filter((k) => k.id !== toRevoke.id));
    } catch {
      setError(t('apiKeys.revokeError'));
    } finally {
      setToRevoke(null);
    }
  };

  const card = 'rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900';
  const tabClass = (on: boolean) =>
    `h-9 px-3 text-sm whitespace-nowrap transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-purple-500/50 ${
      on
        ? 'text-gray-900 dark:text-white font-medium shadow-[inset_0_-2px_0_theme(colors.purple.600)] dark:shadow-[inset_0_-2px_0_theme(colors.purple.400)]'
        : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
    }`;
  const code = snippet(recipe, BASE_URL, language);

  return (
    <div className="min-h-full bg-gray-50 dark:bg-gray-950 px-4 pb-8 pt-16 sm:px-6 md:pt-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <header className="flex flex-col sm:flex-row sm:items-end gap-3 justify-between">
          <div>
            <h1 className="page-title">{t('apiKeys.title')}</h1>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400 max-w-2xl">{t('apiKeys.subtitle')}</p>
          </div>
          <button type="button" onClick={() => setShowCreate(true)} className="btn btn-primary self-start sm:self-auto">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            {t('apiKeys.newKey')}
          </button>
        </header>

        {/* Keys */}
        <section className={card} aria-labelledby="keys-title">
          <div className="px-4 sm:px-5 py-3 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
            <h2 id="keys-title" className="text-sm font-semibold text-gray-900 dark:text-gray-100">{t('apiKeys.yourKeys')}</h2>
            {!loading && <span className="text-xs text-gray-500 dark:text-gray-400">{t('apiKeys.count', { count: keys.length })}</span>}
          </div>
          {error && <p className="mx-4 sm:mx-5 mt-3 text-sm text-red-600 dark:text-red-400" role="alert">{error}</p>}
          {loading ? (
            <p className="px-4 sm:px-5 py-6 text-sm text-gray-500 dark:text-gray-400">{t('common.loading')}</p>
          ) : keys.length === 0 ? (
            <div className="px-4 sm:px-5 py-8 text-center">
              <p className="text-sm text-gray-600 dark:text-gray-300">{t('apiKeys.empty')}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('apiKeys.emptyHint')}</p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-200 dark:divide-gray-800">
              {keys.map((k) => (
                <li key={k.id} className="px-4 sm:px-5 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-gray-100">
                      <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                      </svg>
                      <span className="truncate">{k.name}</span>
                      <span className="font-mono text-xs font-normal text-gray-500 dark:text-gray-400">{k.token_hint}</span>
                      {expired(k) && (
                        <span className="rounded-md px-1.5 py-0.5 text-[11px] font-medium bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300">{t('apiKeys.expired')}</span>
                      )}
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {grantedAreas(k.permissions).map(([area, level]) => (
                        <PermissionChip key={area} area={area} level={level} />
                      ))}
                    </div>
                    <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                      {t('apiKeys.createdOn', { date: formatDate(k.created_at) })}
                      {' · '}
                      {k.expires_at ? t('apiKeys.expiresOn', { date: formatDate(k.expires_at) }) : t('apiKeys.neverExpires')}
                      {' · '}
                      {k.last_used_at ? t('apiKeys.lastUsed', { date: formatDate(k.last_used_at) }) : t('apiKeys.neverUsed')}
                    </p>
                  </div>
                  <button type="button" onClick={() => setToRevoke(k)} className="btn btn-danger btn-sm self-start sm:self-auto">
                    {t('apiKeys.revoke')}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* How to use */}
        <section className={card} aria-labelledby="usage-title">
          <div className="px-4 sm:px-5 py-3 border-b border-gray-200 dark:border-gray-800">
            <h2 id="usage-title" className="text-sm font-semibold text-gray-900 dark:text-gray-100">{t('apiKeys.usage.title')}</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{t('apiKeys.usage.subtitle')}</p>
          </div>
          <div className="p-4 sm:p-5 grid gap-4 md:grid-cols-3 text-sm">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{t('apiKeys.usage.baseUrl')}</p>
              <div className="mt-1 flex items-center gap-1">
                <code className="min-w-0 truncate font-mono text-xs text-gray-900 dark:text-gray-100">{BASE_URL}</code>
                <CopyButton text={BASE_URL} label={t('apiKeys.usage.copyBaseUrl')} />
              </div>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{t('apiKeys.usage.auth')}</p>
              <code className="mt-1 block font-mono text-xs text-gray-900 dark:text-gray-100 break-all">Authorization: Bearer dh_pat_…</code>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{t('apiKeys.usage.errors')}</p>
              <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">{t('apiKeys.usage.errorsText')}</p>
            </div>
          </div>
          <div className="border-t border-gray-200 dark:border-gray-800 md:grid md:grid-cols-[15rem_minmax(0,1fr)]">
            <ul className="p-2 md:border-r border-b md:border-b-0 border-gray-200 dark:border-gray-800 flex md:flex-col gap-1 overflow-x-auto" role="tablist" aria-label={t('apiKeys.usage.recipes')}>
              {RECIPES.map((r) => (
                <li key={r.key} className="flex-shrink-0">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={r.key === recipe.key}
                    onClick={() => setRecipeKey(r.key)}
                    className={`w-full text-left rounded-md px-2.5 py-1.5 text-sm whitespace-nowrap md:whitespace-normal transition-colors ${
                      r.key === recipe.key
                        ? 'bg-gray-100 text-gray-900 font-medium dark:bg-gray-800 dark:text-white'
                        : 'text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800/50'
                    }`}
                  >
                    {t(`apiKeys.recipes.${r.key}.title`)}
                  </button>
                </li>
              ))}
            </ul>
            <div className="min-w-0 p-4 sm:p-5">
              <div className="flex flex-wrap items-center gap-2">
                <MethodBadge method={recipe.method} />
                <code className="font-mono text-xs text-gray-900 dark:text-gray-100 break-all">{recipe.path}</code>
                <span className="ml-auto flex flex-wrap gap-1">
                  {recipe.areas.map((area) => <PermissionChip key={area} area={area} level={recipe.level} />)}
                </span>
              </div>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{t(`apiKeys.recipes.${recipe.key}.description`)}</p>
              <div className="mt-3 rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
                <div className="flex items-center border-b border-gray-200 dark:border-gray-800 px-1 bg-gray-50 dark:bg-gray-950">
                  <div role="tablist" aria-label={t('apiKeys.usage.language')} className="flex">
                    {LANGUAGES.map((l) => (
                      <button key={l.id} type="button" role="tab" aria-selected={language === l.id} onClick={() => setLanguage(l.id)} className={tabClass(language === l.id)}>
                        {l.label}
                      </button>
                    ))}
                  </div>
                  <span className="ml-auto">
                    <CopyButton text={code} label={t('apiKeys.usage.copyCode')} />
                  </span>
                </div>
                <pre className="p-3 text-xs leading-5 font-mono text-gray-800 dark:text-gray-200 bg-white dark:bg-gray-900 overflow-x-auto">{code}</pre>
              </div>
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">{t('apiKeys.usage.envHint')}</p>
            </div>
          </div>
        </section>

        {/* Reference */}
        <section className={card} aria-labelledby="reference-title">
          <div className="px-4 sm:px-5 py-3 border-b border-gray-200 dark:border-gray-800">
            <h2 id="reference-title" className="text-sm font-semibold text-gray-900 dark:text-gray-100">{t('apiKeys.reference.title')}</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{t('apiKeys.reference.subtitle')}</p>
          </div>
          <div className="divide-y divide-gray-200 dark:divide-gray-800">
            {API_KEY_AREAS.map((area) => (
              <div key={area} className="px-4 sm:px-5 py-4">
                <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">{t(`apiKeys.areas.${area}.name`)}</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">{t(`apiKeys.areas.${area}.description`)}</p>
                <ul className="mt-2 space-y-1">
                  {API_REFERENCE.filter((ep) => ep.areas[0] === area).map((ep) => (
                    <li key={`${ep.method} ${ep.path}`} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 text-xs">
                      <span className="flex items-center gap-2 sm:w-[26rem] flex-shrink-0 min-w-0">
                        <MethodBadge method={ep.method} />
                        <code className="font-mono text-gray-900 dark:text-gray-100 truncate" title={ep.path}>{ep.path}</code>
                      </span>
                      <span className="flex-1 text-gray-600 dark:text-gray-400">{t(`apiKeys.endpoints.${ep.key}`)}</span>
                      <span className="flex gap-1 flex-shrink-0">
                        {ep.areas.map((a) => <PermissionChip key={a} area={a} level={ep.level} />)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <p className="px-4 sm:px-5 py-3 border-t border-gray-200 dark:border-gray-800 text-xs text-gray-500 dark:text-gray-400">{t('apiKeys.reference.outside')}</p>
        </section>
      </div>

      <CreateApiKeyModal isOpen={showCreate} onClose={() => setShowCreate(false)} onCreated={() => void load()} baseUrl={BASE_URL} />
      <ConfirmModal
        isOpen={toRevoke !== null}
        onClose={() => setToRevoke(null)}
        onConfirm={revoke}
        title={t('apiKeys.revokeTitle')}
        message={t('apiKeys.revokeMessage', { name: toRevoke?.name ?? '' })}
        confirmText={t('apiKeys.revoke')}
        isDangerous
      />
    </div>
  );
}
