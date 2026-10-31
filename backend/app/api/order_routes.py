import html
import json
import re
import threading
import time
import urllib.parse
import urllib.request
from fastapi import APIRouter, HTTPException, Query, Request, Response
from ..config import settings, get_thai_time_str
from ..models.schemas import CreateOrderRequest
from ..services.auth_service import check_rate_limit, is_floor_7, make_order_token, sanitize_text
from ..services.loyverse_service import fetch_front_store_menu, get_variant_lookup, push_order_to_loyverse
from ..services.notification_service import send_notifications
from ..services.slip_service import verify_and_inspect_slip
from ..storage.repository import repository

router = APIRouter()

ALLOWED_SLIP_PREFIX = re.compile(r"^data:image/(jpeg|jpg|png|webp);base64,[A-Za-z0-9+/=\s]+$")
PAYMENT_LABELS = {
    "qr": "สแกน QR ถุงเงิน (ล็อกยอด)",
    "thai_chuay_thai": "ไทยช่วยไทย (หน้าร้าน)",
    "cash": "เงินสดหน้าร้าน",
}

@router.get("/customer-orders")
def get_customer_orders(
    line_user_id: str = Query(""),
    phone: str = Query(""),
    order_code: str = Query(""),
    customer_name: str = Query(""),
    response: Response = None
):
    if response:
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
        response.headers["Pragma"] = "no-cache"
    line_uid = sanitize_text(line_user_id if isinstance(line_user_id, str) else "", 80).strip()
    phone_str = phone if isinstance(phone, str) else ""
    raw_phone = re.sub(r"[^0-9]", "", phone_str)[:15]
    code = sanitize_text(order_code if isinstance(order_code, str) else "", 20).strip()
    cust_name = sanitize_text(customer_name if isinstance(customer_name, str) else "", 80).strip()
    if not line_uid and len(raw_phone) < 9 and not code and not cust_name:
        return {"ok": True, "orders": []}

    state = repository.get_state()
    proofs = state.get("delivery_proofs", {}) or {}
    matched = []
    seen_codes = set()

    for o in state.get("orders", []):
        o_line = (o.get("line_user_id") or "").strip()
        o_phone = re.sub(r"[^0-9]", "", o.get("phone") or "")
        o_code = (o.get("order_code") or "").strip()
        o_name = (o.get("customer_name") or "").strip()

        is_match = False
        if line_uid and o_line == line_uid:
            is_match = True
        elif len(raw_phone) >= 9 and o_phone == raw_phone:
            is_match = True
        elif code and o_code.upper() == code.upper():
            is_match = True
        elif cust_name and o_name == cust_name and not line_uid and len(raw_phone) < 9:
            is_match = True

        if is_match and o_code not in seen_codes:
            seen_codes.add(o_code)
            matched.append({
                "order_code": o.get("order_code"),
                "customer_name": o.get("customer_name"),
                "created_at": o.get("created_at"),
                "status": o.get("status"),
                "status_label": o.get("status_label"),
                "total_money": float(o.get("total_money", 0)),
                "payment_label": o.get("payment_label") or ("เงินสดหน้าร้าน" if o.get("payment_method") == "cash" else "สแกน QR พร้อมเพย์"),
                "payment_method": o.get("payment_method"),
                "order_type": o.get("order_type"),
                "items": o.get("items", []),
                "loyverse_receipt_number": o.get("loyverse_receipt_number"),
                **_proof_fields(o.get("order_code"), o.get("status_label"), proofs),
            })

    # Direct query fallback to Supabase if nothing found or to ensure complete history across devices
    if settings.SUPABASE_URL and settings.SUPABASE_KEY and (line_uid or len(raw_phone) >= 9 or code):
        try:
            filters = []
            if line_uid:
                filters.append(f"line_user_id.eq.{urllib.parse.quote(line_uid)}")
            if len(raw_phone) >= 9:
                filters.append(f"phone.eq.{urllib.parse.quote(raw_phone)}")
            if code:
                filters.append(f"order_code.eq.{urllib.parse.quote(code)}")
            if filters:
                filter_str = urllib.parse.quote(f"({','.join(filters)})")
                url = f"{settings.SUPABASE_URL}/rest/v1/orders?or={filter_str}&select=*&order=created_at.desc&limit=50"
                req = urllib.request.Request(url, headers={
                    "apikey": settings.SUPABASE_KEY,
                    "Authorization": f"Bearer {settings.SUPABASE_KEY}"
                })
                with urllib.request.urlopen(req, timeout=5) as resp:
                    db_orders = json.load(resp)
                    for o in db_orders:
                        o_code = o.get("order_code")
                        if o_code and o_code not in seen_codes:
                            seen_codes.add(o_code)
                            matched.append({
                                "order_code": o.get("order_code"),
                                "customer_name": o.get("customer_name"),
                                "created_at": o.get("created_at"),
                                "status": o.get("status"),
                                "status_label": o.get("status_label"),
                                "total_money": float(o.get("total_money", 0)),
                                "payment_label": o.get("payment_label") or ("เงินสดหน้าร้าน" if o.get("payment_method") == "cash" else "สแกน QR พร้อมเพย์"),
                                "payment_method": o.get("payment_method"),
                                "order_type": o.get("order_type"),
                                "items": o.get("items", []),
                                "loyverse_receipt_number": o.get("loyverse_receipt_number"),
                                **_proof_fields(o.get("order_code"), o.get("status_label"), proofs),
                            })
        except Exception as e:
            print(f"Direct Supabase customer orders query error: {e}")

    return {"ok": True, "orders": matched}

def _proof_fields(order_code, status_label, proofs) -> dict:
    """Expose delivery-proof photo URL to the customer once the shop has uploaded one."""
    if not order_code:
        return {}
    p = proofs.get(order_code)
    if not p and "ส่งอาหารแล้ว" not in (status_label or ""):
        return {}
    v = (p or {}).get("v", 0)
    return {
        "has_delivery_proof": True,
        "delivery_proof_url": f"/api/order-proof/{order_code}?token={make_order_token(order_code)}&v={v}",
        "delivery_proof_at": (p or {}).get("uploaded_at"),
    }

@router.get("/order-proof/{order_code}")
def get_order_proof(order_code: str, token: str = Query(""), v: str = Query("")):
    import base64
    code = re.sub(r"[^A-Za-z0-9]", "", order_code)[:20]
    if not code or token != make_order_token(code):
        raise HTTPException(status_code=403, detail="ไม่มีสิทธิ์ดูรูปนี้")
    blob = repository.get_blob(f"proof:{code}")
    img = (blob or {}).get("image") or ""
    if not img.startswith("data:image/"):
        raise HTTPException(status_code=404, detail="ยังไม่มีรูปหลักฐานการส่ง")
    header, b64 = img.split(",", 1)
    mime = header[5:].split(";")[0]
    return Response(
        content=base64.b64decode(b64),
        media_type=mime,
        headers={"Cache-Control": "private, max-age=86400" if v else "no-cache"},
    )

@router.get("/order-status")
def get_order_status(code: str = Query(""), token: str = Query(""), response: Response = None):
    if response:
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
        response.headers["Pragma"] = "no-cache"

    if not code or not token:
        raise HTTPException(status_code=400, detail="Missing code or token")
    expected = make_order_token(code)
    if token != expected:
        raise HTTPException(status_code=403, detail="ไม่มีสิทธิ์เข้าถึงออเดอร์นี้")

    state = repository.get_state()
    for o in state.get("orders", []):
        if o.get("order_code") == code:
            safe_order = {
                "order_code": o["order_code"],
                "status": o["status"],
                "status_label": o["status_label"],
                "total_money": o["total_money"],
                "loyverse_receipt_number": o.get("loyverse_receipt_number"),
                **_proof_fields(o["order_code"], o.get("status_label"), state.get("delivery_proofs", {}) or {}),
            }
            return {"ok": True, "order": safe_order}
    raise HTTPException(status_code=404, detail="ไม่พบออเดอร์")

@router.post("/order")
@router.post("/orders")
async def create_order(req: CreateOrderRequest, request: Request):
    client_ip = request.client.host if request.client else "127.0.0.1"
    if not check_rate_limit("order", client_ip, max_events=8, window_sec=60):
        raise HTTPException(status_code=429, detail="คุณส่งคำขอถี่เกินไป กรุณารอสักครู่ครับ")

    state = repository.get_state()
    store_settings = state["settings"]
    if not store_settings.get("is_open", True):
        closed_msg = store_settings.get("closed_message") or "ขณะนี้ร้านปิดรับออเดอร์ชั่วคราวครับ"
        raise HTTPException(status_code=403, detail=f"{closed_msg} (ไม่สามารถส่งออเดอร์ได้ในขณะนี้ครับ)")

    fetch_front_store_menu(force=False)
    variant_lookup = get_variant_lookup()

    customer_name = sanitize_text(req.customer_name or "", 60)
    order_type = sanitize_text(req.dining_type or req.order_type or "สั่งกลับบ้าน", 50)
    floor = sanitize_text(req.condo_floor or req.floor or "", 20)
    room = sanitize_text(req.condo_room or req.room or "", 30)
    raw_phone = req.customer_phone or req.phone or ""
    phone = re.sub(r"[^0-9+\-\s]", "", str(raw_phone)).strip()[:20]
    phone_digits = re.sub(r"[^0-9]", "", phone)[:15]
    line_user_id = sanitize_text(req.line_user_id or "", 80)
    line_display_name = sanitize_text(req.line_display_name or "", 60)
    line_picture_url = str(req.line_picture_url or "").strip()[:300]
    note = sanitize_text(req.order_note or req.note or "", 150)
    raw_pay = str(req.payment_method or "qr").strip()
    payment_key = raw_pay if raw_pay in ("qr", "thai_chuay_thai", "cash") else "qr"
    slip_image = str(req.slip_image_base64 or req.slip_image or "").strip()

    if not customer_name:
        raise HTTPException(status_code=400, detail="กรุณาระบุชื่อลูกค้า")
    if "หน้าห้อง" in html.unescape(order_type):
        if not floor or not room:
            raise HTTPException(status_code=400, detail="กรุณาระบุทั้ง 'ชั้น' และ 'เลขห้อง' สำหรับจัดส่งถึงหน้าห้องครับ")
    if "บันได" in html.unescape(order_type) and not floor:
        raise HTTPException(status_code=400, detail="กรุณาระบุ 'ชั้น' ที่จะให้ไปส่งที่บันไดหนีไฟครับ")

    if not req.items or len(req.items) < 1 or len(req.items) > 30:
        raise HTTPException(status_code=400, detail="รายการอาหารในตะกร้าไม่ถูกต้อง")

    if payment_key == "qr":
        if not slip_image or not ALLOWED_SLIP_PREFIX.match(slip_image):
            raise HTTPException(status_code=400, detail="กรุณาแนบรูปสลิปการโอนเงิน/ชำระเงินใหม่ทุกครั้ง (JPG/PNG/WEBP)")
    else:
        slip_image = ""

    # Server-side price validation
    validated_items = []
    calculated_total = 0.0

    for it in req.items:
        # Find variant_id
        vid = str(it.variant_id or "")
        if not vid and it.item_id:
            # Look up variant_id by item_id
            for k, val in variant_lookup.items():
                if val["id"] == it.item_id:
                    vid = k
                    break

        if not vid or vid not in variant_lookup:
            raise HTTPException(status_code=400, detail="พบรายการอาหารที่ไม่อยู่ในเมนูหน้าร้าน หรือไม่สามารถสั่งได้")

        auth_item = variant_lookup[vid]
        qty = int(it.quantity)
        if not (1 <= qty <= 20):
            raise HTTPException(status_code=400, detail="จำนวนต่อรายการต้องอยู่ระหว่าง 1 ถึง 20")

        item_name_clean = auth_item["name"].replace("(หน้าร้าน)", "").replace("(ข้าวไข่ข้น 49 บาท)", "").replace("(ข้าวไข่ข้น)", "").strip()
        st_info = state.get("item_stock", {}).get(vid, {})
        if st_info.get("is_hidden"):
            raise HTTPException(status_code=400, detail=f"ขออภัย เมนู '{item_name_clean}' ปิดให้บริการชั่วคราวครับ")
        if not st_info.get("is_available", True):
            raise HTTPException(status_code=400, detail=f"ขออภัย เมนู '{item_name_clean}' หมดชั่วคราวแล้วครับ")
        s_count = st_info.get("stock_count")
        if s_count is not None and s_count < qty:
            raise HTTPException(status_code=400, detail=f"ขออภัย เมนู '{item_name_clean}' เหลือเพียง {s_count} กล่อง ไม่พอสำหรับออเดอร์นี้ครับ")

        # Modifier validation
        validated_mods = []
        seen_opt_ids = set()
        for rm in it.modifiers:
            oid = str(rm.option_id) if rm.option_id else None
            # If option_id not provided, try to match by name (prefer unselected option IDs)
            if not oid or oid not in auth_item["allowed_options"]:
                oid = None
                for a_id, a_opt in auth_item["allowed_options"].items():
                    if a_opt["name"] == rm.name and a_id not in seen_opt_ids:
                        oid = a_id
                        break
            if oid and oid in auth_item["allowed_options"] and oid not in seen_opt_ids:
                seen_opt_ids.add(oid)
                opt_info = auth_item["allowed_options"][oid]
                if not opt_info.get("is_available", True):
                    raise HTTPException(status_code=400, detail=f"ตัวเลือก '{opt_info['name']}' ในเมนู '{item_name_clean}' ปิดจำหน่ายชั่วคราวครับ")
                validated_mods.append(opt_info)

        # Validate modifier group constraints (required / max selection)
        item_grps = auth_item.get("modifier_groups", [])
        for grp in item_grps:
            gid = grp.get("id")
            selected_for_grp = [m for m in validated_mods if m.get("group_id") == gid]
            min_req = grp.get("min_selection", 1 if grp.get("is_required") else 0)
            max_limit = grp.get("max_selection", 0)

            # Auto-fill default 0-THB option if a required group was omitted (e.g. legacy Reorder / cached cart)
            if len(selected_for_grp) < min_req:
                for opt in grp.get("options", []):
                    oid_cand = opt.get("id")
                    if (
                        oid_cand
                        and oid_cand in auth_item["allowed_options"]
                        and oid_cand not in seen_opt_ids
                        and opt.get("is_available", True)
                        and float(opt.get("price", 0.0)) == 0.0
                    ):
                        seen_opt_ids.add(oid_cand)
                        opt_info = auth_item["allowed_options"][oid_cand]
                        validated_mods.append(opt_info)
                        selected_for_grp.append(opt_info)
                        if len(selected_for_grp) >= min_req:
                            break

            if len(selected_for_grp) < min_req:
                raise HTTPException(
                    status_code=400,
                    detail=f"กรุณาเลือกตัวเลือกในกลุ่ม '{grp['name']}' อย่างน้อย {min_req} รายการ (เมนู {item_name_clean})"
                )
            if max_limit > 0 and len(selected_for_grp) > max_limit:
                raise HTTPException(
                    status_code=400,
                    detail=f"กลุ่ม '{grp['name']}' สามารถเลือกได้สูงสุด {max_limit} รายการ (เมนู {item_name_clean})"
                )

        base_price = float(auth_item["price"])
        mod_sum = sum(m["price"] for m in validated_mods)
        calculated_total += (base_price + mod_sum) * qty

        validated_items.append({
            "item_id": auth_item["id"],
            "variant_id": vid,
            "sku": auth_item["sku"],
            "category_id": auth_item.get("category_id", ""),
            "name": sanitize_text(auth_item["name"], 80),
            "price": base_price,
            "quantity": qty,
            "modifiers": validated_mods,
            "item_note": sanitize_text(it.item_note or it.note or "", 100),
        })

    raw_order_type = html.unescape(order_type)
    delivery_fee = 0.0
    if "หน้าห้อง" in raw_order_type or "+5" in raw_order_type:
        if is_floor_7(floor):
            delivery_fee = 0.0
        else:
            delivery_fee = settings.CONDO_DELIVERY_FEE
    calculated_total = round(calculated_total + delivery_fee, 2)

    # Persist customer profile lookup for rewards & address memory
    existing_prof = {}
    if line_user_id and f"line:{line_user_id}" in state.get("customers", {}):
        existing_prof = dict(state["customers"][f"line:{line_user_id}"])
    elif len(phone_digits) >= 9 and f"phone:{phone_digits}" in state.get("customers", {}):
        existing_prof = dict(state["customers"][f"phone:{phone_digits}"])

    # Reward discount check (10 THB discount for 10 stamps completed)
    discount_amount = 0.0
    used_reward = False
    if req.use_reward_discount:
        avail_rewards = existing_prof.get("available_rewards", 0)
        if avail_rewards > 0:
            discount_amount = min(10.0, calculated_total)
            used_reward = True
            calculated_total = max(0.0, round(calculated_total - discount_amount, 2))

    # 3-Layer Slip Verification
    slip_sha256 = ""
    slip_qr_ref = ""
    slip_verification = None
    if payment_key == "qr":
        v_res = verify_and_inspect_slip(slip_image, calculated_total, state["orders"])
        if not v_res.get("ok"):
            raise HTTPException(status_code=400, detail=v_res.get("error", "สลิปไม่ถูกต้อง"))
        slip_sha256 = v_res.get("slip_sha256", "")
        slip_qr_ref = v_res.get("slip_qr_ref", "")
        slip_verification = v_res.get("verification")

    # Next order number = highest existing number + 1 (robust even when only the latest 100 orders are loaded)
    max_num = 100 + len(state["orders"])
    for _o in state["orders"]:
        _m = re.match(r"^A(\d+)$", str(_o.get("order_code") or ""))
        if _m:
            max_num = max(max_num, int(_m.group(1)))
    max_num = max(max_num, int(state.get("settings", {}).get("last_order_num") or 0))
    next_num = max_num + 1
    state["settings"]["last_order_num"] = next_num
    order_code = f"A{next_num}"
    order_token = make_order_token(order_code)

    # Calculate Stamps: Strictly Main Dishes ONLY (จานเดียว / มาม่าเกาหลี / กับข้าว)
    # Add-ons, side eggs (ไข่ดองเกาหลี, ไข่ดาว, etc.), sauces, sides, snacks, and drinks earn 0 stamps.
    MAIN_DISH_CATEGORY_IDS = {
        "185532de-9c97-4518-ac39-5d64bac79ec8",  # จานเดียว
        "112abfdf-80e9-4e88-9fe1-e2fa6d5cfcf9",  # มาม่าเกาหลี
        "cf16bc5c-0e0f-4b2b-bb51-3c8fc8feb634",  # กับข้าว
    }
    ADDON_SKIP_KEYWORDS = (
        "ส่งถึงหน้าห้อง", "condo delivery",
        "น้ําเปล่า", "น้ำเปล่า", "โค้ก", "coke", "pepsi", "เป๊ปซี่", "สไปรท์", "sprite", "เครื่องดื่ม",
        "ไข่ดอง", "ไข่ดาว", "ไข่เจียว 1 ฟอง", "ไข่ข้น 1 ฟอง", "ไข่เจียวทรงเครื่อง",
        "แตงกวา", "สลัด", "ดิป", "มายองเนส", "2 oz",
        "สาหร่าย", "ซุปสาหร่าย", "ข้าวสวย", "ข้าวเปล่า", "หมี่หยกน้ำมันงา", "หมี่หยกน้ํามันงา",
        "คอร์นดอก", "ขนมใบไม้", "ชีสสติ๊ก",
    )

    earned_stamps = 0
    total_boxes = 0
    for it in validated_items:
        it_name = (it.get("name") or "").strip()
        it_name_low = it_name.lower()
        it_qty = int(it.get("quantity") or 1)
        it_price = float(it.get("price") or 0)
        it_cat = str(it.get("category_id") or "").strip()

        # 1. Category check: strictly allow only Main Dish categories (จานเดียว / มาม่าเกาหลี / กับข้าว)
        is_main_cat = (it_cat in MAIN_DISH_CATEGORY_IDS) if it_cat else (
            not any(k in it_name_low for k in ADDON_SKIP_KEYWORDS) and it_price >= 40
        )
        if not is_main_cat or it_price < 40:
            continue

        # Combo / เซ็ตคู่: 2 stamps per box
        if any(k in it_name for k in ["เซ็ตคู่", "ชุดคู่", "เซตคู่", "คู่", "รวมมิตร", "ไก่ต้มน้ําปลา+สามชั้น", "ไก่+สามชั้น"]):
            earned_stamps += 2 * it_qty
            total_boxes += it_qty
        else:
            # Single main dish box (เซ็ตเดี่ยว / จานหลัก): 1 stamp per box
            earned_stamps += 1 * it_qty
            total_boxes += it_qty

    current_avail_rewards = existing_prof.get("available_rewards", 0)
    current_redeemed = existing_prof.get("rewards_redeemed", 0)
    if used_reward:
        current_avail_rewards = max(0, current_avail_rewards - 1)
        current_redeemed += 1

    total_rewards_earned = existing_prof.get("total_rewards_earned", 0)
    new_stamp_sum = existing_prof.get("stamps", 0) + earned_stamps
    new_coupons_earned = new_stamp_sum // 10
    remaining_stamps = new_stamp_sum % 10

    current_avail_rewards += new_coupons_earned
    total_rewards_earned += new_coupons_earned

    stamp_logs = list(existing_prof.get("stamp_logs", []))
    if used_reward:
        stamp_logs.insert(0, {
            "created_at": get_thai_time_str(),
            "action": "use_reward",
            "note": f"ใช้ส่วนลดสะสมแต้ม 10 บาท ในออเดอร์ #{order_code}",
            "delta_stamps": 0,
            "delta_rewards": -1,
        })
    if earned_stamps > 0:
        box_desc = f"{total_boxes} กล่อง" if total_boxes > 0 else f"{earned_stamps} แสตมป์"
        if new_coupons_earned > 0:
            stamp_note = f"สั่งซื้อออเดอร์ #{order_code} (+{earned_stamps} แสตมป์ จาก {box_desc}) 🎉 สะสมครบ 10 กล่อง ได้รับส่วนลด 10 บาท (+{new_coupons_earned} คูปอง)!"
        else:
            stamp_note = f"สั่งซื้อออเดอร์ #{order_code} (+{earned_stamps} แสตมป์ จาก {box_desc})"
        stamp_logs.insert(0, {
            "created_at": get_thai_time_str(),
            "action": "order",
            "note": stamp_note,
            "delta_stamps": earned_stamps,
            "delta_rewards": new_coupons_earned,
        })
    stamp_logs = stamp_logs[:50]

    cust_record = {
        "customer_name": html.unescape(customer_name),
        "phone": phone or existing_prof.get("phone", ""),
        "floor": html.unescape(floor) if floor else existing_prof.get("floor", ""),
        "room": html.unescape(room) if room else existing_prof.get("room", ""),
        "order_type": html.unescape(order_type),
        "payment_method": payment_key,
        "line_user_id": line_user_id or existing_prof.get("line_user_id", ""),
        "line_display_name": html.unescape(line_display_name) or existing_prof.get("line_display_name", ""),
        "picture_url": line_picture_url or existing_prof.get("picture_url", ""),
        "total_orders": existing_prof.get("total_orders", 0) + 1,
        "total_spent": round(existing_prof.get("total_spent", 0.0) + calculated_total, 2),
        "stamps": remaining_stamps,
        "available_rewards": current_avail_rewards,
        "rewards_redeemed": current_redeemed,
        "total_rewards_earned": total_rewards_earned,
        "stamp_logs": stamp_logs,
        "last_order_at": get_thai_time_str(),
        "updated_at": get_thai_time_str(),
    }
    state.setdefault("customers", {})
    if line_user_id:
        state["customers"][f"line:{line_user_id}"] = cust_record
    if len(phone_digits) >= 9:
        state["customers"][f"phone:{phone_digits}"] = cust_record
    order_token = make_order_token(order_code)

    order_obj = {
        "order_code": order_code,
        "created_at": get_thai_time_str(),
        "customer_name": customer_name,
        "floor": floor,
        "room": room,
        "line_user_id": line_user_id,
        "line_display_name": line_display_name,
        "line_picture_url": line_picture_url or existing_prof.get("picture_url", ""),
        "order_type": order_type,
        "delivery_fee": delivery_fee,
        "discount_amount": discount_amount,
        "reward_used": used_reward,
        "earned_stamps": earned_stamps,
        "phone": phone,
        "note": note,
        "payment_method": payment_key,
        "payment_label": PAYMENT_LABELS.get(payment_key, "สแกน QR ถุงเงิน (ล็อกยอด)"),
        "total_money": calculated_total,
        "slip_image": slip_image,
        "slip_sha256": slip_sha256,
        "slip_qr_ref": slip_qr_ref,
        "slip_verification": slip_verification,
        "items": validated_items,
        "status": "PENDING_SLIP",
        "status_label": (
            "⏳ รอร้านตรวจสอบสลิปโอนเงิน"
            if payment_key == "qr"
            else "⏳ รอร้านยืนยันออเดอร์ (ชำระหน้าร้าน)"
        ),
        "loyverse_receipt_number": None,
    }

    if not store_settings.get("require_slip_check_before_pos", True):
        rec, _ = push_order_to_loyverse(order_obj)
        order_obj["loyverse_receipt_number"] = rec.get("receipt_number")
        order_obj["status"] = "COOKING"
        order_obj["status_label"] = "🍳 รับออเดอร์แล้ว • กำลังปรุงอาหาร"

    state["orders"].insert(0, order_obj)

    # Decrement stock count
    for vi in validated_items:
        v_id = vi["variant_id"]
        if v_id in state.get("item_stock", {}):
            s_info = state["item_stock"][v_id]
            if s_info.get("stock_count") is not None:
                s_info["stock_count"] = max(0, int(s_info["stock_count"]) - int(vi["quantity"]))
                if s_info["stock_count"] == 0:
                    s_info["is_available"] = False

    repository.save_state(state, sync_supabase_now=True)
    send_notifications(store_settings, order_obj)

    if settings.SUPABASE_URL and settings.SUPABASE_KEY:
        if settings.IS_VERCEL:
            repository.push_supabase_order(order_obj)
            if cust_record:
                c_id = f"line:{line_user_id}" if line_user_id else f"phone:{phone_digits}"
                repository.push_supabase_customer(c_id, cust_record)
        else:
            threading.Thread(target=repository.push_supabase_order, args=(order_obj,), daemon=True).start()
            if cust_record:
                c_id = f"line:{line_user_id}" if line_user_id else f"phone:{phone_digits}"
                threading.Thread(target=repository.push_supabase_customer, args=(c_id, cust_record), daemon=True).start()

    return {
        "ok": True,
        "order_code": order_obj["order_code"],
        "order_token": order_token,
        "order": {
            "order_code": order_obj["order_code"],
            "status": order_obj["status"],
            "status_label": order_obj["status_label"],
            "total_money": order_obj["total_money"],
            "delivery_fee": order_obj["delivery_fee"],
            "loyverse_receipt_number": order_obj.get("loyverse_receipt_number"),
        }
    }
