import React, { useState, useEffect } from 'react';
import { Clock, Phone, MapPin, Check, CookingPot, X, Eye, Receipt, Camera, Loader2, MessageCircle, RotateCw, CheckCircle2, AlertCircle, Globe, Timer } from 'lucide-react';
import { formatPrice, cn, formatOrderTime, formatDuration, parseDate } from '../../lib/utils';

export interface AdminOrderRecord {
  order_code: string;
  created_at: string;
  customer_name: string;
  phone?: string;
  floor?: string;
  room?: string;
  order_type: string;
  delivery_fee?: number;
  payment_method: string;
  payment_label: string;
  total_money: number;
  slip_image?: string;
  has_slip?: boolean;
  slip_verification?: any;
  items: Array<{
    item_id?: string;
    name: string;
    quantity: number;
    price: number;
    modifiers?: Array<{ name: string; price: number }>;
    item_note?: string;
  }>;
  status: 'PENDING_SLIP' | 'COOKING' | 'COMPLETED' | 'CANCELLED';
  status_label: string;
  loyverse_receipt_number?: string | null;
  delivery_proof_url?: string;
  delivery_proof_at?: string;
  completed_at?: string;
  cooking_started_at?: string;
  line_user_id?: string;
  customer_line_notify_status?: 'SUCCESS' | 'FAILED' | 'NO_LINE_UID' | 'NOT_SENT';
  customer_line_notify_at?: string;
  customer_line_notify_detail?: string;
  customer_line_notify_logs?: Array<{
    action: string;
    title: string;
    sent_at: string;
    success: boolean;
    detail: string;
  }>;
}

interface AdminOrderCardProps {
  order: AdminOrderRecord;
  onAction: (orderCode: string, action: 'approve_and_push_pos' | 'mark_done' | 'cancel') => void;
  onViewSlip: (order: AdminOrderRecord) => void;
  onUploadProof?: (orderCode: string, file: File) => Promise<void>;
  onViewProof?: (url: string, orderCode: string) => void;
  onResendNotification?: (orderCode: string) => Promise<void>;
  isActionLoading?: boolean;
}

export const AdminOrderCard: React.FC<AdminOrderCardProps> = ({
  order,
  onAction,
  onViewSlip,
  onUploadProof,
  onViewProof,
  onResendNotification,
  isActionLoading,
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const isPending = order.status === 'PENDING_SLIP';
  const isCooking = order.status === 'COOKING';
  const isDone = order.status === 'COMPLETED';
  const isCancelled = order.status === 'CANCELLED';
  const canViewSlip = Boolean(order.slip_image || order.has_slip || order.payment_method === 'qr');

  // Live Elapsed / Kitchen Timer
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    if (isDone || isCancelled) return;
    const interval = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, [isDone, isCancelled]);

  const createdDate = parseDate(order.created_at);
  const completedDate = parseDate(order.completed_at || order.delivery_proof_at);

  let timerBadge = null;
  if (createdDate) {
    if (isDone) {
      const durSec = completedDate
        ? Math.floor((completedDate.getTime() - createdDate.getTime()) / 1000)
        : null;
      timerBadge = (
        <span
          className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1 shadow-2xs shrink-0"
          title={`เวลาเริ่มสั่ง: ${formatOrderTime(order.created_at)} • เวลาส่งเสร็จ: ${completedDate ? formatOrderTime(order.completed_at || order.delivery_proof_at) : '-'}`}
        >
          <Timer className="w-3 h-3 text-emerald-600 shrink-0" />
          <span>{durSec !== null && durSec >= 0 ? `เสร็จใน ${formatDuration(durSec)}` : 'เสร็จสิ้น'}</span>
        </span>
      );
    } else if (isCancelled) {
      timerBadge = (
        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 border border-gray-200 flex items-center gap-1 shrink-0">
          <span>ยกเลิก</span>
        </span>
      );
    } else {
      // Active order timer (Pending / Cooking)
      const elapsedSec = Math.max(0, Math.floor((now.getTime() - createdDate.getTime()) / 1000));
      const isOverdue = elapsedSec >= 900; // > 15 mins
      const isWarning = elapsedSec >= 600 && elapsedSec < 900; // 10 - 15 mins

      timerBadge = (
        <span
          className={cn(
            'text-[10.5px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 transition-all shadow-2xs font-mono shrink-0',
            !isWarning && !isOverdue && 'bg-emerald-50 text-emerald-800 border-emerald-300',
            isWarning && 'bg-amber-100/90 text-amber-900 border-amber-300 animate-pulse',
            isOverdue && 'bg-rose-100 text-rose-900 border-rose-400 animate-pulse ring-2 ring-rose-400/30'
          )}
          title={`เริ่มนับเวลาตั้งแต่ ${formatOrderTime(order.created_at)} (${isOverdue ? 'เกิน 15 นาทีแล้ว!' : isWarning ? 'เกิน 10 นาทีแล้ว' : 'กำลังทำอาหาร'})`}
        >
          <Timer className={cn('w-3 h-3 shrink-0', isOverdue ? 'text-rose-600' : isWarning ? 'text-amber-700' : 'text-emerald-600')} />
          <span>{formatDuration(elapsedSec)}</span>
          {isOverdue && <span className="text-[10px]" title="ออเดอร์นี้นานเกิน 15 นาทีแล้ว!">⚠️</span>}
        </span>
      );
    }
  }

  return (
    <article
      className={cn(
        'bg-white border rounded-2xl p-4 shadow-sm transition-all',
        isPending && 'border-amber-300 ring-2 ring-amber-400/20 bg-amber-50/10',
        isCooking && 'border-blue-300 bg-blue-50/10',
        isDone && 'border-emerald-200 opacity-90',
        isCancelled && 'border-gray-200 opacity-60 bg-gray-50'
      )}
    >
      {/* Top Header Row */}
      <div className="flex items-center justify-between pb-3 border-b border-app-border gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-base font-bold text-chipotle-brown font-en tracking-tight">
            #{order.order_code}
          </span>
          <span
            className={cn(
              'text-[10px] font-semibold px-2.5 py-0.5 rounded-full border',
              isPending && 'bg-amber-100 text-amber-900 border-amber-300 animate-pulse',
              isCooking && 'bg-blue-100 text-blue-900 border-blue-300',
              isDone && 'bg-emerald-100 text-emerald-900 border-emerald-300',
              isCancelled && 'bg-gray-200 text-gray-700 border-gray-300'
            )}
          >
            {order.status_label || order.status}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {timerBadge}
          <div
            className="text-[11px] text-gray-500 flex items-center gap-1 font-medium font-en bg-stone-50 px-2 py-0.5 rounded-md border border-gray-200 shrink-0"
            title={`เวลาสั่งซื้อ: ${order.created_at}`}
          >
            <Clock className="w-3.5 h-3.5 text-gray-400 shrink-0" />
            <span>{formatOrderTime(order.created_at)}</span>
          </div>
        </div>
      </div>

      {/* Customer Info Row */}
      <div className="py-2.5 border-b border-app-border/60 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-gray-900">{order.customer_name}</span>
          {order.phone && (
            <a
              href={`tel:${order.phone}`}
              className="text-app-muted hover:text-chipotle-brown flex items-center gap-1 font-en"
            >
              <Phone className="w-3 h-3" />
              <span>{order.phone}</span>
            </a>
          )}
        </div>

        <div className="flex items-center gap-1.5 text-xs text-chipotle-brown font-medium">
          <MapPin className="w-3.5 h-3.5 text-chipotle-gold shrink-0" />
          <span>{order.order_type}</span>
          {(order.floor || order.room) && (
            <span className="bg-amber-100/70 text-amber-900 px-1.5 py-0.5 rounded text-[11px] font-semibold">
              ชั้น {order.floor} ห้อง {order.room}
            </span>
          )}
        </div>
      </div>

      {/* Items List */}
      <div className="py-3 space-y-2">
        {order.items.map((it, idx) => (
          <div key={idx} className="text-xs flex items-start justify-between gap-2">
            <div className="flex-1">
              <div className="font-medium text-gray-900">
                <span className="font-bold text-chipotle-brown font-en mr-1.5">{it.quantity}x</span>
                <span>{it.name}</span>
              </div>
              {it.modifiers && it.modifiers.length > 0 && (
                <div className="text-[11px] text-app-muted ml-5">
                  + {it.modifiers.map((m) => m.name).join(', ')}
                </div>
              )}
              {it.item_note && (
                <div className="text-[11px] text-amber-800 bg-amber-50/80 px-2 py-0.5 rounded mt-0.5 ml-5 inline-block">
                  💬 หมายเหตุ: {it.item_note}
                </div>
              )}
            </div>
            <div className="text-xs font-semibold text-gray-700 font-en">
              ฿{((it.price + (it.modifiers ? it.modifiers.reduce((s, m) => s + m.price, 0) : 0)) * it.quantity).toFixed(0)}
            </div>
          </div>
        ))}

        {order.delivery_fee ? (
          <div className="text-xs flex items-center justify-between text-app-muted pt-1 border-t border-dashed border-gray-200">
            <span>ค่าจัดส่งถึงหน้าห้อง</span>
            <span className="font-en font-semibold">+฿{order.delivery_fee.toFixed(0)}</span>
          </div>
        ) : null}
      </div>

      {/* Payment & Slip Inspection Row */}
      <div className="pt-2.5 pb-2 border-t border-app-border flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {canViewSlip ? (
            <button
              type="button"
              onClick={() => onViewSlip(order)}
              className="px-2.5 py-1 rounded-xl bg-amber-50 hover:bg-amber-100 active:scale-95 text-amber-900 border border-amber-300 text-[11px] font-semibold flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
              title="เปิดดูรูปสลิปและผลตรวจ AI"
            >
              <Eye className="w-3.5 h-3.5 text-amber-700" />
              <span>ตรวจสลิป</span>
              {order.slip_verification?.amount_matched && (
                <span className="w-2 h-2 rounded-full bg-emerald-500" title="ตรงยอดเงิน" />
              )}
            </button>
          ) : (
            <span className="text-[11px] text-gray-400">
              {order.payment_method === 'cash' ? '💵 เงินสดหน้าร้าน' : 'ยังไม่แนบสลิป'}
            </span>
          )}

          {order.loyverse_receipt_number && (
            <span className="text-[11px] text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-lg flex items-center gap-1 font-mono font-medium">
              <Receipt className="w-3 h-3" />
              <span>{order.loyverse_receipt_number}</span>
            </span>
          )}
        </div>

        <div className="text-right">
          <div className="text-[10px] text-app-muted">{order.payment_label}</div>
          <div className="text-base font-bold text-chipotle-brown font-en">
            ฿{formatPrice(order.total_money)}
          </div>
        </div>
      </div>

      {/* Delivery Proof Photo Section (for Cooking and Completed orders) */}
      {(isCooking || isDone) && (
        <div className="pt-2 pb-1 border-t border-dashed border-gray-200">
          {order.delivery_proof_url ? (
            <div className="p-2 bg-emerald-50/80 border border-emerald-200 rounded-xl flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => onViewProof?.(order.delivery_proof_url!, order.order_code)}
                className="flex items-center gap-2.5 text-left hover:opacity-85 transition-opacity min-w-0"
              >
                <img
                  src={order.delivery_proof_url}
                  alt="หลักฐานส่ง"
                  className="w-10 h-10 rounded-lg object-cover border border-emerald-300 shrink-0 bg-white"
                />
                <div className="min-w-0">
                  <div className="text-[11px] font-bold text-emerald-900 flex items-center gap-1 truncate">
                    <span>📸 ส่งอาหารแล้ว (มีรูป)</span>
                  </div>
                  <div className="text-[10px] text-emerald-700 truncate">
                    {order.delivery_proof_at ? `อัปโหลด ${order.delivery_proof_at.split(' ')[1] || order.delivery_proof_at}` : 'แตะเพื่อเปิดดูภาพเต็ม'}
                  </div>
                </div>
              </button>

              <label className="text-[10px] font-semibold text-emerald-800 bg-white hover:bg-emerald-100 border border-emerald-300 px-2.5 py-1 rounded-lg cursor-pointer transition-all shadow-2xs shrink-0 active:scale-95">
                {isUploading ? (
                  <span className="flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span>กำลังส่ง...</span>
                  </span>
                ) : (
                  <span>ถ่ายใหม่</span>
                )}
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  disabled={isUploading}
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file && onUploadProof) {
                      setIsUploading(true);
                      try {
                        await onUploadProof(order.order_code, file);
                      } finally {
                        setIsUploading(false);
                      }
                    }
                  }}
                />
              </label>
            </div>
          ) : (
            <label className="w-full py-1.5 px-3 bg-gradient-to-r from-amber-50 to-orange-50 hover:from-amber-100 hover:to-orange-100 active:scale-98 border border-amber-300 text-amber-900 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-all shadow-2xs">
              {isUploading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-700" />
                  <span>กำลังอัปโหลดรูปหลักฐาน...</span>
                </>
              ) : (
                <>
                  <Camera className="w-3.5 h-3.5 text-amber-700" />
                  <span>📸 ถ่ายรูปหลักฐานส่งอาหาร (ส่งให้ลูกค้าดู)</span>
                </>
              )}
              <input
                type="file"
                accept="image/*"
                capture="environment"
                disabled={isUploading}
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file && onUploadProof) {
                    setIsUploading(true);
                    try {
                      await onUploadProof(order.order_code, file);
                    } finally {
                      setIsUploading(false);
                    }
                  }
                }}
              />
            </label>
          )}
        </div>
      )}

      {/* Customer LINE Notification Status */}
      <div className="pt-2 pb-1 border-t border-dashed border-gray-200">
        <div
          className={cn(
            'p-2 rounded-xl border flex items-center justify-between gap-2 text-xs transition-colors',
            order.customer_line_notify_status === 'SUCCESS' && 'bg-emerald-50/70 border-emerald-200 text-emerald-900',
            order.customer_line_notify_status === 'FAILED' && 'bg-rose-50/80 border-rose-200 text-rose-900',
            order.customer_line_notify_status === 'NO_LINE_UID' && 'bg-stone-50 border-gray-200 text-gray-600',
            (!order.customer_line_notify_status || order.customer_line_notify_status === 'NOT_SENT') &&
              (order.line_user_id ? 'bg-amber-50/60 border-amber-200 text-amber-900' : 'bg-stone-50 border-gray-200 text-gray-500')
          )}
        >
          <div className="min-w-0 flex items-center gap-2">
            <span className="shrink-0">
              {order.customer_line_notify_status === 'SUCCESS' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              ) : order.customer_line_notify_status === 'FAILED' ? (
                <AlertCircle className="w-4 h-4 text-rose-600" />
              ) : order.line_user_id ? (
                <MessageCircle className="w-4 h-4 text-amber-600" />
              ) : (
                <Globe className="w-4 h-4 text-gray-400" />
              )}
            </span>
            <div className="min-w-0">
              <div className="font-bold text-[11px] flex items-center gap-1.5 truncate">
                <span>LINE ลูกค้า:</span>
                <span>
                  {order.customer_line_notify_status === 'SUCCESS'
                    ? 'ส่งแจ้งเตือนสำเร็จแล้ว ✅'
                    : order.customer_line_notify_status === 'FAILED'
                    ? 'ส่งข้อความไม่สำเร็จ ❌'
                    : order.customer_line_notify_status === 'NO_LINE_UID'
                    ? 'สั่งผ่านเว็บ (ไม่มี LINE ID)'
                    : order.line_user_id
                    ? 'พร้อมส่งแจ้งเตือน (มี LINE UID)'
                    : 'ไม่มี LINE UID'}
                </span>
              </div>
              <div className="text-[10px] opacity-80 truncate">
                {order.customer_line_notify_detail ||
                  (order.line_user_id
                    ? `ID: ${order.line_user_id.slice(0, 6)}… (จะส่งเมื่อเริ่มทำหรือถ่ายรูปส่ง)`
                    : 'ลูกค้าเปิดสั่งผ่านบราวเซอร์ภายนอก ดูรูปผ่านหน้าประวัติได้')}
                {order.customer_line_notify_at &&
                  ` • ${order.customer_line_notify_at.split(' ')[1] || order.customer_line_notify_at}`}
              </div>
            </div>
          </div>

          {/* Resend button if order has line_user_id */}
          {order.line_user_id && onResendNotification && (
            <button
              type="button"
              disabled={isResending}
              onClick={async () => {
                setIsResending(true);
                try {
                  await onResendNotification(order.order_code);
                } finally {
                  setIsResending(false);
                }
              }}
              className="px-2 py-1 bg-white hover:bg-gray-50 border border-gray-300 rounded-lg text-[10px] font-semibold text-gray-700 shrink-0 transition-all shadow-2xs flex items-center gap-1 active:scale-95 cursor-pointer disabled:opacity-50"
              title="กดส่งข้อความสถานะล่าสุดหาลูกค้าทาง LINE อีกครั้ง"
            >
              <RotateCw className={cn('w-3 h-3', isResending && 'animate-spin')} />
              <span>{isResending ? 'กำลังส่ง...' : 'ส่งซ้ำ'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="pt-2 border-t border-app-border/60 flex items-center gap-2">
        {isPending && (
          <button
            type="button"
            disabled={isActionLoading}
            onClick={() => onAction(order.order_code, 'approve_and_push_pos')}
            className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-sm active:scale-95 disabled:opacity-50"
          >
            <CookingPot className="w-4 h-4" />
            <span>ตรวจสลิปผ่าน & ส่งเข้า Loyverse POS</span>
          </button>
        )}

        {isCooking && (
          <button
            type="button"
            disabled={isActionLoading}
            onClick={() => onAction(order.order_code, 'mark_done')}
            className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-sm active:scale-95 disabled:opacity-50"
          >
            <Check className="w-4 h-4" />
            <span>ทำเสร็จแล้ว (พร้อมส่งมอบ)</span>
          </button>
        )}

        {!isDone && !isCancelled && (
          <button
            type="button"
            disabled={isActionLoading}
            onClick={() => {
              if (window.confirm(`ยืนยันยกเลิกออเดอร์ #${order.order_code} หรือไม่?`)) {
                onAction(order.order_code, 'cancel');
              }
            }}
            className="px-3 py-2 border border-gray-300 hover:bg-red-50 hover:text-red-600 text-gray-500 rounded-xl text-xs font-medium flex items-center justify-center transition-colors"
            title="ยกเลิกออเดอร์"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </article>
  );
};
