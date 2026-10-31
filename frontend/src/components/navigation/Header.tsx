import React from 'react';
import { ShoppingBag } from 'lucide-react';

interface HeaderProps {
  cartCount: number;
  onOpenCart: () => void;
  onOpenProfile: () => void;
  profileAvatarUrl?: string;
  isOpen?: boolean;
  announcement?: string;
  closedMessage?: string;
  isLoading?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  cartCount,
  onOpenCart,
  onOpenProfile,
  profileAvatarUrl,
  isOpen = false,
  announcement,
  closedMessage,
  isLoading = false,
}) => {
  return (
    <header className="sticky top-0 z-30 bg-white border-b border-app-border shadow-xs">
      <div className="h-[58px] px-4 flex items-center justify-between gap-3">
        {/* Left: Avatar */}
        <button
          type="button"
          onClick={onOpenProfile}
          className="w-9 h-9 rounded-full bg-[#F2ECE4] border-[1.5px] border-app-border-dark flex items-center justify-center overflow-hidden transition-transform active:scale-95 shrink-0"
          title="บัญชีลูกค้า"
        >
          {profileAvatarUrl ? (
            <img src={profileAvatarUrl} alt="Avatar" className="w-full h-full object-cover" />
          ) : (
            <span className="text-base">👤</span>
          )}
        </button>

        {/* Center: Store Brand & Condo Delivery Indicator */}
        <div className="flex flex-col items-center justify-center text-center min-w-0">
          <span className="text-sm font-bold text-chipotle-brown tracking-tight font-sans">
            แมวอ้วน & ข้าวไข่ข้น
          </span>
          <div className="flex items-center gap-1 bg-[#F4EFE8] border border-app-border-dark/60 rounded-full px-2 py-0.5 mt-0.5">
            <span className="text-[10px] text-amber-900 font-medium">🚪 จัดส่งถึงหน้าห้องคอนโด</span>
            <span className="text-[9px] text-emerald-700 font-bold bg-emerald-100/90 px-1 rounded-sm">ชั้น 7 ส่งฟรี</span>
          </div>
        </div>

        {/* Right: Cart Button */}
        <button
          type="button"
          onClick={onOpenCart}
          className="relative w-9 h-9 flex items-center justify-center text-chipotle-brown hover:bg-gray-50 rounded-full transition-transform active:scale-95"
          title="ถุงอาหาร"
        >
          <ShoppingBag className="w-5 h-5" />
          {cartCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-chipotle-red text-white text-[10px] font-bold w-[18px] h-[18px] rounded-full flex items-center justify-center border-2 border-white shadow-sm animate-pulse">
              {cartCount > 99 ? '99+' : cartCount}
            </span>
          )}
        </button>
      </div>

      {/* Store status strip */}
      {isLoading ? (
        <div className="bg-[#FAF7F3] text-app-muted text-[11px] font-medium py-1 px-3 flex items-center justify-center gap-1.5 border-t border-app-border-dark/30 text-center animate-pulse">
          <span className="w-1.5 h-1.5 rounded-full bg-gray-400"></span>
          <span>กำลังตรวจสอบสถานะร้าน...</span>
        </div>
      ) : isOpen ? (
        <div className="bg-emerald-50 text-emerald-800 text-[11px] font-medium py-1 px-3 flex items-center justify-center gap-1.5 border-t border-emerald-100 text-center">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
          <span className="truncate">{announcement || 'ร้านเปิดรับออเดอร์ • ครัวพร้อมเสิร์ฟความอร่อย'}</span>
        </div>
      ) : (
        <div className="bg-rose-50 text-rose-800 text-[11px] font-semibold py-1.5 px-3 flex items-center justify-center gap-1.5 border-t border-rose-200 text-center">
          <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0"></span>
          <span>🔴 {closedMessage || 'ขณะนี้ร้านปิดรับออเดอร์ชั่วคราว ขออภัยในความไม่สะดวกครับ'}</span>
        </div>
      )}
    </header>
  );
};
