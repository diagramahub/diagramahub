import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { CommunityImpact } from '../../types/dashboard';
import { TYPE_BADGES } from '../community/typeBadges';
import { StarIcon } from '../FavoriteStarButton';

interface CommunityImpactCardProps {
  data: CommunityImpact | null;
}

/** What the user's Community publications have received. */
export function CommunityImpactCard({ data }: CommunityImpactCardProps) {
  const { t, i18n } = useTranslation();
  const format = (n: number) => n.toLocaleString(i18n.language);

  return (
    <section className="card p-5 sm:p-6 h-full flex flex-col" aria-labelledby="impact-title">
      <h2 id="impact-title" className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
        {t('dashboard.impact.title')}
      </h2>

      {!data ? (
        <div className="mt-4 flex-1 min-h-[10rem] rounded-lg bg-gray-100 dark:bg-gray-800 animate-pulse" aria-hidden="true" />
      ) : data.publications === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center py-6">
          <span className="w-11 h-11 rounded-full bg-amber-100 dark:bg-amber-500/10 text-amber-500 dark:text-amber-400 flex items-center justify-center mb-3" aria-hidden="true">
            <StarIcon filled={false} className="w-5 h-5" />
          </span>
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{t('dashboard.impact.emptyTitle')}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-xs">{t('dashboard.impact.emptyDescription')}</p>
          <Link to="/community" className="btn btn-secondary btn-sm mt-4">
            {t('dashboard.impact.explore')}
          </Link>
        </div>
      ) : (
        <>
          {/* Stars: the headline */}
          <div className="mt-4 flex items-end gap-3">
            <span className="w-11 h-11 rounded-xl bg-amber-100 dark:bg-amber-500/10 text-amber-500 dark:text-amber-400 flex items-center justify-center flex-shrink-0" aria-hidden="true">
              <StarIcon filled className="w-6 h-6" />
            </span>
            <div className="min-w-0">
              <p className="text-3xl font-semibold tracking-tight text-gray-900 dark:text-gray-100 tabular-nums leading-none">{format(data.stars)}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {t('dashboard.impact.stars')}
                {data.stars_last_30_days > 0 && (
                  <span className="ml-1.5 font-medium text-green-700 dark:text-green-400">
                    {t('dashboard.impact.starsLast30', { count: data.stars_last_30_days })}
                  </span>
                )}
              </p>
            </div>
          </div>

          <dl className="mt-4 grid grid-cols-3 gap-2">
            {[
              { label: t('dashboard.impact.forks'), value: data.forks },
              { label: t('dashboard.impact.views'), value: data.views },
              { label: t('dashboard.impact.comments'), value: data.comments },
            ].map((item) => (
              <div key={item.label} className="rounded-lg bg-gray-50 dark:bg-gray-800/60 px-2.5 py-2 min-w-0">
                <dt className="text-[11px] text-gray-500 dark:text-gray-400 truncate">{item.label}</dt>
                <dd className="text-base font-semibold text-gray-900 dark:text-gray-100 tabular-nums">{format(item.value)}</dd>
              </div>
            ))}
          </dl>

          {data.top && (
            <div className="mt-4">
              <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-1.5">{t('dashboard.impact.top')}</p>
              <Link
                to={`/community/${data.top.id}`}
                aria-label={t('dashboard.impact.openTop', { title: data.top.title })}
                className="flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-800 px-3 py-2 hover:border-purple-300 dark:hover:border-purple-700 hover:bg-purple-50/40 dark:hover:bg-purple-500/5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
              >
                {TYPE_BADGES[data.top.diagram_type] && (
                  <span className={`flex-shrink-0 rounded px-1.5 text-[9px] font-bold leading-4 ${TYPE_BADGES[data.top.diagram_type].className}`}>
                    {TYPE_BADGES[data.top.diagram_type].label}
                  </span>
                )}
                <span className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">{data.top.title}</span>
                <span className="ml-auto flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 tabular-nums flex-shrink-0">
                  <StarIcon filled className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
                  {format(data.top.stars_count)}
                </span>
              </Link>
            </div>
          )}

          <div className="mt-auto pt-4 flex items-center justify-between gap-2 text-xs">
            <span className="text-gray-500 dark:text-gray-400">{t('dashboard.impact.publications', { count: data.publications })}</span>
            <Link to="/community?tab=mine" className="font-medium text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300">
              {t('dashboard.impact.seeMine')}
            </Link>
          </div>
        </>
      )}
    </section>
  );
}
