export type Plan = {
  id: string;
  name: string;
  description: string | null;
  price_usd: number;
  max_projects: number | null;  // null = unlimited
  max_diagrams: number | null;  // null = unlimited
  is_active: boolean;
  is_free: boolean;
  active_subscriptions: number;
  created_at: string;
  updated_at: string;
}

export type PlanCreate = {
  name: string;
  description?: string;
  price_usd: number;
  max_projects: number | null;
  max_diagrams: number | null;
}

export type PlanUpdate = {
  name?: string;
  description?: string;
  price_usd?: number;
  max_projects?: number | null;
  max_diagrams?: number | null;
}

export type Subscription = {
  id: string;
  user_id: string;
  plan: Plan;
  status: 'active' | 'pending' | 'payment_failed' | 'cancelled' | 'expired';
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  payment_provider: string;
  started_at: string;
  current_period_start: string | null;
  current_period_end: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
}

export type UsageSummary = {
  plan_name: string;
  projects: {
    current: number;
    limit: number | null;
  };
  diagrams: {
    current: number;
    limit: number | null;
  };
  usage_percentage: {
    projects: number;
    diagrams: number;
  };
}
