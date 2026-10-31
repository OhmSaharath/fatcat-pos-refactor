import json
import os
import threading
import time
import urllib.parse
import urllib.request
from typing import Any, Dict, List, Optional
from ..config import settings

class StateRepository:
    def __init__(self):
        self._lock = threading.RLock()
        self._cache: Dict[str, Any] = {
            "data": None,
            "last_synced": 0.0
        }
        self.default_state = {
            "settings": {
                "is_open": True,
                "store_name": "แมวอ้วน & ข้าวไข่ข้น (เมนูหน้าร้าน)",
                "closed_message": "ขณะนี้ร้านปิดรับออเดอร์ชั่วคราว เปิดให้บริการอีกครั้งเวลา 10:00 น. ครับ 🙏",
                "announcement": "🔥 สั่งเมนูหน้าร้านโดยตรง ราคาหน้าร้านสุดคุ้ม! สแกน QR ยอดตรงเป๊ะ แนบสลิปแล้วครัวเริ่มผัดทันที",
                "promptpay_id": settings.PROMPTPAY_ID,
                "promptpay_name": settings.PROMPTPAY_NAME,
                "require_slip_check_before_pos": True,
                "line_liff_id": settings.LINE_LIFF_ID,
                "line_channel_token": settings.LINE_CHANNEL_TOKEN,
                "line_target_id": settings.LINE_TARGET_ID,
                "telegram_bot_token": settings.TELEGRAM_BOT_TOKEN,
                "telegram_chat_id": settings.TELEGRAM_CHAT_ID,
            },
            "customers": {},
            "item_stock": {},
            "category_order": [],
            "category_config": {},
            "item_order": [],
            "item_config": {},
            "orders": []
        }

    def fetch_supabase_state(self) -> Optional[Dict[str, Any]]:
        if not settings.SUPABASE_URL or not settings.SUPABASE_KEY:
            return None
        try:
            url = f"{settings.SUPABASE_URL}/rest/v1/store_state?id=eq.main&select=data"
            req = urllib.request.Request(url, headers={
                "apikey": settings.SUPABASE_KEY,
                "Authorization": f"Bearer {settings.SUPABASE_KEY}",
                "Accept": "application/json"
            })
            with urllib.request.urlopen(req, timeout=6) as resp:
                rows = json.load(resp)
                if rows and isinstance(rows, list) and len(rows) > 0:
                    return rows[0].get("data")
        except Exception as e:
            print(f"Supabase fetch_state error: {e}")
        return None

    def fetch_supabase_orders(self, limit: int = 25) -> Optional[List[Dict[str, Any]]]:
        if not settings.SUPABASE_URL or not settings.SUPABASE_KEY:
            return None
        try:
            cols = "order_code,customer_name,phone,order_type,floor,room,payment_method,total_money,status,status_label,loyverse_receipt_number,line_user_id,line_display_name,note,items,slip_sha256,slip_verification,created_at"
            url = f"{settings.SUPABASE_URL}/rest/v1/orders?select={cols}&order=created_at.desc&limit={limit}"
            req = urllib.request.Request(url, headers={
                "apikey": settings.SUPABASE_KEY,
                "Authorization": f"Bearer {settings.SUPABASE_KEY}",
                "Accept": "application/json"
            })
            with urllib.request.urlopen(req, timeout=6) as resp:
                rows = json.load(resp)
                if isinstance(rows, list):
                    for r in rows:
                        r["has_slip"] = bool(r.get("slip_sha256"))
                        r["slip_image"] = ""
                    return rows
        except Exception as e:
            print(f"Supabase fetch_supabase_orders error: {e}")
        return None

    def fetch_supabase_slip(self, order_code: str) -> Optional[str]:
        if not settings.SUPABASE_URL or not settings.SUPABASE_KEY:
            return None
        try:
            url = f"{settings.SUPABASE_URL}/rest/v1/orders?order_code=eq.{order_code}&select=slip_image"
            req = urllib.request.Request(url, headers={
                "apikey": settings.SUPABASE_KEY,
                "Authorization": f"Bearer {settings.SUPABASE_KEY}",
                "Accept": "application/json"
            })
            with urllib.request.urlopen(req, timeout=6) as resp:
                rows = json.load(resp)
                if rows and len(rows) > 0:
                    return rows[0].get("slip_image") or ""
        except Exception as e:
            print(f"Supabase fetch_supabase_slip error: {e}")
        return None

    def push_supabase_state(self, state: Dict[str, Any]):
        if not settings.SUPABASE_URL or not settings.SUPABASE_KEY:
            return
        try:
            url = f"{settings.SUPABASE_URL}/rest/v1/store_state"
            payload = json.dumps({"id": "main", "data": state}).encode("utf-8")
            req = urllib.request.Request(url, data=payload, headers={
                "apikey": settings.SUPABASE_KEY,
                "Authorization": f"Bearer {settings.SUPABASE_KEY}",
                "Content-Type": "application/json",
                "Prefer": "resolution=merge-duplicates"
            }, method="POST")
            with urllib.request.urlopen(req, timeout=8) as resp:
                pass
        except Exception as e:
            print(f"Supabase push_state error: {e}")

    def push_supabase_order(self, order_obj: Dict[str, Any]):
        if not settings.SUPABASE_URL or not settings.SUPABASE_KEY:
            return
        try:
            url = f"{settings.SUPABASE_URL}/rest/v1/orders"
            order_record = {
                "order_code": order_obj.get("order_code"),
                "customer_name": order_obj.get("customer_name"),
                "phone": order_obj.get("phone"),
                "order_type": order_obj.get("order_type"),
                "floor": order_obj.get("floor"),
                "room": order_obj.get("room"),
                "payment_method": order_obj.get("payment_method"),
                "total_money": order_obj.get("total_money"),
                "status": order_obj.get("status"),
                "status_label": order_obj.get("status_label"),
                "loyverse_receipt_number": order_obj.get("loyverse_receipt_number"),
                "line_user_id": order_obj.get("line_user_id"),
                "line_display_name": order_obj.get("line_display_name"),
                "note": order_obj.get("note"),
                "items": order_obj.get("items"),
            }
            # IMPORTANT: Only send slip columns when we actually have them.
            # Orders loaded for polling have slip_image stripped to "" for bandwidth; sending that
            # empty value on a status update would overwrite (wipe) the real slip stored in Supabase.
            if order_obj.get("slip_image"):
                order_record["slip_image"] = order_obj.get("slip_image")
            if order_obj.get("slip_sha256"):
                order_record["slip_sha256"] = order_obj.get("slip_sha256")
            if order_obj.get("slip_verification"):
                order_record["slip_verification"] = order_obj.get("slip_verification")
            payload = json.dumps(order_record).encode("utf-8")
            req = urllib.request.Request(url, data=payload, headers={
                "apikey": settings.SUPABASE_KEY,
                "Authorization": f"Bearer {settings.SUPABASE_KEY}",
                "Content-Type": "application/json",
                "Prefer": "resolution=merge-duplicates"
            }, method="POST")
            with urllib.request.urlopen(req, timeout=8) as resp:
                pass
            # Invalidate in-memory cache so subsequent reads pick up fresh order
            self.invalidate_cache()
        except Exception as e:
            print(f"Supabase push_order error: {e}")

    def push_supabase_customer(self, cust_id: str, cust_record: Dict[str, Any]):
        if not settings.SUPABASE_URL or not settings.SUPABASE_KEY:
            return
        try:
            url = f"{settings.SUPABASE_URL}/rest/v1/customers"
            rec = {
                "id": cust_id,
                "customer_name": cust_record.get("customer_name"),
                "phone": cust_record.get("phone"),
                "floor": cust_record.get("floor"),
                "room": cust_record.get("room"),
                "order_type": cust_record.get("order_type"),
                "payment_method": cust_record.get("payment_method"),
                "line_user_id": cust_record.get("line_user_id"),
                "line_display_name": cust_record.get("line_display_name"),
                "picture_url": cust_record.get("picture_url"),
                "total_orders": cust_record.get("total_orders", 0),
                "total_spent": cust_record.get("total_spent", 0),
                "last_order_at": cust_record.get("last_order_at"),
            }
            payload = json.dumps(rec).encode("utf-8")
            req = urllib.request.Request(url, data=payload, headers={
                "apikey": settings.SUPABASE_KEY,
                "Authorization": f"Bearer {settings.SUPABASE_KEY}",
                "Content-Type": "application/json",
                "Prefer": "resolution=merge-duplicates"
            }, method="POST")
            with urllib.request.urlopen(req, timeout=8) as resp:
                pass
        except Exception as e:
            print(f"Supabase push_customer error: {e}")

    # --- Blob storage (delivery proof photos etc.) ---
    # Stored as separate rows in the store_state table (id = "<key>") so the main state stays small.
    # Falls back to local files when Supabase is not configured.

    def _blob_local_path(self, key: str):
        safe = "".join(ch if ch.isalnum() or ch in "-_" else "_" for ch in key)
        d = settings.DATA_DIR / "blobs"
        d.mkdir(parents=True, exist_ok=True)
        return d / f"{safe}.json"

    def put_blob(self, key: str, data: Dict[str, Any]) -> bool:
        if settings.SUPABASE_URL and settings.SUPABASE_KEY:
            try:
                url = f"{settings.SUPABASE_URL}/rest/v1/store_state"
                payload = json.dumps({"id": key, "data": data}).encode("utf-8")
                req = urllib.request.Request(url, data=payload, headers={
                    "apikey": settings.SUPABASE_KEY,
                    "Authorization": f"Bearer {settings.SUPABASE_KEY}",
                    "Content-Type": "application/json",
                    "Prefer": "resolution=merge-duplicates"
                }, method="POST")
                with urllib.request.urlopen(req, timeout=12):
                    pass
                return True
            except Exception as e:
                print(f"Supabase put_blob error: {e}")
                return False
        try:
            with open(self._blob_local_path(key), "w", encoding="utf-8") as f:
                json.dump(data, f)
            return True
        except Exception as e:
            print(f"Local put_blob error: {e}")
            return False

    def get_blob(self, key: str) -> Optional[Dict[str, Any]]:
        if settings.SUPABASE_URL and settings.SUPABASE_KEY:
            try:
                url = f"{settings.SUPABASE_URL}/rest/v1/store_state?id=eq.{urllib.parse.quote(key)}&select=data"
                req = urllib.request.Request(url, headers={
                    "apikey": settings.SUPABASE_KEY,
                    "Authorization": f"Bearer {settings.SUPABASE_KEY}",
                    "Accept": "application/json"
                })
                with urllib.request.urlopen(req, timeout=8) as resp:
                    rows = json.load(resp)
                    if rows:
                        return rows[0].get("data")
            except Exception as e:
                print(f"Supabase get_blob error: {e}")
            return None
        p = self._blob_local_path(key)
        if p.exists():
            try:
                with open(p, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception:
                return None
        return None

    def invalidate_cache(self):
        with self._lock:
            self._cache["data"] = None
            self._cache["last_synced"] = 0.0

    def _clean_state_for_store_state(self, state: Dict[str, Any]) -> Dict[str, Any]:
        """Strip bulky Base64 slips from state copy to keep store_state small (<50KB) and fast."""
        state_copy = json.loads(json.dumps(state))
        if "orders" in state_copy and isinstance(state_copy["orders"], list):
            for o in state_copy["orders"]:
                o["has_slip"] = bool(o.get("slip_image") or o.get("slip_image_base64") or o.get("slip_sha256"))
                o["slip_image"] = ""
                o["slip_image_base64"] = ""
        return state_copy

    def get_state(self, force_refresh: bool = False) -> Dict[str, Any]:
        with self._lock:
            now = time.time()
            ttl = 15.0 if settings.IS_VERCEL else 30.0
            if not force_refresh and self._cache["data"] is not None and (now - self._cache["last_synced"] < ttl):
                return self._cache["data"]

            data = None
            if settings.SUPABASE_URL and settings.SUPABASE_KEY:
                data = self.fetch_supabase_state()
                db_orders = self.fetch_supabase_orders(limit=100)
                if data is not None and db_orders is not None:
                    data["orders"] = db_orders
                elif data is None and db_orders is not None:
                    data = json.loads(json.dumps(self.default_state))
                    data["orders"] = db_orders

            if not data and settings.STATE_FILE.exists():
                try:
                    with open(settings.STATE_FILE, "r", encoding="utf-8") as f:
                        data = json.load(f)
                except Exception as e:
                    print(f"Error loading local state: {e}")

            if not data:
                data = json.loads(json.dumps(self.default_state))

            # Migrate defaults
            for k, v in self.default_state["settings"].items():
                data.setdefault("settings", {}).setdefault(k, v)
            data.setdefault("customers", {})
            data.setdefault("item_stock", {})
            data.setdefault("category_order", [])
            data.setdefault("category_config", {})
            data.setdefault("item_order", [])
            data.setdefault("item_config", {})
            data.setdefault("orders", [])
            data.setdefault("delivery_proofs", {})

            self._cache["data"] = data
            self._cache["last_synced"] = now
            return data

    def save_state(self, state: Dict[str, Any], sync_supabase_now: bool = False):
        with self._lock:
            self._cache["data"] = state
            self._cache["last_synced"] = time.time()

            # Immediate local persistence
            try:
                temp_file = settings.STATE_FILE.with_suffix(".tmp")
                with open(temp_file, "w", encoding="utf-8") as f:
                    json.dump(state, f, ensure_ascii=False, indent=2)
                temp_file.replace(settings.STATE_FILE)
            except Exception as e:
                print(f"Local save_state error: {e}")

            # Supabase sync
            if settings.SUPABASE_URL and settings.SUPABASE_KEY:
                state_clean = self._clean_state_for_store_state(state)
                # On serverless (Vercel) or when requested, push synchronously so Lambda won't freeze before write completes
                if settings.IS_VERCEL or sync_supabase_now:
                    self.push_supabase_state(state_clean)
                else:
                    threading.Thread(target=self.push_supabase_state, args=(state_clean,), daemon=True).start()

repository = StateRepository()
