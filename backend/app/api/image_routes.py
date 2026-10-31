from fastapi import APIRouter, HTTPException, Query, Request, Response
from typing import Optional
import hashlib
from ..services.image_service import get_cached_image, get_custom_dish_image

router = APIRouter()

@router.get("/img/custom/{item_id}")
@router.head("/img/custom/{item_id}")
def serve_custom_image(request: Request, item_id: str, v: Optional[str] = Query(None)):
    res = get_custom_dish_image(item_id)
    if not res:
        raise HTTPException(status_code=404, detail="Custom HD image not found")
    img_bytes, content_type = res
    etag = f'"{hashlib.md5(img_bytes[:256]).hexdigest()}"'
    headers = {
        "Content-Type": content_type,
        "Cache-Control": "public, max-age=604800, stale-while-revalidate=86400, immutable" if v else "public, max-age=86400, stale-while-revalidate=86400",
        "ETag": etag,
    }
    if request.headers.get("if-none-match") == etag:
        return Response(status_code=304, headers=headers)
    return Response(content=img_bytes, media_type=content_type, headers=headers)

@router.get("/img/{img_id}")
@router.head("/img/{img_id}")
def serve_image(request: Request, img_id: str, v: Optional[str] = Query(None), refresh: str = Query("0")):
    force_refresh = refresh in ("1", "true")
    res = get_cached_image(img_id, req_v=0, force_refresh=force_refresh)
    if not res:
        raise HTTPException(status_code=404, detail="Image not found")
    img_bytes, content_type = res
    etag = f'"{hashlib.md5(img_bytes[:256]).hexdigest()}"'
    headers = {
        "Content-Type": content_type,
        "Cache-Control": "public, max-age=604800, stale-while-revalidate=86400, immutable" if v else "public, max-age=86400, stale-while-revalidate=86400",
        "ETag": etag,
    }
    if request.headers.get("if-none-match") == etag:
        return Response(status_code=304, headers=headers)
    return Response(content=img_bytes, media_type=content_type, headers=headers)
