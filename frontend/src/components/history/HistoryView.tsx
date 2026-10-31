import React, { useState, useEffect, useCallback } from 'react';
import { Clock, CheckCircle2, AlertCircle, ChefHat, RotateCcw, X, Camera } from 'lucide-react';
import { cleanFrontName, formatPrice, cn } from '../../lib/utils';

interface HistoryOrderItem {
  name: string;
  quantity: number;
  price?: number;
}

interface HistoryOrder {
  order_code: string;
  order_token?: string;
  created_at?: string;
  status?: string;
  status_label?: string;
  total_money: number;
  items: HistoryOrderItem[];
  payment_method?: string;
  payment_label?: string;
  order_type?: string;
  has_delivery_proof?: boolean;
  delivery_proof_url?: string;
  delivery_proof_at?: string;
}

interface HistoryViewProps {
  lineProfile?: { userId: string; displayName: string; pictureUrl?: string } | null;
  onReorderItems: (items: { name: string; quantity: number }[]) => void;
  onGoToMenu: () => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({ lineProfile, onReorderItems, onGoToMenu }) => {
  const [orders, setOrders] = useState<HistoryOrder[]>([]);
  const [trackedOrder, setTrackedOrder] = useState<any | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [viewingProofUrl, setViewingProofUrl] = useState<string | null>(null);

  // 1. Initial Load from LocalStorage Cache
  useEffect(() => {
    try {
      const cached = localStorage.getItem('fatcat_local_orders');
      if (cached) {
        setOrders(JSON.parse(cached));
      }
    } catch {
      setOrders([]);
    }
  }, []);

  // 2. Poll Active Tracked Order
  const pollActiveOrder = useCallback(async () => {
    const code = localStorage.getItem('last_order_code');
    const token = localStorage.getItem('last_order_token');
    if (!code || !token) {
      setTrackedOrder(null);
      return;
    }

    try {
      const res = await fetch(
        `/api/order-status?code=${encodeURIComponent(code)}&token=${encodeURIComponent(token)}&_t=${Date.now()}`,
        { cache: 'no-store' }
      );
      if (res.ok) {
        const data = await res.json();
        if (data.ok && data.order) {
          setTrackedOrder(data.order);
          // Update status in orders list cache and localStorage
          setOrders((prev) => {
            const updated = prev.map((o) =>
              o.order_code === code
                ? {
                    ...o,
                    status: data.order.status,
                    status_label: data.order.status_label,
                    has_delivery_proof: data.order.has_delivery_proof,
                    delivery_proof_url: data.order.delivery_proof_url,
                    delivery_proof_at: data.order.delivery_proof_at,
                  }
                : o
            );
            try {
              localStorage.setItem('fatcat_local_orders', JSON.stringify(updated.slice(0, 30)));
            } catch {}
            return updated;
          });
        }
      }
    } catch {}
  }, []);

  // 3. Sync full order history from server (matches by phone, line, or last order code)
  const syncServerOrders = useCallback(async () => {
    let phone = '';
    let lineUid = lineProfile?.userId || localStorage.getItem('fatcat_line_user_id') || '';
    let custName = lineProfile?.displayName || localStorage.getItem('fatcat_line_display_name') || '';
    try {
      const p = JSON.parse(localStorage.getItem('fatcat_customer_profile') || '{}');
      if (p.phone) phone = p.phone;
      if (p.line_user_id) lineUid = p.line_user_id;
      if (p.name) custName = p.name;
    } catch {}

    const lastCode = localStorage.getItem('last_order_code') || '';
    if (!phone && !lineUid && !lastCode && !custName) return;

    setIsSyncing(true);
    try {
      const params = new URLSearchParams();
      if (lineUid) params.set('line_user_id', lineUid);
      if (phone) params.set('phone', phone);
      if (lastCode) params.set('order_code', lastCode);
      if (custName) params.set('customer_name', custName);
      params.set('_t', String(Date.now()));

      const res = await fetch(`/api/customer-orders?${params.toString()}`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (data.ok && Array.isArray(data.orders)) {
          setOrders((prev) => {
            const serverCodes = new Set(data.orders.map((o: any) => o.order_code));
            // Keep local cached orders that aren't on server yet, and prepend server orders
            const localOnly = prev.filter((o) => !serverCodes.has(o.order_code));
            const merged = [...data.orders, ...localOnly];
            try {
              localStorage.setItem('fatcat_local_orders', JSON.stringify(merged.slice(0, 30)));
            } catch {}
            return merged;
          });

          // Sync active tracker state from customer-orders if tracking an order
          if (lastCode) {
            const current = data.orders.find((o: any) => o.order_code === lastCode);
            if (current) {
              setTrackedOrder((prev: any) => ({
                ...(prev || {}),
                order_code: current.order_code,
                status: current.status,
                status_label: current.status_label,
                total_money: current.total_money,
                loyverse_receipt_number: current.loyverse_receipt_number,
                has_delivery_proof: current.has_delivery_proof,
                delivery_proof_url: current.delivery_proof_url,
                delivery_proof_at: current.delivery_proof_at,
              }));
            }
          }
        }
      }
    } catch {} finally {
      setIsSyncing(false);
    }
  }, [lineProfile]);

  // Initial sync once on mount
  useEffect(() => {
    pollActiveOrder();
    syncServerOrders();
  }, [pollActiveOrder, syncServerOrders]);

  // Gentle polling ONLY when an order is actively cooking or awaiting slip
  // Stops completely when order is COMPLETED, CANCELLED, or dismissed.
  useEffect(() => {
    const status = (trackedOrder?.status || '').toUpperCase();
    const isOrderActive = ['PENDING_SLIP', 'COOKING', 'READY'].includes(status);

    if (!isOrderActive) return;

    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      pollActiveOrder();
    }, 12000); // 12 seconds only while actively waiting for food

    const handleVisibilityChange = () => {
      if (typeof document !== 'undefined' && !document.hidden) {
        pollActiveOrder();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [trackedOrder?.status, pollActiveOrder]);

  const handleDismissTracker = () => {
    localStorage.removeItem('last_order_code');
    localStorage.removeItem('last_order_token');
    setTrackedOrder(null);
  };

  const getStatusBadge = (status?: string, label?: string) => {
    const s = (status || '').toUpperCase();
    const lbl = label || '';

    if (s === 'COOKING' || lbl.includes('ปรุง')) {
      return {
        bg: 'bg-amber-100 text-amber-900 border-amber-300',
        icon: <ChefHat className="w-3.5 h-3.5 text-amber-700 animate-pulse" />,
        text: lbl || '👨‍🍳 กำลังปรุงอาหาร',
      };
    }
    if (s === 'COMPLETED' || s === 'READY' || lbl.includes('เสร็จ') || lbl.includes('พร้อม')) {
      return {
        bg: 'bg-emerald-100 text-emerald-900 border-emerald-300',
        icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />,
        text: lbl || '🍽️ พร้อมรับ/เสร็จสิ้น',
      };
    }
    if (s === 'CANCELLED' || lbl.includes('ยกเลิก')) {
      return {
        bg: 'bg-red-100 text-red-900 border-red-300',
        icon: <AlertCircle className="w-3.5 h-3.5 text-red-700" />,
        text: lbl || '❌ ยกเลิกออเดอร์',
      };
    }
    return {
      bg: 'bg-blue-100 text-blue-900 border-blue-300',
      icon: <Clock className="w-3.5 h-3.5 text-blue-700 animate-pulse" />,
      text: lbl || '⏳ รอยืนยันออเดอร์',
    };
  };

  return (
    <div className="p-4 pb-28 space-y-4">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-chipotle-brown tracking-tight font-en">
            ORDER HISTORY & STATUS
          </h1>
          {isSyncing && (
            <span className="text-[10px] text-app-muted flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
              ซิงค์ข้อมูล...
            </span>
          )}
        </div>
        <p className="text-xs text-app-muted mt-0.5">
          ติดตามสถานะออเดอร์แบบเรียลไทม์ และดูประวัติการสั่งซื้อ
        </p>
      </div>

      {/* 1. Real-time Active Tracker Card */}
      {trackedOrder && (
        <div
          className={cn(
            'p-4 border-2 rounded-2xl shadow-sm relative transition-all duration-300',
            trackedOrder.status === 'COMPLETED'
              ? 'bg-gradient-to-r from-emerald-50 via-teal-50 to-green-50 border-emerald-400 shadow-emerald-100'
              : 'bg-gradient-to-r from-amber-50 to-orange-50 border-amber-300'
          )}
        >
          <button
            type="button"
            onClick={handleDismissTracker}
            className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 p-1.5 rounded-full hover:bg-black/5 transition-colors"
            title="ปิดแถบติดตาม"
          >
            <X className="w-4 h-4" />
          </button>

          <div
            className={cn(
              'text-[10px] font-bold tracking-wider font-en flex items-center gap-1.5 mb-1',
              trackedOrder.status === 'COMPLETED' ? 'text-emerald-800' : 'text-amber-800'
            )}
          >
            <span
              className={cn(
                'w-2 h-2 rounded-full',
                trackedOrder.status === 'COMPLETED' ? 'bg-emerald-500' : 'bg-emerald-500 animate-ping'
              )}
            />
            {trackedOrder.status === 'COMPLETED'
              ? 'ORDER READY • ออเดอร์ของคุณเสร็จสิ้นแล้ว 🎉'
              : 'LIVE TRACKER • กำลังติดตามออเดอร์ล่าสุด'}
          </div>

          <div className="flex items-center justify-between mb-2 pr-6">
            <span className="text-lg font-bold text-chipotle-brown font-en">
              ORDER #{trackedOrder.order_code}
            </span>
            <span className="text-base font-bold text-chipotle-brown font-en">
              ฿{formatPrice(trackedOrder.total_money || 0)}
            </span>
          </div>

          {(() => {
            const badge = getStatusBadge(trackedOrder.status, trackedOrder.status_label);
            return (
              <div className={cn('p-2.5 rounded-xl border flex items-center gap-2 text-xs font-semibold', badge.bg)}>
                {badge.icon}
                <span>{badge.text}</span>
              </div>
            );
          })()}

          {/* Delivery Proof Card in Active Tracker */}
          {trackedOrder.delivery_proof_url && (
            <div className="mt-2.5 p-2.5 bg-white/95 rounded-xl border border-emerald-300 shadow-xs flex items-center justify-between gap-2.5">
              <button
                type="button"
                onClick={() => setViewingProofUrl(trackedOrder.delivery_proof_url)}
                className="flex items-center gap-2.5 text-left hover:opacity-85 transition-opacity min-w-0"
              >
                <img
                  src={trackedOrder.delivery_proof_url}
                  alt="หลักฐานจุดส่ง"
                  className="w-12 h-12 rounded-lg object-cover border border-emerald-300 shrink-0 bg-stone-100"
                />
                <div className="min-w-0">
                  <div className="text-xs font-bold text-emerald-900 flex items-center gap-1">
                    <span>📸 ร้านส่งอาหารเรียบร้อยแล้ว</span>
                  </div>
                  <div className="text-[10px] text-emerald-700 truncate">
                    แตะเพื่อดูรูปจุดวางอาหารขนาดเต็ม
                  </div>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setViewingProofUrl(trackedOrder.delivery_proof_url)}
                className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-[11px] font-bold rounded-lg shrink-0 shadow-xs flex items-center gap-1 transition-all"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>ดูรูป</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* 2. Order History List */}
      {orders.length === 0 ? (
        <div className="bg-white border border-app-border rounded-2xl p-8 text-center shadow-2xs">
          <div className="text-4xl mb-3">🍽️</div>
          <div className="text-sm font-bold text-chipotle-brown font-en tracking-wider mb-1">
            NO PREVIOUS ORDERS YET
          </div>
          <p className="text-xs text-app-muted mb-4 max-w-xs mx-auto">
            สั่งเมนูแรกของคุณ แล้วออเดอร์และสถานะการปรุงจะปรากฏที่นี่แบบเรียลไทม์
          </p>
          <button
            type="button"
            onClick={onGoToMenu}
            className="bg-chipotle-brown text-white text-xs font-semibold py-2.5 px-6 rounded-full hover:bg-chipotle-brown-hover active:scale-95 transition-all font-en shadow-xs"
          >
            EXPLORE MENU ➔
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="text-xs font-bold text-chipotle-brown font-en tracking-wider flex items-center justify-between">
            <span>PREVIOUS ORDERS ({orders.length})</span>
            <span className="text-[10px] text-app-muted font-normal">บันทึกในเครื่องอัตโนมัติ</span>
          </div>

          {orders.map((o) => {
            const badge = getStatusBadge(o.status, o.status_label);
            return (
              <div
                key={o.order_code}
                className="p-4 bg-white border border-app-border rounded-2xl shadow-2xs space-y-2.5 hover:border-chipotle-gold/50 transition-colors"
              >
                <div className="flex items-start justify-between border-b border-gray-100 pb-2">
                  <div>
                    <span className="text-sm font-bold text-chipotle-brown font-en">
                      ORDER #{o.order_code}
                    </span>
                    <div className="text-[10px] text-app-muted mt-0.5">
                      {o.created_at ? o.created_at.substring(0, 16).replace('T', ' ') : 'ล่าสุด'}
                      {o.order_type ? ` • ${o.order_type}` : ''}
                    </div>
                  </div>

                  <span
                    className={cn(
                      'text-[10px] font-bold px-2 py-0.5 rounded-lg border inline-flex items-center gap-1',
                      badge.bg
                    )}
                  >
                    {badge.icon}
                    <span>{badge.text}</span>
                  </span>
                </div>

                {/* Items preview */}
                <div className="space-y-1">
                  {(o.items || []).map((it, idx) => (
                    <div key={idx} className="flex justify-between text-xs text-gray-700">
                      <span className="truncate pr-2">
                        {cleanFrontName(it.name)} <span className="text-app-muted">x{it.quantity}</span>
                      </span>
                      {it.price !== undefined && (
                        <span className="text-app-muted shrink-0">
                          ฿{formatPrice(it.price * it.quantity)}
                        </span>
                      )}
                    </div>
                  ))}
                </div>

                {/* Delivery proof badge in history list */}
                {o.delivery_proof_url && (
                  <div className="pt-1.5">
                    <button
                      type="button"
                      onClick={() => setViewingProofUrl(o.delivery_proof_url!)}
                      className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-900 rounded-xl text-[11px] font-semibold flex items-center gap-1.5 transition-colors active:scale-95 shadow-2xs"
                    >
                      <Camera className="w-3.5 h-3.5 text-emerald-700" />
                      <span>📸 ดูรูปจุดส่งอาหาร (ที่ร้านถ่ายไว้)</span>
                    </button>
                  </div>
                )}

                {/* Footer: Price & Reorder Action */}
                <div className="pt-2 border-t border-dashed border-gray-100 flex items-center justify-between">
                  <div className="text-xs">
                    <span className="text-app-muted text-[10px] block">
                      {o.payment_label || (o.payment_method === 'cash' ? '💵 เงินสดหน้าร้าน' : '📲 QR ถุงเงิน')}
                    </span>
                    <span className="font-bold text-chipotle-brown font-en text-sm">
                      ฿{formatPrice(o.total_money || 0)}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      onReorderItems(
                        o.items.map((it) => ({
                          name: it.name,
                          quantity: it.quantity,
                        }))
                      )
                    }
                    className="bg-[#2B1810] hover:bg-[#3D1E0B] active:scale-95 text-white text-[11px] font-semibold px-3 py-1.5 rounded-full inline-flex items-center gap-1 shadow-xs transition-all font-en"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>REORDER / สั่งซ้ำ</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Customer Full-size Delivery Proof Modal */}
      {viewingProofUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white rounded-3xl overflow-hidden shadow-2xl border border-app-border flex flex-col max-h-[90vh]">
            <div className="h-12 px-4 border-b border-app-border flex items-center justify-between bg-stone-50 shrink-0">
              <div className="flex items-center gap-1.5">
                <Camera className="w-4 h-4 text-emerald-600" />
                <span className="text-xs font-bold text-chipotle-brown font-sans">
                  รูปหลักฐานจุดวางส่งอาหาร
                </span>
              </div>
              <button
                type="button"
                onClick={() => setViewingProofUrl(null)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-3 flex items-center justify-center bg-black/5 min-h-[300px]">
              <img
                src={viewingProofUrl}
                alt="หลักฐานจุดส่งอาหาร"
                className="max-h-[65vh] w-auto object-contain rounded-2xl shadow-md border border-gray-200"
              />
            </div>
            <div className="p-3 bg-stone-50 border-t border-app-border text-center text-xs text-app-muted">
              💡 ร้านได้วางอาหารไว้ที่จุดนี้เรียบร้อยแล้ว ขอให้อร่อยกับมื้อนี้นะครับ 🙏
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
