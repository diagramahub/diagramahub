import React from 'react';

type SkeletonVariant = 'text' | 'card' | 'chart' | 'table';

interface SkeletonProps {
  variant?: SkeletonVariant;
  /** Width override — Tailwind class (e.g. "w-48", "w-full") */
  width?: string;
  /** Height override — Tailwind class (e.g. "h-4", "h-32") */
  height?: string;
  /** Extra Tailwind classes */
  className?: string;
}

/** Pulse animation base — shared across all variants */
function PulseBlock({ className = '' }: { className?: string }) {
  return (
    <div
      className={`bg-gray-200 dark:bg-gray-700 rounded animate-pulse ${className}`}
      role="status"
      aria-label="Cargando"
    />
  );
}

/**
 * Reusable skeleton loader with 4 variants.
 *
 * - `text`: single line, defaults to `h-4 w-full`
 * - `card`: block placeholder, defaults to `h-32 w-full`
 * - `chart`: square area, defaults to `h-40 w-full`
 * - `table`: 4 rows of varying width, stacked
 */
export default function Skeleton({
  variant = 'text',
  width,
  height,
  className = '',
}: SkeletonProps) {
  switch (variant) {
    case 'card':
      return (
        <PulseBlock
          className={`${height || 'h-32'} ${width || 'w-full'} rounded-xl ${className}`}
        />
      );

    case 'chart':
      return (
        <PulseBlock
          className={`${height || 'h-40'} ${width || 'w-full'} rounded-xl ${className}`}
        />
      );

    case 'table':
      return (
        <div className={`space-y-3 ${className}`} role="status" aria-label="Cargando tabla">
          {/* Header row */}
          <div className="flex gap-4">
            <PulseBlock className="h-6 w-1/4" />
            <PulseBlock className="h-6 w-1/3" />
            <PulseBlock className="h-6 w-1/6" />
          </div>
          {/* Data rows */}
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex gap-4">
              <PulseBlock className="h-5 w-1/4" />
              <PulseBlock className="h-5 w-1/3" />
              <PulseBlock className="h-5 w-1/6" />
            </div>
          ))}
        </div>
      );

    case 'text':
    default:
      return (
        <PulseBlock
          className={`${height || 'h-4'} ${width || 'w-full'} ${className}`}
        />
      );
  }
}

// ------------------------------------------------------------------ //
//  Composite skeletons for specific pages (keeps pages clean)
// ------------------------------------------------------------------ //

/** Dashboard stats row: 4 cards side by side */
export function DashboardStatsSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-3">
            <PulseBlock className="w-10 h-10 rounded-lg" />
            <div className="flex-1 space-y-2">
              <PulseBlock className="h-6 w-12" />
              <PulseBlock className="h-3 w-20" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Dashboard widgets: donut + AI usage side by side */
export function DashboardWidgetsSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <PulseBlock className="h-4 w-32 mb-4" />
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <PulseBlock className="w-7 h-7 rounded-full" />
              <div className="flex-1 space-y-2">
                <div className="flex justify-between">
                  <PulseBlock className="h-3 w-24" />
                  <PulseBlock className="h-3 w-8" />
                </div>
                <PulseBlock className="h-2 w-full rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <PulseBlock className="h-4 w-28 mb-4" />
        <div className="flex flex-col items-center gap-4">
          <PulseBlock className="w-40 h-40 rounded-full" />
          <div className="flex gap-4">
            <PulseBlock className="h-3 w-16" />
            <PulseBlock className="h-3 w-16" />
            <PulseBlock className="h-3 w-16" />
          </div>
        </div>
      </div>
    </div>
  );
}

/** Full-page editor loader */
export function EditorSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
      {/* Top bar */}
      <div className="flex items-center h-9 px-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <PulseBlock className="h-5 w-40" />
        <div className="flex-1" />
        <PulseBlock className="h-5 w-20" />
      </div>
      {/* Content area */}
      <div className="flex-1 flex">
        {/* Main area */}
        <div className="flex-1 p-6">
          <PulseBlock className="h-8 w-64 mb-4" />
          <PulseBlock className="h-96 w-full rounded-xl" />
        </div>
      </div>
      {/* Status bar */}
      <div className="h-8 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 flex items-center">
        <PulseBlock className="h-3 w-32" />
      </div>
    </div>
  );
}

/** Empty state skeleton for lists */
export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <PulseBlock className="w-8 h-8 rounded-full" />
          <div className="flex-1 space-y-2">
            <PulseBlock className="h-4 w-1/3" />
            <PulseBlock className="h-3 w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );
}
