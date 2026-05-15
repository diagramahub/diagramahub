import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import apiService from '../../services/api';
import { AdminUserMfaInfo } from '../../types/auth';

const ShieldIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
      d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
  </svg>
);

const ShieldOffIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
      d="M12 9v3.75m0-10.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.75c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.249-8.25-3.286zm0 13.036h.008v.008H12v-.008z" />
  </svg>
);

const ChevronLeftIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.75 19.5L8.25 12l7.5-7.5" />
  </svg>
);

const ChevronRightIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.25 4.5l7.5 7.5-7.5 7.5" />
  </svg>
);

const AIProviderLogo = ({ provider, className = 'w-3.5 h-3.5' }: { provider: string; className?: string }) => {
  const [imageError, setImageError] = useState(false);
  const providerName = provider;

  if (imageError) {
    return (
      <span
        className={`${className} inline-flex items-center justify-center rounded-full bg-gray-100 text-[9px] font-semibold text-gray-500 dark:bg-gray-700 dark:text-gray-300`}
        aria-hidden="true"
      >
        {providerName.charAt(0).toUpperCase()}
      </span>
    );
  }

  return (
    <img
      src={`/images/ai-providers/${provider}.svg`}
      alt={providerName}
      className={`${className} object-contain`}
      loading="lazy"
      onError={() => { setImageError(true); }}
    />
  );
};

const PAGE_SIZE = 15;


export default function UserMfaManagement() {
  const { t } = useTranslation();
  const [users, setUsers] = useState<AdminUserMfaInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [resetConfirm, setResetConfirm] = useState<string | null>(null);
  const [resetLoading, setResetLoading] = useState(false);

  // Pagination & search
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [searchTimeout, setSearchTimeout] = useState<ReturnType<typeof setTimeout> | null>(null);

  const loadUsers = useCallback(async (p: number, search: string) => {
    setLoading(true);
    try {
      const data = await apiService.adminGetUsersWithMfa({
        page: p,
        page_size: PAGE_SIZE,
        search: search || undefined,
      });
      setUsers(data.items);
      setTotal(data.total);
      setTotalPages(data.total_pages);
      setPage(data.page);
    } catch {
      setError(t('admin.users.errorLoading'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadUsers(1, '');
  }, [loadUsers]);

  // Debounced search
  const handleSearchChange = (value: string) => {
    setSearchInput(value);
    if (searchTimeout) clearTimeout(searchTimeout);
    const timeout = setTimeout(() => {
      setSearchQuery(value);
      loadUsers(1, value);
    }, 400);
    setSearchTimeout(timeout);
  };

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages) return;
    loadUsers(newPage, searchQuery);
  };

  const handleResetMfa = async (userId: string) => {
    setResetLoading(true);
    setError('');
    setSuccess('');
    try {
      const response = await apiService.adminResetUserMfa(userId);
      setSuccess(response.message);
      setResetConfirm(null);
      loadUsers(page, searchQuery);
    } catch (err: any) {
      setError(err.response?.data?.detail || t('admin.users.errorResetting'));
    } finally {
      setResetLoading(false);
    }
  };

  const getMethodLabels = (methods: string[]) => {
    return methods.map(m => m === 'email' ? 'Email' : 'TOTP').join(', ');
  };

  const [exporting, setExporting] = useState(false);

  const handleExportExcel = async () => {
    setExporting(true);
    setError('');
    try {
      const blob = await apiService.adminExportUsersExcel();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `diagramahub_users_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      setError(err.response?.data?.detail || t('admin.users.errorExporting'));
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
      <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-0">
          <div className="flex items-center gap-2">
            <ShieldIcon className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100">{t('admin.users.title')}</h2>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={handleExportExcel}
              disabled={exporting}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/30 disabled:opacity-50 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              {exporting ? t('admin.users.exporting') : t('admin.users.exportExcel')}
            </button>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {t('admin.users.totalUsers', { count: total })}
            </span>
          </div>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t('admin.users.description')}</p>
      </div>

      <div className="px-4 sm:px-6 py-4">
        {/* Messages */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}
        {success && (
          <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg">
            <p className="text-sm text-green-600 dark:text-green-400">{success}</p>
          </div>
        )}

        {/* Search */}
        <div className="mb-4">
          <input
            type="text"
            value={searchInput}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder={t('admin.users.searchPlaceholder')}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          />
        </div>

        {/* Loading state */}
        {loading ? (
          <div className="py-8 text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('common.loading')}</p>
          </div>
        ) : (
          <>
            {/* User table */}
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead>
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      {t('admin.users.columnEmail')}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      {t('admin.users.columnName')}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      {t('admin.users.columnRole')}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      {t('admin.users.columnPlan')}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      {t('admin.users.columnLicenseUsage')}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      {t('admin.users.columnAiModels')}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      {t('admin.users.columnLastLogin')}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      {t('admin.users.columnMfaStatus')}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      {t('admin.users.columnRecoveryCodes')}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      {t('admin.users.columnRegistered')}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      {t('admin.users.columnActions')}
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                        {u.email}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {u.full_name || '—'}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm">
                        {u.role === 'admin' ? (
                          <span className="text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 px-1.5 py-0.5 rounded-full">
                            Admin
                          </span>
                        ) : (
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {t('admin.users.user')}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm">
                        {u.plan_name ? (
                          <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 px-1.5 py-0.5 rounded-full">
                            {u.plan_name}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400 dark:text-gray-500">—</span>
                        )}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded-full">
                            {u.project_count} {u.project_count === 1 ? t('admin.users.project') : t('admin.users.projects')}
                          </span>
                          <span className="text-xs bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 px-1.5 py-0.5 rounded-full">
                            {u.diagram_count} {u.diagram_count === 1 ? t('admin.users.diagram') : t('admin.users.diagrams')}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-500 dark:text-gray-400 max-w-xs">
                        {u.connected_ai_models.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {u.connected_ai_models.map((model) => (
                              <span
                                key={`${u.id}-${model.provider}-${model.model}`}
                                title={`${model.provider}: ${model.model}`}
                                className={`inline-flex items-center justify-center rounded-full border px-1 py-1 leading-none ${
                                  model.is_default
                                    ? 'border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-700 dark:bg-purple-900/20 dark:text-purple-300'
                                    : 'border-gray-200 bg-gray-50 text-gray-600 dark:border-gray-700 dark:bg-gray-700 dark:text-gray-300'
                                }`}
                              >
                                <AIProviderLogo provider={model.provider} />
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400 dark:text-gray-500">{t('admin.users.noAiModels')}</span>
                        )}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {u.last_login_at
                          ? new Date(u.last_login_at).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })
                          : '—'}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm">
                        {u.mfa_enabled ? (
                          <div className="flex items-center gap-1.5">
                            <ShieldIcon className="w-4 h-4 text-green-600 dark:text-green-400" />
                            <span className="text-xs text-green-600 dark:text-green-400 font-medium">
                              {getMethodLabels(u.mfa_methods)}
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <ShieldOffIcon className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                            <span className="text-xs text-gray-400 dark:text-gray-500">
                              {t('admin.users.noMfa')}
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {u.mfa_enabled ? (
                          <span className="text-xs">
                            {t('admin.users.recoveryCodes', { count: u.recovery_codes_remaining })}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400 dark:text-gray-500">—</span>
                        )}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {u.created_at
                          ? new Date(u.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })
                          : '—'}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm">
                        {u.mfa_enabled ? (
                          resetConfirm === u.id ? (
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => handleResetMfa(u.id)}
                                disabled={resetLoading}
                                className="px-2.5 py-1 text-xs font-medium text-white bg-red-600 rounded hover:bg-red-700 disabled:opacity-50 transition-colors"
                              >
                                {resetLoading ? '...' : t('admin.users.confirmReset')}
                              </button>
                              <button
                                onClick={() => setResetConfirm(null)}
                                className="px-2.5 py-1 text-xs font-medium text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                              >
                                {t('common.cancel')}
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => { setResetConfirm(u.id); setError(''); setSuccess(''); }}
                              className="px-2.5 py-1 text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                            >
                              {t('admin.users.resetMfa')}
                            </button>
                          )
                        ) : (
                          <span className="text-xs text-gray-400 dark:text-gray-500">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {users.length === 0 && (
                <div className="py-8 text-center">
                  <p className="text-sm text-gray-500 dark:text-gray-400">{t('admin.users.noResults')}</p>
                </div>
              )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-4 mt-4 border-t border-gray-100 dark:border-gray-700">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {t('admin.users.pageInfo', {
                    from: (page - 1) * PAGE_SIZE + 1,
                    to: Math.min(page * PAGE_SIZE, total),
                    total,
                  })}
                </p>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handlePageChange(page - 1)}
                    disabled={page <= 1}
                    className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeftIcon className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                  </button>
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                    let pageNum: number;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (page <= 3) {
                      pageNum = i + 1;
                    } else if (page >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = page - 2 + i;
                    }
                    return (
                      <button
                        key={pageNum}
                        onClick={() => handlePageChange(pageNum)}
                        className={`w-8 h-8 text-xs rounded transition-colors ${
                          pageNum === page
                            ? 'bg-purple-600 text-white'
                            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => handlePageChange(page + 1)}
                    disabled={page >= totalPages}
                    className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRightIcon className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
