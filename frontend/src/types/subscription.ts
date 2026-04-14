export type StripePriceEntry = {
  stripe_price_id: string;
  currency: string;
  amount: number;
}

export type Plan = {
  id: string;
  name: string;
  code: string;
  description: string | null;
  price_usd: number;
  max_projects: number | null;  // null = unlimited
  max_diagrams: number | null;  // null = unlimited
  is_active: boolean;
  is_free: boolean;
  active_subscriptions: number;
  stripe_product_id?: string;
  stripe_prices?: StripePriceEntry[];
  created_at: string;
  updated_at: string;
}

export type PlanCreate = {
  name: string;
  code: string;
  description?: string;
  price_usd: number;
  max_projects: number | null;
  max_diagrams: number | null;
}

export type PlanUpdate = {
  name?: string;
  code?: string;
  description?: string;
  price_usd?: number;
  max_projects?: number | null;
  max_diagrams?: number | null;
  is_active?: boolean;
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

export type Invoice = {
  id: string;
  amount: number;
  currency: string;
  status: 'paid' | 'open' | 'void' | 'uncollectible';
  description: string;
  invoice_pdf: string | null;
  hosted_invoice_url: string | null;
  created_at: string;
  paid_at: string | null;
}

export type BillingHistory = {
  invoices: Invoice[];
  total_count: number;
}
