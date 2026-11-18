import { useTranslation } from 'react-i18next';

interface FavoriteStarButtonProps {
  favorite: boolean;
  onToggle: () => void;
  busy?: boolean;
  /** Names the diagram in the label when the button sits in a list. */
  title?: string;
  size?: 'sm' | 'md';
  className?: string;
}

export const STAR_PATH =
  'M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z';

/** The star that marks a diagram as favorite: filled amber when it is one. */
export function StarIcon({ filled, className = 'w-4 h-4' }: { filled: boolean; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={filled ? 1.5 : 2} d={STAR_PATH} />
    </svg>
  );
}

/** Toggle button for a diagram's star (editor header, dashboard table). */
export function FavoriteStarButton({ favorite, onToggle, busy, title, size = 'sm', className = '' }: FavoriteStarButtonProps) {
  const { t } = useTranslation();
  const label = title
    ? t(favorite ? 'dashboard.favorites.remove' : 'favorite.add', { title })
    : t(favorite ? 'favorite.remove' : 'favorite.add');
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={busy}
      aria-pressed={favorite}
      aria-label={label}
      title={label}
      className={`flex-shrink-0 rounded-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 disabled:opacity-50 disabled:cursor-wait ${
        size === 'md' ? 'p-1.5' : 'p-1'
      } ${
        favorite
          ? 'text-amber-500 hover:text-amber-600 dark:text-amber-400 dark:hover:text-amber-300'
          : 'text-gray-400 hover:text-amber-500 dark:text-gray-500 dark:hover:text-amber-400'
      } ${className}`}
    >
      <StarIcon filled={favorite} className={size === 'md' ? 'w-5 h-5' : 'w-4 h-4'} />
    </button>
  );
}
