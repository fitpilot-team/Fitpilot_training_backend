export interface Plan {
  id: number;
  name: string;
  price_monthly: string;
  trial_days: number;
  access_nutrition: boolean;
  access_training: boolean;
  is_active: boolean;
  max_clients: number | null;
  stripe_product_id: string;
  stripe_price_id: string;
  stripe_price_id_monthly: string | null;
  stripe_price_id_yearly: string | null;
}
