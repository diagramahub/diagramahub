import React from 'react';

interface EmptyStateProps {
  /** Main heading — keep it generic (e.g. "Nothing here yet") */
  title: string;
  /** Supporting text (1-2 lines), context-specific */
  description?: string;
  /** CTA button label. Omit to hide the button. */
  actionLabel?: string;
  /** CTA button handler. Required if actionLabel is set. */
  onAction?: () => void;
  /** Override icon. Defaults to animated tumbleweed. */
  icon?: React.ReactNode;
  /** Extra content below the button */
  children?: React.ReactNode;
}

/**
 * Reusable empty-state placeholder for any list, dashboard, or panel.
 *
 * Shows the tumbleweed illustration by default, a title, optional description,
 * and an optional CTA button. Use it anywhere you have zero data.
 */
export default function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  icon,
  children,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center pt-0 pb-14 px-4 text-center">
      {/* Icon */}
      <div className="mb-6 w-96 h-64 text-gray-300 dark:text-gray-600">
        {icon || (
          <img
            src="/images/tumbleweed.svg"
            alt=""
            className="w-full h-full object-contain"
            aria-hidden="true"
          />
        )}
      </div>

      {/* Title */}
      <h3 className="text-lg font-semibold text-gray-500 dark:text-gray-400 mb-1">
        {title}
      </h3>

      {/* Description */}
      {description && (
        <p className="text-sm text-gray-400 dark:text-gray-500 max-w-sm mb-5">
          {description}
        </p>
      )}

      {/* CTA */}
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="px-5 py-2.5 bg-purple-600 text-white btn-glass rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium"
        >
          {actionLabel}
        </button>
      )}

      {children}
    </div>
  );
}
