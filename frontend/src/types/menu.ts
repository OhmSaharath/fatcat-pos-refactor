export interface ModifierOption {
  id: string;
  name: string;
  price: number;
  custom_price?: number | null;
  effective_price?: number;
  is_available?: boolean;
  position?: number;
}

export interface ModifierGroup {
  id: string;
  name: string;
  custom_name?: string;
  min_selection: number;
  max_selection: number;
  is_required?: boolean;
  options: ModifierOption[];
  linked_items?: { id: string; name: string; price: number }[];
  items_count?: number;
}

export interface MenuItem {
  id: string;
  sku?: string;
  name: string;
  description?: string;
  price: number;
  image_url?: string;
  category_id: string;
  is_recommended?: boolean;
  is_available?: boolean;
  stock_count?: number | null;
  badge?: string;
  modifier_groups?: ModifierGroup[];
}

export interface MenuCategory {
  id: string;
  name: string;
  color?: string;
  is_recommended?: boolean;
  items: MenuItem[];
}

export interface StoreSettings {
  is_open: boolean;
  store_name: string;
  closed_message?: string;
  announcement?: string;
  kitchen_mode?: boolean;
  promptpay_id?: string;
  promptpay_name?: string;
  line_liff_id?: string;
}

export interface CartModifier {
  group_id: string;
  group_name: string;
  option_id: string;
  name: string;
  price: number;
}

export interface CartItem {
  id: string;
  item_id: string;
  name: string;
  base_price: number;
  unit_price: number;
  quantity: number;
  modifiers: CartModifier[];
  item_note?: string;
  image_url?: string;
}
