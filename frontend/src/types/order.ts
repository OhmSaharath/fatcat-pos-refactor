export type DiningType = 'รับอาหารข้างล่างชั้น 1' | 'เจอที่บันไดหนีไฟ (ฟรี)' | 'ส่งถึงหน้าห้อง / แขวนไว้หน้าห้อง (+5 บาท)';

export const DINING_OPTIONS: { value: DiningType; label: string; desc: string; icon: string }[] = [
  { value: 'รับอาหารข้างล่างชั้น 1', label: 'รับข้างล่างชั้น 1', desc: 'ฟรี', icon: '🏢' },
  { value: 'เจอที่บันไดหนีไฟ (ฟรี)', label: 'บันไดหนีไฟ', desc: 'ฟรี', icon: '🪜' },
  { value: 'ส่งถึงหน้าห้อง / แขวนไว้หน้าห้อง (+5 บาท)', label: 'แขวนหน้าห้อง', desc: '+5฿ • ชั้น 7 ฟรี', icon: '🚪' },
];
export type PaymentMethod = 'qr' | 'cash' | 'thai_chuay_thai';

export interface CustomerProfile {
  name: string;
  phone: string;
  floor?: string;
  room?: string;
  line_user_id?: string;
  line_display_name?: string;
  line_picture_url?: string;
}

export interface OrderItemPayload {
  item_id: string;
  name: string;
  quantity: number;
  price: number;
  modifiers?: { name: string; price: number }[];
  note?: string;
}

export interface CreateOrderPayload {
  dining_type: DiningType;
  payment_method: PaymentMethod;
  customer_name: string;
  customer_phone: string;
  condo_floor?: string;
  condo_room?: string;
  order_note?: string;
  items: OrderItemPayload[];
  total_money: number;
  slip_image_base64?: string;
}

export interface OrderRecord {
  order_code: string;
  created_at: string;
  total_money: number;
  status: 'pending' | 'cooking' | 'ready' | 'completed' | 'cancelled';
  items: { name: string; quantity: number }[];
  payment_method?: string;
  payment_label?: string;
}
