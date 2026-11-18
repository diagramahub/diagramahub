/** Admin plans page: ordering, limits and the summary at the top. */
import type { Plan } from '../types/subscription';

/** A limit stored as null or -1 means unlimited. */
export function isUnlimited(limit: number | null | undefined): boolean {
  return limit === null || limit === undefined || limit < 0;
}

/** Plans as the page shows them: active first, then free before paid, cheapest first. */
export function sortPlans(plans: Plan[]): Plan[] {
  return [...plans].sort(
    (a, b) =>
      Number(b.is_active) - Number(a.is_active) ||
      Number(b.is_free) - Number(a.is_free) ||
      a.price_usd - b.price_usd ||
      a.name.localeCompare(b.name),
  );
}

export function isPaid(plan: Plan): boolean {
  return !plan.is_free && plan.price_usd > 0;
}

/** A paid plan nobody can pay for: no product/price in the payment gateway yet. */
export function needsGateway(plan: Plan): boolean {
  return isPaid(plan) && !(plan.gateway_config?.external_product_id && plan.gateway_config?.external_price_id);
}

export interface PlansSummary {
  total: number;
  active: number;
  subscribers: number;
  paidActive: number;
  /** Active paid plans that can't be paid for (no gateway product). */
  withoutGateway: Plan[];
}

export function plansSummary(plans: Plan[]): PlansSummary {
  const active = plans.filter((p) => p.is_active);
  return {
    total: plans.length,
    active: active.length,
    subscribers: plans.reduce((sum, p) => sum + (p.active_subscriptions || 0), 0),
    paidActive: active.filter(isPaid).length,
    withoutGateway: active.filter(needsGateway),
  };
}

/** Currency amount in the UI language (e.g. "$3.00", "MX$59.00", "3,00 €"). */
export function formatAmount(amount: number, currency: string, locale: string): string {
  const whole = Number.isInteger(amount);
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: whole ? 0 : 2,
  }).format(amount);
}
