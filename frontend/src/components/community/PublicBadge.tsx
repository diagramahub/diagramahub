import { useTranslation } from 'react-i18next';

export const GLOBE_PATH =
  'M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z';

interface PublicBadgeProps {
  /** Hidden by moderation: published, but others can't see it. */
  hidden?: boolean;
  /** Icon only (lists); otherwise icon and label. */
  compact?: boolean;
  className?: string;
}

/** Marks a diagram that is published to the Community. */
export function PublicBadge({ hidden = false, compact = false, className = '' }: PublicBadgeProps) {
  const { t } = useTranslation();
  const label = hidden ? t('community.public.hidden') : t('community.public.label');
  const tooltip = hidden ? t('community.public.hiddenTooltip') : t('community.public.tooltip');
  const tone = hidden
    ? 'text-amber-600 dark:text-amber-400'
    : 'text-emerald-600 dark:text-emerald-400';
  const icon = (
    <svg className={compact ? 'w-3.5 h-3.5' : 'w-3 h-3'} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={GLOBE_PATH} />
    </svg>
  );

  if (compact) {
    return (
      <span className={`inline-flex flex-shrink-0 ${tone} ${className}`} title={tooltip}>
        {icon}
        <span className="sr-only">{label}</span>
      </span>
    );
  }
  return (
    <span
      className={`inline-flex flex-shrink-0 items-center gap-1 rounded-md px-1.5 h-5 text-[11px] font-medium ring-1 ring-inset ${
        hidden
          ? 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30'
          : 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30'
      } ${className}`}
      title={tooltip}
    >
      {icon}
      {label}
    </span>
  );
}
