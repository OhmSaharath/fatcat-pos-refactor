import re
import time
from fastapi import APIRouter, HTTPException, Query, Request
from ..config import get_thai_time_str
from ..models.schemas import CustomerProfileSchema
from ..services.auth_service import sanitize_text
from ..storage.repository import repository

router = APIRouter()

def _ensure_reward_fields(record: dict) -> dict:
    total_orders = int(record.get("total_orders", 0))
    if "stamps" not in record:
        record["stamps"] = total_orders % 10
    if "available_rewards" not in record:
        record["available_rewards"] = total_orders // 10
    if "rewards_redeemed" not in record:
        record["rewards_redeemed"] = 0
    if "total_rewards_earned" not in record:
        record["total_rewards_earned"] = (record["stamps"] + total_orders) // 10 if total_orders else 0
    if "stamp_logs" not in record:
        record["stamp_logs"] = []
    return record

@router.get("/customer-profile")
def get_customer_profile(line_user_id: str = Query(""), phone: str = Query("")):
    line_uid = sanitize_text(line_user_id, 80)
    raw_phone = re.sub(r"[^0-9]", "", phone)[:15]
    state = repository.get_state()
    customers = state.get("customers", {})
    found = None
    if line_uid and f"line:{line_uid}" in customers:
        found = customers[f"line:{line_uid}"]
    elif len(raw_phone) >= 9 and f"phone:{raw_phone}" in customers:
        found = customers[f"phone:{raw_phone}"]

    if found:
        _ensure_reward_fields(found)
        return {"ok": True, "found": True, "profile": found}
    return {"ok": True, "found": False}

@router.post("/customer-login")
async def customer_login(request: Request):
    body = await request.json()
    line_uid = sanitize_text(body.get("line_user_id", ""), 80)
    if not line_uid:
        raise HTTPException(status_code=400, detail="Missing line_user_id")

    disp_name = sanitize_text(body.get("display_name", ""), 80)
    pic_url = str(body.get("picture_url", "")).strip()[:300]
    status_msg = sanitize_text(body.get("status_message", ""), 150)

    state = repository.get_state()
    cust_key = f"line:{line_uid}"
    existing = state.setdefault("customers", {}).get(cust_key, {})

    user_orders = [o for o in state.get("orders", []) if o.get("line_user_id") == line_uid]
    total_orders = len(user_orders)
    total_spent = round(sum(float(o.get("total_money", 0)) for o in user_orders), 2)

    # Initialize stamps & rewards intelligently if new or missing
    init_stamps = existing.get("stamps", total_orders % 10)
    init_avail_rewards = existing.get("available_rewards", total_orders // 10)
    init_redeemed = existing.get("rewards_redeemed", 0)
    init_total_rewards = existing.get("total_rewards_earned", total_orders // 10)
    init_logs = existing.get("stamp_logs", [])

    record = {
        "line_user_id": line_uid,
        "customer_name": disp_name or existing.get("customer_name", ""),
        "line_display_name": disp_name or existing.get("line_display_name", ""),
        "picture_url": pic_url or existing.get("picture_url", ""),
        "status_message": status_msg or existing.get("status_message", ""),
        "phone": existing.get("phone", ""),
        "floor": existing.get("floor", ""),
        "room": existing.get("room", ""),
        "order_type": existing.get("order_type", "สั่งกลับบ้าน"),
        "payment_method": existing.get("payment_method", "qr"),
        "total_orders": total_orders,
        "total_spent": total_spent,
        "stamps": int(init_stamps),
        "available_rewards": int(init_avail_rewards),
        "rewards_redeemed": int(init_redeemed),
        "total_rewards_earned": int(init_total_rewards),
        "stamp_logs": init_logs,
        "last_order_at": user_orders[0].get("created_at") if user_orders else existing.get("last_order_at", ""),
        "updated_at": get_thai_time_str(),
    }
    state["customers"][cust_key] = record
    repository.save_state(state)

    return {
        "ok": True,
        "profile": record,
        "orders_count": total_orders,
        "latest_order": user_orders[0] if user_orders else None
    }
