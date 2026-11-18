import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import type { PublicationCard } from '../../types/community';
import { compactCount } from '../../utils/community';
import { DiagramThumbnail } from './DiagramThumbnail';
import { CommunityAvatar } from './CommunityAvatar';
import { TYPE_BADGES } from './typeBadges';

interface PublicationCardViewProps {
  publication: PublicationCard;
  onToggleStar: (publication: PublicationCard) => void;
}

/** A publication in the portal's grid. */
export function PublicationCardView({ publication: p, onToggleStar }: PublicationCardViewProps) {
  const { t } = useTranslation();
  const badge = TYPE_BADGES[p.diagram_type];
  return (
    <article className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden flex flex-col hover:border-gray-300 dark:hover:border-gray-700 transition-colors">
      <Link to={`/community/${p.id}`} className="block focus:outline-none focus:ring-2 focus:ring-inset focus:ring-purple-500" aria-label={p.title}>
        <DiagramThumbnail
          cacheKey={`${p.id}:${p.updated_at}`}
          content={p.content}
          diagramType={p.diagram_type}
          title={p.title}
          className="h-44 p-3 bg-white border-b border-gray-100 dark:border-gray-800"
        />
      </Link>
      <div className="p-4 flex-1 flex flex-col">
        <div className="flex items-center gap-2 mb-1">
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${badge.className}`}>{badge.label}</span>
          <span className="text-xs text-gray-500 dark:text-gray-400">{t(`community.categories.${p.category}`)}</span>
          {p.featured && (
            <span className="ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
              {t('community.featured')}
            </span>
          )}
          {p.hidden && (
            <span className="ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">
              {t('community.hiddenBadge')}
            </span>
          )}
        </div>
        <h3 className="text-[15px] font-semibold text-gray-900 dark:text-gray-100 line-clamp-2">
          <Link to={`/community/${p.id}`} className="hover:underline focus:outline-none focus:ring-2 focus:ring-purple-500 rounded">
            {p.title}
          </Link>
        </h3>
        {p.description && <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{p.description}</p>}
        <div className="mt-auto pt-3 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
          <CommunityAvatar name={p.owner_name} />
          <span className="truncate">{p.owner_name}</span>
          <span className="ml-auto flex items-center gap-3">
            <button
              type="button"
              onClick={() => onToggleStar(p)}
              aria-pressed={p.starred_by_me}
              aria-label={p.starred_by_me ? t('community.unstar') : t('community.star')}
              className={`flex items-center gap-1 rounded px-1 focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                p.starred_by_me ? 'text-amber-500' : 'hover:text-amber-500'
              }`}
            >
              <span aria-hidden="true">{p.starred_by_me ? '★' : '☆'}</span>
              {compactCount(p.stars_count)}
            </button>
            <span title={t('community.forks')}>
              <span aria-hidden="true">⑂</span> {compactCount(p.forks_count)}
            </span>
            <span title={t('community.comments')}>
              <span aria-hidden="true">💬</span> {compactCount(p.comments_count)}
            </span>
          </span>
        </div>
      </div>
    </article>
  );
}
