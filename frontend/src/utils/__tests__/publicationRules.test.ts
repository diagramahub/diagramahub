import { AxiosError, AxiosHeaders } from 'axios';
import type { TFunction } from 'i18next';
import { describe, expect, it } from 'vitest';
import type { UsageSummary } from '../../types/subscription';
import { diagramLimitLines } from '../plans';
import { publicationErrorMessage, publishingFreesSlot, unpublishBlocked } from '../publicationRules';

// Returns the key and its options, so tests can see which message was picked.
const t = ((key: string, options?: Record<string, unknown>) =>
  options ? `${key} ${JSON.stringify(options)}` : key) as unknown as TFunction;

function httpError(status: number, detail: unknown): AxiosError {
  const config = { headers: new AxiosHeaders() };
  return new AxiosError('Request failed', 'ERR_BAD_RESPONSE', config, null, {
    status,
    statusText: '',
    headers: {},
    config,
    data: { detail },
  });
}

function usage(diagrams: Partial<UsageSummary['diagrams']>): UsageSummary {
  return {
    plan_name: 'Free',
    projects: { current: 1, limit: 1 },
    diagrams: { current: 0, limit: 5, public: 0, public_counts: false, public_limit: null, ...diagrams },
    usage_percentage: { projects: 100, diagrams: 0 },
  };
}

describe('unpublishBlocked', () => {
  it('blocks when there is no room for one more private diagram', () => {
    expect(unpublishBlocked(usage({ current: 5 }), false)).toBe(true);
    expect(unpublishBlocked(usage({ current: 6 }), false)).toBe(true); // over the limit
    expect(unpublishBlocked(usage({ current: 4 }), false)).toBe(false);
  });

  it('never blocks a hidden publication, a plan that counts public ones, or no limit', () => {
    expect(unpublishBlocked(usage({ current: 5 }), true)).toBe(false);
    expect(unpublishBlocked(usage({ current: 5, public_counts: true }), false)).toBe(false);
    expect(unpublishBlocked(usage({ current: 50, limit: null }), false)).toBe(false);
    expect(unpublishBlocked(null, false)).toBe(false);
  });

  it('says publishing frees a slot only when public diagrams do not count', () => {
    expect(publishingFreesSlot(usage({}))).toBe(true);
    expect(publishingFreesSlot(usage({ public_counts: true }))).toBe(false);
    expect(publishingFreesSlot(usage({ limit: null }))).toBe(false);
  });
});

describe('publicationErrorMessage', () => {
  it('explains plan limits', () => {
    const publicLimit = { error: 'resource_limit_exceeded', resource_type: 'public_diagrams', current_usage: 3, limit: 3 };
    expect(publicationErrorMessage(httpError(403, publicLimit), t)).toBe('community.publish.errors.publicLimit {"count":3}');
    const privateLimit = { error: 'resource_limit_exceeded', resource_type: 'private_diagrams', current_usage: 5, limit: 5 };
    expect(publicationErrorMessage(httpError(403, privateLimit), t)).toBe('community.owner.unpublishBlocked {"current":5,"limit":5}');
  });

  it('explains what a diagram needs to be published', () => {
    expect(publicationErrorMessage(httpError(422, { error: 'diagram_empty' }), t)).toBe('community.publish.errors.empty');
    expect(publicationErrorMessage(httpError(422, { error: 'diagram_invalid', message: 'bad line 2' }), t)).toBe(
      'community.publish.errors.invalidWithReason {"reason":"bad line 2"}',
    );
    expect(publicationErrorMessage(httpError(422, { error: 'diagram_too_large', limit: 100000 }), t, 'en')).toBe(
      'community.publish.errors.tooLarge {"limit":"100,000"}',
    );
    expect(publicationErrorMessage(httpError(429, { error: 'publish_daily_limit', limit: 20 }), t)).toBe(
      'community.publish.errors.dailyLimit {"count":20}',
    );
  });

  it('falls back to the rate limit message or nothing', () => {
    expect(publicationErrorMessage(httpError(429, 'Too many requests'), t)).toBe('community.tooFast');
    expect(publicationErrorMessage(httpError(500, 'boom'), t)).toBeUndefined();
  });
});

describe('diagramLimitLines', () => {
  it('names private diagrams and unlimited public ones by default', () => {
    expect(diagramLimitLines({ max_diagrams: 10, public_diagrams_count: false, max_public_diagrams: null }, t)).toEqual([
      'subscription.features.upToPrivateDiagrams {"count":10}',
      'subscription.features.unlimitedPublicDiagrams',
    ]);
  });

  it('counts everything when the plan says so, and shows a public cap', () => {
    expect(diagramLimitLines({ max_diagrams: 10, public_diagrams_count: true, max_public_diagrams: -1 }, t)).toEqual([
      'subscription.features.upToDiagrams {"count":10}',
    ]);
    expect(diagramLimitLines({ max_diagrams: 10, public_diagrams_count: false, max_public_diagrams: 50 }, t)).toEqual([
      'subscription.features.upToPrivateDiagrams {"count":10}',
      'subscription.features.upToPublicDiagrams {"count":50}',
    ]);
  });

  it('keeps an unlimited plan short', () => {
    expect(diagramLimitLines({ max_diagrams: null, public_diagrams_count: false, max_public_diagrams: null }, t)).toEqual([
      'subscription.features.unlimitedDiagrams',
    ]);
  });
});
