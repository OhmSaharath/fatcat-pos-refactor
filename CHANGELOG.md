# 📝 FATCAT POS Refactor — Developer Changelog & Engineering Journal

This document records all architectural decisions, component refactorings, feature implementations, and revisions in **Project Phase 2 (Refactored Codebase)**.

---

## 📌 [2026-10-25] Reactive Order History View & LocalStorage Cache Architecture

### 🎯 Scope & User Request
- **User Request & Issue:**
  > "อันนี้ยังไม่ได้ login line เพราะว่า ยังอยู่กับ phase 1อยู่ แก้ไขบัคให้จบหมดก่อนค่อยย้ายมา แต่ไม่มีประวัติขึ้นอันนี้เพราะอะไร มันน่าจะต้องมี cache ปะ"
  > [Screenshot shows]: The user navigated to History tab on storefront, seeing a static empty box: `ประวัติการสั่งซื้อจะแสดงผลที่นี่`.
- **Root Cause Analysis:**
  1. **Placeholder Component in Phase 2:** `App.tsx` had a static placeholder `<div>ประวัติการสั่งซื้อจะแสดงผลที่นี่</div>` without an active component implementation.
  2. **Uncached Order Submission:** `CheckoutModal.tsx` did not persist submitted orders into `fatcat_local_orders` or save `last_order_code` / `last_order_token` into `localStorage`.
  3. **Strict Filter on Customer Orders API:** `/api/customer-orders` required either a LINE UID or phone number $\ge 9$ digits. When ordering without LINE and without entering a phone, queries returned empty `[]`.

### 🛠️ Fixes & Engineering Enhancements:
1. **Dedicated HistoryView Component (`HistoryView.tsx`):**
   - **Instant Offline Cache:** Immediately loads and renders orders from `localStorage.getItem('fatcat_local_orders')` on mount with zero network delay.
   - **Live Progress Tracker:** Prominently tracks the latest active order (`last_order_code`), polling `/api/order-status` every 4 seconds with animated status indicators (`⏳ รอยืนยัน` $\rightarrow$ `👨‍🍳 กำลังปรุง` $\rightarrow$ `🍽️ พร้อมรับ/เสร็จสิ้น`).
   - **One-Click Reorder Action:** Directly repopulates cart from past receipts via `onReorderItems`.
2. **Checkout Order Persistence:**
   - In `CheckoutModal.tsx`, successfully placed orders now automatically save `last_order_code`, `last_order_token`, and prepend the full order summary into `fatcat_local_orders` in `localStorage`.
3. **Flexible Order Retrieval API:**
   - Enhanced `/api/customer-orders` to allow matching by `order_code` or `customer_name` when LINE UID and phone are unavailable.
4. **Dual-Phase Parity:** Applied the enhanced customer-orders lookup to Phase 1 (`fatcat-web-order/server.py`).

---

## 📌 [2026-10-25] Thai Timezone (UTC+7), Loyverse Employee ID Fix & Audio Mute UX Overhaul

### 🎯 Scope & User Request
- **User Request & Issue:**
  > "อันนี้กดส่ง order มาแล้ว แล้วกดปิดเสียตรงไหนหรอ แล้วเวลาสั่งเหมือนจะไม่ใช่เวลาไทยนะ"
  > [Screenshot shows]:
  > 1. Alert modal: `Unexpected token 'I', "Internal S"... is not valid JSON` when clicking "ตรวจสลิปผ่าน & ส่งเข้า Loyverse POS".
  > 2. Order #A101 created_at was `10:32:47` (UTC) instead of Thai local time (`17:32:47`).
  > 3. User inquiry about how to mute sound alert ("ปิดเสียง") and manage order completion.
- **Root Cause Analysis:**
  1. **500 Internal Server Error on POS Push:** `Settings` class in `config.py` defined `LOYVERSE_EMPLOYEE_ID` but lacked `EMPLOYEE_ID`. Calling `push_order_to_loyverse` caused `AttributeError: 'Settings' object has no attribute 'EMPLOYEE_ID'`. Uncaught exception yielded 500 HTML which broke `res.json()`.
  2. **UTC Server Timezone:** Render container defaults to UTC (GMT+0), causing `time.strftime` to record `10:32:47` instead of Bangkok time (`17:32:47`).
  3. **Audio Alert Mute Ergonomics:** The top-right mute button was only an icon without label, and toggling it did not immediately halt the currently playing audio element.

### 🛠️ Fixes & Engineering Enhancements:
1. **Pydantic Model & Loyverse Employee Fix:**
   - Added `EMPLOYEE_ID` alias and `model_config = ConfigDict(extra="allow")` in `config.py`.
   - Verified end-to-end receipt generation with Loyverse API (successfully issued Receipt #0008).
   - Wrapped `push_order_to_loyverse` in `admin_routes.py` with structured HTTP error response.
2. **Asia/Bangkok (UTC+7) Local Timezone:**
   - Introduced `get_thai_time_str()` using `timezone(timedelta(hours=7))` across `order_routes.py`, `customer_routes.py`, and `config.py`. All newly created orders record accurate Thailand local time.
3. **Audio Mute & Controls Ergonomics:**
   - Added distinct "เปิดเสียง" (Green) / "ปิดเสียง" (Red) text labels beside the speaker icon in `AdminHeader.tsx`.
   - Implemented immediate audio interruption (`audio.pause(); audio.currentTime = 0;`) whenever the user clicks Mute or takes action on an order.
4. **Dual-Phase Parity:** Applied Thai timezone fix to Phase 1 (`fatcat-web-order/server.py`).

---

## 📌 [2026-10-25] PromptPay QR Instant In-Memory Generation & Offline Speedup

### 🎯 Scope & User Request
- **User Request:**
  > "QR Code แสกนจ่ายก็ไม่ขึ้นนะ มันโหลดรูปช้า"
- **Root Cause Analysis:**
  1. **External Third-Party Network Latency:** QR code generation previously depended on external network calls to `https://api.qrserver.com` and `https://quickchart.io` with a 6-second timeout.
  2. **Render Thread Queue Stalling:** When dish images were previously hogging the CPU, any incoming requests to `/api/promptpay-qr-image` queued behind image generation, causing apparent freezes or timeouts.
  3. **No In-Memory QR Caching:** Every time the checkout modal was opened or the amount refreshed, a new external request was triggered with `Cache-Control: no-store`.

### 🛠️ Fixes & Engineering Optimizations:
1. **Local Offline QR Generation (`qrcode[pil]`):**
   - Added `qrcode[pil]>=7.4.2` to `backend/requirements.txt`.
   - Generates pixel-perfect PNG QR codes directly in Python memory via Pillow in **~18–50ms** with zero external network dependencies.
2. **In-Memory RAM Cache (`_QR_CACHE`):**
   - Caches generated QR PNG bytes by payload string in memory. Subsequent calls respond in **~0.1ms**.
3. **HTTP Caching Optimization:**
   - Switched header to `Cache-Control: public, max-age=3600, stale-while-revalidate=86400` to allow browser and reverse proxy caching for fixed amounts.
4. **Checkout Modal Loading Skeleton:**
   - Added interactive spinner and smooth opacity transition in `CheckoutModal.tsx` while QR code is generating.
5. **Dual-Phase Parity:** Applied local QR generation and `_QR_CACHE` to Phase 1 (`fatcat-web-order/server.py`).

---

## 📌 [2026-10-25] Image Delivery Acceleration & Zero-Latency Caching Overhaul

### 🎯 Scope & User Request
- **User Request:**
  > "ตอนนี้รูปหน้าเว็บโหลดช้ามากเลยเหมือนเมื่อวานที่รูปโหลดช้าๆ"
- **Root Cause Analysis:**
  1. **Dynamic Timestamp Cache Invalidation Bug:** In `loyverse_service.py`, image URLs were appended with `?v={int(time.time())}`. Because `time.time()` was always newer than disk cache timestamps, every image check (`getmtime >= req_v`) failed.
  2. **Render CPU Choke (Method 6 WebP):** Every image request bypassed disk cache, triggering an external HTTP call to `https://api.loyverse.com/image/...` and Pillow WebP encoding with `quality=95, method=6`. On Render's 0.1 CPU Free tier, `method=6` took 7–10 seconds of 100% CPU per image, queuing and stalling all subsequent requests.
  3. **Hardcoded Future Version in Carousel:** `DEFAULT_SHOWCASE_DISHES` had `?v=1792917864` (in the future), causing top carousel dishes to always miss the disk cache.

### 🛠️ Fixes & Engineering Optimizations:
1. **In-Memory RAM Cache (`_RAM_CACHE`):**
   - Implemented an in-memory dictionary caching decoded WebP/JPEG bytes and MIME types. Serving an image from RAM drops response latency from **~9,600ms** to **~2ms** (<0.003s).
2. **Proper Disk & RAM Cache Validation:**
   - Checked RAM cache first, then disk cache. Only if an image is genuinely missing or `force_refresh=True` does it call the external Loyverse API.
3. **High-Speed WebP Encoding (`method=3`, `quality=85`):**
   - Reduced encoding CPU time by ~20x while maintaining crisp Retina resolution.
   - Added automatic downscaling for oversized images (max 800x800px) to prevent excessive memory and bandwidth consumption.
4. **Stable Versioning in Menu:**
   - Switched from `time.time()` to item `updated_at` timestamps from Loyverse API, preventing false cache busting.
5. **HTTP Conditional Caching (ETag & 304 Not Modified):**
   - Added MD5-based `ETag` headers and `If-None-Match` verification in `image_routes.py`. Returning visitors receive instant `304 Not Modified` with zero byte payload.
6. **Dual-Phase Parity:** Applied the same optimizations to Phase 1 (`fatcat-web-order/server.py`).

---

## 📌 [2026-10-25] Production Menu & Category Ordering Resolution (Bestseller Sync & Default Sequence)

### 🎯 Scope & User Request
- **User Request:**
  > "ตอนนี้ลำดับมันยังมั่วเพราะไม่มีข้อมูลใช่ปะ -.- ใน production หนะหรือยังไง ทำไมขนมใบไม้ถึงอยู่อันดับ 1 555"
- **Root Cause Analysis:**
  1. **Fresh Database State:** The new production Supabase project (`ksxiawmveeosyyyvgdbu`) was freshly created, with `category_order: []` and `item_order: []`.
  2. **Loyverse Default Order:** When custom sequences are not yet initialized or synced, Python preserved Loyverse's raw creation/pagination sequence (`items?limit=250` and raw categories), where `ทานเล่น` or items like `ขนมใบไม้ทอด` appeared first.
  3. **Frontend Property Mapping:** In `frontend/src/hooks/useMenu.ts`, `is_recommended` and `badge` properties on categories were omitted from `mappedCategories`.

### 🛠️ Fixes & Resolution:
1. **Bestseller Sync Execution:**
   - Ran `POST /api/admin/sync-bestsellers` on production.
   - Analyzed real Loyverse receipt history:
     - 🥇 `เซ็ตข้าวไก่ต้มน้ำปลา` (67 sales) $\rightarrow$ Assigned `🏆 ขายดีอันดับ 1`.
     - 🥈 `[เซ็ตเพื่อนซี้ สุดคุ้ม!] ชุดเซ็ตข้าวไก่ต้มน้ำปลา x2` (48 sales).
     - 🥉 `ซุปสาหร่ายวากาเมะ` (30 sales).
     - 🍲 `เซ็ตข้าวหมูสามชั้นต้มน้ำปลา` (25 sales).
     - 🍱 `[เซ็ตคู่หู2กล่อง สุดคุ้ม!] ไก่ต้มน้ำปลา+สามชั้น` (20 sales).
2. **Default Category Fallback Sequence:**
   - Defined `DEFAULT_CATEGORY_ORDER`:
     1. `จานเดียว` (Single Dishes - พระเอกไก่ต้มน้ำปลา) `185532de-9c97-4518-ac39-5d64bac79ec8` [🔥 แนะนำ]
     2. `กับข้าว` (Main Dishes) `cf16bc5c-0e0f-4b2b-bb51-3c8fc8feb634`
     3. `มาม่าเกาหลี` (Korean Noodles) `112abfdf-80e9-4e88-9fe1-e2fa6d5cfcf9`
     4. `ทานเล่น` (Snacks / Appetizers) `0653c242-7e23-463d-bd7e-4acca0f86625`
     5. `เครื่องเคียง` (Sides) `84c26b72-a70a-4bb9-9cd4-2288aa1f5792`
     6. `เครื่องดื่ม` (Beverages) `5be31675-00fd-4543-8560-214bac8f491c`
3. **Frontend Recommendation Badges:**
   - Updated `useMenu.ts` to propagate `is_recommended` and `badge` to categories, displaying the `🔥 แนะนำ` badge on `จานเดียว`.
4. **Dual-Phase Parity:** Applied the same fallback to Phase 1 `server.py` and committed to both repositories.

---

## 📌 [2026-10-25] Phase 2 Production Launch on Render (fatcat-pos-v2.onrender.com)

### 🎯 Scope & Milestone
- **Live Production URL:** [https://fatcat-pos-v2.onrender.com](https://fatcat-pos-v2.onrender.com)
- **Deployment Architecture:** Multi-Stage Docker container (Node.js 20 Vite frontend builder + Python 3.11 FastAPI backend).
- **Branch:** `v2` on `https://github.com/OhmSaharath/fatcat-pos.git`.
- **Database:** Dedicated Phase 2 Supabase PostgreSQL Project (`ksxiawmveeosyyyvgdbu`).

### 🛠️ Verification & Status:
1. **Health Check:** `/api/health` returning `200 OK` (Healthy, Version 2.0.0, Production).
2. **Dynamic Ingredient-Linked Stock:** Real-time composite deduction from Loyverse `[วัตถุดิบ]` active (`ไก่ต้มน้ำปลา`: 2, `หมูสามชั้น`: 1, `คู่หู`: 1, `เพื่อนซี้หมู x2`: Sold out, `ไข่ดอง`: Sold out).
3. **Hero Showcase Carousel:** 6 Condo Bestsellers with `เซ็ตข้าวไก่ต้มน้ำปลา` (฿60) featured front and center with `🏆 ขายดีอันดับ 1 ในคอนโด`.
4. **Categories:** Strictly the 6 authentic categories from Loyverse (`เครื่องดื่ม`, `มาม่าเกาหลี`, `ทานเล่น`, `เครื่องเคียง`, `กับข้าว`, `จานเดียว`).
5. **Customer Profile:** Decoupled from Admin; `CustomerProfileModal` with LINE LIFF integration active.
6. **Admin Backoffice:** Protected under `/admin` with HMAC-SHA256 authentication and rate limiting.

---

## 📌 [2026-10-25] LINE LIFF Integration, Customer Profile Modal & Deployment Readiness Audit

### 🎯 Scope & User Request
- **User Request:**
  > "phase 2 เชื่อมต่อไลน์หรือยัง แล้วตรง profile กดแล้วเป็นลิงค์เข้าระบบ หลังบ้าน เช็ค Secure ของ Phase 2 หน่อย database พร้อมหรือยัง ฉันอยาก deploy แล้ว รอบนี้ต้อง deploy ที่ไหนแนะนำมาฉันจะไปเตรียมรอ รวมถึง database ด้วยนะ"
- **Objectives:**
  1. Audit LINE integration (Push notifications & LINE LIFF Login).
  2. Decouple customer profile button in `Header.tsx` from Admin portal; build dedicated `CustomerProfileModal.tsx`.
  3. Conduct security review of Phase 2 API routes, auth tokens, and cryptographic checks.
  4. Verify Supabase Cloud Database readiness (`store_state`, `orders`, `customers`).
  5. Provide production deployment blueprint and recommendations.

### 🛠️ Architecture & Technical Implementation
1. **Customer Profile Modal (`CustomerProfileModal.tsx`) & LIFF Helper (`liff.ts`):**
   - Included LINE LIFF SDK in `frontend/index.html`.
   - Built `src/lib/liff.ts` supporting `initLiff()`, `loginWithLine()`, `logoutLine()`, and auto-syncing with `/api/customer-login`.
   - Created `CustomerProfileModal.tsx`:
     - Displays LINE avatar and online status when logged in.
     - Allows saving contact name, phone number, condo floor, and room number to `fatcat_customer_profile` in `localStorage` for 1-click checkout autofill.
     - Separated store owner portal with discrete "สำหรับเจ้าของร้าน (Admin)" link pointing to `/admin`.
   - Updated `App.tsx` and `Header.tsx` to open the customer modal instead of redirecting directly to `/admin`.

2. **Security Audit Summary:**
   - **Admin Authentication:** Strict Bearer token verification using `HMAC-SHA256` cryptographic signatures with timestamp expiry (24 hours).
   - **Timing Attack Prevention:** `hmac.compare_digest()` for admin password and signature verification.
   - **Brute Force Protection:** IP-based rate limiting (8 attempts per 5 minutes on login).
   - **Customer Order Isolation:** Signed order tokens preventing enumeration of other customer orders or payment slips.

3. **Database Readiness:**
   - Supabase PostgreSQL Cloud integration verified against the production project.
   - Verified active rows in tables: `store_state`, `orders`, and `customers`.

4. **Deployment Preparation:**
   - Updated `Dockerfile` to bind to dynamic `${PORT:-8765}` for cloud runtime compatibility.
   - Created `render.yaml` blueprint with environment variable definitions.

---

## 📌 [2026-10-25] Top Showcase Food Carousel: Top 6 Condo Bestsellers with ต้มน้ำปลา Priority

### 🎯 Scope & User Request
- **Request:**
  > "ไอ่ตรง ภาพที่สไลลด์ไปมาอะ อยากให้ต้มน้ำปลาขึ้นมาก่อนอะ จริงๆ เอา 6 อันดับแรก ที่ขายดีในคอนโด ก็ได้ นะเอามา ไม่เอารวมมิตรไก่สามชั้นเพราะเมนูนั้นนานๆทีจะเปิดขาย"

### 🛠️ Architecture & Technical Implementation
1. **Ranked 6 Best-Selling Condo Dishes:**
   - Analyzed 250 sales receipts from Loyverse POS database. Excluded side dishes (`ซุปสาหร่ายวากาเมะ`, `ข้าวสวย`, `ไข่เจียว`) and excluded `เซ็ตข้าวรวมมิตรไก่+สามชั้นต้มน้ำปลา` as requested:
     1. 🥇 `เซ็ตข้าวไก่ต้มน้ำปลา` (ID: `4192187c-536e-4651-91da-ee743b14def1`, ฿60) — **🏆 ขายดีอันดับ 1 ในคอนโด**
     2. 🥈 `เซ็ตข้าวหมูสามชั้นต้มน้ำปลา` (ID: `2ab9bb15-8413-498e-972b-555e6d9329f6`, ฿80) — **🍲 ซิกเนเจอร์ต้มน้ำปลา**
     3. 🥉 `[เซ็ตคู่หู2กล่อง สุดคุ้ม!] ไก่ต้มน้ำปลา+สามชั้น` (ID: `3d19216d-68d6-489d-9cec-abe5781d34e1`, ฿140) — **🍱 เซ็ตคู่หูสุดคุ้ม**
     4. 🍗 `[กับข้าว] ไก่ต้มน้ำปลา+สามชั้นต้มน้ำปลา` (ID: `38576332-4c9a-4b56-8019-dee39205b1b8`, ฿120) — **🥘 กับข้าวต้มน้ำปลา**
     5. 🍜 `มาม่าเกาหลี + ไก่ทอดชิ้นโตๆ` (ID: `d9337664-8a01-46b0-a354-1b06b9f5b8ba`, ฿99) — **🍜 มาม่าเกาหลียอดฮิต**
     6. 🍳 `ข้าวไข่ข้น` (ID: `64e1c84e-4394-4457-b064-d97ad9ad7abf`, ฿75) — **🍳 ซิกเนเจอร์ข้าวไข่ข้น**

2. **Frontend Fixes & Improvements:**
   - **Default Active Index:** Initialized carousel `currentIndex` to `0` so `เซ็ตข้าวไก่ต้มน้ำปลา` starts front and center immediately upon page load.
   - **ID Priority Matching:** Fixed matching bug where partial substring in `targetQuery` matched composite dishes like `[กับข้าว]` prematurely before strict ID lookup.
   - **Dual-Phase Parity:** Applied updates in Phase 1 (`fatcat-web-order/index.html`) and Phase 2 (`MenuCarousel.tsx`, `App.tsx`).

---

## 📌 [2026-10-25] Dynamic Ingredient-Linked Stock Deduction (ต้มน้ำปลา) & Authentic Loyverse Categories

### 🎯 Scope & User Request
- **Request:**
  > "ต่อมา มันจะมีเรื่องนึงที่ลืมบอกพอดีว่า เมนูต้มน้ำปลานายจะเห็นว่ามันจะมีการผูก Stock ไว้กับ Item [วัตถุดิบ] หนะซึ่งเมนูพวกนี้จะหัก Stock ของไก่และหมูออกไป นั่นแหละ สมมติฉันกดเมนูเซ็ตข้าวไก่ต้มน้ำปลา มันก็จะหักสะโพกไก่ไป 1 ถ้าฉันสั่ง หมูสามชั้นต้มน้ำปลามันก็จะหักหมูไป 1 ถ้าฉันสั่งเซ็ตคู่หู ไก่ หมู ก็จะหักไก่ และ หมูไปอย่างละ 1 ซึ่งนั่นแหละ ฉันอยากให้นายเอามาใช้ แล้วฉันจะ Set จำนวนไก่และหมูพวกนี้อยู่แล้วในทุกๆวัน ซึ่งเอามาผูกมันจะง่ายกว่ามาจัดการ 2 ที่ ซึ่งมันจะมีแต่เมนูต้มน้ำปลานะที่ผูกเอาไว้หนะ แล้วก็หมวดหมู่ไหน ที่ไม่มีใน Loyverse ไม่ต้องเอามาโชว์หน้าเว็บทั้งสิ้น นะครับอิงจาก Loyverse ทั้งหมดเลย แก้ทั้ง 2 Phase เลยนะ ทั้งแบบ ที่อยู่ใน Render ละก็ ที่ Refactor นะครับ"

### 🛠️ Architecture & Technical Implementation

#### 1. Dynamic Stock Deduction from Loyverse `[วัตถุดิบ]` (Composite Dish Formula):
- **Linked Ingredients in Loyverse (`inventory_levels`):**
  - `648b3389-18f0-43ef-a012-62b3fd2e5aa2`: `[วัตถุดิบ] สะโพกไก่`
  - `c4155e83-e2b5-4c75-8121-30e789a72318`: `[วัตถุดิบ] หมู`
  - `038c1ebf-61cc-41c6-b21b-15e22fb5a8d5`: `[วัตถุดิบ] น่องติดสะโพก`
  - `cfbd599b-f378-47e4-b548-78c64537a979`: `[วัตถุดิบ] ไข่ดอง`
- **Dynamic Composite Calculation Formula:**
  - When querying items from Loyverse, the backend fetches store inventory via `https://api.loyverse.com/v1.0/inventory?limit=250` and filters by `store_id == settings.LOYVERSE_STORE_ID`.
  - For any composite dish (`is_composite == true` and `components` present):
    $$\text{stock\_count} = \min_{c \in \text{components}} \left\lfloor \frac{\text{inventory}[c.\text{variant\_id}]}{c.\text{quantity}} \right\rfloor$$
  - If $\text{stock\_count} \le 0$: `is_available` is automatically set to `False` (Sold Out).
  - If $\text{stock\_count} > 0$: `is_available` is set to `True` with remaining available portion count.
- **Component Template Fallback for Duplicate (หน้าร้าน) Items:**
  - Discovered that Loyverse duplicate items created with suffix `(หน้าร้าน)` occasionally miss component linkages in the backoffice while their parent counterpart item contains full component metadata.
  - Implemented `normalize_dish_key()` matching across all Loyverse items. Any `(หน้าร้าน)` item seamlessly inherits its parent's ingredients:
    - `[เซ็ตคู่หู2กล่อง สุดคุ้ม!] ไก่ต้มน้ำปลา+สามชั้น (หน้าร้าน)` -> Inherits 1x `[วัตถุดิบ] สะโพกไก่` + 1x `[วัตถุดิบ] หมู`.
    - `[เซ็ตเพื่อนซี้ สุดคุ้ม!] ชุดเซ็ตข้าวไก่ต้มน้ำปลา x2 (หน้าร้าน)` -> Inherits 2x `[วัตถุดิบ] สะโพกไก่`.
    - `[เซ็ตเพื่อนซี้ สุดคุ้ม!] ข้าวหมูสามชั้นต้มน้ำปลา x2 (หน้าร้าน)` -> Inherits 2x `[วัตถุดิบ] หมู`.

#### 2. Strict Loyverse Authentic Category Enforcement:
- Completely eliminated hardcoded / synthetic categories (`uncategorized_front`, `cat_beverages`).
- Customer storefront displays **exclusively** authentic categories defined in Loyverse:
  1. `185532de-9c97-4518-ac39-5d64bac79ec8`: `จานเดียว`
  2. `cf16bc5c-0e0f-4b2b-bb51-3c8fc8feb634`: `กับข้าว`
  3. `112abfdf-80e9-4e88-9fe1-e2fa6d5cfcf9`: `มาม่าเกาหลี`
  4. `0653c242-7e23-463d-bd7e-4acca0f86625`: `ทานเล่น`
  5. `84c26b72-a70a-4bb9-9cd4-2288aa1f5792`: `เครื่องเคียง`
  6. `5be31675-00fd-4543-8560-214bac8f491c`: `เครื่องดื่ม`
- Implemented `resolve_loyverse_category_id()` to deterministically assign any uncategorized dish into its proper authentic Loyverse category based on dish title keywords.

#### 3. Dual-Phase Parity & Verification:
- **Phase 1 (`fatcat-web-order` / Render codebase on port 8765):**
  - Updated `server.py` with `_normalize_dish_key()`, `comp_templates`, `inv_map` query, and stock overlay fallback.
  - Tested `/api/menu` returning exactly 6 Loyverse categories and composite stocks: `ไก่ต้มน้ำปลา` (stock: 2), `หมูสามชั้นต้มน้ำปลา` (stock: 1), `คู่หู 2 กล่อง` (stock: 1), `เพื่อนซี้หมู x2` (stock: 0 -> Sold Out).
- **Phase 2 (`fatcat-pos-refactor` / Refactored FastAPI + React on port 8766):**
  - Updated `loyverse_service.py` with composite template inheritance, inventory level mapping, and authentic category routing.
  - Verified `/api/menu` returning exact parity with Phase 1.
  - Captured responsive mobile screenshots for both Phase 1 and Phase 2 verifying visual category pills and dish listings.

---

## 📌 [2026-10-25] Image Quality Optimization (Method 1 & 3) & Lineman Menu Integration

### 🎯 Scope & User Request
- **Request:** "วิธี 1 ไปก่อนแล้วทำวิธี 3 ไปด้วยเพราะต้องใช้เวลา แล้วก็ฝากเพิ่ม สาหร่ายวากาเมะน้ำมันงา น้ำจิ้มสุกี้ ที่มีเมนูใน Lineman อะเพิ่มเข้า (หน้าร้าน) ไปด้วยครับ"
- **Objectives:**
  1. Activate **Method 1**: Automatic Smart Unsharp Masking + Micro-Contrast enhancement + WebP quality 95 and CSS contrast optimization.
  2. Implement **Method 3**: Studio High-Resolution Image Override system in Admin Backoffice (`/admin` Stock Manager) supporting 1400x1400px studio photo uploads per dish.
  3. Include Lineman items into the front-store menu: `สาหร่ายวากาเมะน้ำมันงา น้ำจิ้มสุกี้` (89 THB) and `น้ำจิ้มสุกี้` (25 THB) in both Phase 1 and Phase 2.

### 🛠️ Architecture & Technical Implementation

#### 1. Method 1 — Image Sharpness Pipeline (`backend/app/services/image_service.py`):
- **Smart Unsharp Masking:**
  - Applied `PIL.ImageEnhance.Sharpness(img).enhance(1.45)` to restore crisp edges lost during Loyverse Cloud downsampling.
  - Applied `PIL.ImageEnhance.Contrast(img).enhance(1.04)` for juicy micro-contrast and appetizing color separation.
- **Modern WebP Compression:**
  - Saves optimized images in WebP format at Quality 95 (`method=6`), delivering significantly sharper rendering at smaller file sizes than repeated JPEG re-encoding.
- **Frontend Retina Hint:**
  - Added `style={{ imageRendering: '-webkit-optimize-contrast' }}` across `DishCard.tsx`, `ItemCustomizerModal.tsx`, and `MenuCarousel.tsx`.

#### 2. Method 3 — Studio High-Res Image Override System:
- **Backend Endpoints:**
  - `POST /api/admin/upload-dish-image`: Receives multipart image upload, processes with high-quality WebP up to 1400×1400px, stores in `backend/data/custom_images/{item_id}.webp`, and records `custom_image_url` in `item_config`.
  - `GET /api/img/custom/{item_id}`: Dedicated low-latency endpoint serving studio-grade HD dish images with immutable cache headers.
  - `DELETE /api/admin/custom-dish-image/{item_id}`: Deletes custom override and reverts the dish back to its Loyverse Cloud photo.
- **Admin UI Integration (`frontend/src/components/admin/AdminStockManager.tsx`):**
  - Added camera icon overlay on each dish card thumbnail.
  - One-click file picker allows instant uploading of high-res photos from desktop or mobile.
  - Active HD dishes display a distinct purple `HD 4K` badge with a "กลับไปใช้รูป Loyverse" reset button.

#### 3. Lineman Menu Items Added to Front Store (`loyverse_service.py` & `server.py`):
- Added item allowlisting for:
  - `b7739b25-4f78-4c13-82a5-9c9a9d3fe597`: `สาหร่ายวากาเมะน้ำมันงา น้ำจิ้มสุกี้` (89 THB)
  - `77ffe1f4-33df-4ad1-a018-d5b3f36a8175`: `น้ำจิ้มสุกี้` (25 THB)
- Dual-phase parity maintained: tested and verified active on both Port 8765 (Phase 1) and Port 8766 (Phase 2).

---

## 📌 [2026-10-25] Admin Backoffice: Full Category Management & Recommended Category System

### 🎯 Scope & User Request
- **User Feedback:** "หลังบ้านขาดการจัดการหมวดหมู่ไหม หมวดหมู่ที่แนะนำไรงี้"
- **Objective:** Add comprehensive category management and category recommendation controls into the React Admin Backoffice (`/admin`) and ensure seamless end-to-end integration with the FastAPI backend and customer storefront.

### 🛠️ Architecture & Implementation Details
1. **Backend Integration (`backend/app/services/loyverse_service.py`):**
   - Merged `category_order` and `category_config` from store state into live menu categories.
   - Evaluates `is_recommended` and assigns badge `🔥 แนะนำ` to designated categories.
   - Deterministic multi-key sorting: prioritized by custom `category_order` index and recommendation status.
   - Enabled real-time cache invalidation on category update.
2. **Admin Frontend Component (`frontend/src/components/admin/AdminReorderView.tsx`):**
   - Built dual-tab view switcher:
     - 📁 **จัดการหมวดหมู่ (Category Management):**
       - Displays all active categories with item counts.
       - Up/Down reordering controls (▲ / ▼).
       - One-click recommendation toggle: **"⭐ ตั้งเป็นหมวดแนะนำ"** / **"🔥 แนะนำแล้ว"**.
       - Live visual preview with amber glowing badges.
     - 🍲 **จัดการลำดับเมนูอาหาร (Item Management):**
       - Category filter pills for targeted reordering.
       - Wongnai AI Bestsellers auto-ranking button.
       - Per-item Move Up, Move Down, and Top-Pin (⏫).
       - Item recommendation badge toggle (⭐ แนะนำ / 🏆 ขายดี).
   - Auto-saving state synchronization via `/api/admin/menu-reorder`.
3. **Customer Storefront Parity:**
   - On the customer menu header, recommended categories automatically display the `🔥` badge with highlighted amber pill borders and golden accents.

---

## 📌 [2026-10-25] Menu Categorization: Dedicated "เครื่องดื่ม" (Beverages) Category

### 🎯 Scope & User Request
- **Request:** "แยก น้ำเปล่า โค้ก เก๊กฮวย เอาไปไว้หมวดเครื่องดื่มให้หน่อยนะ"
- **Objective:** Separate beverage items out of the default catalog and assign them to a dedicated "เครื่องดื่ม" category across both Phase 1 and Phase 2 architectures.

### 🔍 Root Cause Analysis & Technical Discovery
1. **Loyverse Cloud API Behavior:**
   - Querying `https://api.loyverse.com/v1.0/categories?limit=250` returns `{"categories": []}` because category permissions or definitions are not exposed via the current POS API token.
   - All items returned from Loyverse have `category_id: null`.
   - Consequently, items fell back to an unassigned / single category bucket.
2. **Thai Character Encoding Variance:**
   - In Loyverse, "น้ำเปล่า" and "น้ำเก๊กฮวย" use Thai combining diacritics: `THAI CHARACTER NO NU` + `THAI CHARACTER MAI THO` + `THAI CHARACTER NIKHAHIT` (U+0E4D) + `THAI CHARACTER SARA AA` (U+0E45), which renders identically to Sara Am (`\u0e33`) but does not match standard `\u0e33` string comparison without normalization or multi-variant keyword checking.
   - Keyword matching updated to support both forms: `("น้ำเปล่า", "น้ําเปล่า", "โค้ก", "เก๊กฮวย")`.

### 🛠️ Implementation Details
1. **Backend Service (`backend/app/services/loyverse_service.py`):**
   - Injected dedicated category definitions:
     - `MAIN_CAT_ID = "uncategorized_front"` ("เมนูจานเดี่ยว", color: `#C89D66`)
     - `BEVERAGE_CAT_ID = "cat_beverages"` ("เครื่องดื่ม", color: `#0284c7`)
   - Added `is_beverage_item(clean_title)` helper matching all 4 beverage items:
     - `น้ําเปล่า (หน้าร้าน)` (15 THB)
     - `โค้ก ออริจินัล (กระป๋อง) (หน้าร้าน)` (30 THB)
     - `โค้ก ไม่มีน้ําตาล (กระป๋อง) (หน้าร้าน)` (30 THB)
     - `น้ําเก๊กฮวยแมวอ้วน 250ml (หน้าร้าน)` (40 THB)
   - Auto-assigned beverage items to `BEVERAGE_CAT_ID` and all food dishes to `MAIN_CAT_ID`.
   - Ordered category output deterministically: `[MAIN_CAT_ID, BEVERAGE_CAT_ID]`.
2. **Storefront Verification:**
   - Category navigation pills dynamically render:
     - `ทั้งหมด (76)`
     - `เมนูจานเดี่ยว (72)`
     - `เครื่องดื่ม (4)`
   - Filter clicks instantly isolate beverage items with live Loyverse high-res images and pricing.
3. **Dual-Phase Parity:**
   - Applied identical keyword detection and category routing to Phase 1 (`fatcat-web-order/server.py`).

---

## 📌 [2026-10-25] Project Phase 2 — Complete Kitchen Display & Admin Backoffice System

### 🎯 Scope & Deliverables
Implemented the complete React 18 + TypeScript + Tailwind CSS Admin Backoffice and Kitchen Display System (KDS), fully integrated with the Phase 2 FastAPI backend and accessible at `/admin`.

### 🛡️ Admin Components Breakdown
1. **`src/components/admin/AdminLoginModal.tsx`**:
   - Secure authentication screen protecting all administrative functions.
   - Session token persistence in `sessionStorage` (`fatcat_admin_token`).
2. **`src/components/admin/AdminHeader.tsx`**:
   - Real-time store status indicator (🟢 Open / 🔴 Closed).
   - Audio alarm notification toggle with voice selector: **กะเทย 💅** (`alarm_kathoey_3x.mp3`) vs **Siri Diva 🎙️** (`alarm_siri_diva_3x.mp3`).
   - Quick navigation tabs: ออเดอร์ (Orders), สต็อก (Stock), จัดลำดับเมนู (Reorder), ตั้งค่าร้าน (Settings), ใบเสร็จ (Receipts).
3. **`src/components/admin/AdminOrdersFeed.tsx` & `AdminOrderCard.tsx`**:
   - Live order stream with auto-polling every 4 seconds.
   - Status filters: รอตรวจสลิป (Pending), กำลังปรุง (Cooking), เสร็จสิ้น (Done), ยกเลิก (Cancelled), ทั้งหมด (All).
   - Card details: Customer name, phone, delivery type (condo floor/room tag), items with modifiers, custom cooking notes, and grand total.
   - Actions: 🍳 "ตรวจสลิปผ่าน & ส่งเข้า Loyverse POS" (`approve_and_push_pos`), ✅ "ทำอาหารเสร็จแล้ว" (`mark_done`), ❌ "ยกเลิก" (`cancel`).
4. **`src/components/admin/AdminSlipModal.tsx`**:
   - High-res inspection modal displaying customer bank transfer slip.
   - 3-Layer Vision AI verification badges: SHA-256 duplicate image check, Bank QR reference parser, and OCR recipient/amount matched status.
5. **`src/components/admin/AdminStockManager.tsx`**:
   - Live inventory management across all 76 items.
   - Switches for "พร้อมขาย" / "หมดชั่วคราว" (`is_available`) and "เปิดแสดง" / "ซ่อนเมนู" (`is_hidden`).
   - "🔄 ซิงก์สต็อกสดจาก Loyverse Inventory" action button.
6. **`src/components/admin/AdminSettingsView.tsx`**:
   - Store open/closed master switch with custom closure message.
   - Store announcement banner editor.
   - PromptPay account number & account name editor.
   - Auto-push vs Manual slip check toggle (`require_slip_check_before_pos`).
   - LINE Channel Token, Target ID, and Telegram Bot Token settings.
7. **`src/components/admin/AdminReorderView.tsx` & `AdminReceiptsView.tsx`**:
   - "📊 ดึงยอดขายจริง 250 บิลล่าสุดเพื่อคำนวณ 'ขายดีอันดับ 1' อัตโนมัติ" action.
   - Drag & drop / up-down menu reordering.
   - Real-time Loyverse POS receipts viewer.
8. **Routing Integration (`main.tsx` & `App.tsx`)**:
   - Automatic route dispatching: `http://localhost:8766/` loads Customer Storefront (`<App />`); `http://localhost:8766/admin` loads Admin Backoffice (`<AdminApp />`).
   - Storefront avatar button clicks directly navigate to `/admin`.
   - Responsive multi-device layout: Storefront stays as a centered luxury mobile app; Admin expands to full width on tablets/kitchen displays.

---

## 📌 [2026-10-25] Project Phase 2 — Top Showcase Carousel Image Sync Fix

### 🎯 Scope & Fixes
- **Carousel Image Proxying**:
  - Fixed broken image URLs in `MenuCarousel.tsx` and `App.tsx` where non-existent external hostnames (`assets.loyverse.com`) were referenced.
  - Replaced with authentic Loyverse image proxy paths (`/api/img/{img_id}?v=...`) directly linked to live menu items.
  - Dynamically bound `carouselDishes` in `App.tsx` to automatically pull live prices, badges (e.g. `🏆 ขายดีอันดับ 1`, `🍲 ซิกเนเจอร์`), and optimized square photos directly from the loaded Loyverse inventory.
  - Enhanced `MenuCarousel.tsx` to pass the dish ID upon clicking "+ สั่ง", immediately opening the customizer sheet for that exact food item.
- **Backend Image Router**:
  - Added `@router.head("/img/{img_id}")` support in `image_routes.py` to allow browser image pre-flight queries without raising HTTP 405.

---

## 📌 [2026-10-25] Project Phase 2 — Live Server Verification & React Hook Fixes

### 🎯 Scope & Runtime Testing
- **Server Deployment**:
  - Successfully running Phase 2 high-performance FastAPI server on `http://localhost:8766/` (preloaded 6 categories and 80 items live from Loyverse POS API).
  - Configured non-conflicting dedicated port `8766` to allow concurrent testing alongside Phase 1 production (`8765`).
  - Vite dev proxy configured to forward `/api` requests to port `8766`.
- **Bug Fixes & Refinements**:
  - `src/hooks/useMenu.ts`: Fixed data structure mapping between Loyverse flat item arrays and React category objects; resolved `TypeError: undefined filter` on category grouping.
  - `src/components/modal/ItemCustomizerModal.tsx`: Fixed React Hook order violation (`Minified React error #310`) by moving all `useMemo` computations above conditional render returns.
  - `src/App.tsx`: Ensured `<ItemCustomizerModal>` only mounts when an active dish is selected.
  - `src/lib/api.ts`: Added optional `items?: MenuItem[]` to `MenuApiResponse` type interface.
  - `backend/app/main.py`: Hardened SPA static route handler to properly emit 404 for missing API routes.
- **Visual Evidence & Rendering Verification**:
  - Captured full responsive viewport screenshots (`phase2_live_storefront.png` and `phase2_dish_modal.png`) verifying crisp 1:1 square dish imagery, Inter & IBM Plex Sans Thai typography, category tabs, and real-time modifier calculations.

---

## 📌 [2026-10-25] Project Phase 2 — Full Modular Stack Implementation (Frontend & Backend)

### 🎯 Scope & Deliverables
Implemented the complete Phase 2 Enterprise-grade architecture, decoupling the monolithic Phase 1 system into modular, testable, type-safe components and microservices.

### 🎨 Frontend (React 18 + TypeScript + Tailwind CSS + Lucide Icons)
- **Typography & Theme Integration**:
  - Global typography configured: **Inter** for English text, prices, and digits; **IBM Plex Sans Thai** for Thai characters.
  - Chipotle warm earth-tone palette (`chipotle-cream`, `chipotle-brown`, `chipotle-gold`, `chipotle-amber`).
- **Core State Management & Custom Hooks**:
  - `src/hooks/useCart.ts`: LocalStorage-persisted cart with unique modifier hashing, item counters, real-time total computation, and item clearing.
  - `src/hooks/useMenu.ts`: Active menu fetching with search filtering, category pill filtering, and active item modal selection.
  - `src/lib/api.ts`: Typed Fetch API client for menu retrieval, order dispatching, and order tracking.
  - `src/lib/utils.ts`: Tailwind class merging (`clsx` + `tailwind-merge`), currency formatting, and name sanitization.
- **Component Breakdown (All < 150 lines)**:
  - `src/components/navigation/Header.tsx`: Fixed top header with store badge, dine-in/takeaway pill toggle, and cart bag indicator.
  - `src/components/navigation/BottomNav.tsx`: Floating island navigation bar with Menu, Reorder, Rewards, and History tabs.
  - `src/components/carousel/MenuCarousel.tsx`: Chipotle 1:1 crisp square food showcase with smooth auto-sliding, category indicator pills, dot indicators, and 1-click add-to-bag triggers.
  - `src/components/menu/CategoryPills.tsx`: Horizontal scrolling category pills with active indicators and item count badges.
  - `src/components/menu/DishCard.tsx`: Chipotle clean row dish card with 1:1 square photo, title, description, price badge, and options indicators.
  - `src/components/modal/ItemCustomizerModal.tsx`: Uncropped 1:1 food hero photo, option selectors (radio/checkbox modifier groups), custom cooking note input, quantity stepper, and "ADD TO BAG" action.
  - `src/components/cart/CartFloatingPill.tsx`: Floating checkout bar above navigation island with live item count and subtotal.
  - `src/components/cart/CheckoutModal.tsx`: Slide-up checkout drawer with customer info persistence, dining mode selector, PromptPay QR with locked amount, slip photo upload, and order dispatching.
  - `src/components/reorder/ReorderView.tsx`: `Reorder (สั่งซ้ำเมนูโปรด)` dedicated interface for instant re-ordering of previous favorite dishes.
- **Build & Compilation**:
  - `npm run build` (`tsc && vite build`) passes cleanly with zero warnings/errors (Output bundle: JS 216kB / CSS 26kB).

### ⚙️ Backend (Python FastAPI + Layered Service-Repository Pattern)
- **Layered Clean Architecture**:
  - `app/config.py`: Centralized environment configuration via Pydantic (`Settings`), loading `.env` variables and defining directory paths.
  - `app/models/schemas.py`: Strictly validated Pydantic models for `MenuItemSchema`, `ModifierGroupSchema`, `StoreSettingsSchema`, `CartItemSchema`, `CreateOrderRequest`, `CustomerProfileSchema`, and Admin payloads.
  - `app/storage/repository.py`: Thread-safe `StateRepository` handling atomic state read/write operations to `store_state.json` and asynchronous background synchronization with Supabase PostgreSQL.
  - `app/services/auth_service.py`: IP-based sliding window rate limiter, HMAC-SHA256 admin session token generator/validator, order security tokens, and XSS sanitization.
  - `app/services/loyverse_service.py`: Direct Loyverse POS API client, store price resolver, (หน้าร้าน) menu parser with modifier mapping, receipt creation, inventory synchronization, and bestseller calculation.
  - `app/services/promptpay_service.py`: Authentic EMVCo CRC-16 payload generator with locked amounts and Krungthai Thung Ngern Tag 30 support.
  - `app/services/slip_service.py`: 3-layer anti-fraud slip verification (SHA-256 duplicate image detection, Apple Vision QR reference validation, and Thai/English OCR amount/recipient verification).
  - `app/services/image_service.py`: Proxy service caching Loyverse dish images locally with PIL Lanczos 800x800 square thumbnail optimization.
  - `app/services/notification_service.py`: Asynchronous push notifications via LINE Messaging API and Telegram Bot.
- **RESTful API Controllers (`app/api/`)**:
  - `menu_routes.py`: Public menu and store status endpoints (`/api/menu`, `/api/store-state`).
  - `order_routes.py`: Zero-trust order validation and creation endpoints (`/api/order`, `/api/orders`, `/api/order-status`, `/api/customer-orders`).
  - `promptpay_routes.py`: Real-time QR generation (`/api/promptpay-qr`, `/api/promptpay-qr-image`).
  - `image_routes.py`: Cached image delivery (`/api/img/{img_id}`).
  - `customer_routes.py`: LINE LIFF profile sync and customer order history (`/api/customer-profile`, `/api/customer-login`).
  - `admin_routes.py`: Secured admin management endpoints (`/api/admin/login`, `/api/admin/state`, `/api/admin/settings`, `/api/admin/order-action`, `/api/admin/menu-stock`, `/api/admin/menu-reorder`, `/api/admin/sync-bestsellers`, `/api/admin/sync-loyverse-stock`, `/api/receipts`).
- **Unified Application & SPA Serving (`app/main.py`)**:
  - FastAPI root app with CORS middleware, health check at `/api/health`, automatic startup menu pre-loading, and static serving of the React Vite single-page application.
- **Containerization**:
  - Multi-stage `Dockerfile`: Stage 1 builds the Vite React frontend using Node 20; Stage 2 packages the Python 3.11 FastAPI backend and serves both on port 8765.

---

## 📌 [2026-10-25] Project Phase 2 Kickoff & Architecture Scaffolding

### 🎯 Objective
Transition from the single-file rapid prototype (Phase 1) into a clean, modern, modular **Component-Driven & Layered Architecture** adhering to international industry standards (React 18+, TypeScript, Tailwind CSS, Python Layered Services).

### 🏛️ Architecture Paradigm: Component-Driven (Frontend) + Layered Clean Architecture (Backend)
1. **Frontend Paradigm (Functional Components + Custom Hooks)**:
   - Replaced single monolithic 4,000-line `index.html` with modular React components (`<150 lines` per file).
   - Separation of UI from State/Logic: UI components remain pure and declarative, while business state (cart, customer profile, modal state, menu loading) is handled by custom hooks (`useCart`, `useMenu`, `useOrders`).
   - Complete TypeScript interfaces (`Item`, `Category`, `ModifierGroup`, `OrderPayload`).
2. **Backend Paradigm (Service-Repository Pattern)**:
   - Decomposed monolithic 1,900-line `server.py` into distinct layers:
     - `api/`: HTTP Controllers (routes, input validation, JSON serialization).
     - `services/`: Core business logic (`LoyverseService`, `SlipVerificationService`, `PromptPayService`).
     - `storage/`: Thread-safe state repository (`StateRepository`).
     - `models/`: Strictly typed schemas.

### 📂 Directory Structure Initialized
- `frontend/src/components/`:
  - `carousel/`: 1:1 food square showcase with smooth slide-left animations.
  - `menu/`: Dish cards, category tabs, filter search.
  - `modal/`: 1:1 square dish customizer modal.
  - `cart/`: Floating cart pill and checkout drawer.
  - `reorder/`: Instant 1-tap reorder view.
  - `navigation/`: Dynamic Island sticky header and floating bottom navigation.
- `frontend/src/types/`: Centralized TypeScript definitions.
- `frontend/src/hooks/`: Reusable custom state hooks.
- `backend/app/`: Modular Python services and endpoints.
- `docs/`: System documentation and developer onboarding guide.

---

## 🧭 Project Phase Conventions
- **"Project Phase 1"**: Refers to the live production prototype repository (`fatcat-pos` on Render).
- **"Project Phase 2"**: Refers to this refactored, modular repository (`fatcat-pos-refactor`).
