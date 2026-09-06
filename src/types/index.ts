export type OrderStatus =
  | 'Pending'
  | 'Confirmed'
  | 'Processing'
  | 'Delivered'
  | 'Cancelled'
  | 'Refunded';

export type UserRole = 'admin';

export interface User {
  id: string;
  username: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  category: string;
  selling_price: number;
  material_cost: number;
  manufacturing_cost: number;
  packaging_cost: number;
  delivery_cost: number;
  marketing_cost: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  unit_price: number; // Historical price captured at order creation
  created_at: string;
  product_name?: string;
  product_sku?: string;
}

export interface Order {
  id: string;
  order_number: string;
  order_date: string; // YYYY-MM-DD
  status: OrderStatus;
  customer_name: string;
  customer_phone: string;
  notes: string;
  created_at: string;
  updated_at: string;
  items?: OrderItem[];
  total_amount?: number;
  items_count?: number;
}

export interface MarketingRecord {
  id: string;
  month: string; // YYYY-MM
  spend: number;
  orders_generated: number;
  revenue: number;
  created_at: string;
  updated_at: string;
}

export interface Target {
  id: string;
  month: string; // YYYY-MM
  sales_target: number;
  profit_margin_min: number; // e.g. 25
  profit_margin_max: number; // e.g. 30
  created_at: string;
  updated_at: string;
}

export type TargetRecord = Target;

export interface SettingItem {
  key: string;
  value: string;
  updated_at: string;
}

export interface ProductMixItem {
  product_id: string;
  product_name: string;
  sku: string;
  category: string;
  units_sold: number;
  revenue: number;
  product_cost: number;
  profit: number;
  margin: number;
}

export interface DashboardMetrics {
  month: string;
  sales: number;
  orders_count: number;
  aov: number;
  cogs: number;
  marketing_cost: number;
  delivery_cost: number;
  net_profit: number;
  net_margin: number;
  website_conversion_rate: string; // "Not available" when traffic data missing
  cost_per_order: number;
  roas: number;
  target?: Target | null;
  sales_achievement_rate: number | null; // e.g. 92.5 (%) or null if no target
  margin_status: 'below' | 'in_range' | 'above' | 'no_target';
}

export interface MonthlyPerformanceRecord {
  month: string;
  sales: number;
  orders_count: number;
  cogs: number;
  delivery_cost: number;
  marketing_cost: number;
  net_profit: number;
  net_margin: number;
  sales_target: number | null;
  variance: number | null; // sales - sales_target
  achievement_pct: number | null;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: {
    code: string;
    message: string;
    isAuthError?: boolean;
    httpStatus?: number;
  };
}
