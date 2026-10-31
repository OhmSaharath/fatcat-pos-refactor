from collections import Counter
from datetime import datetime
import html
import json
import re
import time
import urllib.request
import urllib.error
from typing import Any, Dict, List, Optional, Tuple
from ..config import settings
from ..storage.repository import repository
from .image_service import prewarm_image_cache
from .auth_service import is_floor_7

_MENU_CACHE: Dict[str, Any] = {
    "menu": None,
    "variant_lookup": {},
    "timestamp": 0
}

def loyverse_req(endpoint: str, data: Optional[Dict[str, Any]] = None, method: str = "GET") -> Dict[str, Any]:
    url = f"{settings.LOYVERSE_BASE_URL}/{endpoint}"
    encoded = json.dumps(data).encode("utf-8") if data is not None else None
    req = urllib.request.Request(
        url,
        data=encoded,
        headers={
            "Authorization": f"Bearer {settings.LOYVERSE_TOKEN}",
            "Content-Type": "application/json",
        },
        method=method,
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            body = resp.read().decode("utf-8")
            return json.loads(body) if body else {}
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8", errors="ignore")
        try:
            err_json = json.loads(err_body)
            err_details = [x.get("details") or x.get("message") or str(x) for x in err_json.get("errors", [])]
            msg = " / ".join(filter(None, err_details)) or err_body
        except Exception:
            msg = err_body
        raise RuntimeError(f"Loyverse ปฏิเสธ (HTTP {e.code}): {msg}")

def resolve_store_price(variant: Dict[str, Any]) -> float:
    for st in variant.get("stores", []):
        if st.get("store_id") == settings.LOYVERSE_STORE_ID:
            if st.get("pricing_type") == "FIXED" and st.get("price") is not None:
                return float(st["price"])
    if variant.get("default_pricing_type") == "FIXED" and variant.get("default_price") is not None:
        return float(variant["default_price"])
    return 0.0

def clean_item_name(name: str) -> str:
    return (
        name.replace("(หน้าร้าน)", "")
        .replace("(เดลิเวอรี่)", "")
        .replace("(เดลิเวอรี)", "")
        .replace("(ข้าวไข่ข้น 49 บาท)", "")
        .replace("(ข้าวไข่ข้น)", "")
        .strip()
    )

def normalize_dish_key(name: str) -> str:
    import unicodedata, re
    n = unicodedata.normalize("NFKD", name or "")
    n = (
        n.replace("(หน้าร้าน)", "")
        .replace("(เดลิเวอรี่)", "")
        .replace("(เดลิเวอรี)", "")
        .replace("(ข้าวไข่ข้น 49 บาท)", "")
        .replace("(ข้าวไข่ข้น)", "")
    )
    return re.sub(r"\s+", " ", n).strip()

EXTRA_FRONT_STORE_ITEM_IDS = {
    "b7739b25-4f78-4c13-82a5-9c9a9d3fe597",  # สาหร่ายวากาเมะน้ำมันงา น้ําจิ้มสุกี้
    "77ffe1f4-33df-4ad1-a018-d5b3f36a8175",  # น้ำจิ้มสุกี้
}
EXTRA_FRONT_STORE_KEYWORDS = (
    "สาหร่ายวากาเมะน้ํามันงา",
    "สาหร่ายวากาเมะน้ำมันงา",
    "น้ําจิ้มสุกี้",
    "น้ำจิ้มสุกี้",
)

def is_front_store_item(raw_name: str, item_id: str, cat_id: Optional[str] = None, all_cats: Optional[Dict[str, Any]] = None) -> bool:
    if all_cats is not None:
        if not cat_id or cat_id not in all_cats:
            return False
    if "(เดลิเวอรี่)" in raw_name or "(เดลิเวอรี)" in raw_name:
        return False
    return True

def resolve_loyverse_category_id(item_name: str, explicit_cat_id: Optional[str], all_cats: Dict[str, Any]) -> str:
    """Strictly resolve category from authentic Loyverse categories only."""
    if explicit_cat_id and explicit_cat_id in all_cats:
        return explicit_cat_id
    return ""

DEFAULT_CATEGORY_ORDER = [
    "185532de-9c97-4518-ac39-5d64bac79ec8",  # จานเดียว
    "cf16bc5c-0e0f-4b2b-bb51-3c8fc8feb634",  # กับข้าว
    "112abfdf-80e9-4e88-9fe1-e2fa6d5cfcf9",  # มาม่าเกาหลี
    "0653c242-7e23-463d-bd7e-4acca0f86625",  # ทานเล่น
    "84c26b72-a70a-4bb9-9cd4-2288aa1f5792",  # เครื่องเคียง
    "5be31675-00fd-4543-8560-214bac8f491c",  # เครื่องดื่ม
]

def fetch_front_store_menu(force: bool = False) -> Dict[str, Any]:
    global _MENU_CACHE
    now = time.time()
    if force or not _MENU_CACHE.get("menu") or (now - _MENU_CACHE.get("timestamp", 0) >= 300):
        # 1. Fetch strictly from Loyverse Categories
        cats_resp = loyverse_req("categories?limit=250")
        all_cats = {
            c["id"]: c for c in cats_resp.get("categories", []) if not c.get("deleted_at")
        }

        # 2. Fetch inventory for ingredient-linked stock calculation
        inv_map = {}
        try:
            inv_resp = loyverse_req("inventory?limit=250")
            levels = inv_resp.get("inventory_levels", [])
            inv_map = {
                lev["variant_id"]: lev.get("in_stock", 0)
                for lev in levels
                if lev.get("store_id") == settings.LOYVERSE_STORE_ID
            }
        except Exception:
            inv_map = {}

        mods_resp = loyverse_req("modifiers?limit=250")
        modifiers = {}
        for m in mods_resp.get("modifiers", []):
            if m.get("deleted_at"):
                continue
            opts = [
                {
                    "id": o["id"],
                    "name": o["name"].strip(),
                    "price": float(o.get("price", 0)),
                    "position": o.get("position", 0),
                }
                for o in m.get("modifier_options", [])
                if not o.get("deleted_at")
            ]
            opts.sort(key=lambda x: x["position"])
            modifiers[m["id"]] = {
                "id": m["id"],
                "name": m["name"].strip(),
                "options": opts,
            }

        raw_items = []
        cursor = None
        while True:
            ep = "items?limit=250" + (f"&cursor={cursor}" if cursor else "")
            res = loyverse_req(ep)
            raw_items.extend(res.get("items", []))
            cursor = res.get("cursor")
            if not cursor:
                break

        # Build composite component templates map for items whose duplicate (หน้าร้าน) variant lacks components
        comp_templates = {}
        for it in raw_items:
            if it.get("is_composite") and it.get("components"):
                k = normalize_dish_key(it.get("item_name", ""))
                if k and k not in comp_templates:
                    comp_templates[k] = it["components"]

        base_items = []
        variant_lookup = {}
        used_cat_ids = set()

        for it in raw_items:
            if it.get("deleted_at"):
                continue
            raw_name = it.get("item_name", "").strip()
            cat_id = it.get("category_id")

            # Rule: Strictly sync items belonging to active current categories (Ignore "All items" / Uncategorized)
            if not cat_id or cat_id not in all_cats:
                continue

            # Safeguard: Skip delivery fee or delivery variants if accidentally categorized
            if "(เดลิเวอรี่)" in raw_name or "(เดลิเวอรี)" in raw_name:
                continue

            # Skip Condo Delivery line item from menu
            variants = it.get("variants", [])
            if any(v.get("variant_id") == settings.CONDO_DELIVERY_VARIANT_ID for v in variants):
                continue

            for v in variants:
                if v.get("deleted_at"):
                    continue
                price = resolve_store_price(v)
                if price <= 0:
                    continue

                item_mods = []
                allowed_opts = {}
                for mid in it.get("modifier_ids", []):
                    if mid in modifiers:
                        item_mods.append(modifiers[mid])
                        for opt in modifiers[mid]["options"]:
                            allowed_opts[opt["id"]] = {
                                "option_id": opt["id"],
                                "name": opt["name"],
                                "price": opt["price"],
                            }

                img_url = it.get("image_url") or ""
                if img_url:
                    clean_id = img_url.split("/")[-1].split("?")[0].strip()
                    up_str = it.get("updated_at") or ""
                    v_ts = 0
                    if up_str:
                        try:
                            v_ts = int(datetime.fromisoformat(up_str.replace("Z", "+00:00")).timestamp())
                        except Exception:
                            v_ts = 0
                    img_url = f"/api/img/{clean_id}" + (f"?v={v_ts}" if v_ts else "")

                clean_title = clean_item_name(raw_name)
                assigned_cat_id = cat_id

                # Composite stock deduction & availability linked to [วัตถุดิบ]
                is_comp = bool(it.get("is_composite"))
                comps = it.get("components") or []
                if not comps:
                    k_match = normalize_dish_key(raw_name)
                    if k_match in comp_templates:
                        is_comp = True
                        comps = comp_templates[k_match]

                calculated_stock = None
                if is_comp and comps:
                    avail_counts = []
                    for c in comps:
                        comp_vid = c.get("variant_id")
                        comp_req = float(c.get("quantity", 1))
                        ing_stock = inv_map.get(comp_vid, 0)
                        if comp_req > 0:
                            avail_counts.append(int(ing_stock / comp_req))
                        else:
                            avail_counts.append(0)
                    calculated_stock = max(0, min(avail_counts)) if avail_counts else 0
                elif v["variant_id"] in inv_map:
                    calculated_stock = max(0, int(inv_map[v["variant_id"]]))

                is_available = True
                if calculated_stock is not None and calculated_stock <= 0:
                    is_available = False

                dish_obj = {
                    "id": it["id"],
                    "variant_id": v["variant_id"],
                    "sku": v.get("sku") or "",
                    "name": clean_title,
                    "category_id": assigned_cat_id,
                    "price": price,
                    "image_url": img_url,
                    "is_available": is_available,
                    "is_hidden": False,
                    "stock_count": calculated_stock,
                    "is_composite": is_comp,
                    "components": comps,
                    "is_recommended": False,
                    "badge": None,
                    "modifier_ids": it.get("modifier_ids", []),
                    "modifiers": item_mods,
                }
                base_items.append(dish_obj)
                variant_lookup[v["variant_id"]] = {
                    "id": it["id"],
                    "name": raw_name,
                    "sku": v.get("sku") or "",
                    "price": price,
                    "category_id": assigned_cat_id,
                    "allowed_options": allowed_opts,
                    "is_composite": is_comp,
                    "components": comps,
                }
                if assigned_cat_id:
                    used_cat_ids.add(assigned_cat_id)

        # Build categories strictly from authentic Loyverse Categories
        categories = []
        for cid, c in all_cats.items():
            if cid in used_cat_ids:
                categories.append({
                    "id": c["id"],
                    "name": c["name"].strip(),
                    "color": c.get("color", "GREY"),
                })

        _MENU_CACHE["menu"] = {
            "categories": categories,
            "items": base_items,
            "updated_at": time.strftime("%Y-%m-%d %H:%M:%S"),
        }
        _MENU_CACHE["variant_lookup"] = variant_lookup
        _MENU_CACHE["all_modifiers"] = modifiers
        _MENU_CACHE["timestamp"] = now

        # Prewarm image cache in background
        prewarm_image_cache(base_items)

    # Apply store state stock and customization overrides
    state = repository.get_state()
    cached_data = _MENU_CACHE["menu"]
    item_stock = state.get("item_stock", {})
    item_config = state.get("item_config", {})
    item_order = state.get("item_order", [])
    category_order = state.get("category_order", [])
    category_config = state.get("category_config", {})
    modifier_settings = state.get("modifier_settings", {})

    # 1. Custom category ordering and recommendation flags
    final_categories = []
    for c in cached_data["categories"]:
        cid = c["id"]
        cfg = category_config.get(cid, {})
        is_rec = bool(cfg.get("is_recommended", False))
        badge = cfg.get("badge", "🔥 แนะนำ" if is_rec else "")
        final_categories.append({
            **c,
            "is_recommended": is_rec,
            "badge": badge,
        })

    effective_cat_order = category_order if category_order else DEFAULT_CATEGORY_ORDER

    def cat_sort_key(c):
        cid = c["id"]
        idx = effective_cat_order.index(cid) if cid in effective_cat_order else 9999
        return (idx, 0 if c.get("is_recommended") else 1)

    final_categories.sort(key=cat_sort_key)

    # 2. Custom item ordering, stock, and recommendation flags
    final_items = []
    for it in cached_data["items"]:
        item_copy = dict(it)
        vid = item_copy["variant_id"]
        iid = item_copy["id"]

        if vid in item_stock:
            st = item_stock[vid]
            if "is_available" in st:
                item_copy["is_available"] = bool(st["is_available"])
            if "is_hidden" in st:
                item_copy["is_hidden"] = bool(st["is_hidden"])
            if "stock_count" in st and st["stock_count"] is not None:
                item_copy["stock_count"] = st["stock_count"]

        if item_copy.get("stock_count") is not None and item_copy["stock_count"] <= 0:
            item_copy["is_available"] = False

        if iid in item_config:
            cfg = item_config[iid]
            if cfg.get("is_recommended"):
                item_copy["is_recommended"] = True
            if cfg.get("badge"):
                item_copy["badge"] = cfg["badge"]
            if cfg.get("custom_image_url"):
                item_copy["image_url"] = cfg["custom_image_url"]
                item_copy["is_high_res"] = True

        # Modifier groups configuration & rules (Wongnai / Lineman style)
        configured_mods = []
        for grp in item_copy.get("modifiers", []):
            gid = grp.get("id")
            mod_cfg = modifier_settings.get(gid, {})
            name_raw = grp.get("name", "")

            # Default smart detection if not explicitly configured in backoffice
            is_single_default = 1 if any(k in name_raw for k in ["ความเผ็ด", "ความสุก", "แยกถุง", "ภาชนะ"]) else 0
            min_sel = mod_cfg.get("min_selection", is_single_default)
            max_sel = mod_cfg.get("max_selection", is_single_default)
            is_req = mod_cfg.get("is_required", min_sel > 0)
            custom_name = mod_cfg.get("custom_name") or name_raw
            disabled_options = set(mod_cfg.get("disabled_options", []))
            custom_prices = mod_cfg.get("custom_prices", {})

            configured_opts = []
            for opt in grp.get("options", []):
                oid = opt.get("id")
                eff_price = float(custom_prices.get(oid, opt.get("price", 0.0)))
                opt_avail = oid not in disabled_options
                configured_opts.append({
                    **opt,
                    "price": eff_price,
                    "is_available": opt_avail,
                })
                # Update variant lookup allowed_options as well for backend price verification
                if vid in _MENU_CACHE.get("variant_lookup", {}):
                    v_entry = _MENU_CACHE["variant_lookup"][vid]
                    if "allowed_options" in v_entry and oid in v_entry["allowed_options"]:
                        v_entry["allowed_options"][oid]["price"] = eff_price
                        v_entry["allowed_options"][oid]["is_available"] = opt_avail
                        v_entry["allowed_options"][oid]["group_id"] = gid

            grp_obj = {
                "id": gid,
                "name": custom_name,
                "min_selection": min_sel,
                "max_selection": max_sel,
                "is_required": is_req,
                "options": configured_opts,
            }
            configured_mods.append(grp_obj)

        item_copy["modifiers"] = configured_mods
        if vid in _MENU_CACHE.get("variant_lookup", {}):
            _MENU_CACHE["variant_lookup"][vid]["modifier_groups"] = configured_mods

        final_items.append(item_copy)

    # Sort items according to custom order
    if item_order:
        order_map = {item_id: idx for idx, item_id in enumerate(item_order)}
        final_items.sort(key=lambda x: order_map.get(x["id"], 9999))

    return {
        "categories": final_categories,
        "items": final_items,
        "updated_at": cached_data["updated_at"],
    }

def get_variant_lookup() -> Dict[str, Any]:
    if not _MENU_CACHE.get("variant_lookup"):
        fetch_front_store_menu(force=False)
    return _MENU_CACHE.get("variant_lookup", {})

def invalidate_menu_cache():
    global _MENU_CACHE
    _MENU_CACHE["timestamp"] = 0

def make_loyverse_order_tag(order_code: str, customer_name: str) -> str:
    """Format safe Order tag for Loyverse: '#A122 (ชื่อลูกค้า/ชื่อ Line)' strictly within 20 UTF-16 code units."""
    code = re.sub(r"[^A-Za-z0-9]", "", str(order_code or ""))[:6]

    # Strip emoji & symbols that cause surrogate pair overflow in Java
    cust = re.sub(r"[\U00010000-\U0010ffff]", "", customer_name or "")
    cust = re.sub(r"[\u2600-\u27bf\ufe00-\ufe0f\u200d]", "", cust).strip()

    prefix = f"#{code} " if code else ""
    remaining = 20 - len(prefix)
    cust_part = cust[:remaining].strip()
    tag = f"{prefix}{cust_part}".strip()

    while len(tag.encode("utf-16-le")) // 2 > 20:
        tag = tag[:-1]
    return tag.strip()


def push_order_to_loyverse(order_obj: Dict[str, Any]) -> Tuple[Dict[str, Any], Dict[str, Any]]:
    line_items = []
    for entry in order_obj["items"]:
        qty = int(entry["quantity"])
        base_price = float(entry["price"])
        mods = entry.get("modifiers", [])
        line_item = {
            "variant_id": entry["variant_id"],
            "quantity": qty,
            "price": base_price,
            "line_modifiers": [
                {"modifier_option_id": m["option_id"]}
                for m in mods
                if m.get("option_id")
            ],
        }
        if entry.get("item_note"):
            line_item["line_note"] = html.unescape(entry["item_note"]).strip()[:100]
        line_items.append(line_item)

    # Condo Room Delivery Fee (+5 Baht)
    delivery_fee = float(order_obj.get("delivery_fee") or 0.0)
    raw_floor = html.unescape(order_obj.get("floor") or "").strip()
    raw_room = html.unescape(order_obj.get("room") or "").strip()
    floor_tag = " [ชั้น 7 ส่งฟรี]" if is_floor_7(raw_floor) else ""
    room_loc_txt = f"ชั้น {raw_floor} ห้อง {raw_room}{floor_tag}".strip() if (raw_floor or raw_room) else ""

    if delivery_fee > 0 and settings.CONDO_DELIVERY_VARIANT_ID:
        line_items.append({
            "variant_id": settings.CONDO_DELIVERY_VARIANT_ID,
            "quantity": 1,
            "price": round(delivery_fee, 2),
            "line_note": (f"{room_loc_txt} ({html.unescape(order_obj.get('order_type') or 'ส่งหน้าห้อง')})" if room_loc_txt else html.unescape(order_obj.get("order_type") or "ส่งถึงหน้าห้องคอนโด"))[:100]
        })

    raw_cust = html.unescape(order_obj["customer_name"])
    order_tag = make_loyverse_order_tag(
        order_obj.get("order_code", ""),
        raw_cust
    )
    full_note = " | ".join(
        p for p in [
            f"ออเดอร์ #{order_obj['order_code']} {raw_cust} ({html.unescape(order_obj['order_type'])})",
            room_loc_txt,
            f"โทร: {html.unescape(order_obj['phone'])}" if order_obj.get("phone") else "",
            html.unescape(order_obj.get("note") or "")
        ] if p
    )

    payment_types = {
        "qr": settings.PAYMENT_TYPE_QR,
        "thai_chuay_thai": settings.PAYMENT_TYPE_THAI_CHUAY_THAI,
        "cash": settings.PAYMENT_TYPE_CASH,
    }
    payment_type_id = payment_types.get(order_obj.get("payment_method", "qr"), payment_types["qr"])

    loyverse_payload = {
        "store_id": settings.LOYVERSE_STORE_ID,
        "pos_device_id": settings.LOYVERSE_POS_DEVICE_ID,
        "employee_id": settings.EMPLOYEE_ID,
        "order": order_tag,
        "note": full_note[:250] if full_note else None,
        "line_items": line_items,
        "payments": [
            {
                "payment_type_id": payment_type_id,
                "money_amount": round(float(order_obj["total_money"]), 2),
            }
        ],
    }
    created = loyverse_req("receipts", loyverse_payload, method="POST")
    return created, loyverse_payload

def sync_loyverse_stock() -> int:
    inv_resp = loyverse_req("inventory?limit=250")
    levels = inv_resp.get("inventory_levels", [])
    inv_map = {lev["variant_id"]: lev.get("in_stock", 0) for lev in levels if lev.get("store_id") == settings.LOYVERSE_STORE_ID}

    data = fetch_front_store_menu(force=True)
    state = repository.get_state()
    state.setdefault("item_stock", {})

    synced_count = 0
    for it in data.get("items", []):
        vid = it["variant_id"]
        is_comp = bool(it.get("is_composite"))
        comps = it.get("components", [])

        calc_stock = None
        if is_comp and comps:
            avail_counts = []
            for c in comps:
                comp_vid = c.get("variant_id")
                comp_req = float(c.get("quantity", 1))
                ing_stock = inv_map.get(comp_vid, 0)
                if comp_req > 0:
                    avail_counts.append(int(ing_stock / comp_req))
                else:
                    avail_counts.append(0)
            calc_stock = max(0, min(avail_counts)) if avail_counts else 0
        elif vid in inv_map:
            calc_stock = max(0, int(inv_map[vid]))

        if calc_stock is not None:
            is_avail = calc_stock > 0
            state["item_stock"][vid] = {
                "is_available": is_avail,
                "stock_count": calc_stock,
                "is_composite": is_comp,
                "components": comps,
                "updated_at": time.strftime("%Y-%m-%d %H:%M:%S")
            }
            synced_count += 1

    repository.save_state(state)
    invalidate_menu_cache()
    return synced_count

def sync_bestsellers() -> Dict[str, Any]:
    res = loyverse_req("receipts?limit=250")
    counts = Counter()
    for r in res.get("receipts", []):
        for li in r.get("line_items", []):
            counts[li.get("item_name", "").strip()] += int(li.get("quantity", 1))

    data = fetch_front_store_menu(force=False)
    state = repository.get_state()
    item_cfg = state.setdefault("item_config", {})
    item_order = state.get("item_order", [])

    item_scores = []
    for it in data.get("items", []):
        cn = clean_item_name(it.get("name", ""))
        sales = sum(cnt for r_name, cnt in counts.items() if clean_item_name(r_name) == cn)
        item_scores.append((it, sales))

    item_scores.sort(key=lambda x: x[1], reverse=True)
    top_items_report = []
    if item_scores:
        top_1 = item_scores[0][0]
        top_1_sales = item_scores[0][1]
        item_cfg[top_1["id"]] = {
            "is_recommended": True,
            "badge": "🏆 ขายดีอันดับ 1"
        }
        if top_1["id"] in item_order:
            item_order.remove(top_1["id"])
        item_order.insert(0, top_1["id"])

        for it, s in item_scores[:5]:
            top_items_report.append({"name": it.get("name"), "sales": s, "id": it.get("id")})

    state["item_order"] = item_order
    repository.save_state(state)
    invalidate_menu_cache()
    return {
        "ok": True,
        "top_1": item_scores[0][0].get("name") if item_scores else None,
        "top_items": top_items_report
    }

def get_admin_modifiers() -> List[Dict[str, Any]]:
    """Retrieve all modifier groups merged with backoffice settings (Wongnai POS style)."""
    fetch_front_store_menu(force=False)
    all_mods = _MENU_CACHE.get("all_modifiers", {})
    cached_items = _MENU_CACHE.get("menu", {}).get("items", [])
    state = repository.get_state()
    modifier_settings = state.get("modifier_settings", {})

    # Map which front-store items use each modifier group
    linked_map: Dict[str, List[Dict[str, Any]]] = {}
    for it in cached_items:
        for mid in it.get("modifier_ids", []):
            if mid not in linked_map:
                linked_map[mid] = []
            linked_map[mid].append({
                "id": it["id"],
                "name": it["name"],
                "price": it["price"],
            })

    results = []
    for mid, m in all_mods.items():
        cfg = modifier_settings.get(mid, {})
        name_raw = m.get("name", "")
        is_single_default = 1 if any(k in name_raw for k in ["ความเผ็ด", "ความสุก", "แยกถุง", "ภาชนะ"]) else 0
        min_sel = cfg.get("min_selection", is_single_default)
        max_sel = cfg.get("max_selection", is_single_default)
        is_req = cfg.get("is_required", min_sel > 0)
        custom_name = cfg.get("custom_name") or name_raw
        disabled_opts = set(cfg.get("disabled_options", []))
        custom_prices = cfg.get("custom_prices", {})

        opts_list = []
        for o in m.get("options", []):
            oid = o.get("id")
            custom_p = custom_prices.get(oid)
            eff_p = float(custom_p) if custom_p is not None else float(o.get("price", 0.0))
            opts_list.append({
                "id": oid,
                "name": o.get("name", ""),
                "price": float(o.get("price", 0.0)),
                "custom_price": float(custom_p) if custom_p is not None else None,
                "effective_price": eff_p,
                "is_available": oid not in disabled_opts,
                "position": o.get("position", 0),
            })

        linked = linked_map.get(mid, [])
        results.append({
            "id": mid,
            "name": name_raw,
            "custom_name": custom_name,
            "min_selection": min_sel,
            "max_selection": max_sel,
            "is_required": is_req,
            "options": opts_list,
            "linked_items": linked,
            "items_count": len(linked),
        })

    # Sort so most used modifier groups in menu appear first
    results.sort(key=lambda x: (-x["items_count"], x["name"]))
    return results
