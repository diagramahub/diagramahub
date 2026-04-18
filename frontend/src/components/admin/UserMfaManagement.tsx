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
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldIcon className="w-5 h-5 text-purple-600" />
            <h2 className="text-lg font-semibold text-gray-900">{t('admin.users.title')}</h2>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleExportExcel}
              disabled={exporting}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-purple-600 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 disabled:opacity-50 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              {exporting ? t('admin.users.exporting') : t('admin.users.exportExcel')}
            </button>
            <span className="text-sm text-gray-500">
              {t('admin.users.totalUsers', { count: total })}
            </span>
          </div>
        </div>
        <p className="text-sm text-gray-500 mt-1">{t('admin.users.description')}</p>
      </div>

      <div className="px-6 py-4">
        {/* Messages */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}
        {success && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm text-green-600">{success}</p>
          </div>
        )}

        {/* Search */}
        <div className="mb-4">
          <input
            type="text"
            value={searchInput}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder={t('admin.users.searchPlaceholder')}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
          />
        </div>

        {/* Loading state */}
        {loading ? (
          <div className="py-8 text-center">
            <p className="text-sm text-gray-500">{t('common.loading')}</p>
          </div>
        ) : (
          <>
            {/* User list */}
            <div className="divide-y divide-gray-100">
              {users.map((u) => (
                <div key={u.id} className="py-3 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`flex-shrink-0 p-1.5 rounded-full ${u.mfa_enabled ? 'bg-green-100' : 'bg-gray-100'}`}>
                      {u.mfa_enabled ? (
                        <ShieldIcon className="w-4 h-4 text-green-600" />
                      ) : (
                        <ShieldOffIcon className="w-4 h-4 text-gray-400" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-gray-900 truncate">{u.email}</p>
                        {u.role === 'admin' && (
                          <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full flex-shrink-0">
                            Admin
                          </span>
                        )}
                        {u.plan_name && (
                          <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full flex-shrink-0">
                            {u.plan_name}
                          </span>
                        )}
                        <span className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-full flex-shrink-0">
                          {u.diagram_count} {u.diagram_count === 1 ? t('admin.users.diagram') : t('admin.users.diagrams')}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {u.full_name && (
                          <p className="text-xs text-gray-500 truncate">{u.full_name}</p>
                        )}
                        {u.full_name && u.created_at && (
                          <span className="text-xs text-gray-300">·</span>
                        )}
                        {u.created_at && (
                          <p className="text-xs text-gray-400">
                            {t('admin.users.registered')} {new Date(u.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 flex-shrink-0">
                    {u.mfa_enabled ? (
                      <>
                        <div className="text-right hidden sm:block">
                          <p className="text-xs text-green-600 font-medium">
                            MFA: {getMethodLabels(u.mfa_methods)}
                          </p>
                          <p className="text-xs text-gray-400">
                            {t('admin.users.recoveryCodes', { count: u.recovery_codes_remaining })}
                          </p>
                        </div>

                        {resetConfirm === u.id ? (
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
                              className="px-2.5 py-1 text-xs font-medium text-gray-600 bg-gray-100 rounded hover:bg-gray-200 transition-colors"
                            >
                              {t('common.cancel')}
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => { setResetConfirm(u.id); setError(''); setSuccess(''); }}
                            className="px-2.5 py-1 text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded hover:bg-red-100 transition-colors"
                          >
                            {t('admin.users.resetMfa')}
                          </button>
                        )}
                      </>
                    ) : (
                      <span className="text-xs text-gray-400">{t('admin.users.mfaDisabled')}</span>
                    )}
                  </div>
                </div>
              ))}

              {users.length === 0 && (
                <div className="py-8 text-center">
                  <p className="text-sm text-gray-500">{t('admin.users.noResults')}</p>
                </div>
              )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-4 mt-4 border-t border-gray-100">
                <p className="text-xs text-gray-500">
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
                    className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeftIcon className="w-4 h-4 text-gray-600" />
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
                            : 'text-gray-600 hover:bg-gray-100'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => handlePageChange(page + 1)}
                    disabled={page >= totalPages}
                    className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRightIcon className="w-4 h-4 text-gray-600" />
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
