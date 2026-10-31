import io
import urllib.parse
import urllib.request
from typing import Dict, Optional
from ..config import settings

try:
    import qrcode
    HAS_QRCODE = True
except ImportError:
    HAS_QRCODE = False

# High-speed in-memory cache for QR PNG bytes
_QR_CACHE: Dict[str, bytes] = {}

def _crc16_ccitt(data_str: str) -> str:
    crc = 0xFFFF
    for ch in data_str.encode("ascii"):
        crc ^= (ch << 8)
        for _ in range(8):
            if crc & 0x8000:
                crc = ((crc << 1) ^ 0x1021) & 0xFFFF
            else:
                crc = (crc << 1) & 0xFFFF
    return f"{crc:04X}"

def _tlv(tag: str, val: str) -> str:
    return f"{tag}{len(val):02d}{val}"

def generate_promptpay_payload(promptpay_id: str, amount: Optional[float] = None) -> str:
    has_amt = amount is not None and float(amount) > 0
    if settings.THUNG_NGERN_TAG30:
        payload = (
            _tlv("00", "01")
            + _tlv("01", "12" if has_amt else "11")
            + _tlv("30", settings.THUNG_NGERN_TAG30)
            + _tlv("53", "764")
        )
        if has_amt:
            payload += _tlv("54", f"{float(amount):.2f}")
        payload += _tlv("58", "TH")
        if settings.THUNG_NGERN_TAG62:
            payload += _tlv("62", settings.THUNG_NGERN_TAG62)
        payload += "6304"
        payload += _crc16_ccitt(payload)
        return payload

    target = "".join(ch for ch in str(promptpay_id) if ch.isdigit())
    if len(target) >= 13:
        acc_field = _tlv("02", target[:13])
    else:
        if target.startswith("0"):
            target = "0066" + target[1:]
        acc_field = _tlv("01", target)

    merchant_info = _tlv("00", "A000000677010111") + acc_field
    payload = (
        _tlv("00", "01")
        + _tlv("01", "12" if has_amt else "11")
        + _tlv("29", merchant_info)
        + _tlv("53", "764")
    )
    if has_amt:
        amt_str = f"{float(amount):.2f}"
        payload += _tlv("54", amt_str)
    payload += _tlv("58", "TH") + "6304"
    payload += _crc16_ccitt(payload)
    return payload

def fetch_qr_png_bytes(payload_str: str) -> bytes:
    """Generate or retrieve PromptPay QR code PNG (instant local offline generation)."""
    # 1. In-memory Cache Hit (< 0.1ms)
    if payload_str in _QR_CACHE:
        return _QR_CACHE[payload_str]

    # 2. Instant Local Offline Generation via Pillow & qrcode library (0 network call)
    if HAS_QRCODE:
        try:
            qr = qrcode.QRCode(
                version=None,
                error_correction=qrcode.constants.ERROR_CORRECT_M,
                box_size=10,
                border=2,
            )
            qr.add_data(payload_str)
            qr.make(fit=True)
            img = qr.make_image(fill_color="black", back_color="white")
            buf = io.BytesIO()
            img.save(buf, format="PNG")
            png_bytes = buf.getvalue()
            _QR_CACHE[payload_str] = png_bytes
            return png_bytes
        except Exception:
            pass

    # 3. Fallback to external APIs if qrcode package is missing
    encoded = urllib.parse.quote(payload_str, safe="")
    qr_url = f"https://api.qrserver.com/v1/create-qr-code/?size=500x500&margin=24&format=png&data={encoded}"
    try:
        req = urllib.request.Request(qr_url, headers={"User-Agent": "FatCatPOS/2.0"})
        with urllib.request.urlopen(req, timeout=5) as resp:
            png_bytes = resp.read()
            _QR_CACHE[payload_str] = png_bytes
            return png_bytes
    except Exception:
        fallback_url = f"https://quickchart.io/qr?text={encoded}&size=500&margin=2"
        req2 = urllib.request.Request(fallback_url, headers={"User-Agent": "FatCatPOS/2.0"})
        with urllib.request.urlopen(req2, timeout=5) as resp2:
            png_bytes = resp2.read()
            _QR_CACHE[payload_str] = png_bytes
            return png_bytes
