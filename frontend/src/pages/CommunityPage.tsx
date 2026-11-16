import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import apiService from '../services/api';
import { useAuth } from '../contexts/AuthContext';
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
  const [tab, setTab] = useState<Tab>('explore');
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
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    },
    [tab, debounced, category, type, sort],
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
    `px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap border focus:outline-none focus:ring-2 focus:ring-purple-500 ${
      on
        ? 'bg-purple-600 text-white border-purple-600'
        : 'border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
    }`;

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="page-title">{t('community.title')}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t('community.subtitle')}</p>
        </div>
        <Link
          to="/projects-list"
          className="btn btn-primary self-start sm:self-auto"
          title={t('community.publishHint')}
        >
          {t('community.publishCta')}
        </Link>
      </div>

      <div role="tablist" aria-label={t('community.title')} className="flex gap-1 border-b border-gray-200 dark:border-gray-800 mb-4 text-sm overflow-x-auto">
        {tabs.map((item) => (
          <button
            key={item.id}
            role="tab"
            type="button"
            aria-selected={tab === item.id}
            onClick={() => setTab(item.id)}
            className={`px-4 py-2 -mb-px border-b-2 whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-purple-500 rounded-t ${
              tab === item.id
                ? 'border-purple-600 text-purple-700 dark:text-purple-300 font-medium'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
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
          <div className="flex flex-col lg:flex-row gap-3 mb-4">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('community.searchPlaceholder')}
              aria-label={t('community.searchPlaceholder')}
              className="input flex-1 min-w-0 lg:min-w-[16rem]"
            />
            <div className="flex gap-2 flex-wrap" role="group" aria-label={t('community.filterByType')}>
              <button type="button" onClick={() => setType(null)} aria-pressed={type === null} className={chipClass(type === null)}>
                {t('community.allTypes')}
              </button>
              {TYPES.map((value) => (
                <button key={value} type="button" onClick={() => setType(type === value ? null : value)} aria-pressed={type === value} className={chipClass(type === value)}>
                  {TYPE_BADGES[value].label}
                </button>
              ))}
            </div>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as CommunitySort)}
              aria-label={t('community.sortLabel')}
              className="input lg:w-44"
            >
              {(['trending', 'stars', 'forks', 'recent'] as CommunitySort[]).map((value) => (
                <option key={value} value={value}>
                  {t(`community.sort.${value}`)}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-2 mb-4" role="group" aria-label={t('community.categoriesLabel')}>
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
    </div>
  );
}

function ReportsPanel({ reports, loading, error, language }: { reports: CommunityReport[]; loading: boolean; error: boolean; language: string }) {
  const { t } = useTranslation();
  if (loading) return <p className="text-sm text-gray-500 dark:text-gray-400">{t('common.loading')}</p>;
  if (error) return <p className="text-sm text-red-600 dark:text-red-400">{t('community.loadError')}</p>;
  if (reports.length === 0) return <p className="text-sm text-gray-500 dark:text-gray-400">{t('community.reports.empty')}</p>;
  return (
    <ul className="divide-y divide-gray-200 dark:divide-gray-800 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800">
      {reports.map((r) => (
        <li key={r.id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-2 justify-between">
          <div className="min-w-0">
            <p className="text-sm text-gray-900 dark:text-gray-100">
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 mr-2">
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
