from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

class ModifierOptionSchema(BaseModel):
    id: str
    name: str
    price: float = 0.0
    position: int = 0
    is_available: bool = True
    custom_price: Optional[float] = None

class ModifierGroupSchema(BaseModel):
    id: str
    name: str
    custom_name: Optional[str] = None
    min_selection: int = 0
    max_selection: int = 0
    is_required: bool = False
    options: List[ModifierOptionSchema] = []

class MenuItemSchema(BaseModel):
    id: str
    variant_id: str
    sku: Optional[str] = ""
    name: str
    category_id: Optional[str] = ""
    price: float = 0.0
    image_url: Optional[str] = ""
    is_available: bool = True
    is_hidden: bool = False
    is_recommended: bool = False
    badge: Optional[str] = None
    modifier_ids: List[str] = []
    modifiers: List[ModifierGroupSchema] = []
    stock_count: Optional[int] = None
    loyverse_in_stock: Optional[float] = None
    category_name: Optional[str] = "ทั่วไป"

class MenuCategorySchema(BaseModel):
    id: str
    name: str
    color: Optional[str] = "#C89D66"

class StoreSettingsSchema(BaseModel):
    is_open: bool = True
    store_name: str = "แมวอ้วน & ข้าวไข่ข้น (เมนูหน้าร้าน)"
    closed_message: str = "ขณะนี้ร้านปิดรับออเดอร์ชั่วคราว เปิดให้บริการอีกครั้งเวลา 10:00 น. ครับ 🙏"
    announcement: str = "🔥 สั่งเมนูหน้าร้านโดยตรง ราคาหน้าร้านสุดคุ้ม! สแกน QR ยอดตรงเป๊ะ แนบสลิปแล้วครัวเริ่มผัดทันที"
    promptpay_id: str = ""
    promptpay_name: str = "ร้านแมวอ้วน"
    require_slip_check_before_pos: bool = True
    line_liff_id: str = ""
    line_channel_token: Optional[str] = ""
    line_target_id: Optional[str] = ""
    customer_line_channel_token: Optional[str] = ""
    telegram_bot_token: Optional[str] = ""
    telegram_chat_id: Optional[str] = ""
    has_line_token: Optional[bool] = False
    has_customer_line_token: Optional[bool] = False
    has_tg_token: Optional[bool] = False
    notify_customer_cooking: Optional[bool] = True
    notify_customer_delivery: Optional[bool] = True

class CartModifierSchema(BaseModel):
    option_id: Optional[str] = None
    name: str
    price: float = 0.0

class CartItemSchema(BaseModel):
    item_id: Optional[str] = None
    variant_id: Optional[str] = None
    name: str
    price: float
    quantity: int = Field(default=1, ge=1, le=20)
    modifiers: List[CartModifierSchema] = []
    note: Optional[str] = ""
    item_note: Optional[str] = ""

class CreateOrderRequest(BaseModel):
    customer_name: str
    customer_phone: Optional[str] = ""
    phone: Optional[str] = ""
    dining_type: Optional[str] = "สั่งกลับบ้าน"
    order_type: Optional[str] = "สั่งกลับบ้าน"
    condo_floor: Optional[str] = ""
    floor: Optional[str] = ""
    condo_room: Optional[str] = ""
    room: Optional[str] = ""
    order_note: Optional[str] = ""
    note: Optional[str] = ""
    payment_method: str = "qr"
    total_money: Optional[float] = 0.0
    items: List[CartItemSchema]
    slip_image_base64: Optional[str] = None
    slip_image: Optional[str] = None
    line_user_id: Optional[str] = ""
    line_display_name: Optional[str] = ""
    line_picture_url: Optional[str] = ""
    use_reward_discount: Optional[bool] = False

class CustomerProfileSchema(BaseModel):
    line_user_id: Optional[str] = ""
    customer_name: str = ""
    line_display_name: Optional[str] = ""
    picture_url: Optional[str] = ""
    status_message: Optional[str] = ""
    phone: Optional[str] = ""
    floor: Optional[str] = ""
    room: Optional[str] = ""
    order_type: Optional[str] = "สั่งกลับบ้าน"
    payment_method: Optional[str] = "qr"
    total_orders: int = 0
    total_spent: float = 0.0
    stamps: int = 0
    available_rewards: int = 0
    rewards_redeemed: int = 0
    total_rewards_earned: int = 0
    stamp_logs: List[Dict[str, Any]] = []
    last_order_at: Optional[str] = ""
    updated_at: Optional[str] = ""

class AdminLoginRequest(BaseModel):
    password: str

class AdminSettingsUpdateRequest(BaseModel):
    is_open: Optional[bool] = None
    closed_message: Optional[str] = None
    announcement: Optional[str] = None
    promptpay_id: Optional[str] = None
    promptpay_name: Optional[str] = None
    require_slip_check_before_pos: Optional[bool] = None
    line_liff_id: Optional[str] = None
    line_channel_token: Optional[str] = None
    line_target_id: Optional[str] = None
    customer_line_channel_token: Optional[str] = None
    telegram_bot_token: Optional[str] = None
    telegram_chat_id: Optional[str] = None
    line_extra_targets: Optional[List[Dict[str, Any]]] = None
    notify_customer_cooking: Optional[bool] = None
    notify_customer_delivery: Optional[bool] = None

class AdminOrderActionRequest(BaseModel):
    order_code: str
    action: str  # approve_and_push_pos, mark_done, cancel

class MenuStockUpdateRequest(BaseModel):
    variant_id: str
    is_available: Optional[bool] = None
    is_hidden: Optional[bool] = None
    stock_count: Optional[Any] = None

class MenuReorderRequest(BaseModel):
    category_order: Optional[List[str]] = None
    category_config: Optional[Dict[str, Any]] = None
    item_order: Optional[List[str]] = None
    item_config: Optional[Dict[str, Any]] = None
    showcase_dishes: Optional[List[Dict[str, Any]]] = None

class AdminCustomerStampRequest(BaseModel):
    customer_id: str
    action: str  # add, deduct, set, add_reward, use_reward
    amount: Optional[int] = 1
    note: Optional[str] = ""

class AdminModifierUpdateRequest(BaseModel):
    modifier_id: str
    custom_name: Optional[str] = None
    is_required: bool = False
    min_selection: int = 0
    max_selection: int = 0
    disabled_options: List[str] = []
    custom_prices: Dict[str, float] = {}
