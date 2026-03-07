export interface SubscriptionPlan {
  id: number | string;
  name: string;
  description?: string | null;
  price?: number | null;
  currency?: string | null;
  interval?: string | null;
  code?: string | null;
  price_id?: string | null;
  features?: string[];
  [key: string]: unknown;
}

export interface CreateCheckoutSessionPayload {
  plan_id: number;
  billing_interval?: 'monthly' | 'yearly';
  success_url?: string;
  cancel_url?: string;
}

export type CancelSubscriptionMode = 'immediately' | 'period_end';

export interface CancelSubscriptionPayload {
  mode?: CancelSubscriptionMode;
}

export interface ManagedSubscription {
  id?: number | string;
  status?: string | null;
  provider_status?: string | null;
  cancel_at_period_end?: boolean;
  auto_renew?: boolean;
  canceled_at?: string | null;
  current_period_end?: string | null;
  trial_end?: string | null;
  ended_at?: string | null;
}

export interface CreateCheckoutSessionResponse {
  url?: string;
  checkout_url?: string;
  session_url?: string;
  [key: string]: unknown;
}

export interface VerifyCheckoutSessionResponse {
  id: string;
  status?: string | null;
  payment_status?: string | null;
  customer?: string | null;
  subscription_status?: string | null;
  has_active_subscription: boolean;
}

export interface CancelSubscriptionResponse {
  message?: string;
  cancel_mode?: CancelSubscriptionMode;
  subscription?: ManagedSubscription | null;
}
