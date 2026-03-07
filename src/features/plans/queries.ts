import { useQuery } from '@tanstack/react-query';
import { getPlans } from './api';

export const usePlans = () => {
  return useQuery({
    queryKey: ['plans', { is_active: true }],
    queryFn: getPlans,
  });
};
