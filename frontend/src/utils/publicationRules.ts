/**
 * Plan rules around Community publications: a published (visible) diagram
 * doesn't count toward the plan's diagram limit, so making it private again
 * needs room, and publishing has its own requirements.
 */
import type { TFunction } from 'i18next';
import type { UsageSummary } from '../types/subscription';
import { apiErrorDetail, apiErrorStatus, resourceLimitDetail } from './apiError';

type Translate = TFunction;

/** Whether unpublishing would leave the owner with more private diagrams than the plan allows. */
export function unpublishBlocked(usage: UsageSummary | null, hidden: boolean): boolean {
  if (!usage || hidden) return false; // a hidden publication already counts as private
  const { current, limit, public_counts: publicCounts } = usage.diagrams;
  return !publicCounts && limit !== null && current >= limit;
}

/** Whether publishing frees a slot in the user's plan (public diagrams don't count). */
export function publishingFreesSlot(usage: UsageSummary | null): boolean {
  return !!usage && !usage.diagrams.public_counts && usage.diagrams.limit !== null;
}

/** The message for a failed publish or unpublish, or undefined for a generic one. */
export function publicationErrorMessage(err: unknown, t: Translate, language?: string): string | undefined {
  const limit = resourceLimitDetail(err);
  if (limit?.resource_type === 'public_diagrams') {
    return t('community.publish.errors.publicLimit', { count: limit.limit });
  }
  if (limit?.resource_type === 'private_diagrams') {
    return t('community.owner.unpublishBlocked', { current: limit.current_usage, limit: limit.limit });
  }
  const detail = apiErrorDetail(err);
  const code = typeof detail === 'object' && detail !== null ? (detail as { error?: unknown }).error : undefined;
  const info = (detail ?? {}) as { limit?: number; message?: string };
  switch (code) {
    case 'diagram_empty':
      return t('community.publish.errors.empty');
    case 'diagram_invalid':
      return info.message
        ? t('community.publish.errors.invalidWithReason', { reason: info.message })
        : t('community.publish.errors.invalid');
    case 'diagram_too_large':
      return t('community.publish.errors.tooLarge', { limit: (info.limit ?? 0).toLocaleString(language) });
    case 'publish_daily_limit':
      return t('community.publish.errors.dailyLimit', { count: info.limit ?? 0 });
    case 'type_not_publishable':
      return t('community.publish.notPublishable');
    case 'already_published':
      return t('community.publish.alreadyPublished');
  }
  return apiErrorStatus(err) === 429 ? t('community.tooFast') : undefined;
}
