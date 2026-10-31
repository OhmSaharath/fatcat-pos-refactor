import html
import json
import urllib.request
import urllib.error
from typing import Any, Dict, List, Optional, Tuple
from ..config import settings, get_thai_time_str


def line_push(token: str, to: str, messages: List[Dict[str, Any]]) -> None:
    """Push LINE messages to a single user/group ID. Raises on HTTP error."""
    req = urllib.request.Request(
        "https://api.line.me/v2/bot/message/push",
        data=json.dumps({"to": to, "messages": messages}).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        },
        method="POST"
    )
    urllib.request.urlopen(req, timeout=8).read()


def parse_line_error(e: urllib.error.HTTPError) -> str:
    """Extract clean error description and helpful guidance from LINE API error response."""
    err_body = e.read().decode("utf-8", errors="ignore")
    try:
        err_json = json.loads(err_body)
        msg = err_json.get("message", err_body)
        details = [d.get("message", "") for d in err_json.get("details", []) if isinstance(d, dict)]
        if details:
            msg += f" ({', '.join(details)})"
    except Exception:
        msg = err_body
    hint = ""
    if "not found" in msg.lower() or "failed to send" in msg.lower() or e.code == 400:
        hint = " (ลูกค้าอาจยังไม่ได้กด 'เพิ่มเพื่อน' กับบอท หรือบล็อกบอท)"
    return f"{msg}{hint}"


def record_customer_notify_log(
    order_obj: Dict[str, Any],
    action_type: str,
    action_title: str,
    success: bool,
    detail: str
) -> None:
    """Record customer notification audit log directly onto the order object."""
    now_str = get_thai_time_str()
    logs = order_obj.setdefault("customer_line_notify_logs", [])
    logs.insert(0, {
        "action": action_type,
        "title": action_title,
        "sent_at": now_str,
        "success": success,
        "detail": detail
    })
    order_obj["customer_line_notify_logs"] = logs[:15]
    order_obj["customer_line_notify_status"] = "SUCCESS" if success else "FAILED"
    order_obj["customer_line_notify_at"] = now_str
    order_obj["customer_line_notify_detail"] = detail


def get_store_line_targets(store_settings: Dict[str, Any]) -> List[str]:
    """Primary target + extra staff targets (deduplicated, order preserved)."""
    targets: List[str] = []
    primary = (store_settings.get("line_target_id") or settings.LINE_TARGET_ID or "").strip()
    if primary:
        targets.append(primary)
    for t in store_settings.get("line_extra_targets") or []:
        tid = (t.get("id") if isinstance(t, dict) else str(t or "")).strip()
        enabled = t.get("enabled", True) if isinstance(t, dict) else True
        if tid and enabled and tid not in targets:
            targets.append(tid)
    return targets


def get_customer_line_token(store_settings: Dict[str, Any]) -> str:
    """Customer-facing LINE OA token (falls back to kitchen token / default env token)."""
    return (
        store_settings.get("customer_line_channel_token")
        or store_settings.get("line_channel_token")
        or settings.LINE_CHANNEL_TOKEN
        or ""
    ).strip()


def send_delivery_proof_to_customer(store_settings: Dict[str, Any], order_obj: Dict[str, Any], image_url: str = "", force: bool = False) -> Tuple[bool, str]:
    """Notify the customer (if they ordered via LINE) that food was delivered, with the proof photo."""
    if not force and not store_settings.get("notify_customer_delivery", True):
        return False, "ปิดการแจ้งเตือนส่งอาหารในหน้าตั้งค่า"
    line_token = get_customer_line_token(store_settings)
    cust_line_uid = (order_obj.get("line_user_id") or "").strip()
    if not cust_line_uid:
        detail = "ลูกค้าไม่ได้สั่งผ่าน LINE (ไม่มี User ID)"
        order_obj["customer_line_notify_status"] = "NO_LINE_UID"
        order_obj["customer_line_notify_detail"] = detail
        return False, detail
    if not line_token:
        detail = "ยังไม่ได้ตั้งค่า LINE Token ในระบบหลังบ้าน"
        record_customer_notify_log(order_obj, "DELIVERY_PROOF", "ส่งรูปหลักฐานไม่สำเร็จ", False, detail)
        return False, detail

    location = html.unescape(order_obj.get("order_type") or "จัดส่งอาหาร")
    room_txt = ""
    if order_obj.get("floor") or order_obj.get("room"):
        room_txt = f" (ชั้น {order_obj.get('floor') or '-'} ห้อง {order_obj.get('room') or '-'})"

    text_msg = (
        f"🛵 อาหารของคุณจัดส่งเรียบร้อยแล้วครับ! 🎉\n"
        f"━━━━━━━━━━━━━━\n"
        f"📦 ออเดอร์: #{order_obj['order_code']}\n"
        f"👤 ลูกค้า: {html.unescape(order_obj.get('customer_name') or 'ลูกค้า')}\n"
        f"📍 พิกัดที่วาง: {location}{room_txt}\n"
        f"📸 ทางร้านแนบรูปหลักฐานการวางอาหารไว้ให้แล้วครับ\n\n"
        f"ขอบคุณที่อุดหนุนแมวอ้วนนะครับ ขอให้อร่อยกับมื้ออาหารครับ! 🙏🐱"
    )

    # Prepare message list
    messages: List[Dict[str, Any]] = [{"type": "text", "text": text_msg}]
    can_attach_image = (
        image_url
        and image_url.startswith("https://")
        and not any(x in image_url for x in ("localhost", "127.0.0.1", "0.0.0.0"))
    )
    if can_attach_image:
        messages.append({
            "type": "image",
            "originalContentUrl": image_url,
            "previewImageUrl": image_url
        })

    # Try sending with image; if LINE rejects image URL (e.g. invalid host), fallback to text-only
    try:
        line_push(line_token, cust_line_uid, messages)
        detail = "ส่งรูปภาพหลักฐานและข้อความสรุปจุดวางเข้า LINE ลูกค้าเรียบร้อยแล้ว ✅" if can_attach_image else "ส่งข้อความสรุปจุดวางเข้า LINE ลูกค้าเรียบร้อยแล้ว ✅"
        record_customer_notify_log(order_obj, "DELIVERY_PROOF", "ส่งรูปหลักฐานสำเร็จ", True, detail)
        return True, detail
    except urllib.error.HTTPError as e:
        err_msg = parse_line_error(e)
        print(f"LINE Push with image failed HTTP {e.code}: {err_msg}, retrying text-only...")
        if can_attach_image:
            try:
                line_push(line_token, cust_line_uid, [{"type": "text", "text": text_msg}])
                detail = "ส่งข้อความเข้า LINE ลูกค้าสำเร็จ (รูปภาพไม่ผ่าน กำลังให้ลูกค้าดูในเว็บแทน) ✅"
                record_customer_notify_log(order_obj, "DELIVERY_PROOF", "ส่งข้อความสำเร็จ", True, detail)
                return True, detail
            except urllib.error.HTTPError as e2:
                err_msg = parse_line_error(e2)
        record_customer_notify_log(order_obj, "DELIVERY_PROOF", "ส่งรูปหลักฐานไม่สำเร็จ", False, f"LINE ปฏิเสธ: {err_msg}")
        return False, f"LINE ปฏิเสธ: {err_msg}"
    except Exception as e:
        err_str = str(e)
        record_customer_notify_log(order_obj, "DELIVERY_PROOF", "ส่งรูปหลักฐานไม่สำเร็จ", False, f"ข้อผิดพลาด: {err_str}")
        return False, f"ข้อผิดพลาด: {err_str}"


def send_order_status_to_customer(store_settings: Dict[str, Any], order_obj: Dict[str, Any], status: str, force: bool = False) -> Tuple[bool, str]:
    """Notify customer when food status changes (COOKING / READY)."""
    line_token = get_customer_line_token(store_settings)
    cust_line_uid = (order_obj.get("line_user_id") or "").strip()
    if not cust_line_uid:
        detail = "ลูกค้าไม่ได้สั่งผ่าน LINE (ไม่มี User ID)"
        order_obj["customer_line_notify_status"] = "NO_LINE_UID"
        order_obj["customer_line_notify_detail"] = detail
        return False, detail
    if not line_token:
        detail = "ยังไม่ได้ตั้งค่า LINE Token ในระบบหลังบ้าน"
        record_customer_notify_log(order_obj, status, f"แจ้ง{status} ไม่สำเร็จ", False, detail)
        return False, detail

    if status == "COOKING":
        if not force and not store_settings.get("notify_customer_cooking", True):
            return False, "ปิดการแจ้งเตือนเริ่มทำอาหารในหน้าตั้งค่า"
        action_title = "แจ้งเริ่มปรุงอาหาร"
        msg = (
            f"🍳 ครัวเริ่มทำอาหารแล้วครับ! #{order_obj['order_code']}\n"
            f"━━━━━━━━━━━━━━\n"
            f"👤 คุณ {html.unescape(order_obj.get('customer_name') or '')}\n"
            f"👨‍🍳 เชฟกำลังปรุงอาหารสดใหม่ ร้อนๆ ให้อย่างพิถีพิถัน\n"
            f"⏳ รอสักครู่นะครับ เมื่อทำเสร็จและนำส่งจะแจ้งเตือนให้ทราบทันทีครับ!"
        )
    elif status == "READY":
        action_title = "แจ้งอาหารเสร็จพร้อมส่ง"
        msg = (
            f"🍱 อาหารของคุณปรุงเสร็จแล้วครับ! #{order_obj['order_code']}\n"
            f"━━━━━━━━━━━━━━\n"
            f"🛵 กำลังนำไปส่งมอบให้ที่: {html.unescape(order_obj.get('order_type') or '')}\n"
            f"เตรียมรอรับความอร่อยได้เลยครับ!"
        )
    else:
        return False, f"ไม่รองรับสถานะ {status}"

    try:
        line_push(line_token, cust_line_uid, [{"type": "text", "text": msg}])
        detail = f"ส่งข้อความแจ้ง{action_title}เข้า LINE ลูกค้าเรียบร้อยแล้ว ✅"
        record_customer_notify_log(order_obj, status, f"{action_title}สำเร็จ", True, detail)
        return True, detail
    except urllib.error.HTTPError as e:
        err_msg = parse_line_error(e)
        record_customer_notify_log(order_obj, status, f"{action_title}ไม่สำเร็จ", False, f"LINE ปฏิเสธ: {err_msg}")
        return False, f"LINE ปฏิเสธ: {err_msg}"
    except Exception as e:
        err_str = str(e)
        record_customer_notify_log(order_obj, status, f"{action_title}ไม่สำเร็จ", False, f"ข้อผิดพลาด: {err_str}")
        return False, f"ข้อผิดพลาด: {err_str}"


def send_notifications(store_settings: Dict[str, Any], order_obj: Dict[str, Any]):
    items_txt = "\n".join(
        f"• {it['quantity']}x {html.unescape(it['name'])}"
        + (f" ({', '.join(html.unescape(m['name']) for m in it.get('modifiers', []))})" if it.get("modifiers") else "")
        + (f" [หมายเหตุ: {html.unescape(it['item_note'])}]" if it.get("item_note") else "")
        for it in order_obj.get("items", [])
    )
    disc_txt = f"🎁 ใช้ส่วนลดสะสมแต้ม: -{order_obj['discount_amount']:.2f} บาท\n" if order_obj.get("discount_amount") else ""
    loc_txt = ""
    if order_obj.get("floor") or order_obj.get("room"):
        loc_txt = f"📍 ชั้น {html.unescape(order_obj.get('floor') or '-')}" + (f" ห้อง {html.unescape(order_obj.get('room'))}" if order_obj.get("room") else "") + "\n"
    msg = (
        f"🔔 ออเดอร์หน้าร้านใหม่! #{order_obj['order_code']}\n"
        f"👤 ลูกค้า: {html.unescape(order_obj['customer_name'])} ({html.unescape(order_obj['order_type'])})\n"
        f"{loc_txt}"
        f"📞 โทร: {html.unescape(order_obj.get('phone') or '-')}\n"
        f"{disc_txt}"
        f"💰 ยอดชำระ: {order_obj['total_money']:.2f} บาท ({order_obj['payment_label']})\n"
        f"🧾 สลิป: {'แนบสลิปแล้ว ✅' if order_obj.get('slip_image') else 'ยังไม่แนบ'}\n"
        f"----------------\n"
        f"{items_txt}"
    )

    line_token = (store_settings.get("line_channel_token") or settings.LINE_CHANNEL_TOKEN).strip()
    line_targets = get_store_line_targets(store_settings)
    if line_token:
        for line_to in line_targets:
            try:
                line_push(line_token, line_to, [{"type": "text", "text": msg}])
            except urllib.error.HTTPError as e:
                err_body = e.read().decode("utf-8", errors="ignore")
                print(f"LINE Push error (store -> {line_to[:6]}…) HTTP {e.code}: {err_body}")
            except Exception as e:
                print(f"LINE Push error (store -> {line_to[:6]}…):", e)

    # Optional: Send customer order confirmation via LINE bot if user ordered with LINE
    cust_line_uid = (order_obj.get("line_user_id") or "").strip()
    cust_token = get_customer_line_token(store_settings)
    if cust_token and cust_line_uid and cust_line_uid not in line_targets:
        try:
            earned = order_obj.get("earned_stamps") or 1
            cust_msg = (
                f"🐱 ร้านแมวอ้วน ได้รับออเดอร์ #{order_obj['order_code']} เรียบร้อยแล้วครับ!\n"
                f"👤 คุณ {html.unescape(order_obj['customer_name'])}\n"
                f"💰 ยอดชำระ: {order_obj['total_money']:.2f} บาท\n"
                f"🍳 กำลังจัดเตรียมความอร่อยให้คุณครับ\n"
                f"⭐️ ได้รับสแตมป์สะสมแต้มเพิ่ม {earned} ดวง (สะสมครบ 10 กล่อง รับส่วนลด 10.-)"
            )
            line_push(cust_token, cust_line_uid, [{"type": "text", "text": cust_msg}])
            record_customer_notify_log(order_obj, "ORDER_CREATED", "ยืนยันรับออเดอร์", True, "ส่งข้อความยืนยันรับออเดอร์เข้า LINE เรียบร้อย ✅")
        except urllib.error.HTTPError as e:
            err_msg = parse_line_error(e)
            record_customer_notify_log(order_obj, "ORDER_CREATED", "ยืนยันรับออเดอร์ไม่สำเร็จ", False, f"LINE ปฏิเสธ: {err_msg}")
        except Exception as e:
            record_customer_notify_log(order_obj, "ORDER_CREATED", "ยืนยันรับออเดอร์ไม่สำเร็จ", False, str(e))
    elif not cust_line_uid:
        order_obj["customer_line_notify_status"] = "NO_LINE_UID"
        order_obj["customer_line_notify_detail"] = "ลูกค้าสั่งผ่านเว็บ (ไม่มี LINE ID)"

    tg_token = (store_settings.get("telegram_bot_token") or settings.TELEGRAM_BOT_TOKEN).strip()
    tg_chat = (store_settings.get("telegram_chat_id") or settings.TELEGRAM_CHAT_ID).strip()
    if tg_token and tg_chat:
        try:
            req = urllib.request.Request(
                f"https://api.telegram.org/bot{tg_token}/sendMessage",
                data=json.dumps({"chat_id": tg_chat, "text": msg}).encode("utf-8"),
                headers={"Content-Type": "application/json"},
                method="POST"
            )
            urllib.request.urlopen(req, timeout=8).read()
        except Exception as e:
            print("Telegram Push error:", e)
