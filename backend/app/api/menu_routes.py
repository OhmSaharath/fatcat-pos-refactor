from fastapi import APIRouter, Query, Response, HTTPException
from typing import Optional
from ..storage.repository import repository
from ..services.loyverse_service import fetch_front_store_menu

router = APIRouter()

@router.get("/store-state")
@router.get("/state")
def get_store_state(response: Response):
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate, max-age=0"
    state = repository.get_state()
    settings = state["settings"]
    public_settings = {
        "is_open": bool(settings.get("is_open", True)),
        "store_name": settings.get("store_name", ""),
        "closed_message": settings.get("closed_message", ""),
        "announcement": settings.get("announcement", ""),
        "promptpay_name": settings.get("promptpay_name", ""),
        "line_liff_id": settings.get("line_liff_id", ""),
    }
    return {"ok": True, "state": public_settings}

@router.get("/menu")
@router.get("/items")
def get_menu(response: Response, refresh: Optional[str] = Query("0")):
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate, max-age=0"
    force = refresh in ("1", "true")
    try:
        data = fetch_front_store_menu(force=force)
        state = repository.get_state()
        settings = state["settings"]

        visible_items = [it for it in data.get("items", []) if not it.get("is_hidden")]
        visible_cat_ids = {it["category_id"] for it in visible_items if it.get("category_id")}
        visible_categories = [c for c in data.get("categories", []) if c["id"] in visible_cat_ids]

        customer_data = {
            "categories": visible_categories,
            "items": visible_items,
            "updated_at": data.get("updated_at"),
            "showcase_dishes": state.get("showcase_dishes", []),
        }
        public_settings = {
            "is_open": bool(settings.get("is_open", True)),
            "store_name": settings.get("store_name", ""),
            "closed_message": settings.get("closed_message", ""),
            "announcement": settings.get("announcement", ""),
            "promptpay_name": settings.get("promptpay_name", ""),
            "line_liff_id": settings.get("line_liff_id", ""),
        }
        return {"ok": True, "settings": public_settings, **customer_data}
    except Exception as e:
        raise HTTPException(status_code=500, detail="ไม่สามารถดึงข้อมูลเมนูได้ในขณะนี้")
