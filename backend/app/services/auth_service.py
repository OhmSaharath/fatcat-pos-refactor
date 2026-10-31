import hashlib
import hmac
import html
import re
import time
from typing import Dict, List
from ..config import settings

_RATE_LIMITS: Dict[str, Dict[str, List[float]]] = {
    "order": {},
    "login_fail": {}
}

def _hmac_secret() -> bytes:
    if not settings.ADMIN_HMAC_SECRET:
        raise RuntimeError("ADMIN_HMAC_SECRET is not configured")
    return settings.ADMIN_HMAC_SECRET.encode("utf-8")

def sanitize_text(val: str, max_len: int = 120) -> str:
    if not isinstance(val, str):
        return ""
    cleaned = re.sub(r"[\x00-\x1f\x7f]", "", val).strip()
    return html.escape(cleaned[:max_len], quote=True)

def check_rate_limit(bucket: str, ip: str, max_events: int, window_sec: int) -> bool:
    now = time.time()
    records = _RATE_LIMITS.setdefault(bucket, {}).get(ip, [])
    records = [t for t in records if now - t < window_sec]
    if len(records) >= max_events:
        _RATE_LIMITS[bucket][ip] = records
        return False
    records.append(now)
    _RATE_LIMITS[bucket][ip] = records
    return True

def make_order_token(order_code: str) -> str:
    return hmac.new(
        _hmac_secret(),
        f"order:{order_code}".encode("utf-8"),
        hashlib.sha256
    ).hexdigest()[:24]

def create_admin_token() -> str:
    exp = int(time.time()) + 86400  # 24 hours validity
    msg = f"admin:{exp}"
    sig = hmac.new(
        _hmac_secret(),
        msg.encode("utf-8"),
        hashlib.sha256
    ).hexdigest()
    return f"{exp}.{sig}"

def verify_admin_token(token_str: str) -> bool:
    if not settings.ADMIN_HMAC_SECRET or not token_str or "." not in token_str:
        return False
    try:
        exp_str, sig = token_str.split(".", 1)
        exp = int(exp_str)
        if time.time() > exp:
            return False
        expected = hmac.new(
            _hmac_secret(),
            f"admin:{exp}".encode("utf-8"),
            hashlib.sha256
        ).hexdigest()
        return hmac.compare_digest(sig, expected)
    except Exception:
        return False

def is_floor_7(floor_str: str) -> bool:
    cleaned = (floor_str or "").strip()
    return bool(re.search(r"^\s*(ชั้น|floor|fl\.?)?\s*7\s*$", cleaned, re.I))
