import { useMutation, useQuery } from '@tanstack/react-query';
import { cancelSubscription, createCheckoutSession, getSubscriptionPlans } from './api';
import { CancelSubscriptionPayload, CreateCheckoutSessionPayload } from './types';

export const useSubscriptionPlans = () => {
  return useQuery({
    queryKey: ['subscription-plans'],
    queryFn: getSubscriptionPlans,
  });
};

export const useCreateCheckoutSession = () => {
  return useMutation({
    mutationFn: (payload: CreateCheckoutSessionPayload) => createCheckoutSession(payload),
  });
};

export const useCancelSubscription = () => {
  return useMutation({
    mutationFn: (payload: CancelSubscriptionPayload) => cancelSubscription(payload),
  });
};
