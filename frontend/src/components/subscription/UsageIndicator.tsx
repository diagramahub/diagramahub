import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import apiService from '../../services/api';
import { UsageSummary } from '../../types/subscription';
import { apiErrorMessage } from '../../utils/apiError';
import { isUnlimited } from '../../utils/plans';

function percentage(current: number, limit: number | null): number {
  if (isUnlimited(limit) || !limit) return 0;
  return (current / limit) * 100;
}

const barColor = (pct: number) => (pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-green-500');
const trackColor = (pct: number) =>
  pct >= 100 ? 'bg-red-100 dark:bg-red-900/30' : pct >= 80 ? 'bg-amber-100 dark:bg-amber-900/30' : 'bg-green-100 dark:bg-green-900/30';

function UsageRow({ label, current, limit, note }: { label: string; current: number; limit: number | null; note?: string }) {
  const { t } = useTranslation();
  const pct = percentage(current, limit);
  const unlimited = isUnlimited(limit);
  return (
    <div>
      <div className="flex justify-between items-center mb-2 gap-3">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</span>
        <span className="text-sm text-gray-600 dark:text-gray-400 tabular-nums">
          {current} / {unlimited ? t('subscription.usage.unlimited') : limit}
        </span>
      </div>
      {!unlimited && (
        <div
          className={`w-full h-2 rounded-full ${trackColor(pct)}`}
          role="progressbar"
          aria-label={label}
          aria-valuemin={0}
          aria-valuemax={limit ?? 0}
          aria-valuenow={current}
        >
          <div className={`h-2 rounded-full transition-all duration-300 ${barColor(pct)}`} style={{ width: `${Math.min(pct, 100)}%` }} />
        </div>
      )}
      {!unlimited && pct >= 80 && (
        <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
          {pct >= 100 ? `${t('subscription.usage.limitReached')}. ${t('subscription.usage.upgradePrompt')}` : t('subscription.usage.warning')}
        </p>
      )}
      {note && <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">{note}</p>}
    </div>
  );
}

/** Projects and diagrams used against the plan; published diagrams shown apart when they don't count. */
export default function UsageIndicator() {
  const { t } = useTranslation();
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    apiService
      .getUsageSummary()
      .then((data) => {
        setUsage(data);
        setError('');
      })
      .catch((err: unknown) => setError(apiErrorMessage(err) || t('subscription.errorLoading')))
      .finally(() => setLoading(false));
  }, [t]);

  if (loading) {
    return (
      <div className="card p-6">
        <div className="h-24 rounded-lg bg-gray-100 dark:bg-gray-800 animate-pulse" aria-hidden="true" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="card p-6">
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600 dark:border-red-700 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </p>
      </div>
    );
  }

  if (!usage) return null;

  const { diagrams } = usage;
  const privateOnly = !diagrams.public_counts && !isUnlimited(diagrams.limit);
  const overLimit = !isUnlimited(diagrams.limit) && diagrams.limit !== null && diagrams.current > diagrams.limit;

  return (
    <div className="card">
      <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 dark:border-gray-800">
        <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100">{t('subscription.usage.title')}</h2>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{t('subscription.usage.subtitle')}</p>
      </div>

      <div className="px-4 sm:px-6 py-4 sm:py-6 space-y-6">
        <UsageRow label={t('subscription.usage.projects')} current={usage.projects.current} limit={usage.projects.limit} />
        <UsageRow
          label={privateOnly ? t('subscription.usage.privateDiagrams') : t('subscription.usage.diagrams')}
          current={diagrams.current}
          limit={diagrams.limit}
          note={privateOnly ? t('subscription.usage.publicFree', { count: diagrams.public }) : undefined}
        />
        {!isUnlimited(diagrams.public_limit) && (
          <UsageRow label={t('subscription.usage.publicDiagrams')} current={diagrams.public} limit={diagrams.public_limit} />
        )}
        {overLimit && (
          <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
            {t('subscription.usage.overLimit')}
          </p>
        )}
      </div>
    </div>
  );
}
