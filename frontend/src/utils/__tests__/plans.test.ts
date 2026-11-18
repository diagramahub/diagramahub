import { describe, expect, it } from 'vitest';
import type { Plan } from '../../types/subscription';
import { formatAmount, isUnlimited, needsGateway, plansSummary, sortPlans } from '../plans';

const plan = (over: Partial<Plan>): Plan => ({
  id: over.name ?? 'p',
  name: 'P',
  code: 'P',
  description: '',
  price_usd: 0,
  max_projects: 1,
  max_diagrams: 5,
  is_active: true,
  is_free: false,
  active_subscriptions: 0,
  ...over,
} as Plan);

const free = plan({ name: 'Free', is_free: true, active_subscriptions: 40 });
const pro = plan({ name: 'Pro', price_usd: 3, active_subscriptions: 2, gateway_config: { provider: 'stripe', external_product_id: 'prod', external_price_id: 'price' } as Plan['gateway_config'] });
const team = plan({ name: 'Team', price_usd: 9 });
const legacy = plan({ name: 'Legacy', price_usd: 1, is_active: false });

describe('plans page helpers', () => {
  it('shows active plans first, free before paid, cheapest first', () => {
    expect(sortPlans([legacy, team, pro, free]).map((p) => p.name)).toEqual(['Free', 'Pro', 'Team', 'Legacy']);
  });

  it('treats null and -1 as unlimited', () => {
    expect([null, -1, 0, 5].map(isUnlimited)).toEqual([true, true, false, false]);
  });

  it('flags active paid plans without a gateway product', () => {
    expect(needsGateway(team)).toBe(true);
    expect(needsGateway(pro)).toBe(false);
    expect(needsGateway(free)).toBe(false);
    const summary = plansSummary([free, pro, team, legacy]);
    expect(summary).toMatchObject({ total: 4, active: 3, subscribers: 42, paidActive: 2 });
    expect(summary.withoutGateway.map((p) => p.name)).toEqual(['Team']);
  });

  it('formats amounts in the UI language', () => {
    expect(formatAmount(3, 'usd', 'en-US')).toBe('$3');
    expect(formatAmount(59, 'mxn', 'en-US')).toBe('MX$59');
    expect(formatAmount(4.99, 'usd', 'en-US')).toBe('$4.99');
  });
});
