import { createClient } from '@/api/api.client';
import {
  CancelSubscriptionPayload,
  CancelSubscriptionResponse,
  CreateCheckoutSessionPayload,
  CreateCheckoutSessionResponse,
  SubscriptionPlan,
  VerifyCheckoutSessionResponse,
} from './types';

const client = createClient({ baseURL: import.meta.env.VITE_NUTRITION_API_URL });

type PlansEnvelope =
  | SubscriptionPlan[]
  | { plans: SubscriptionPlan[] }
  | { items: SubscriptionPlan[] }
  | { data: SubscriptionPlan[] };

const normalizePlansResponse = (payload: PlansEnvelope): SubscriptionPlan[] => {
  if (Array.isArray(payload)) return payload;

  if ('plans' in payload && Array.isArray(payload.plans)) return payload.plans;
  if ('items' in payload && Array.isArray(payload.items)) return payload.items;
  if ('data' in payload && Array.isArray(payload.data)) return payload.data;
  return [];
};

export const getSubscriptionPlans = async (): Promise<SubscriptionPlan[]> => {
  const { data } = await client.get<PlansEnvelope>('/v1/subscriptions/plans');
  return normalizePlansResponse(data);
};

export const createCheckoutSession = async (
  payload: CreateCheckoutSessionPayload
): Promise<CreateCheckoutSessionResponse> => {
  const { data } = await client.post<CreateCheckoutSessionResponse>(
    '/v1/billing/checkout-session',
    payload
  );
  return data;
};

export const verifyCheckoutSession = async (
  sessionId: string
): Promise<VerifyCheckoutSessionResponse> => {
  const { data } = await client.get<VerifyCheckoutSessionResponse>(
    `/v1/billing/checkout-session/${encodeURIComponent(sessionId)}`
  );
  return data;
};

export const cancelSubscription = async (
  payload: CancelSubscriptionPayload
): Promise<CancelSubscriptionResponse> => {
  const { data } = await client.post<CancelSubscriptionResponse>(
    '/v1/billing/subscription/cancel',
    payload
  );
  return data;
};
