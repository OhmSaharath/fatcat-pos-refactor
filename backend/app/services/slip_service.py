import base64
import hashlib
import io
import json
import os
import subprocess
import tempfile
from typing import Any, Dict, List
from ..config import settings

try:
    import zxingcpp
    HAS_ZXING = True
except ImportError:
    HAS_ZXING = False

try:
    from PIL import Image
    HAS_PIL = True
except ImportError:
    HAS_PIL = False

BANK_NAMES: Dict[str, str] = {
    "002": "ธ.กรุงเทพ (BBL)",
    "004": "ธ.กสิกรไทย (KBANK)",
    "006": "ธ.กรุงไทย (KTB)",
    "011": "ธ.ทหารไทยธนชาต (TTB)",
    "014": "ธ.ไทยพาณิชย์ (SCB)",
    "025": "ธ.กรุงศรีอยุธยา (BAY)",
    "030": "ธ.ออมสิน (GSB)",
    "034": "ธ.ก.ส. (BAAC)",
    "069": "ธ.เกียรตินาคินภัทร (KKP)",
    "073": "ธ.แลนด์ แอนด์ เฮ้าส์ (LH)",
}

def parse_thai_bank_slip_qr(qr_text: str) -> Dict[str, Any]:
    """Parse official PromptPay / Thai Bank Mini-QR standard payload."""
    if not qr_text:
        return {"has_bank_qr": False, "bank_name": "", "ref_id": "", "raw": ""}

    bank_code = ""
    ref_id = ""

    # Check for official Thai bank Mini-QR standard: Tag 00 contains Sub-TLVs
    if qr_text.startswith("00") and "000001" in qr_text[:20]:
        sub_str = qr_text[4:]  # Skip outer tag 00 and length
        idx = 0
        while idx < len(sub_str) - 4:
            tag = sub_str[idx:idx + 2]
            try:
                length = int(sub_str[idx + 2:idx + 4])
                val = sub_str[idx + 4:idx + 4 + length]
                if tag == "01":
                    bank_code = val
                elif tag == "02":
                    ref_id = val
                idx += 4 + length
            except Exception:
                break

    if not ref_id:
        # Fallback to tail reference string if non-standard or URL
        ref_id = qr_text[-25:]

    bank_name = BANK_NAMES.get(bank_code, f"ธนาคารรหัส {bank_code}" if bank_code else "ธนาคาร")
    return {
        "has_bank_qr": bool(ref_id),
        "bank_code": bank_code,
        "bank_name": bank_name,
        "ref_id": ref_id,
        "raw": qr_text,
    }

def verify_and_inspect_slip(slip_data_url: str, expected_amount: float, existing_orders: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    3-Layer Anti-Replay & Vision AI Slip Verification:
    1. SHA-256 hash of raw image bytes (blocks exact duplicate image reuse).
    2. Cross-platform ZXing-C++ QR Barcode extraction (detects official Bank Mini-QR).
    3. Anti-replay duplicate reference check & store payment QR safeguard.
    """
    try:
        header, b64_part = slip_data_url.split(",", 1)
        img_bytes = base64.b64decode(b64_part)
    except Exception:
        return {"ok": False, "error": "รูปแบบไฟล์รูปสลิปไม่ถูกต้อง"}

    if len(img_bytes) < 500:
        return {"ok": False, "error": "ไฟล์รูปสลิปมีขนาดเล็กผิดปกติ กรุณาแนบรูปสลิปจริง"}

    slip_sha256 = hashlib.sha256(img_bytes).hexdigest()

    # Check 1: Exact image hash replay check
    for old_ord in existing_orders:
        if old_ord.get("status") == "CANCELLED":
            continue
        if old_ord.get("slip_sha256") and old_ord.get("slip_sha256") == slip_sha256:
            return {
                "ok": False,
                "error": f"❌ สลิปนี้เคยถูกใช้สั่งอาหารไปแล้วในออเดอร์ #{old_ord['order_code']} ห้ามนำสลิปเก่ามาใช้ซ้ำครับ!"
            }

    qr_refs: List[str] = []
    ocr_text = ""

    # Method 2A: High-Speed In-Process ZXing-C++ QR Scanner (Cross-platform Linux/macOS)
    if HAS_ZXING and HAS_PIL:
        try:
            pil_img = Image.open(io.BytesIO(img_bytes))
            results = zxingcpp.read_barcodes(pil_img)
            for r in results:
                if r.text:
                    qr_refs.append(r.text.strip())
        except Exception as e:
            print("zxing barcode scan warning:", e)

    # Method 2B: Fallback to macOS Vision Binary if present and ZXing found nothing
    bin_path = settings.SLIP_VERIFIER_BIN
    if not bin_path.exists():
        fallback_bin = settings.BACKEND_DIR.parent.parent / "fatcat-web-order" / "slip_verifier"
        if fallback_bin.exists():
            bin_path = fallback_bin

    if bin_path.exists() and (not qr_refs or not ocr_text):
        tmp_path = None
        try:
            with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as tf:
                tf.write(img_bytes)
                tmp_path = tf.name
            proc = subprocess.run(
                [str(bin_path), tmp_path],
                capture_output=True,
                text=True,
                timeout=10
            )
            if proc.stdout:
                parsed_v = json.loads(proc.stdout.strip())
                if parsed_v.get("ok"):
                    if not qr_refs:
                        qr_refs = parsed_v.get("qrs") or []
                    ocr_text = parsed_v.get("text") or ""
        except Exception as e:
            print("slip_verifier warning:", e)
        finally:
            if tmp_path and os.path.exists(tmp_path):
                try:
                    os.remove(tmp_path)
                except Exception:
                    pass

    # Check 2: Reject store's own Thung Ngern QR
    for qr in qr_refs:
        if "XQ112990H30532501LW" in qr or (settings.THUNG_NGERN_TAG30 and settings.THUNG_NGERN_TAG30 in qr):
            return {
                "ok": False,
                "error": "❌ รูปที่แนบเป็นรูป QR รับเงินของร้าน ไม่ใช่สลิปโอนเงินครับ กรุณาแนบรูปสลิปหลังโอนสำเร็จ"
            }

    primary_qr_raw = qr_refs[0] if qr_refs else ""
    bank_info = parse_thai_bank_slip_qr(primary_qr_raw) if primary_qr_raw else {}
    bank_ref = bank_info.get("ref_id") or primary_qr_raw

    # Check 3: Reject duplicate bank QR ref (prevents re-screenshotted slips)
    if bank_ref:
        for old_ord in existing_orders:
            if old_ord.get("status") == "CANCELLED":
                continue
            old_ref = old_ord.get("slip_qr_ref") or ""
            if old_ref and (old_ref == bank_ref or old_ref == primary_qr_raw):
                return {
                    "ok": False,
                    "error": f"❌ รหัสอ้างอิงธนาคารบนสลิปนี้ ({bank_ref}) เคยถูกใช้ไปแล้วในออเดอร์ #{old_ord['order_code']} ห้ามใช้สลิปเก่าซ้ำครับ!"
                }

    amt_str_2dec = f"{float(expected_amount):.2f}"
    amt_str_int = f"{int(expected_amount)}" if float(expected_amount).is_integer() else amt_str_2dec
    amount_matched = (amt_str_2dec in ocr_text) or (f"{amt_str_int}.00" in ocr_text) if ocr_text else False
    recipient_keywords = ["ศรัญญา", "ประกอบมูล", "แมวอ้วน", "SARANYA", "PRAKOBMOO", "XQ11299"]
    recipient_matched = any(kw.lower() in ocr_text.lower() for kw in recipient_keywords) if ocr_text else False

    qr_label = f"{bank_info.get('bank_name', '')} {bank_ref}" if bank_info.get("bank_name") else bank_ref

    return {
        "ok": True,
        "slip_sha256": slip_sha256,
        "slip_qr_ref": bank_ref or primary_qr_raw,
        "verification": {
            "is_unique": True,
            "has_bank_qr": bool(primary_qr_raw),
            "bank_name": bank_info.get("bank_name", ""),
            "bank_ref": bank_ref,
            "qr_ref_short": qr_label or "",
            "amount_matched": amount_matched,
            "recipient_matched": recipient_matched,
        }
    }
