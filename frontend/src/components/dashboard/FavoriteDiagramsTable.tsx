import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { DiagramListEntry, FavoriteDiagrams } from '../../types/dashboard';
import { TYPE_BADGES } from '../community/typeBadges';
import { FavoriteStarButton, StarIcon } from '../FavoriteStarButton';
import { PublicBadge } from '../community/PublicBadge';
import { dateLocale } from '../../utils/locale';

const FREEHAND_BADGE = { label: '✎', className: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300' };

interface FavoriteDiagramsTableProps {
  data: FavoriteDiagrams | null;
  published: Map<string, { hidden: boolean }>;
  /** Unstars a diagram; resolves false when it couldn't. */
  onUnstar: (diagram: DiagramListEntry) => Promise<boolean>;
  onRestar: (diagram: DiagramListEntry) => Promise<boolean>;
}

/** Shortcuts to the diagrams the user starred, most recently edited first. */
export function FavoriteDiagramsTable({ data, published, onUnstar, onRestar }: FavoriteDiagramsTableProps) {
  const { t, i18n } = useTranslation();
  const locale = dateLocale(i18n.language);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [removed, setRemoved] = useState<DiagramListEntry | null>(null);
  const [error, setError] = useState<string | null>(null);

  const unstar = async (diagram: DiagramListEntry) => {
    setBusyId(diagram.id);
    setError(null);
    const ok = await onUnstar(diagram);
    setBusyId(null);
    if (ok) setRemoved(diagram);
    else setError(t('dashboard.favorites.removeError'));
  };

  const undo = async () => {
    if (!removed) return;
    const diagram = removed;
    setRemoved(null);
    if (!(await onRestar(diagram))) setError(t('favorite.error'));
  };

  return (
    <section className="card overflow-hidden" aria-labelledby="favorites-title">
      <div className="px-5 sm:px-6 pt-5 sm:pt-6 pb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 id="favorites-title" className="flex items-center gap-1.5 text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            <StarIcon filled className="w-4 h-4 text-amber-500 dark:text-amber-400" />
            {t('dashboard.favorites.title')}
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{t('dashboard.favorites.subtitle')}</p>
        </div>
        {data && data.total > data.items.length && (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {t('dashboard.favorites.showing', { shown: data.items.length, total: data.total })}
          </p>
        )}
      </div>

      <div aria-live="polite">
        {removed && (
          <div role="status" className="mx-5 sm:mx-6 mb-3 flex items-center justify-between gap-3 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/60 px-3 py-2 text-sm text-gray-700 dark:text-gray-300">
            <span className="truncate">{t('dashboard.favorites.removed', { title: removed.title })}</span>
            <button type="button" onClick={undo} className="btn btn-ghost btn-sm flex-shrink-0">
              {t('dashboard.favorites.undo')}
            </button>
          </div>
        )}
        {error && (
          <p role="alert" className="mx-5 sm:mx-6 mb-3 rounded-lg border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">
            {error}
          </p>
        )}
      </div>

      {!data ? (
        <div className="px-5 sm:px-6 pb-6 space-y-2" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-10 rounded-lg bg-gray-100 dark:bg-gray-800 animate-pulse" />
          ))}
        </div>
      ) : data.items.length === 0 ? (
        <div className="px-5 sm:px-6 pb-8 pt-2 flex flex-col items-center text-center">
          <span className="w-11 h-11 rounded-full bg-amber-100 dark:bg-amber-500/10 text-amber-500 dark:text-amber-400 flex items-center justify-center mb-3" aria-hidden="true">
            <StarIcon filled={false} className="w-5 h-5" />
          </span>
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{t('dashboard.favorites.emptyTitle')}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-md">{t('dashboard.favorites.emptyDescription')}</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-y border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/60 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                <th scope="col" className="px-5 sm:px-6 py-2">{t('dashboard.favorites.diagram')}</th>
                <th scope="col" className="hidden md:table-cell px-3 py-2">{t('dashboard.favorites.project')}</th>
                <th scope="col" className="hidden sm:table-cell px-3 py-2 whitespace-nowrap">{t('dashboard.favorites.updated')}</th>
                <th scope="col" className="px-5 sm:px-6 py-2 w-12">
                  <span className="sr-only">{t('dashboard.favorites.actions')}</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {data.items.map((d) => {
                const badge = TYPE_BADGES[d.diagram_type] ?? FREEHAND_BADGE;
                const updated = new Date(d.updated_at);
                return (
                  <tr key={d.id} className="group hover:bg-purple-50/40 dark:hover:bg-purple-500/5 transition-colors">
                    <td className="px-5 sm:px-6 py-2.5 max-w-0 w-full">
                      <Link
                        to={`/projects/${d.project_id}/diagrams/${d.id}`}
                        aria-label={t('dashboard.favorites.open', { title: d.title })}
                        className="flex items-center gap-2.5 min-w-0 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
                      >
                        <span className={`flex-shrink-0 w-9 text-center rounded text-[9px] font-bold leading-4 ${badge.className}`} aria-hidden="true">
                          {badge.label}
                        </span>
                        <span className="min-w-0">
                          <span className="flex items-center gap-2 min-w-0">
                            <span className="truncate font-medium text-gray-900 dark:text-gray-100 group-hover:text-purple-700 dark:group-hover:text-purple-300">
                              {d.title}
                            </span>
                            {published.has(d.id) && <PublicBadge compact hidden={published.get(d.id)?.hidden} />}
                          </span>
                          <span className="md:hidden block truncate text-xs text-gray-500 dark:text-gray-400">
                            {d.project_emoji} {d.project_name}
                          </span>
                        </span>
                      </Link>
                    </td>
                    <td className="hidden md:table-cell px-3 py-2.5 text-gray-600 dark:text-gray-400 whitespace-nowrap max-w-[14rem] truncate">
                      <Link to={`/projects/${d.project_id}`} className="hover:text-purple-700 dark:hover:text-purple-300">
                        {d.project_emoji} {d.project_name}
                      </Link>
                    </td>
                    <td className="hidden sm:table-cell px-3 py-2.5 text-gray-500 dark:text-gray-400 whitespace-nowrap tabular-nums">
                      <time dateTime={d.updated_at}>
                        {updated.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: updated.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' })}
                      </time>
                    </td>
                    <td className="px-5 sm:px-6 py-2.5 text-right">
                      <FavoriteStarButton favorite busy={busyId === d.id} title={d.title} onToggle={() => unstar(d)} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
