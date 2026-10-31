import React, { useState, useEffect } from 'react';
import { X, Trash2 } from 'lucide-react';
import { CartItem } from '../../types/menu';
import { DiningType, PaymentMethod, CustomerProfile, DINING_OPTIONS } from '../../types/order';
import { formatPrice, cleanFrontName } from '../../lib/utils';
import { LineUserProfile, loginWithLine } from '../../lib/liff';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  cartItems: CartItem[];
  onRemoveItem: (id: string) => void;
  grandTotal: number;
  /** @deprecated dine-in/takeaway tabs were removed; kept for backward-compatible props */
  diningMode?: string;
  lineProfile?: LineUserProfile | null;
  onOrderSuccess: (orderCode: string) => void;
  isStoreOpen?: boolean;
  closedMessage?: string;
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({
  isOpen,
  onClose,
  cartItems,
  onRemoveItem,
  grandTotal,
  lineProfile,
  onOrderSuccess,
  isStoreOpen = true,
  closedMessage,
}) => {
  const [profile, setProfile] = useState<CustomerProfile>(() => {
    try {
      const saved = localStorage.getItem('fatcat_customer_profile');
      const parsed = saved ? JSON.parse(saved) : {};
      const lineName = localStorage.getItem('fatcat_line_display_name') || '';
      const phase1Saved = localStorage.getItem('fatcat_saved_profile');
      const p1 = phase1Saved ? JSON.parse(phase1Saved) : {};
      return {
        name: parsed.name || p1.name || lineName || '',
        phone: parsed.phone || p1.phone || '',
        floor: parsed.floor || p1.floor || '',
        room: parsed.room || p1.room || '',
      };
    } catch {
      return { name: '', phone: '', floor: '', room: '' };
    }
  });

  // Keep customer profile and LINE display name synchronized whenever modal opens
  useEffect(() => {
    if (!isOpen) return;
    const lineName = lineProfile?.displayName || localStorage.getItem('fatcat_line_display_name') || '';
    let p1Name = '';
    let p1Phone = '';
    let p1Floor = '';
    let p1Room = '';
    try {
      const p1 = JSON.parse(localStorage.getItem('fatcat_saved_profile') || '{}');
      p1Name = p1.name || '';
      p1Phone = p1.phone || '';
      p1Floor = p1.floor || '';
      p1Room = p1.room || '';
    } catch {}

    setProfile((prev) => {
      const effectiveName = prev.name.trim() || p1Name || lineName || '';
      const effectivePhone = prev.phone.trim() || p1Phone || '';
      const effectiveFloor = prev.floor?.trim() || p1Floor || '';
      const effectiveRoom = prev.room?.trim() || p1Room || '';

      const updated = {
        name: effectiveName,
        phone: effectivePhone,
        floor: effectiveFloor,
        room: effectiveRoom,
      };
      try {
        localStorage.setItem('fatcat_customer_profile', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  }, [isOpen, lineProfile]);

  const [orderType, setOrderType] = useState<DiningType>(() => {
    const saved = localStorage.getItem('fatcat_last_dining_type') as DiningType | null;
    return saved && DINING_OPTIONS.some((o) => o.value === saved) ? saved : 'รับอาหารข้างล่างชั้น 1';
  });
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('qr');
  const [orderNote, setOrderNote] = useState('');
  const [slipFileBase64, setSlipFileBase64] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [qrLoaded, setQrLoaded] = useState(false);
  const [availableRewards, setAvailableRewards] = useState<number>(0);
  const [useRewardDiscount, setUseRewardDiscount] = useState<boolean>(false);

  // Check customer reward coupons on modal open
  useEffect(() => {
    if (!isOpen) return;
    const lineUid = lineProfile?.userId || localStorage.getItem('fatcat_line_user_id') || '';
    const phone = profile.phone || '';
    if (lineUid || phone) {
      fetch(`/api/customer-profile?line_user_id=${lineUid}&phone=${phone}`)
        .then((r) => r.json())
        .then((d) => {
          if (d.ok && d.profile && d.profile.available_rewards) {
            setAvailableRewards(d.profile.available_rewards);
          }
        })
        .catch(() => {});
    }
  }, [isOpen, lineProfile, profile.phone]);

  // Delivery Fee calculation (Free for Floor 7)
  const isFloor7 = (fl?: string) => {
    if (!fl) return false;
    const clean = fl.replace(/[^\d]/g, '').trim();
    return clean === '7';
  };

  const isCondoDelivery = orderType.includes('หน้าห้อง') || orderType.includes('+5');
  const isStairs = orderType.includes('บันได');
  const deliveryFee = isCondoDelivery ? (isFloor7(profile.floor) ? 0 : 5) : 0;

  const subTotal = grandTotal;
  const totalBeforeDiscount = subTotal + deliveryFee;
  const discountAmount = useRewardDiscount && availableRewards > 0 ? Math.min(10, totalBeforeDiscount) : 0;
  const finalGrandTotal = Math.max(0, totalBeforeDiscount - discountAmount);

  if (!isOpen) return null;

  const handleProfileChange = (field: keyof CustomerProfile, val: string) => {
    const updated = { ...profile, [field]: val };
    setProfile(updated);
    if (field === 'floor') {
      setQrLoaded(false);
    }
    try {
      localStorage.setItem('fatcat_customer_profile', JSON.stringify(updated));
    } catch {}
  };

  const handleSlipUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const rawDataUrl = reader.result as string;
      const isStandardMime = /^data:image\/(jpeg|jpg|png|webp);base64,/i.test(rawDataUrl);
      // Keep original bytes for standard images <= 1.8MB to preserve exact QR barcode sharpness
      if (isStandardMime && file.size <= 1.8 * 1024 * 1024) {
        setSlipFileBase64(rawDataUrl);
        return;
      }
      // For oversized photos or non-standard mobile formats, normalize to clean JPEG via canvas
      const img = new Image();
      img.onload = () => {
        try {
          const maxDim = 1600;
          let { width, height } = img;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            setSlipFileBase64(canvas.toDataURL('image/jpeg', 0.9));
            return;
          }
        } catch {}
        setSlipFileBase64(rawDataUrl);
      };
      img.onerror = () => setSlipFileBase64(rawDataUrl);
      img.src = rawDataUrl;
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    if (!profile.name.trim()) {
      setErrorMessage('กรุณาระบุชื่อลูกค้า');
      return;
    }
    if (orderType.includes('หน้าห้อง') && (!profile.floor?.trim() || !profile.room?.trim())) {
      setErrorMessage('กรุณาระบุชั้นและเลขห้องสำหรับส่งถึงหน้าห้อง');
      return;
    }
    if (isStairs && !profile.floor?.trim()) {
      setErrorMessage('กรุณาระบุชั้นที่จะให้ไปส่งที่บันไดหนีไฟ');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const payload = {
        dining_type: orderType,
        payment_method: paymentMethod,
        customer_name: profile.name,
        customer_phone: profile.phone,
        condo_floor: profile.floor,
        condo_room: profile.room,
        order_note: orderNote,
        total_money: finalGrandTotal,
        use_reward_discount: Boolean(useRewardDiscount && availableRewards > 0),
        line_user_id: lineProfile?.userId || localStorage.getItem('fatcat_line_user_id') || undefined,
        line_display_name: lineProfile?.displayName || localStorage.getItem('fatcat_line_display_name') || profile.name,
        line_picture_url: lineProfile?.pictureUrl || localStorage.getItem('fatcat_line_picture_url') || undefined,
        items: cartItems.map((c) => ({
          item_id: c.item_id,
          name: c.name,
          quantity: c.quantity,
          price: c.unit_price,
          note: c.item_note,
          modifiers: c.modifiers.map((m) => ({
            option_id: m.option_id,
            name: m.name,
            price: m.price,
          })),
        })),
        slip_image_base64: slipFileBase64 || undefined,
      };

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.ok) {
        const orderCode = data.order_code || 'A000';
        const orderToken = data.order_token || '';

        // 1. Cache for active live tracking
        if (orderCode && orderToken) {
          localStorage.setItem('last_order_code', orderCode);
          localStorage.setItem('last_order_token', orderToken);
        }

        // 2. Cache in fatcat_local_orders (instant offline history)
        const newRecord = {
          order_code: orderCode,
          order_token: orderToken,
          created_at: new Date().toISOString(),
          status: 'PENDING_SLIP',
          status_label: paymentMethod === 'cash' ? '⏳ รอร้านยืนยันออเดอร์ (ชำระหน้าร้าน)' : '⏳ รอร้านตรวจสลิป',
          items: cartItems.map((c) => ({
            item_id: c.item_id,
            name: c.name,
            quantity: c.quantity,
            price: c.unit_price,
            modifiers: c.modifiers,
            item_note: c.item_note,
          })),
          total_money: finalGrandTotal,
          discount_amount: discountAmount,
          payment_method: paymentMethod,
          payment_label: paymentMethod === 'cash' ? '💵 เงินสดหน้าร้าน' : '📲 QR ถุงเงิน',
          order_type: orderType,
        };

        try {
          const prev = JSON.parse(localStorage.getItem('fatcat_local_orders') || '[]');
          const updated = [newRecord, ...prev.filter((o: any) => o.order_code !== orderCode)];
          localStorage.setItem('fatcat_local_orders', JSON.stringify(updated.slice(0, 30)));
        } catch {}

        onOrderSuccess(orderCode);
        onClose();
      } else {
        setErrorMessage(data.detail || data.error || 'ไม่สามารถส่งออเดอร์ได้');
      }
    } catch (e: any) {
      setErrorMessage(e.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อ');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs">
      <div className="w-full max-w-[500px] bg-white rounded-t-3xl sm:rounded-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom duration-200">
        {/* Header */}
        <div className="h-12 px-4 border-b border-app-border flex items-center justify-between shrink-0">
          <span className="text-xs font-bold text-chipotle-brown tracking-wider font-en">YOUR BAG & CHECKOUT</span>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-4 overflow-y-auto space-y-4">
          {/* Store Closed Warning Banner */}
          {!isStoreOpen && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2 font-medium">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0"></span>
              <span>🔴 {closedMessage || 'ขณะนี้ร้านปิดรับออเดอร์ชั่วคราว ไม่สามารถส่งออเดอร์ได้ในขณะนี้ครับ'}</span>
            </div>
          )}

          {/* Cart Items List */}
          <div className="divide-y divide-gray-100">
            {cartItems.map((it) => (
              <div key={it.id} className="py-2.5 flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-chipotle-brown truncate">
                    {cleanFrontName(it.name)}
                  </div>
                  {it.modifiers.length > 0 && (
                    <div className="text-[11px] text-chipotle-gold truncate">
                      {it.modifiers.map((m) => m.name).join(', ')}
                    </div>
                  )}
                  {it.item_note && (
                    <div className="text-[10px] text-amber-900 truncate">โน้ต: {it.item_note}</div>
                  )}
                  <div className="text-xs text-app-muted mt-0.5 font-en font-medium">
                    {formatPrice(it.unit_price)} × {it.quantity}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-chipotle-brown font-en">
                    {formatPrice(it.unit_price * it.quantity)}
                  </span>
                  <button
                    type="button"
                    onClick={() => onRemoveItem(it.id)}
                    className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Customer Fields */}
          <div className="pt-3 border-t border-app-border space-y-3">
            {/* LINE Identity Card */}
            {lineProfile ? (
              <div className="bg-emerald-50 border border-emerald-200/80 rounded-2xl p-2.5 px-3 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  {lineProfile.pictureUrl ? (
                    <img
                      src={lineProfile.pictureUrl}
                      alt="LINE"
                      className="w-6 h-6 rounded-full object-cover shrink-0 border border-emerald-300"
                    />
                  ) : (
                    <span className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] font-bold shrink-0">
                      L
                    </span>
                  )}
                  <div className="truncate">
                    <span className="text-emerald-950 font-medium text-[11px]">สั่งในนาม LINE: </span>
                    <span className="text-emerald-800 font-bold text-[11px] truncate">{lineProfile.displayName}</span>
                  </div>
                </div>
                <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full shrink-0">
                  ✓ บันทึกประวัติ
                </span>
              </div>
            ) : (
              <div className="bg-[#06C755]/10 border border-[#06C755]/30 rounded-2xl p-2.5 px-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-[#06C755] text-white flex items-center justify-center text-[10px] font-bold shrink-0">
                    LINE
                  </span>
                  <div className="text-[11px] text-gray-800">
                    <span className="font-semibold text-gray-900">เข้าสู่ระบบด้วย LINE</span>
                    <span className="text-gray-500 text-[10px] block">บันทึกประวัติออเดอร์เพื่อดูได้ทุกเครื่อง</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={loginWithLine}
                  className="px-2.5 py-1 bg-[#06C755] hover:bg-[#05b34c] text-white font-bold rounded-xl text-[11px] shrink-0 shadow-xs active:scale-95 transition-all"
                >
                  เชื่อมต่อ
                </button>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-medium text-gray-700">
                    ชื่อลูกค้า <span className="text-red-500">*</span>
                  </label>
                  {(lineProfile?.displayName || localStorage.getItem('fatcat_line_display_name')) && (
                    <button
                      type="button"
                      onClick={() => {
                        const nameToRestore = lineProfile?.displayName || localStorage.getItem('fatcat_line_display_name') || '';
                        if (nameToRestore) handleProfileChange('name', nameToRestore);
                      }}
                      className="text-[10px] text-chipotle-gold hover:underline font-semibold"
                    >
                      ดึงชื่อ LINE
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  value={profile.name}
                  onChange={(e) => handleProfileChange('name', e.target.value)}
                  placeholder="เช่น คุณบี หรือ ชื่อ LINE"
                  className="w-full text-xs p-2.5 rounded-xl border border-app-border-dark focus:ring-1 focus:ring-chipotle-brown"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">เบอร์โทร</label>
                <input
                  type="tel"
                  value={profile.phone}
                  onChange={(e) => handleProfileChange('phone', e.target.value)}
                  placeholder="081-234-5678"
                  className="w-full text-xs p-2.5 rounded-xl border border-app-border-dark focus:ring-1 focus:ring-chipotle-brown"
                />
              </div>
            </div>

            {/* Delivery / Pickup Method Picker (3 options) */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">รับอาหารแบบไหน</label>
              <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="รับอาหารแบบไหน">
                {DINING_OPTIONS.map((opt) => {
                  const active = orderType === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => {
                        setOrderType(opt.value);
                        setQrLoaded(false);
                        try {
                          localStorage.setItem('fatcat_last_dining_type', opt.value);
                        } catch {}
                      }}
                      className={`p-2 rounded-xl border text-center transition-all active:scale-95 ${
                        active
                          ? 'border-chipotle-brown bg-amber-50 ring-2 ring-chipotle-brown/20'
                          : 'border-app-border-dark bg-white hover:bg-stone-50'
                      }`}
                    >
                      <div className="text-lg leading-none">{opt.icon}</div>
                      <div className={`text-[11px] font-semibold mt-1 ${active ? 'text-chipotle-brown' : 'text-gray-800'}`}>
                        {opt.label}
                      </div>
                      <div className={`text-[10px] ${opt.desc.startsWith('+') ? 'text-amber-700' : 'text-emerald-700'}`}>
                        {opt.desc}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">วิธีชำระเงิน</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => {
                    const nextMethod = e.target.value as PaymentMethod;
                    setPaymentMethod(nextMethod);
                    try {
                      localStorage.setItem('fatcat_customer_profile', JSON.stringify(profile));
                    } catch {}
                  }}
                  className="w-full text-xs p-2.5 rounded-xl border border-app-border-dark bg-white"
                >
                  <option value="qr">📲 สแกน QR ถุงเงิน</option>
                  <option value="cash">💵 เงินสดหน้าร้าน</option>
                  <option value="thai_chuay_thai">🇹🇭 ไทยช่วยไทย</option>
                </select>
              </div>
            </div>

            {/* Ground-floor pickup hint */}
            {orderType === 'รับอาหารข้างล่างชั้น 1' && (
              <div className="p-2.5 bg-emerald-50/70 border border-emerald-200 rounded-xl text-[11px] text-emerald-800">
                🏢 ร้านจะวางอาหารไว้ข้างล่างชั้น 1 และส่งรูปหลักฐานให้ดูในหน้าประวัติออเดอร์ครับ
              </div>
            )}

            {/* Stairs / Condo Delivery Extra Fields */}
            {(isCondoDelivery || isStairs) && (
              <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl space-y-2">
                <div className={isCondoDelivery ? 'grid grid-cols-2 gap-2' : 'grid grid-cols-1 gap-2'}>
                  <div>
                    <label className="block text-[11px] font-medium text-amber-900 mb-1">
                      {isStairs ? 'ไปส่งบันไดหนีไฟชั้นไหน *' : 'ชั้น *'}
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={profile.floor}
                      onChange={(e) => handleProfileChange('floor', e.target.value)}
                      placeholder="เช่น 7"
                      className="w-full text-xs p-2 rounded-lg border border-amber-300 bg-white"
                    />
                  </div>
                  {isCondoDelivery && (
                    <div>
                      <label className="block text-[11px] font-medium text-amber-900 mb-1">เลขห้อง *</label>
                      <input
                        type="text"
                        value={profile.room}
                        onChange={(e) => handleProfileChange('room', e.target.value)}
                        placeholder="เช่น 702"
                        className="w-full text-xs p-2 rounded-lg border border-amber-300 bg-white"
                      />
                    </div>
                  )}
                </div>
                {isCondoDelivery && (
                  <div className="pt-0.5 text-[11px]">
                    {isFloor7(profile.floor) ? (
                      <span className="text-emerald-700 font-semibold flex items-center gap-1">
                        🎉 สิทธิพิเศษ: ชั้น 7 แขวนหน้าห้อง ฟรีค่าส่ง! (0 บาท)
                      </span>
                    ) : (
                      <span className="text-amber-800 flex items-center gap-1">
                        ℹ️ ค่าส่งแขวนหน้าห้อง +5 บาท (เฉพาะชั้น 7 ฟรีค่าส่ง)
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Order Note */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                หมายเหตุถึงร้าน (ถ้ามี)
              </label>
              <input
                type="text"
                value={orderNote}
                onChange={(e) => setOrderNote(e.target.value)}
                placeholder="เช่น ขอช้อนส้อม, ไม่รับผักชี, แยกน้ำ..."
                className="w-full text-xs p-2.5 rounded-xl border border-app-border-dark focus:ring-1 focus:ring-chipotle-brown"
              />
            </div>

            {/* Reward Coupon Discount Option */}
            {availableRewards > 0 && (
              <div className="p-3 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-300 rounded-2xl flex items-center justify-between gap-3 shadow-xs">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center text-sm shrink-0">
                    🎟️
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs font-bold text-emerald-950 block">
                      ใช้ส่วนลดสะสมแต้ม 10 บาท
                    </span>
                    <span className="text-[10px] text-emerald-700 block">
                      มีคูปองสะสมครบ 10 กล่องว่างอยู่ {availableRewards} สิทธิ์
                    </span>
                  </div>
                </div>

                <label className="flex items-center gap-2 cursor-pointer bg-white px-3 py-1.5 rounded-full border border-emerald-200 shadow-xs hover:border-emerald-400 transition-all shrink-0">
                  <input
                    type="checkbox"
                    checked={useRewardDiscount}
                    onChange={(e) => {
                      setUseRewardDiscount(e.target.checked);
                      setQrLoaded(false);
                    }}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                  />
                  <span className="text-xs font-bold text-emerald-800 whitespace-nowrap">
                    ลด 10฿
                  </span>
                </label>
              </div>
            )}

            {/* Price Summary Breakdown if Delivery Fee or Discount Applied */}
            {(isCondoDelivery || discountAmount > 0) && (
              <div className="bg-[#FAF7F3] border border-app-border rounded-xl p-3 text-xs space-y-1.5">
                <div className="flex justify-between text-gray-600">
                  <span>ค่าอาหาร:</span>
                  <span className="font-en">{formatPrice(subTotal)} บาท</span>
                </div>
                {isCondoDelivery && (
                  <div className={`flex justify-between font-medium ${deliveryFee === 0 ? 'text-emerald-700' : 'text-amber-800'}`}>
                    <span>{deliveryFee === 0 ? '🎉 ค่าส่งแขวนหน้าห้อง (โปรฯ ชั้น 7):' : '🚪 ค่าส่งแขวนหน้าห้องคอนโด:'}</span>
                    <span className="font-en">{deliveryFee === 0 ? 'ฟรี (0.00 บาท)' : '+5.00 บาท'}</span>
                  </div>
                )}
                {discountAmount > 0 && (
                  <div className="flex justify-between text-emerald-700 font-medium">
                    <span>🎟️ ส่วนลดสะสมแต้ม (10 กล่อง):</span>
                    <span className="font-en">-10.00 บาท</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-chipotle-brown pt-1.5 border-t border-gray-200">
                  <span>ยอดชำระสุทธิ:</span>
                  <span className="text-chipotle-brown font-en text-sm">{formatPrice(finalGrandTotal)} บาท</span>
                </div>
              </div>
            )}

            {/* PromptPay QR Code Box */}
            {paymentMethod === 'qr' && (
              <div className="p-3 bg-stone-50 border border-app-border-dark rounded-2xl text-center space-y-2">
                <div className="text-xs font-bold text-chipotle-gold font-en">📲 PROMPTPAY / THUNG NGERN QR</div>
                <div className="text-xs font-medium text-chipotle-brown">
                  แมวอ้วนต้มน้ำปลา (น.ส. ศรัญญา ประกอบมูล)
                </div>
                <div className="text-base font-bold text-chipotle-brown font-en">
                  ยอดโอนสุทธิ {formatPrice(finalGrandTotal)} บาท
                </div>

                <div className="w-44 h-44 mx-auto bg-white p-2 border border-gray-200 rounded-xl flex items-center justify-center relative overflow-hidden">
                  {!qrLoaded && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-50 text-xs text-gray-400 gap-1.5">
                      <div className="w-6 h-6 border-2 border-chipotle-gold border-t-transparent rounded-full animate-spin" />
                      <span className="text-[10px]">กำลังสร้าง QR Code...</span>
                    </div>
                  )}
                  <img
                    src={`/api/promptpay-qr-image?amount=${finalGrandTotal.toFixed(2)}`}
                    alt="PromptPay QR"
                    className={`w-full h-full object-contain transition-opacity duration-200 ${qrLoaded ? 'opacity-100' : 'opacity-0'}`}
                    onLoad={() => setQrLoaded(true)}
                  />
                </div>

                {/* Slip Upload */}
                <label className="block cursor-pointer p-3 border border-dashed border-chipotle-gold/40 rounded-xl bg-amber-50/30 hover:bg-amber-50/60 transition-colors">
                  <span className="text-xs font-semibold text-chipotle-brown block">
                    📸 แตะที่นี่เพื่อแนบสลิปโอนเงิน
                  </span>
                  <span className="text-[10px] text-app-muted block mt-0.5">
                    ระบบตรวจรหัส QR บนสลิปอัตโนมัติ
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleSlipUpload}
                    className="hidden"
                  />
                </label>

                {slipFileBase64 && (
                  <div className="text-xs text-emerald-700 bg-emerald-50 py-1 px-2 rounded-md font-medium">
                    ✓ แนบสลิปเรียบร้อยแล้ว
                  </div>
                )}
              </div>
            )}

            {/* Error Message */}
            {errorMessage && (
              <div className="text-xs text-red-600 bg-red-50 p-2.5 rounded-xl border border-red-200 text-center">
                {errorMessage}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-3.5 border-t border-app-border bg-white shrink-0">
          <button
            type="button"
            disabled={isSubmitting || cartItems.length === 0 || !isStoreOpen}
            onClick={handleSubmit}
            className={isStoreOpen
              ? "w-full bg-chipotle-brown hover:bg-chipotle-brown-hover active:scale-[0.98] disabled:opacity-50 text-white py-3 px-4 rounded-full font-semibold text-sm shadow-md transition-all font-en"
              : "w-full bg-gray-300 text-gray-500 py-3 px-4 rounded-full font-semibold text-xs cursor-not-allowed select-none"
            }
          >
            {!isStoreOpen
              ? '🔴 ร้านปิดรับออเดอร์ชั่วคราว'
              : isSubmitting
              ? 'กำลังส่งออเดอร์...'
              : `CONFIRM & PAY (${formatPrice(finalGrandTotal)})`}
          </button>
        </div>
      </div>
    </div>
  );
};
