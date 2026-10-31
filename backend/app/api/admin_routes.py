import hmac
import re
import threading
import time
from typing import Optional
from pydantic import BaseModel
from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request, File, UploadFile, Form, Body
import json
import urllib.request
import urllib.error
from ..config import settings, get_thai_time_str
from ..services.image_service import save_custom_dish_image, delete_custom_dish_image
from ..models.schemas import (
    AdminLoginRequest,
    AdminOrderActionRequest,
    AdminSettingsUpdateRequest,
    MenuReorderRequest,
    MenuStockUpdateRequest,
    AdminCustomerStampRequest,
    AdminModifierUpdateRequest,
)
from ..services.auth_service import (
    check_rate_limit,
    create_admin_token,
    make_order_token,
    sanitize_text,
    verify_admin_token,
)
from ..services.notification_service import (
    send_delivery_proof_to_customer,
    send_order_status_to_customer,
    get_customer_line_token,
)
from ..services.loyverse_service import (
    fetch_front_store_menu,
    invalidate_menu_cache,
    loyverse_req,
    push_order_to_loyverse,
    sync_bestsellers,
    sync_loyverse_stock,
    get_admin_modifiers,
)
from ..storage.repository import repository

router = APIRouter(prefix="/admin")

def require_admin(authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Unauthorized")
    token = authorization.split("Bearer ", 1)[1].strip()
    if not verify_admin_token(token):
        raise HTTPException(status_code=401, detail="Unauthorized or token expired")
    return token

@router.post("/login")
def admin_login(req: AdminLoginRequest, request: Request):
    if not settings.ADMIN_PASSWORD or not settings.ADMIN_HMAC_SECRET:
        raise HTTPException(status_code=503, detail="Admin authentication is not configured")

    client_ip = request.client.host if request.client else "127.0.0.1"
    if not check_rate_limit("login_fail", client_ip, max_events=8, window_sec=300):
        raise HTTPException(status_code=429, detail="ลองผิดเกินกำหนด กรุณารอ 5 นาที")

    if hmac.compare_digest(req.password.encode("utf-8"), settings.ADMIN_PASSWORD.encode("utf-8")):
        return {"ok": True, "token": create_admin_token()}
    raise HTTPException(status_code=401, detail="รหัสผ่านหลังบ้านไม่ถูกต้อง")

@router.get("/state")
def get_admin_state(_: str = Depends(require_admin)):
    state = repository.get_state()
    safe_settings = dict(state["settings"])
    safe_settings["has_line_token"] = bool(safe_settings.get("line_channel_token"))
    safe_settings["has_customer_line_token"] = bool(safe_settings.get("customer_line_channel_token"))
    safe_settings["has_tg_token"] = bool(safe_settings.get("telegram_bot_token"))
    safe_settings["line_channel_token"] = ""
    safe_settings["customer_line_channel_token"] = ""
    safe_settings["telegram_bot_token"] = ""

    # Extreme Bandwidth Optimization: Strip massive base64 slips from high-frequency polling
    proofs = state.get("delivery_proofs", {}) or {}
    lightweight_orders = []
    for o in state.get("orders", []):
        o_copy = dict(o)
        o_copy["has_slip"] = bool(o.get("has_slip") or o.get("slip_image") or o.get("slip_image_base64") or o.get("slip_sha256"))
        o_copy["slip_image"] = ""  # Fetched on-demand only when admin clicks to view slip
        o_copy.pop("slip_image_base64", None)
        p = proofs.get(o.get("order_code"))
        if p:
            o_copy["delivery_proof_url"] = f"/api/order-proof/{o['order_code']}?token={make_order_token(o['order_code'])}&v={p.get('v', 0)}"
            o_copy["delivery_proof_at"] = p.get("uploaded_at")
            if not o_copy.get("completed_at"):
                o_copy["completed_at"] = p.get("uploaded_at")
        lightweight_orders.append(o_copy)

    return {"ok": True, "settings": safe_settings, "orders": lightweight_orders}

@router.get("/order-slip/{order_code}")
def get_order_slip(order_code: str, _: str = Depends(require_admin)):
    clean_code = re.sub(r"[^A-Za-z0-9]", "", order_code)
    state = repository.get_state()
    for o in state.get("orders", []):
        if o.get("order_code") == clean_code:
            slip = o.get("slip_image") or o.get("slip_image_base64") or ""
            if slip:
                return {"ok": True, "order_code": clean_code, "slip_image": slip}

    # On-demand fetch from Supabase
    slip = repository.fetch_supabase_slip(clean_code)
    if slip:
        return {"ok": True, "order_code": clean_code, "slip_image": slip}

    # Fallback to local store_state.json if available
    if settings.STATE_FILE.exists():
        try:
            with open(settings.STATE_FILE, "r", encoding="utf-8") as f:
                d = json.load(f)
                for o in d.get("orders", []):
                    if o.get("order_code") == clean_code:
                        slip = o.get("slip_image") or o.get("slip_image_base64") or ""
                        if slip:
                            return {"ok": True, "order_code": clean_code, "slip_image": slip}
        except Exception:
            pass

    raise HTTPException(status_code=404, detail="ไม่พบรูปสลิปสำหรับออเดอร์นี้ (อาจเป็นออเดอร์ชำระเงินสดหน้าร้าน หรือสลิปไม่ได้ถูกบันทึกไว้)")

@router.post("/settings")
def update_admin_settings(req: AdminSettingsUpdateRequest, _: str = Depends(require_admin)):
    state = repository.get_state()
    s = state["settings"]
    if req.is_open is not None:
        s["is_open"] = bool(req.is_open)
    if req.closed_message is not None:
        s["closed_message"] = sanitize_text(req.closed_message, 250)
    if req.announcement is not None:
        s["announcement"] = sanitize_text(req.announcement, 250)
    if req.promptpay_id is not None:
        s["promptpay_id"] = re.sub(r"[^0-9]", "", str(req.promptpay_id))[:15]
    if req.promptpay_name is not None:
        s["promptpay_name"] = sanitize_text(req.promptpay_name, 80)
    if req.require_slip_check_before_pos is not None:
        s["require_slip_check_before_pos"] = bool(req.require_slip_check_before_pos)
    if req.line_liff_id is not None:
        s["line_liff_id"] = sanitize_text(req.line_liff_id, 80)
    if req.line_channel_token:
        s["line_channel_token"] = str(req.line_channel_token).strip()
    if req.customer_line_channel_token is not None:
        s["customer_line_channel_token"] = str(req.customer_line_channel_token).strip()
    if req.notify_customer_cooking is not None:
        s["notify_customer_cooking"] = bool(req.notify_customer_cooking)
    if req.notify_customer_delivery is not None:
        s["notify_customer_delivery"] = bool(req.notify_customer_delivery)
    if req.line_target_id is not None:
        s["line_target_id"] = sanitize_text(req.line_target_id, 80)
    if req.telegram_bot_token:
        s["telegram_bot_token"] = str(req.telegram_bot_token).strip()
    if req.telegram_chat_id is not None:
        s["telegram_chat_id"] = sanitize_text(req.telegram_chat_id, 80)
    if req.line_extra_targets is not None:
        cleaned = []
        seen = set()
        for t in req.line_extra_targets[:20]:
            tid = re.sub(r"[^A-Za-z0-9]", "", str(t.get("id") or ""))[:64]
            if not tid or tid in seen:
                continue
            seen.add(tid)
            cleaned.append({
                "id": tid,
                "name": sanitize_text(str(t.get("name") or ""), 40),
                "enabled": bool(t.get("enabled", True)),
            })
        s["line_extra_targets"] = cleaned

    repository.save_state(state, sync_supabase_now=True)
    return {"ok": True}

@router.post("/test-line-notification")
def test_line_notification(req: dict = Body(default={}), _: str = Depends(require_admin)):
    state = repository.get_state()
    s = state.get("settings", {})
    token = (req.get("line_channel_token") or s.get("line_channel_token") or "").strip()
    target = (req.get("line_target_id") or s.get("line_target_id") or "").strip()

    if not token:
        raise HTTPException(status_code=400, detail="กรุณากรอกหรือบันทึก LINE Channel Token ก่อนทดสอบ")
    if not target:
        raise HTTPException(status_code=400, detail="กรุณากรอกหรือบันทึก LINE Target User/Group ID ก่อนทดสอบ")

    if token.startswith("U") and len(token) == 33:
        raise HTTPException(
            status_code=400,
            detail="Token ที่ใส่ขึ้นต้นด้วย 'U...' (ความยาว 33 ตัวอักษร) ซึ่งเป็น LINE User ID ไม่ใช่ Channel Access Token ครับ กรุณานำ 'Channel access token (long-lived)' จากแท็บ Messaging API ใน LINE Developers มาใส่แทน"
        )

    targets = []
    single_target = (req.get("target_id") or "").strip()
    if single_target:
        targets.append(single_target)
    else:
        if target:
            targets.append(target)
        extra_list = req.get("line_extra_targets") if "line_extra_targets" in req else s.get("line_extra_targets", [])
        for xt in (extra_list or []):
            xid = (xt.get("id") if isinstance(xt, dict) else str(xt or "")).strip()
            is_en = xt.get("enabled", True) if isinstance(xt, dict) else True
            if xid and is_en and xid not in targets:
                targets.append(xid)

    if not targets:
        raise HTTPException(status_code=400, detail="กรุณากรอกหรือบันทึก LINE Target User/Group ID ก่อนทดสอบ")

    success_cnt = 0
    errors = []
    for tgt in targets:
        try:
            payload = {
                "to": tgt,
                "messages": [
                    {
                        "type": "text",
                        "text": f"🐱 ทดสอบระบบแจ้งเตือน FatCat POS: บอทเชื่อมต่อกับปลายทาง ({tgt[:6]}…) สำเร็จแล้ว! 🎉 เมื่อมีออเดอร์ใหม่เข้ามาจะแจ้งเตือนมาที่นี่ครับ"
                    }
                ]
            }
            test_req = urllib.request.Request(
                "https://api.line.me/v2/bot/message/push",
                data=json.dumps(payload).encode("utf-8"),
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json"
                },
                method="POST"
            )
            with urllib.request.urlopen(test_req, timeout=10) as resp:
                resp.read()
            success_cnt += 1
        except urllib.error.HTTPError as e:
            err_body = e.read().decode("utf-8", errors="ignore")
            try:
                err_json = json.loads(err_body)
                err_msg = err_json.get("message", err_body)
            except Exception:
                err_msg = err_body
            hint = ""
            if "not found" in err_msg.lower() or "failed to send" in err_msg.lower():
                hint = " (ต้องกด 'เพิ่มเพื่อน' บอทใน LINE ก่อนเสมอ หรือ User ID ไม่ตรง)"
            errors.append(f"{tgt[:8]}…: {err_msg}{hint}")
        except Exception as e:
            errors.append(f"{tgt[:8]}…: {str(e)}")

    if success_cnt > 0:
        err_msg = f" (แต่พบปัญหาใน {len(errors)} ปลายทาง: {', '.join(errors)})" if errors else ""
        return {"ok": True, "message": f"ส่งข้อความทดสอบสำเร็จ {success_cnt}/{len(targets)} ปลายทางแล้ว!{err_msg}"}
    raise HTTPException(status_code=400, detail=f"ส่งไม่สำเร็จ: {'; '.join(errors)}")

@router.post("/test-telegram-notification")
def test_telegram_notification(req: dict = Body(default={}), _: str = Depends(require_admin)):
    state = repository.get_state()
    s = state.get("settings", {})
    token = (req.get("telegram_bot_token") or s.get("telegram_bot_token") or "").strip()
    chat_id = (req.get("telegram_chat_id") or s.get("telegram_chat_id") or "").strip()

    if not token:
        raise HTTPException(status_code=400, detail="กรุณากรอกหรือบันทึก Telegram Bot Token ก่อนทดสอบ")
    if not chat_id:
        raise HTTPException(status_code=400, detail="กรุณากรอกหรือบันทึก Telegram Chat ID ก่อนทดสอบ")

    try:
        payload = {
            "chat_id": chat_id,
            "text": "🐱 <b>ทดสอบระบบแจ้งเตือน FatCat POS</b>\n\n🎉 บอท Telegram เชื่อมต่อสำเร็จแล้ว!\nเมื่อมีออเดอร์ใหม่เข้ามาจะแจ้งเตือนพร้อมส่งเสียงมาที่นี่ทันทีครับ",
            "parse_mode": "HTML",
            "disable_notification": False
        }
        test_req = urllib.request.Request(
            f"https://api.telegram.org/bot{token}/sendMessage",
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        with urllib.request.urlopen(test_req, timeout=10) as resp:
            resp.read()
        return {"ok": True, "message": "ส่งข้อความทดสอบเข้า Telegram สำเร็จแล้ว! กรุณาตรวจสอบในแอป Telegram"}
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8", errors="ignore")
        try:
            err_json = json.loads(err_body)
            err_msg = err_json.get("description", err_body)
        except Exception:
            err_msg = err_body
        raise HTTPException(
            status_code=400,
            detail=f"Telegram ปฏิเสธคำขอ (HTTP {e.code}): {err_msg} (คำแนะนำ: อย่าลืมกดปุ่ม Start ที่บอทในแอป Telegram ก่อนนะครับ)"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"เกิดข้อผิดพลาดในการเชื่อมต่อ Telegram: {str(e)}")

@router.post("/test-customer-line-notification")
def test_customer_line_notification(req: dict = Body(default={}), _: str = Depends(require_admin)):
    state = repository.get_state()
    s = state.get("settings", {})
    token = (
        req.get("customer_line_channel_token")
        or s.get("customer_line_channel_token")
        or s.get("line_channel_token")
        or settings.LINE_CHANNEL_TOKEN
        or ""
    ).strip()
    target = (req.get("target_id") or req.get("line_target_id") or s.get("line_target_id") or "").strip()

    if not token:
        raise HTTPException(status_code=400, detail="กรุณากรอกหรือบันทึก LINE Token ก่อนทดสอบ")
    if not target:
        raise HTTPException(status_code=400, detail="กรุณาระบุ LINE User ID ปลายทางที่ต้องการทดสอบ")

    try:
        payload = {
            "to": target,
            "messages": [
                {
                    "type": "text",
                    "text": "🐱 ทดสอบระบบแจ้งเตือนลูกค้า (Customer LINE OA): เชื่อมต่อสำเร็จแล้ว! 🎉\nเมื่อมีออเดอร์ใหม่ ระบบจะส่งข้อความแจ้งเตือนสถานะอาหารและรูปหลักฐานการส่งมอบมาที่ห้องแชทนี้ครับ"
                }
            ]
        }
        test_req = urllib.request.Request(
            "https://api.line.me/v2/bot/message/push",
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json"
            },
            method="POST"
        )
        with urllib.request.urlopen(test_req, timeout=10) as resp:
            resp.read()
        return {"ok": True, "message": f"ส่งข้อความทดสอบไปยัง LINE ({target[:8]}…) สำเร็จแล้ว!"}
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8", errors="ignore")
        try:
            err_json = json.loads(err_body)
            err_msg = err_json.get("message", err_body)
        except Exception:
            err_msg = err_body
        hint = ""
        if "not found" in err_msg.lower() or "failed to send" in err_msg.lower():
            hint = " (ตรวจสอบว่าบัญชี LINE ปลายทางได้กด 'เพิ่มเพื่อน' กับ LINE OA นี้แล้วหรือยัง)"
        raise HTTPException(status_code=400, detail=f"LINE แจ้งข้อผิดพลาด: {err_msg}{hint}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"เกิดข้อผิดพลาดในการเชื่อมต่อ LINE: {str(e)}")

@router.post("/order-action")
def order_action(req: AdminOrderActionRequest, _: str = Depends(require_admin)):
    state = repository.get_state()
    target = next((o for o in state["orders"] if o["order_code"] == req.order_code), None)
    if not target:
        raise HTTPException(status_code=404, detail="ไม่พบออเดอร์")

    store_settings = state.get("settings", {})

    if req.action == "approve_and_push_pos":
        if not target.get("loyverse_receipt_number"):
            try:
                rec, _ = push_order_to_loyverse(target)
                target["loyverse_receipt_number"] = rec.get("receipt_number")
            except Exception as e:
                raise HTTPException(status_code=400, detail=f"ส่งเข้า Loyverse ไม่สำเร็จ: {str(e)}")
        target["status"] = "COOKING"
        target["status_label"] = "🍳 ตรวจสลิปแล้ว • กำลังปรุงอาหาร"
        if not target.get("cooking_started_at"):
            target["cooking_started_at"] = get_thai_time_str()
        try:
            send_order_status_to_customer(store_settings, target, "COOKING")
        except Exception as e:
            print("Customer cooking notify error:", e)
    elif req.action == "mark_done":
        target["status"] = "COMPLETED"
        target["status_label"] = "✅ ทำอาหารเสร็จแล้ว / พร้อมส่งมอบ"
        if not target.get("completed_at"):
            target["completed_at"] = get_thai_time_str()
        try:
            send_order_status_to_customer(store_settings, target, "READY")
        except Exception as e:
            print("Customer ready notify error:", e)
    elif req.action == "cancel":
        target["status"] = "CANCELLED"
        target["status_label"] = "❌ ยกเลิกออเดอร์"
        if not target.get("completed_at"):
            target["completed_at"] = get_thai_time_str()

    repository.save_state(state, sync_supabase_now=True)
    if settings.SUPABASE_URL and settings.SUPABASE_KEY:
        if settings.IS_VERCEL:
            repository.push_supabase_order(target)
        else:
            threading.Thread(target=repository.push_supabase_order, args=(target,), daemon=True).start()

    return {"ok": True, "order": target}

def _compress_proof_photo(raw: bytes) -> bytes:
    """Resize/compress a phone camera photo to a small JPEG (max 1080px) with EXIF rotation applied."""
    import io
    from PIL import Image, ImageOps
    img = Image.open(io.BytesIO(raw))
    img = ImageOps.exif_transpose(img)
    if img.mode not in ("RGB", "L"):
        img = img.convert("RGB")
    img.thumbnail((1080, 1080))
    out = io.BytesIO()
    img.save(out, format="JPEG", quality=72, optimize=True, progressive=True)
    return out.getvalue()

@router.post("/order-proof")
async def upload_order_proof(
    request: Request,
    order_code: str = Form(...),
    file: UploadFile = File(...),
    _: str = Depends(require_admin),
):
    import base64
    code = re.sub(r"[^A-Za-z0-9]", "", order_code)[:20]
    contents = await file.read()
    if not contents:
        raise HTTPException(status_code=400, detail="ไม่พบไฟล์รูปภาพ")
    if len(contents) > 15 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="ไฟล์รูปภาพใหญ่เกิน 15MB")

    state = repository.get_state(force_refresh=True)
    target = next((o for o in state["orders"] if o["order_code"] == code), None)
    if not target:
        raise HTTPException(status_code=404, detail="ไม่พบออเดอร์")

    try:
        jpg = _compress_proof_photo(contents)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"อ่านไฟล์รูปไม่สำเร็จ: {e}")

    uploaded_at = get_thai_time_str()
    ok = repository.put_blob(f"proof:{code}", {
        "image": "data:image/jpeg;base64," + base64.b64encode(jpg).decode("ascii"),
        "uploaded_at": uploaded_at,
    })
    if not ok:
        raise HTTPException(status_code=500, detail="บันทึกรูปไม่สำเร็จ กรุณาลองใหม่")

    version = int(time.time())
    proofs = state.setdefault("delivery_proofs", {})
    is_first_upload = code not in proofs
    proofs[code] = {"uploaded_at": uploaded_at, "v": version}

    if target.get("status") != "CANCELLED":
        target["status"] = "COMPLETED"
        target["status_label"] = "📸 ส่งอาหารแล้ว • ดูรูปหลักฐานได้"
        if not target.get("completed_at"):
            target["completed_at"] = uploaded_at

    # Notify customer on LINE (only on the first upload, not when replacing the photo)
    if is_first_upload:
        proto = request.headers.get("x-forwarded-proto") or request.url.scheme
        host = request.headers.get("x-forwarded-host") or request.headers.get("host") or ""
        if "vercel.app" in host or request.headers.get("x-forwarded-proto") == "https":
            proto = "https"
        img_url = f"{proto}://{host}/api/order-proof/{code}?token={make_order_token(code)}&v={version}" if host else ""
        try:
            send_delivery_proof_to_customer(state.get("settings", {}), target, img_url)
        except Exception as e:
            print("Delivery proof notify error:", e)

    repository.save_state(state, sync_supabase_now=True)
    if settings.SUPABASE_URL and settings.SUPABASE_KEY:
        if settings.IS_VERCEL:
            repository.push_supabase_order(target)
        else:
            threading.Thread(target=repository.push_supabase_order, args=(target,), daemon=True).start()

    return {
        "ok": True,
        "order": target,
        "delivery_proof_url": f"/api/order-proof/{code}?token={make_order_token(code)}&v={version}",
    }

class ResendNotificationRequest(BaseModel):
    order_code: str
    action_type: Optional[str] = "AUTO"

@router.post("/resend-customer-notification")
def resend_customer_notification(req: ResendNotificationRequest, request: Request, _: str = Depends(require_admin)):
    code = re.sub(r"[^A-Za-z0-9]", "", req.order_code)[:20]
    state = repository.get_state(force_refresh=True)
    target = next((o for o in state["orders"] if o["order_code"] == code), None)
    if not target:
        raise HTTPException(status_code=404, detail="ไม่พบออเดอร์นี้")

    if not target.get("line_user_id"):
        raise HTTPException(status_code=400, detail="ออเดอร์นี้ไม่ได้สั่งผ่าน LINE (ไม่มี User ID ของลูกค้า)")

    store_settings = state.get("settings", {})
    action = (req.action_type or "AUTO").upper()

    proofs = state.get("delivery_proofs", {}) or {}
    has_proof = code in proofs or bool(target.get("delivery_proof_url"))

    if action == "DELIVERY_PROOF" or (action == "AUTO" and has_proof):
        version = proofs.get(code, {}).get("v", int(time.time()))
        proto = request.headers.get("x-forwarded-proto") or request.url.scheme
        host = request.headers.get("x-forwarded-host") or request.headers.get("host") or ""
        if "vercel.app" in host or request.headers.get("x-forwarded-proto") == "https":
            proto = "https"
        img_url = f"{proto}://{host}/api/order-proof/{code}?token={make_order_token(code)}&v={version}" if host else ""
        ok, msg = send_delivery_proof_to_customer(store_settings, target, img_url, force=True)
    else:
        st = target.get("status", "COOKING")
        ok, msg = send_order_status_to_customer(store_settings, target, st if st in ("COOKING", "READY") else "COOKING", force=True)

    repository.save_state(state, sync_supabase_now=True)
    if settings.SUPABASE_URL and settings.SUPABASE_KEY:
        if settings.IS_VERCEL:
            repository.push_supabase_order(target)
        else:
            threading.Thread(target=repository.push_supabase_order, args=(target,), daemon=True).start()

    if not ok:
        raise HTTPException(status_code=400, detail=msg)
    return {"ok": True, "message": msg, "order": target}

@router.get("/menu-stock")
def get_menu_stock(refresh: str = Query("0"), _: str = Depends(require_admin)):
    force = refresh in ("1", "true")
    try:
        data = fetch_front_store_menu(force=force)
        items = data.get("items", [])

        inv_map = {}
        try:
            inv_resp = loyverse_req("inventory")
            levels = inv_resp.get("inventory_levels", [])
            inv_map = {lev["variant_id"]: lev["in_stock"] for lev in levels if lev.get("store_id") == settings.LOYVERSE_STORE_ID}
        except Exception:
            pass

        cat_map = {c["id"]: c["name"] for c in data.get("categories", [])}
        enhanced_items = []
        for it in items:
            vid = it["variant_id"]
            loy_stock = inv_map.get(vid)
            enhanced_items.append({
                **it,
                "item_name": it.get("name"),
                "category_name": cat_map.get(it.get("category_id"), "ทั่วไป"),
                "loyverse_in_stock": loy_stock,
            })

        total_cnt = len(enhanced_items)
        hidden_cnt = sum(1 for it in enhanced_items if it.get("is_hidden"))
        avail_cnt = sum(1 for it in enhanced_items if it.get("is_available") and not it.get("is_hidden"))
        sold_out_cnt = sum(1 for it in enhanced_items if not it.get("is_available") and not it.get("is_hidden"))

        return {
            "ok": True,
            "categories": data.get("categories", []),
            "items": enhanced_items,
            "total_count": total_cnt,
            "available_count": avail_cnt,
            "sold_out_count": sold_out_cnt,
            "hidden_count": hidden_cnt,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"โหลดสต็อกไม่สำเร็จ: {str(e)}")

@router.post("/menu-stock")
def update_menu_stock(req: MenuStockUpdateRequest, _: str = Depends(require_admin)):
    vid = req.variant_id.strip()
    if not vid:
        raise HTTPException(status_code=400, detail="Missing variant_id")

    state = repository.get_state()
    cur_st = state.setdefault("item_stock", {}).setdefault(vid, {})

    if req.is_available is not None:
        cur_st["is_available"] = bool(req.is_available)
    if req.is_hidden is not None:
        cur_st["is_hidden"] = bool(req.is_hidden)
    if req.stock_count is not None:
        if str(req.stock_count).strip() != "":
            try:
                sc = max(0, int(req.stock_count))
                cur_st["stock_count"] = sc
                if sc == 0:
                    cur_st["is_available"] = False
            except Exception:
                cur_st["stock_count"] = None
        else:
            cur_st["stock_count"] = None

    cur_st["updated_at"] = time.strftime("%Y-%m-%d %H:%M:%S")
    repository.save_state(state)
    invalidate_menu_cache()

    return {
        "ok": True,
        "variant_id": vid,
        "is_available": cur_st.get("is_available", True),
        "is_hidden": cur_st.get("is_hidden", False),
        "stock_count": cur_st.get("stock_count")
    }

@router.post("/sync-loyverse-stock")
def sync_stock(_: str = Depends(require_admin)):
    try:
        count = sync_loyverse_stock()
        return {"ok": True, "synced_count": count}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/menu-reorder")
def get_menu_reorder(_: str = Depends(require_admin)):
    state = repository.get_state()
    data = fetch_front_store_menu(force=False)
    return {
        "ok": True,
        "category_order": state.get("category_order", []),
        "category_config": state.get("category_config", {}),
        "item_order": state.get("item_order", []),
        "item_config": state.get("item_config", {}),
        "showcase_dishes": state.get("showcase_dishes", []),
        "categories": data.get("categories", []),
        "items": data.get("items", []),
    }

@router.post("/menu-reorder")
def update_menu_reorder(req: MenuReorderRequest, _: str = Depends(require_admin)):
    state = repository.get_state()
    if req.category_order is not None:
        state["category_order"] = list(req.category_order)
    if req.category_config is not None:
        state["category_config"] = dict(req.category_config)
    if req.item_order is not None:
        state["item_order"] = list(req.item_order)
    if req.item_config is not None:
        state["item_config"] = dict(req.item_config)
    if req.showcase_dishes is not None:
        state["showcase_dishes"] = list(req.showcase_dishes)

    repository.save_state(state, sync_supabase_now=True)
    invalidate_menu_cache()

    return {
        "ok": True,
        "message": "บันทึกลำดับและการตั้งค่าหมวดหมู่/เมนูอาหารเรียบร้อยแล้ว",
        "category_order": state.get("category_order", []),
        "category_config": state.get("category_config", {}),
        "item_order": state.get("item_order", []),
        "item_config": state.get("item_config", {}),
        "showcase_dishes": state.get("showcase_dishes", []),
    }

@router.get("/modifiers")
def get_admin_modifiers_endpoint(refresh: str = Query("0"), _: str = Depends(require_admin)):
    if refresh in ("1", "true"):
        invalidate_menu_cache()
    try:
        mods = get_admin_modifiers()
        return {"ok": True, "modifiers": mods}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"ไม่สามารถดึงข้อมูลตัวเลือกเสริมได้: {str(e)}")

@router.post("/modifiers")
def update_admin_modifier_endpoint(req: AdminModifierUpdateRequest, _: str = Depends(require_admin)):
    state = repository.get_state()
    if "modifier_settings" not in state:
        state["modifier_settings"] = {}

    state["modifier_settings"][req.modifier_id] = {
        "custom_name": sanitize_text(req.custom_name or "", 80),
        "is_required": bool(req.is_required),
        "min_selection": max(0, int(req.min_selection)),
        "max_selection": max(0, int(req.max_selection)),
        "disabled_options": [str(x).strip() for x in req.disabled_options],
        "custom_prices": {str(k).strip(): float(v) for k, v in req.custom_prices.items()},
    }

    repository.save_state(state, sync_supabase_now=True)
    invalidate_menu_cache()
    return {"ok": True, "message": "บันทึกการตั้งค่าตัวเลือกเสริมเรียบร้อยแล้ว"}

@router.post("/sync-bestsellers")
def trigger_sync_bestsellers(_: str = Depends(require_admin)):
    try:
        res = sync_bestsellers()
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/receipts")
def get_receipts(_: str = Depends(require_admin)):
    try:
        res = loyverse_req("receipts?limit=12")
        return {"ok": True, "receipts": res.get("receipts", [])}
    except Exception:
        raise HTTPException(status_code=500, detail="ดึงข้อมูลใบเสร็จไม่สำเร็จ")

@router.post("/upload-dish-image")
async def upload_dish_image(
    item_id: str = Form(...),
    file: UploadFile = File(...),
    _: str = Depends(require_admin)
):
    contents = await file.read()
    if len(contents) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="ไฟล์รูปภาพมีขนาดใหญ่เกิน 10MB")
    ok, res_url = save_custom_dish_image(item_id, contents)
    if not ok:
        raise HTTPException(status_code=500, detail=f"ไม่สามารถประมวลผลรูปภาพได้: {res_url}")

    # Update item_config in store_state
    state = repository.get_state()
    cfg = state.setdefault("item_config", {}).setdefault(item_id, {})
    cfg["custom_image_url"] = res_url
    repository.save_state(state)
    invalidate_menu_cache()

    return {"ok": True, "custom_image_url": res_url}

@router.delete("/custom-dish-image/{item_id}")
def remove_custom_dish_image(item_id: str, _: str = Depends(require_admin)):
    delete_custom_dish_image(item_id)
    state = repository.get_state()
    if item_id in state.get("item_config", {}):
        state["item_config"][item_id].pop("custom_image_url", None)
        repository.save_state(state)
        invalidate_menu_cache()
    return {"ok": True, "message": "ยกเลิกรูป HD และกลับไปใช้รูป Loyverse เรียบร้อยแล้ว"}

@router.post("/clear-cache")
def clear_cache(_: str = Depends(require_admin)):
    invalidate_menu_cache()
    return {"ok": True, "message": "Menu cache cleared"}

@router.get("/customers")
def get_admin_customers(_: str = Depends(require_admin)):
    state = repository.get_state()
    raw_customers = state.get("customers", {})

    # Normalize list of unique customers (prefer line: keys if available)
    seen_uids = set()
    customer_list = []
    for k, v in raw_customers.items():
        uid = v.get("line_user_id") or k
        if uid in seen_uids:
            continue
        seen_uids.add(uid)

        # Ensure reward fields are present
        tot_orders = int(v.get("total_orders", 0))
        cust_copy = dict(v)
        cust_copy["id"] = k
        cust_copy.setdefault("stamps", tot_orders % 10)
        cust_copy.setdefault("available_rewards", tot_orders // 10)
        cust_copy.setdefault("rewards_redeemed", 0)
        cust_copy.setdefault("total_rewards_earned", tot_orders // 10)
        cust_copy.setdefault("stamp_logs", [])
        customer_list.append(cust_copy)

    # Sort by updated_at or last_order_at descending
    customer_list.sort(key=lambda c: c.get("updated_at") or c.get("last_order_at") or "", reverse=True)

    total_stamps = sum(c.get("stamps", 0) for c in customer_list)
    total_rewards = sum(c.get("available_rewards", 0) for c in customer_list)
    total_spent = round(sum(float(c.get("total_spent", 0.0)) for c in customer_list), 2)
    total_orders = sum(c.get("total_orders", 0) for c in customer_list)

    return {
        "ok": True,
        "customers": customer_list,
        "metrics": {
            "total_customers": len(customer_list),
            "total_stamps": total_stamps,
            "total_available_rewards": total_rewards,
            "total_spent": total_spent,
            "total_orders": total_orders,
        }
    }

@router.post("/customer-stamp")
def admin_manage_customer_stamp(req: AdminCustomerStampRequest, _: str = Depends(require_admin)):
    cust_id = sanitize_text(req.customer_id, 100)
    if not cust_id:
        raise HTTPException(status_code=400, detail="Missing customer_id")

    state = repository.get_state()
    customers = state.setdefault("customers", {})

    # Find matching record by id or line_user_id
    found_key = None
    if cust_id in customers:
        found_key = cust_id
    else:
        for k, v in customers.items():
            if v.get("line_user_id") == cust_id:
                found_key = k
                break

    if not found_key:
        # Create a new customer profile on the fly if admin inputs a LINE UID manually
        found_key = f"line:{cust_id}" if not cust_id.startswith("line:") else cust_id
        clean_uid = cust_id.replace("line:", "")
        customers[found_key] = {
            "customer_name": f"ลูกค้า {clean_uid[:6]}",
            "line_display_name": f"LINE {clean_uid[:6]}",
            "line_user_id": clean_uid,
            "picture_url": "",
            "phone": "",
            "total_orders": 0,
            "total_spent": 0.0,
            "stamps": 0,
            "available_rewards": 0,
            "rewards_redeemed": 0,
            "total_rewards_earned": 0,
            "stamp_logs": [],
            "updated_at": get_thai_time_str(),
        }

    cust = customers[found_key]
    action = req.action.lower().strip()
    amt = max(1, req.amount or 1)
    note_text = sanitize_text(req.note or "ปรับแต้มโดยผู้ดูแลระบบ (สั่งผ่าน LINE OA)", 200)

    curr_stamps = int(cust.get("stamps", 0))
    avail_rewards = int(cust.get("available_rewards", 0))
    total_rewards_earned = int(cust.get("total_rewards_earned", 0))
    rewards_redeemed = int(cust.get("rewards_redeemed", 0))
    stamp_logs = list(cust.get("stamp_logs", []))

    if action == "add":
        new_stamps = curr_stamps + amt
        earned_now = 0
        while new_stamps >= 10:
            new_stamps -= 10
            avail_rewards += 1
            total_rewards_earned += 1
            earned_now += 1
        curr_stamps = new_stamps
        log_title = f"+{amt} สแตมป์ ({note_text})"
        if earned_now > 0:
            log_title += f" 🎉 ครบ 10 กล่อง ได้รับส่วนลด 10฿ (+{earned_now} คูปอง)!"
        stamp_logs.insert(0, {
            "created_at": get_thai_time_str(),
            "action": "admin_add_stamp",
            "note": log_title,
            "delta_stamps": amt,
            "delta_rewards": earned_now
        })

    elif action == "deduct":
        curr_stamps = max(0, curr_stamps - amt)
        stamp_logs.insert(0, {
            "created_at": get_thai_time_str(),
            "action": "admin_deduct_stamp",
            "note": f"-{amt} สแตมป์ ({note_text})",
            "delta_stamps": -amt,
            "delta_rewards": 0
        })

    elif action == "set":
        target = max(0, req.amount if req.amount is not None else 0)
        diff = target - curr_stamps
        curr_stamps = target % 10
        earned_now = target // 10
        if earned_now > 0:
            avail_rewards += earned_now
            total_rewards_earned += earned_now
        stamp_logs.insert(0, {
            "created_at": get_thai_time_str(),
            "action": "admin_set_stamp",
            "note": f"ตั้งค่าสแตมป์เป็น {target} ดวง ({note_text})",
            "delta_stamps": diff,
            "delta_rewards": earned_now
        })

    elif action == "add_reward":
        avail_rewards += amt
        total_rewards_earned += amt
        stamp_logs.insert(0, {
            "created_at": get_thai_time_str(),
            "action": "admin_add_reward",
            "note": f"แจกคูปองส่วนลด 10 บาท +{amt} ใบ ({note_text})",
            "delta_stamps": 0,
            "delta_rewards": amt
        })

    elif action == "use_reward":
        if avail_rewards <= 0:
            raise HTTPException(status_code=400, detail="ลูกค้าไม่มีคูปองส่วนลดที่ใช้งานได้")
        avail_rewards = max(0, avail_rewards - amt)
        rewards_redeemed += amt
        stamp_logs.insert(0, {
            "created_at": get_thai_time_str(),
            "action": "admin_use_reward",
            "note": f"หักใช้คูปองส่วนลด 10 บาท -{amt} ใบ ({note_text})",
            "delta_stamps": 0,
            "delta_rewards": -amt
        })
    else:
        raise HTTPException(status_code=400, detail=f"Action '{action}' is not supported")

    cust["stamps"] = curr_stamps
    cust["available_rewards"] = avail_rewards
    cust["total_rewards_earned"] = total_rewards_earned
    cust["rewards_redeemed"] = rewards_redeemed
    cust["stamp_logs"] = stamp_logs[:50]
    cust["updated_at"] = get_thai_time_str()

    customers[found_key] = cust
    repository.save_state(state, sync_supabase_now=True)

    if settings.SUPABASE_URL and settings.SUPABASE_KEY:
        try:
            threading.Thread(target=repository.push_supabase_customer, args=(found_key, cust), daemon=True).start()
        except Exception:
            pass

    return {
        "ok": True,
        "message": "อัปเดตสแตมป์ของลูกค้าเรียบร้อยแล้ว",
        "customer": cust
    }
