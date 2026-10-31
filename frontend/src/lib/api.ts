import { MenuCategory, MenuItem, StoreSettings } from '../types/menu';
import { CreateOrderPayload } from '../types/order';

export interface MenuApiResponse {
  ok: boolean;
  settings: StoreSettings;
  categories: MenuCategory[];
  items?: MenuItem[];
  updated_at?: string;
  showcase_dishes?: any[];
}

export async function fetchMenu(): Promise<MenuApiResponse> {
  const res = await fetch(`/api/menu?_t=${Date.now()}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Failed to fetch menu: ${res.status}`);
  return res.json();
}

export async function createOrder(payload: CreateOrderPayload) {
  const res = await fetch('/api/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.json();
}

export async function fetchOrderTracking(orderCode: string) {
  const res = await fetch(`/api/orders/track?code=${encodeURIComponent(orderCode)}`);
  return res.json();
}
