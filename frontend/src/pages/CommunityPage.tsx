import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import apiService from '../services/api';
import { apiErrorStatus } from '../utils/apiError';
import { useAuth } from '../contexts/AuthContext';
import { useAccountGate } from '../hooks/useAccountGate';
import type {
  CommunityCategory,
  CommunityReport,
  CommunitySort,
  CommunityTab,
  PublicationCard,
  PublishableType,
} from '../types/community';
import { COMMUNITY_CATEGORIES } from '../utils/community';
import { dateLocale } from '../utils/locale';
import { PublicationCardView } from '../components/community/PublicationCardView';
import { TYPE_BADGES } from '../components/community/typeBadges';
import EmptyState from '../components/EmptyState';

const PAGE_SIZE = 24;
const TYPES: PublishableType[] = ['mermaid', 'plantuml', 'd2', 'dbml'];
type Tab = CommunityTab | 'reports';

/** Community portal: browse, filter and star published diagrams. */
export default function CommunityPage() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const { isAuthenticated, requireAccount, accountPrompt } = useAccountGate();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // `?tab=mine` (dashboard link) opens a personal tab when signed in.
  const [tab, setTab] = useState<Tab>(() => {
    const asked = searchParams.get('tab');
    if (asked === 'featured') return 'featured';
    if ((asked === 'mine' || asked === 'starred') && isAuthenticated) return asked;
    return 'explore';
  });
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [category, setCategory] = useState<CommunityCategory | null>(null);
  const [type, setType] = useState<PublishableType | null>(null);
  const [sort, setSort] = useState<CommunitySort>('trending');
  const [items, setItems] = useState<PublicationCard[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reports, setReports] = useState<CommunityReport[]>([]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(query.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  const load = useCallback(
    async (nextPage: number) => {
      if (tab === 'reports') return;
      setLoading(true);
      setError(false);
      try {
        const result = await apiService.listCommunity({
          tab,
          q: debounced || undefined,
          category: category ?? undefined,
          type: type ?? undefined,
          sort,
          page: nextPage,
          page_size: PAGE_SIZE,
        });
        setItems((prev) => (nextPage === 1 ? result.items : [...prev, ...result.items]));
        setTotal(result.total);
        setPage(nextPage);
      } catch (err: unknown) {
        // A private community (COMMUNITY_PUBLIC off): sign in and come back.
        if (apiErrorStatus(err) === 401 && !isAuthenticated) {
          navigate('/login?next=%2Fcommunity', { replace: true });
          return;
        }
        setError(true);
      } finally {
        setLoading(false);
      }
    },
    [tab, debounced, category, type, sort, isAuthenticated, navigate],
  );

  useEffect(() => {
    load(1);
  }, [load]);

  useEffect(() => {
    if (tab !== 'reports') return;
    setLoading(true);
    apiService
      .listCommunityReports()
      .then(setReports)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [tab]);

  const toggleStar = async (publication: PublicationCard) => {
    if (!requireAccount('star')) return;
    const next = !publication.starred_by_me;
    const apply = (starred: boolean, count: number) =>
      setItems((prev) => prev.map((p) => (p.id === publication.id ? { ...p, starred_by_me: starred, stars_count: count } : p)));
    apply(next, publication.stars_count + (next ? 1 : -1));
    try {
      const result = await apiService.setStar(publication.id, next);
      apply(result.starred, result.stars_count);
    } catch {
      apply(publication.starred_by_me, publication.stars_count);
    }
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: 'explore', label: t('community.tabs.explore') },
    { id: 'featured', label: t('community.tabs.featured') },
    { id: 'starred', label: t('community.tabs.starred') },
    { id: 'mine', label: t('community.tabs.mine') },
    ...(isAdmin ? [{ id: 'reports' as Tab, label: t('community.tabs.reports') }] : []),
  ];

  const chipClass = (on: boolean) =>
    `inline-flex items-center h-7 px-2.5 text-xs font-medium rounded-md whitespace-nowrap border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/50 ${
      on
        ? 'bg-purple-50 text-purple-700 border-purple-300 dark:bg-purple-500/15 dark:text-purple-200 dark:border-purple-500/40'
        : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:bg-gray-900 dark:border-gray-800 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-gray-100'
    }`;
  // Diagram type: one segmented control instead of separate chips.
  const segmentClass = (on: boolean) =>
    `inline-flex items-center h-7 px-2.5 text-xs font-medium whitespace-nowrap transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-purple-500/50 ${
      on
        ? 'bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-white'
        : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100'
    }`;

  return (
    <div className={`px-4 pb-4 sm:px-6 sm:pb-6 max-w-7xl mx-auto ${isAuthenticated ? 'pt-16 md:pt-6' : 'pt-6'}`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="page-title">{t('community.title')}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t('community.subtitle')}</p>
        </div>
        <Link
          to="/projects-list"
          onClick={(e) => {
            if (!requireAccount('publish')) e.preventDefault();
          }}
          className="btn btn-primary self-start sm:self-auto"
          title={t('community.publishHint')}
        >
          {t('community.publishCta')}
        </Link>
      </div>

      <div role="tablist" aria-label={t('community.title')} className="flex gap-1 border-b border-gray-200 dark:border-gray-800 mb-5 text-sm overflow-x-auto scrollbar-hide">
        {tabs.map((item) => (
          <button
            key={item.id}
            role="tab"
            type="button"
            aria-selected={tab === item.id}
            onClick={() => {
              if ((item.id === 'starred' || item.id === 'mine') && !requireAccount('tabs')) return;
              setTab(item.id);
            }}
            className={`h-10 px-3 whitespace-nowrap transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-purple-500/50 rounded-t-md ${
              tab === item.id
                ? 'text-gray-900 dark:text-white font-medium shadow-[inset_0_-2px_0_theme(colors.purple.600)] dark:shadow-[inset_0_-2px_0_theme(colors.purple.400)]'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'reports' ? (
        <ReportsPanel reports={reports} loading={loading} error={error} language={i18n.language} />
      ) : (
        <>
          <div className="flex flex-col sm:flex-row gap-2 mb-3">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('community.searchPlaceholder')}
              aria-label={t('community.searchPlaceholder')}
              className="input min-w-0 sm:flex-1"
            />
            <div className="inline-flex self-start sm:self-auto h-9 items-center rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 p-0.5 shadow-sm overflow-hidden" role="group" aria-label={t('community.filterByType')}>
              <button type="button" onClick={() => setType(null)} aria-pressed={type === null} className={`${segmentClass(type === null)} rounded`}>
                {t('community.allTypes')}
              </button>
              {TYPES.map((value) => (
                <button key={value} type="button" onClick={() => setType(type === value ? null : value)} aria-pressed={type === value} className={`${segmentClass(type === value)} rounded`}>
                  {TYPE_BADGES[value].label}
                </button>
              ))}
            </div>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as CommunitySort)}
              aria-label={t('community.sortLabel')}
              className="input sm:w-40"
            >
              {(['trending', 'stars', 'forks', 'recent'] as CommunitySort[]).map((value) => (
                <option key={value} value={value}>
                  {t(`community.sort.${value}`)}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap gap-1.5 mb-5" role="group" aria-label={t('community.categoriesLabel')}>
            <button type="button" onClick={() => setCategory(null)} aria-pressed={category === null} className={chipClass(category === null)}>
              {t('community.allCategories')}
            </button>
            {COMMUNITY_CATEGORIES.map((value) => (
              <button key={value} type="button" onClick={() => setCategory(value)} aria-pressed={category === value} className={chipClass(category === value)}>
                {t(`community.categories.${value}`)}
              </button>
            ))}
          </div>

          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3" aria-live="polite">
            {t('community.resultCount', { count: total })}
          </p>
          {error && <p className="text-sm text-red-600 dark:text-red-400 mb-3">{t('community.loadError')}</p>}

          {!loading && !error && items.length === 0 ? (
            <EmptyState
              title={tab === 'mine' ? t('community.emptyMineTitle') : t('community.emptyTitle')}
              description={tab === 'mine' ? t('community.emptyMine') : t('community.empty')}
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {items.map((p) => (
                <PublicationCardView key={p.id} publication={p} onToggleStar={toggleStar} />
              ))}
            </div>
          )}

          {items.length < total && (
            <div className="flex justify-center mt-6">
              <button
                type="button"
                onClick={() => load(page + 1)}
                disabled={loading}
                className="btn btn-secondary"
              >
                {loading ? t('common.loading') : t('community.loadMore')}
              </button>
            </div>
          )}
        </>
      )}
      {accountPrompt}
    </div>
  );
}

function ReportsPanel({ reports, loading, error, language }: { reports: CommunityReport[]; loading: boolean; error: boolean; language: string }) {
  const { t } = useTranslation();
  if (loading) return <p className="text-sm text-gray-500 dark:text-gray-400">{t('common.loading')}</p>;
  if (error) return <p className="text-sm text-red-600 dark:text-red-400">{t('community.loadError')}</p>;
  if (reports.length === 0) return <p className="text-sm text-gray-500 dark:text-gray-400">{t('community.reports.empty')}</p>;
  return (
    <ul className="divide-y divide-gray-200 dark:divide-gray-800 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800">
      {reports.map((r) => (
        <li key={r.id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-2 justify-between">
          <div className="min-w-0">
            <p className="text-sm text-gray-900 dark:text-gray-100">
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 mr-2">
                {t(`community.reports.target.${r.target_type}`)}
              </span>
              {r.publication_title}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              “{r.reason}” · {new Date(r.created_at).toLocaleDateString(dateLocale(language))}
            </p>
          </div>
          <Link
            to={`/community/${r.publication_id}`}
            className="self-start sm:self-auto text-sm font-medium text-purple-600 dark:text-purple-400 hover:underline focus:outline-none focus:ring-2 focus:ring-purple-500 rounded"
          >
            {t('community.reports.review')}
          </Link>
        </li>
      ))}
    </ul>
  );
}
