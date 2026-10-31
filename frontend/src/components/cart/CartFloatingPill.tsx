import React from 'react';
import { ShoppingBag } from 'lucide-react';
import { formatPrice } from '../../lib/utils';

interface CartFloatingPillProps {
  totalQuantity: number;
  grandTotal: number;
  onOpenCheckout: () => void;
  isStoreOpen?: boolean;
}

export const CartFloatingPill: React.FC<CartFloatingPillProps> = ({
  totalQuantity,
  grandTotal,
  onOpenCheckout,
  isStoreOpen = true,
}) => {
  if (totalQuantity <= 0) return null;

  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-40 w-[calc(100%-32px)] max-w-[468px] animate-in slide-in-from-bottom-4 duration-200">
      <button
        type="button"
        onClick={onOpenCheckout}
        className={isStoreOpen
          ? "w-full bg-chipotle-brown hover:bg-chipotle-brown-hover active:scale-[0.98] text-white py-3 px-4 rounded-full flex items-center justify-between shadow-xl transition-all select-none"
          : "w-full bg-gray-600 hover:bg-gray-700 active:scale-[0.98] text-white py-3 px-4 rounded-full flex items-center justify-between shadow-xl transition-all select-none"
        }
      >
        <div className="flex items-center gap-2.5">
          <span className="bg-white/20 text-white text-xs font-semibold px-2.5 py-1 rounded-full font-en">
            {totalQuantity} รายการ
          </span>
          <span className="text-xs font-medium">
            {isStoreOpen ? 'ดูถุงอาหาร & ชำระเงิน' : '🔴 ร้านปิด (ดูรายการในถุง)'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm font-bold font-en">{formatPrice(grandTotal)}</span>
          <ShoppingBag className="w-4 h-4 opacity-80" />
        </div>
      </button>
    </div>
  );
};
