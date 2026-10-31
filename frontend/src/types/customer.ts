export interface StampLog {
  created_at: string;
  action: string;
  note: string;
  delta_stamps: number;
  delta_rewards: number;
}

export interface CustomerProfile {
  id?: string;
  line_user_id: string;
  customer_name: string;
  line_display_name?: string;
  picture_url?: string;
  status_message?: string;
  phone?: string;
  floor?: string;
  room?: string;
  order_type?: string;
  payment_method?: string;
  total_orders: number;
  total_spent: number;
  stamps: number; // 0 to 9
  available_rewards: number; // count of 10 THB discount coupons ready to use
  rewards_redeemed?: number;
  total_rewards_earned?: number;
  stamp_logs?: StampLog[];
  last_order_at?: string;
  updated_at?: string;
}

export interface AdminCustomerMetrics {
  total_customers: number;
  total_stamps: number;
  total_available_rewards: number;
  total_spent: number;
  total_orders: number;
}
