from fastapi import APIRouter, Query, Response, HTTPException
from ..config import settings
from ..storage.repository import repository
from ..services.promptpay_service import generate_promptpay_payload, fetch_qr_png_bytes

router = APIRouter()

@router.get("/promptpay-qr")
def get_promptpay_qr(amount: float = Query(0.0)):
    if amount < 0 or amount > 100000:
        raise HTTPException(status_code=400, detail="จำนวนเงินไม่ถูกต้อง")
    state = repository.get_state()
    pp_id = state["settings"].get("promptpay_id") or settings.PROMPTPAY_ID
    payload_str = generate_promptpay_payload(pp_id, amount)
    masked_pp = pp_id[:3] + "-xxx-" + pp_id[-4:] if len(pp_id) >= 10 else pp_id
    return {
        "ok": True,
        "promptpay_masked": masked_pp,
        "promptpay_name": state["settings"].get("promptpay_name", settings.PROMPTPAY_NAME),
        "amount": round(amount, 2),
        "qr_payload": payload_str,
        "qr_image_url": f"/api/promptpay-qr-image?amount={amount:.2f}"
    }

@router.get("/promptpay-qr-image")
def get_promptpay_qr_image(amount: float = Query(0.0), download: str = Query("0")):
    if amount < 0 or amount > 100000:
        raise HTTPException(status_code=400, detail="จำนวนเงินไม่ถูกต้อง")
    state = repository.get_state()
    pp_id = state["settings"].get("promptpay_id") or settings.PROMPTPAY_ID
    payload_str = generate_promptpay_payload(pp_id, amount)
    png_bytes = fetch_qr_png_bytes(payload_str)

    headers = {"Cache-Control": "public, max-age=3600, stale-while-revalidate=86400"}
    if download in ("1", "true"):
        fname = f"fatcat-qr-{amount:.2f}baht.png"
        headers["Content-Disposition"] = f'attachment; filename="{fname}"'

    return Response(content=png_bytes, media_type="image/png", headers=headers)
