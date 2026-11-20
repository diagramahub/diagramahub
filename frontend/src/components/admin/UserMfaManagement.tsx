import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import apiService from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { AdminUserMfaInfo, AdminUserStatusFilter, AdminUserStatusResult } from '../../types/auth';
import { apiErrorMessage } from '../../utils/apiError';
import { formatDate, mfaMethodLabel } from '../../utils/adminUsers';
import { ShieldIcon, ShieldOffIcon, StatusPill, UserAvatar } from './users/shared';
import { UserDetailDrawer } from './users/UserDetailDrawer';

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
const STATUS_FILTERS: AdminUserStatusFilter[] = ['', 'active', 'blocked'];
const TH = 'px-3 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap';

/** Admin user list: search, status filter, and a detail panel to block, delete or review payments. */
export default function UserMfaManagement() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<AdminUserMfaInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Pagination, search and status filter
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [statusFilter, setStatusFilter] = useState<AdminUserStatusFilter>('');
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadUsers = useCallback(async (p: number, search: string, status: AdminUserStatusFilter) => {
    setLoading(true);
    try {
      const data = await apiService.adminGetUsersWithMfa({
        page: p,
        page_size: PAGE_SIZE,
        search: search || undefined,
        status,
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
    loadUsers(1, '', '');
  }, [loadUsers]);

  useEffect(() => () => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
  }, []);

  const handleSearchChange = (value: string) => {
    setSearchInput(value);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      setSearchQuery(value);
      loadUsers(1, value, statusFilter);
    }, 400);
  };

  const handleStatusFilter = (status: AdminUserStatusFilter) => {
    setStatusFilter(status);
    loadUsers(1, searchQuery, status);
  };

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages) return;
    loadUsers(newPage, searchQuery, statusFilter);
  };

  const openUser = (id: string) => {
    setError('');
    setSuccess('');
    setSelectedId(id);
  };

  const selected = users.find((u) => u.id === selectedId) ?? null;

  const handleStatusChanged = (result: AdminUserStatusResult) => {
    const target = users.find((u) => u.id === result.id);
    setUsers((list) => list.map((u) => (u.id === result.id ? { ...u, ...result } : u)));
    if (target) {
      setSuccess(t(result.is_active ? 'admin.users.unblocked' : 'admin.users.blocked', { email: target.email }));
    }
  };

  const handleDeleted = (subscriptionCancelled: boolean) => {
    const email = selected?.email ?? '';
    setSelectedId(null);
    setSuccess(t(subscriptionCancelled ? 'admin.users.deletedCancelled' : 'admin.users.deleted', { email }));
    // The page may be empty now: go back one when it held only that user.
    const targetPage = users.length === 1 && page > 1 ? page - 1 : page;
    loadUsers(targetPage, searchQuery, statusFilter);
  };

  const handleMfaReset = (message: string) => {
    setSuccess(message);
    loadUsers(page, searchQuery, statusFilter);
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
    } catch (err: unknown) {
      setError(apiErrorMessage(err) || t('admin.users.errorExporting'));
    } finally {
      setExporting(false);
    }
  };

  const filterLabel = (status: AdminUserStatusFilter) =>
    status === 'active' ? t('admin.users.filterActive') : status === 'blocked' ? t('admin.users.filterBlocked') : t('admin.users.filterAll');

  return (
    <div className="card">
      {/* The page above already shows the title and description. */}
      <div className="px-4 sm:px-6 py-3 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 tabular-nums">
          {t('admin.users.totalUsers', { count: total })}
        </h2>
        <button type="button" onClick={handleExportExcel} disabled={exporting} className="btn btn-secondary btn-sm">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
          {exporting ? t('admin.users.exporting') : t('admin.users.exportExcel')}
        </button>
      </div>

      <div className="px-4 sm:px-6 py-4">
        <div aria-live="polite">
          {error && (
            <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-700 dark:bg-red-900/20 dark:text-red-400">
              {error}
            </p>
          )}
          {success && (
            <p role="status" className="mb-4 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700 dark:border-green-700 dark:bg-green-900/20 dark:text-green-400">
              {success}
            </p>
          )}
        </div>

        {/* Search + status filter */}
        <div className="mb-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <input
            type="search"
            value={searchInput}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder={t('admin.users.searchPlaceholder')}
            aria-label={t('admin.users.searchPlaceholder')}
            className="input sm:flex-1"
          />
          <div
            role="group"
            aria-label={t('admin.users.statusFilter')}
            className="inline-flex shrink-0 self-start rounded-lg border border-gray-200 bg-gray-50 p-0.5 dark:border-gray-800 dark:bg-gray-950"
          >
            {STATUS_FILTERS.map((status) => (
              <button
                key={status || 'all'}
                type="button"
                aria-pressed={statusFilter === status}
                onClick={() => handleStatusFilter(status)}
                className={`rounded-md px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/50 ${
                  statusFilter === status
                    ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-800 dark:text-gray-100'
                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                }`}
              >
                {filterLabel(status)}
              </button>
            ))}
          </div>
        </div>

        {loading && users.length === 0 ? (
          <div className="space-y-2" aria-hidden="true">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-12 rounded-lg bg-gray-100 dark:bg-gray-800 animate-pulse" />
            ))}
          </div>
        ) : (
          <>
            <div className={`overflow-x-auto -mx-4 sm:mx-0 transition-opacity ${loading ? 'opacity-60' : ''}`} aria-busy={loading}>
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-y border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900/60">
                    <th scope="col" className={`${TH} pl-4 sm:pl-3`}>{t('admin.users.columnUser')}</th>
                    <th scope="col" className={TH}>{t('admin.users.columnPlan')}</th>
                    <th scope="col" className={`${TH} hidden md:table-cell`}>{t('admin.users.columnUsage')}</th>
                    <th scope="col" className={`${TH} hidden lg:table-cell`}>{t('admin.users.columnSecurity')}</th>
                    <th scope="col" className={`${TH} hidden sm:table-cell`}>{t('admin.users.lastLogin')}</th>
                    <th scope="col" className={`${TH} pr-4 sm:pr-3`}>{t('admin.users.columnStatus')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {users.map((u) => (
                    <tr
                      key={u.id}
                      onClick={() => openUser(u.id)}
                      className={`cursor-pointer transition-colors hover:bg-purple-50/40 dark:hover:bg-purple-500/5 ${u.is_active ? '' : 'bg-red-50/40 dark:bg-red-500/5'}`}
                    >
                      <td className="pl-4 sm:pl-3 pr-3 py-2.5 max-w-[16rem]">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); openUser(u.id); }}
                          aria-label={t('admin.users.openDetail', { email: u.email })}
                          className="flex w-full min-w-0 items-center gap-2.5 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
                        >
                          <UserAvatar name={u.full_name} email={u.email} />
                          <span className="min-w-0">
                            <span className="flex items-center gap-1.5">
                              <span className="truncate font-medium text-gray-900 dark:text-gray-100">{u.full_name || u.email}</span>
                              {u.role === 'admin' && <span className="badge shrink-0">{t('admin.users.admin')}</span>}
                            </span>
                            {u.full_name && <span className="block truncate text-xs text-gray-500 dark:text-gray-400">{u.email}</span>}
                          </span>
                        </button>
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <span className="flex items-center gap-1.5">
                          <span className="text-gray-700 dark:text-gray-300">{u.plan_name || t('admin.users.freePlan')}</span>
                          {u.is_paying && <StatusPill tone="green">{t('admin.users.paying')}</StatusPill>}
                        </span>
                      </td>
                      <td className="hidden md:table-cell px-3 py-2.5 whitespace-nowrap text-gray-600 dark:text-gray-400 tabular-nums">
                        {t('admin.users.usageSummary', { projects: u.project_count, diagrams: u.diagram_count })}
                      </td>
                      <td className="hidden lg:table-cell px-3 py-2.5 whitespace-nowrap">
                        {u.mfa_enabled ? (
                          <span className="flex items-center gap-1.5 text-xs font-medium text-green-700 dark:text-green-400">
                            <ShieldIcon className="w-4 h-4" />
                            MFA · {u.mfa_methods.map(mfaMethodLabel).join(', ')}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                            <ShieldOffIcon className="w-4 h-4" />
                            MFA · {t('admin.users.noMfa')}
                          </span>
                        )}
                      </td>
                      <td className="hidden sm:table-cell px-3 py-2.5 whitespace-nowrap text-gray-500 dark:text-gray-400 tabular-nums">
                        {formatDate(u.last_login_at, lang, t('admin.users.never'))}
                      </td>
                      <td className="pl-3 pr-4 sm:pr-3 py-2.5 whitespace-nowrap">
                        <StatusPill tone={u.is_active ? 'green' : 'red'}>
                          {u.is_active ? t('admin.users.statusActive') : t('admin.users.statusBlocked')}
                        </StatusPill>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {users.length === 0 && (
                <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">{t('admin.users.noResults')}</p>
              )}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-4 mt-4 border-t border-gray-100 dark:border-gray-800">
                <p className="text-xs text-gray-500 dark:text-gray-400 tabular-nums">
                  {t('admin.users.pageInfo', {
                    from: (page - 1) * PAGE_SIZE + 1,
                    to: Math.min(page * PAGE_SIZE, total),
                    total,
                  })}
                </p>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handlePageChange(page - 1)}
                    disabled={page <= 1}
                    aria-label={t('common.previous')}
                    className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeftIcon className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                  </button>
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                    let pageNum: number;
                    if (totalPages <= 5 || page <= 3) {
                      pageNum = i + 1;
                    } else if (page >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = page - 2 + i;
                    }
                    return (
                      <button
                        key={pageNum}
                        type="button"
                        onClick={() => handlePageChange(pageNum)}
                        aria-current={pageNum === page ? 'page' : undefined}
                        className={`w-8 h-8 text-xs rounded transition-colors ${
                          pageNum === page
                            ? 'bg-purple-600 text-white'
                            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => handlePageChange(page + 1)}
                    disabled={page >= totalPages}
                    aria-label={t('common.next')}
                    className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRightIcon className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {selected && (
        <UserDetailDrawer
          user={selected}
          isSelf={selected.id === currentUser?.id}
          onClose={() => setSelectedId(null)}
          onStatusChanged={handleStatusChanged}
          onDeleted={handleDeleted}
          onMfaReset={handleMfaReset}
        />
      )}
    </div>
  );
}
