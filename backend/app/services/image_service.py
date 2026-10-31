import io
import os
import re
import urllib.request
import hashlib
from concurrent.futures import ThreadPoolExecutor
import threading
from typing import Dict, Optional, Tuple
from pathlib import Path
from ..config import settings

try:
    from PIL import Image, ImageEnhance
    HAS_PIL = True
except ImportError:
    HAS_PIL = False

# High-speed in-memory RAM cache for instant (0.1ms) image serving
_RAM_CACHE: Dict[str, Tuple[bytes, str]] = {}

def make_square_1to1(img: Image.Image) -> Image.Image:
    """Pad non-square landscape or portrait photos into a perfect 1:1 square canvas.
    This prevents CSS object-cover from aggressively zooming in and cutting off meal boxes/packaging."""
    w, h = img.size
    ratio = w / h
    # If already virtually 1:1 square (within 2%), leave untouched
    if 0.98 <= ratio <= 1.02:
        return img

    max_side = max(w, h)

    def _median_color(samples):
        if not samples:
            return (250, 247, 243)
        r = sorted([s[0] for s in samples])[len(samples) // 2]
        g = sorted([s[1] for s in samples])[len(samples) // 2]
        b = sorted([s[2] for s in samples])[len(samples) // 2]
        return (r, g, b)

    if w > h:
        # Wide landscape image: add top and bottom padding matching the container edge colors
        pad_total = max_side - h
        pad_top = pad_total // 2
        pad_bot = pad_total - pad_top

        sample_rows = min(4, h)
        top_samples = [img.getpixel((x, y)) for x in range(w) for y in range(sample_rows)]
        bot_samples = [img.getpixel((x, h - 1 - y)) for x in range(w) for y in range(sample_rows)]

        top_color = _median_color(top_samples)
        bot_color = _median_color(bot_samples)

        canvas = Image.new("RGB", (max_side, max_side), top_color)
        bot_fill = Image.new("RGB", (max_side, pad_bot), bot_color)
        canvas.paste(bot_fill, (0, pad_top + h))
        canvas.paste(img, (0, pad_top))
        return canvas
    else:
        # Tall portrait image: add left and right padding matching the container edge colors
        pad_total = max_side - w
        pad_left = pad_total // 2
        pad_right = pad_total - pad_left

        sample_cols = min(4, w)
        left_samples = [img.getpixel((x, y)) for x in range(sample_cols) for y in range(h)]
        right_samples = [img.getpixel((w - 1 - x, y)) for x in range(sample_cols) for y in range(h)]

        left_color = _median_color(left_samples)
        right_color = _median_color(right_samples)

        canvas = Image.new("RGB", (max_side, max_side), left_color)
        right_fill = Image.new("RGB", (pad_right, max_side), right_color)
        canvas.paste(right_fill, (pad_left + w, 0))
        canvas.paste(img, (pad_left, 0))
        return canvas

def optimize_image_bytes(raw_bytes: bytes) -> Tuple[bytes, str]:
    """Enhance sharpness, micro-contrast, ensure 1:1 square aspect ratio, downscale, and encode fast WebP."""
    if not HAS_PIL:
        return raw_bytes, "image/jpeg"
    try:
        img = Image.open(io.BytesIO(raw_bytes))
        if img.mode in ("RGBA", "P"):
            img = img.convert("RGB")

        # Automatically square non-square photos to preserve full packaging and dish context
        img = make_square_1to1(img)

        # Downscale oversized Loyverse images down to 800px max (Retina crisp, low RAM/transfer)
        if img.width > 800 or img.height > 800:
            img.thumbnail((800, 800), Image.Resampling.LANCZOS)

        # Smart Unsharp Mask & Micro-contrast Enhancement
        enhancer = ImageEnhance.Sharpness(img)
        img_sharp = enhancer.enhance(1.30)
        contrast = ImageEnhance.Contrast(img_sharp)
        img_final = contrast.enhance(1.03)

        # High-speed WebP encoding: method=3 (20x faster than method=6 on Render)
        buf = io.BytesIO()
        try:
            img_final.save(buf, format="WEBP", quality=85, method=3)
            return buf.getvalue(), "image/webp"
        except Exception:
            buf = io.BytesIO()
            img_final.save(buf, format="JPEG", quality=85, optimize=True)
            return buf.getvalue(), "image/jpeg"
    except Exception:
        return raw_bytes, "image/jpeg"

def fetch_image_from_loyverse(img_id: str) -> Optional[Tuple[bytes, str]]:
    if not re.match(r"^[a-zA-Z0-9\-]+$", img_id):
        return None
    target_url = f"https://api.loyverse.com/image/{img_id}"
    try:
        req = urllib.request.Request(target_url, headers={"User-Agent": "FatCatPOS/2.0"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            raw_data = resp.read()
        opt_bytes, opt_type = optimize_image_bytes(raw_data)
        cache_file = settings.IMG_CACHE_DIR / img_id
        try:
            with open(cache_file, "wb") as f:
                f.write(opt_bytes)
        except Exception:
            pass
        _RAM_CACHE[img_id] = (opt_bytes, opt_type)
        return opt_bytes, opt_type
    except Exception:
        return None

def get_cached_image(img_id: str, req_v: int = 0, force_refresh: bool = False) -> Optional[Tuple[bytes, str]]:
    # 1. RAM Cache Hit (Fastest: < 0.1ms)
    if not force_refresh and img_id in _RAM_CACHE:
        return _RAM_CACHE[img_id]

    cache_file = settings.IMG_CACHE_DIR / img_id

    # 2. Disk Cache Hit (Fast: < 1ms)
    if not force_refresh and cache_file.is_file():
        try:
            if cache_file.stat().st_size > 0:
                with open(cache_file, "rb") as f:
                    img_bytes = f.read()

                # Verify aspect ratio: if legacy cache has non-square image, auto-square to 1:1
                if HAS_PIL:
                    try:
                        chk = Image.open(io.BytesIO(img_bytes))
                        ratio = chk.width / chk.height
                        if ratio < 0.98 or ratio > 1.02:
                            opt_bytes, opt_type = optimize_image_bytes(img_bytes)
                            with open(cache_file, "wb") as f:
                                f.write(opt_bytes)
                            img_bytes = opt_bytes
                    except Exception:
                        pass

                content_type = "image/jpeg"
                if img_bytes.startswith(b"RIFF") and b"WEBP" in img_bytes[:16]:
                    content_type = "image/webp"
                elif img_bytes.startswith(b"\x89PNG"):
                    content_type = "image/png"
                elif img_bytes.startswith(b"GIF"):
                    content_type = "image/gif"
                _RAM_CACHE[img_id] = (img_bytes, content_type)
                return img_bytes, content_type
        except Exception:
            pass

    # 3. Fetch from Loyverse (Only when not in cache or force_refresh requested)
    res = fetch_image_from_loyverse(img_id)
    if res:
        _RAM_CACHE[img_id] = res
    return res

# --- Method 3: Studio High-Res Image Override System ---

def get_custom_dish_image(item_id: str) -> Optional[Tuple[bytes, str]]:
    """Retrieve custom studio HD image for a dish if uploaded."""
    clean_id = re.sub(r"[^a-zA-Z0-9_\-]", "", item_id)
    cache_key = f"custom_{clean_id}"
    if cache_key in _RAM_CACHE:
        return _RAM_CACHE[cache_key]

    static_dir = Path(__file__).resolve().parent.parent / "static" / "custom_images"
    frontend_public_dir = Path(__file__).resolve().parent.parent.parent / "frontend" / "public" / "custom_dishes"

    candidate_dirs = [settings.CUSTOM_IMG_DIR, static_dir, frontend_public_dir]

    for d in candidate_dirs:
        target_webp = d / f"{clean_id}.webp"
        if target_webp.is_file():
            try:
                with open(target_webp, "rb") as f:
                    res = (f.read(), "image/webp")
                    _RAM_CACHE[cache_key] = res
                    return res
            except Exception:
                pass

        target_jpg = d / f"{clean_id}.jpg"
        if target_jpg.is_file():
            try:
                with open(target_jpg, "rb") as f:
                    res = (f.read(), "image/jpeg")
                    _RAM_CACHE[cache_key] = res
                    return res
            except Exception:
                pass
    return None

def save_custom_dish_image(item_id: str, raw_bytes: bytes) -> Tuple[bool, str]:
    """Process and save an uploaded studio HD image (up to 1200x1200px WebP)."""
    clean_id = re.sub(r"[^a-zA-Z0-9_\-]", "", item_id)
    if not clean_id:
        return False, "Invalid item ID"
    try:
        if HAS_PIL:
            img = Image.open(io.BytesIO(raw_bytes))
            if img.mode in ("RGBA", "P"):
                img = img.convert("RGB")
            img = make_square_1to1(img)
            img.thumbnail((1200, 1200), Image.Resampling.LANCZOS)
            contrast = ImageEnhance.Contrast(img)
            img_final = contrast.enhance(1.02)

            target_path = settings.CUSTOM_IMG_DIR / f"{clean_id}.webp"
            img_final.save(target_path, format="WEBP", quality=90, method=3)
        else:
            target_path = settings.CUSTOM_IMG_DIR / f"{clean_id}.webp"
            with open(target_path, "wb") as f:
                f.write(raw_bytes)

        _RAM_CACHE.pop(f"custom_{clean_id}", None)
        custom_url = f"/api/img/custom/{clean_id}?v={int(os.path.getmtime(target_path))}"
        return True, custom_url
    except Exception as e:
        return False, str(e)

def delete_custom_dish_image(item_id: str) -> bool:
    """Revert a dish image back to Loyverse Cloud."""
    clean_id = re.sub(r"[^a-zA-Z0-9_\-]", "", item_id)
    _RAM_CACHE.pop(f"custom_{clean_id}", None)
    deleted = False
    for ext in (".webp", ".jpg", ".png"):
        p = settings.CUSTOM_IMG_DIR / f"{clean_id}{ext}"
        if p.is_file():
            try:
                p.unlink()
                deleted = True
            except Exception:
                pass
    return deleted

def prewarm_image_cache(items: list):
    """Background prewarm to pull all items into disk & RAM cache concurrently."""
    def _worker():
        targets = []
        for it in items:
            img_url = it.get("image_url", "")
            if img_url.startswith("/api/img/") and not img_url.startswith("/api/img/custom/"):
                clean = img_url.replace("/api/img/", "").strip()
                u = clean.split("?")[0].strip()
                v = 0
                if "?v=" in clean:
                    try:
                        v = int(clean.split("?v=")[-1].split("&")[0])
                    except Exception:
                        v = 0
                if u and not any(t[0] == u for t in targets):
                    targets.append((u, v))
        with ThreadPoolExecutor(max_workers=6) as executor:
            list(executor.map(lambda t: get_cached_image(t[0], t[1]), targets))

    threading.Thread(target=_worker, daemon=True).start()
