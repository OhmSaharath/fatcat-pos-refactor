import os
from pathlib import Path
from datetime import datetime, timezone, timedelta
from pydantic import BaseModel, ConfigDict

THAI_TZ = timezone(timedelta(hours=7))

def get_thai_time_str() -> str:
    """Return formatted current time in Thailand (UTC+7 / Asia/Bangkok)."""
    return datetime.now(THAI_TZ).strftime("%Y-%m-%d %H:%M:%S")

# Base directories
BACKEND_DIR = Path(__file__).resolve().parent.parent
PROJECT_DIR = BACKEND_DIR.parent
ENV_FILE = BACKEND_DIR / ".env"
FALLBACK_ENV = PROJECT_DIR.parent / "fatcat-web-order" / ".env"

def load_dotenv_file(filepath: Path):
    if not filepath.exists():
        return
    with open(filepath, "r", encoding="utf-8") as f:
        for raw_line in f:
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, val = line.split("=", 1)
            key = key.strip()
            val = val.strip().strip('"').strip("'")
            if key and key not in os.environ:
                os.environ[key] = val

# Auto-load .env
if ENV_FILE.exists():
    load_dotenv_file(ENV_FILE)
elif FALLBACK_ENV.exists():
    load_dotenv_file(FALLBACK_ENV)

class Settings(BaseModel):
    model_config = ConfigDict(extra="allow")

    # App Settings
    APP_NAME: str = "FatCat Ordering API"
    VERSION: str = "2.0.0"
    ENV: str = os.environ.get("ENV", "development").strip().lower()
    HOST: str = os.environ.get("HOST", "0.0.0.0")
    PORT: int = int(os.environ.get("PORT", "8765"))
    PROJECT_DIR: Path = PROJECT_DIR
    BACKEND_DIR: Path = BACKEND_DIR
    IS_VERCEL: bool = bool(os.environ.get("VERCEL"))
    DATA_DIR: Path = Path("/tmp/data") if bool(os.environ.get("VERCEL")) else BACKEND_DIR / "data"
    IMG_CACHE_DIR: Path = Path("/tmp/data/img_cache") if bool(os.environ.get("VERCEL")) else BACKEND_DIR / "data" / "img_cache"
    CUSTOM_IMG_DIR: Path = Path("/tmp/data/custom_images") if bool(os.environ.get("VERCEL")) else BACKEND_DIR / "data" / "custom_images"
    STATE_FILE: Path = Path("/tmp/data/store_state.json") if bool(os.environ.get("VERCEL")) else BACKEND_DIR / "data" / "store_state.json"
    SLIP_VERIFIER_BIN: Path = BACKEND_DIR / "slip_verifier"

    # Loyverse Configuration
    LOYVERSE_TOKEN: str = os.environ.get("LOYVERSE_TOKEN", "").strip()
    LOYVERSE_BASE_URL: str = os.environ.get("LOYVERSE_BASE_URL", "https://api.loyverse.com/v1.0").strip()
    LOYVERSE_STORE_ID: str = os.environ.get("LOYVERSE_STORE_ID", "").strip()
    LOYVERSE_POS_DEVICE_ID: str = os.environ.get("LOYVERSE_POS_DEVICE_ID", "").strip()
    LOYVERSE_EMPLOYEE_ID: str = os.environ.get("LOYVERSE_EMPLOYEE_ID", "").strip()
    EMPLOYEE_ID: str = os.environ.get("LOYVERSE_EMPLOYEE_ID", "").strip() or os.environ.get("EMPLOYEE_ID", "").strip()

    # Payment Configuration
    PAYMENT_TYPE_QR: str = os.environ.get("PAYMENT_TYPE_QR", "").strip()
    PAYMENT_TYPE_THAI_CHUAY_THAI: str = os.environ.get("PAYMENT_TYPE_THAI_CHUAY_THAI", "").strip() or os.environ.get("PAYMENT_TYPE_QR", "").strip()
    PAYMENT_TYPE_CASH: str = os.environ.get("PAYMENT_TYPE_CASH", "").strip()
    PROMPTPAY_ID: str = os.environ.get("PROMPTPAY_ID", "").strip()
    PROMPTPAY_NAME: str = os.environ.get("PROMPTPAY_NAME", "ร้านแมวอ้วน").strip()
    THUNG_NGERN_TAG30: str = os.environ.get("THUNG_NGERN_TAG30", "").strip()
    THUNG_NGERN_TAG62: str = os.environ.get("THUNG_NGERN_TAG62", "07040000").strip()
    CONDO_DELIVERY_FEE: float = float(os.environ.get("CONDO_DELIVERY_FEE", "5.0") or 5.0)
    CONDO_DELIVERY_VARIANT_ID: str = os.environ.get("CONDO_DELIVERY_VARIANT_ID", "").strip()

    # Security & Auth
    ADMIN_PASSWORD: str = os.environ.get("ADMIN_PASSWORD", "").strip()
    ADMIN_HMAC_SECRET: str = os.environ.get("ADMIN_HMAC_SECRET", "").strip()

    # External Integrations
    LINE_LIFF_ID: str = os.environ.get("LINE_LIFF_ID", "").strip()
    LINE_CHANNEL_TOKEN: str = os.environ.get("LINE_CHANNEL_TOKEN", "").strip()
    LINE_TARGET_ID: str = os.environ.get("LINE_TARGET_ID", "").strip()
    TELEGRAM_BOT_TOKEN: str = os.environ.get("TELEGRAM_BOT_TOKEN", "").strip()
    TELEGRAM_CHAT_ID: str = os.environ.get("TELEGRAM_CHAT_ID", "").strip()
    SUPABASE_URL: str = os.environ.get("SUPABASE_URL", "").strip()
    SUPABASE_KEY: str = os.environ.get("SUPABASE_KEY", "").strip()

settings = Settings()

if settings.ENV == "production" or settings.IS_VERCEL:
    missing_security_settings = [
        name
        for name, value in (
            ("ADMIN_PASSWORD", settings.ADMIN_PASSWORD),
            ("ADMIN_HMAC_SECRET", settings.ADMIN_HMAC_SECRET),
        )
        if not value
    ]
    if missing_security_settings:
        raise RuntimeError(
            "Missing required production security settings: "
            + ", ".join(missing_security_settings)
        )

try:
    settings.DATA_DIR.mkdir(parents=True, exist_ok=True)
    settings.IMG_CACHE_DIR.mkdir(parents=True, exist_ok=True)
    settings.CUSTOM_IMG_DIR.mkdir(parents=True, exist_ok=True)
    if settings.IS_VERCEL and not settings.STATE_FILE.exists():
        orig = settings.BACKEND_DIR / "data" / "store_state.json"
        if orig.exists():
            import shutil
            try:
                shutil.copy2(orig, settings.STATE_FILE)
            except Exception:
                pass
except Exception as e:
    print(f"Directory initialization warning: {e}")
