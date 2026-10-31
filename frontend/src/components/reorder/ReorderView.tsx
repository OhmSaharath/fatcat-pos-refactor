import React, { useState, useEffect } from 'react';
import { RotateCcw } from 'lucide-react';
import { OrderRecord } from '../../types/order';
import { formatPrice } from '../../lib/utils';

interface ReorderViewProps {
  onReorderItems: (items: { name: string; quantity: number }[]) => void;
  onGoToMenu: () => void;
}

export const ReorderView: React.FC<ReorderViewProps> = ({ onReorderItems, onGoToMenu }) => {
  const [orders, setOrders] = useState<OrderRecord[]>([]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('fatcat_local_orders');
      if (saved) {
        setOrders(JSON.parse(saved));
      }
    } catch {
      setOrders([]);
    }
  }, []);

  if (orders.length === 0) {
    return (
      <div className="p-4">
        <h1 className="text-xl font-semibold text-chipotle-brown tracking-tight mb-1">
          Reorder (สั่งซ้ำเมนูโปรด)
        </h1>
        <p className="text-xs text-app-muted mb-6">
          เลือกออเดอร์เดิมที่คุณเคยสั่ง เพื่อสั่งซ้ำได้ใน 1 คลิก
        </p>

        <div className="bg-white border border-app-border rounded-2xl p-8 text-center shadow-xs">
          <div className="text-4xl mb-3">🍽️</div>
          <div className="text-sm font-bold text-chipotle-brown font-en tracking-wider mb-1">
            NO PREVIOUS ORDERS YET
          </div>
          <p className="text-xs text-app-muted mb-4 max-w-xs mx-auto">
            สั่งเมนูแรกของคุณ แล้วออเดอร์จะมาปรากฏที่นี่เพื่อกดสั่งซ้ำได้ใน 1 คลิก
          </p>
          <button
            type="button"
            onClick={onGoToMenu}
            className="bg-chipotle-brown text-white text-xs font-semibold py-2.5 px-6 rounded-full hover:bg-chipotle-brown-hover transition-colors font-en"
          >
            EXPLORE MENU ➔
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 pb-28">
      <h1 className="text-xl font-semibold text-chipotle-brown tracking-tight mb-1">
        Reorder (สั่งซ้ำเมนูโปรด)
      </h1>
      <p className="text-xs text-app-muted mb-4">
        เลือกออเดอร์เดิมที่คุณเคยสั่ง เพื่อสั่งซ้ำได้ใน 1 คลิก
      </p>

      <div className="space-y-3">
        {orders.map((o) => (
          <article
            key={o.order_code}
            className="bg-white border border-app-border rounded-2xl p-4 shadow-xs space-y-2.5"
          >
            <div className="flex items-center justify-between pb-2 border-b border-dashed border-gray-100">
              <span className="text-sm font-bold text-chipotle-brown font-en tracking-wide">
                ORDER #{o.order_code}
              </span>
              <span className="text-[11px] text-app-muted font-en">
                {o.created_at ? o.created_at.substring(0, 16).replace('T', ' ') : 'ล่าสุด'}
              </span>
            </div>

            <div className="text-xs text-gray-800 leading-relaxed">
              {o.items.map((it) => `${it.name} x${it.quantity}`).join(', ')}
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-base font-semibold text-chipotle-brown font-en">
                {formatPrice(o.total_money)}
              </span>
              <button
                type="button"
                onClick={() => onReorderItems(o.items)}
                className="bg-chipotle-brown hover:bg-chipotle-brown-hover active:scale-95 text-white text-xs font-semibold px-3.5 py-1.5 rounded-full inline-flex items-center gap-1.5 shadow-xs transition-all font-en"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                REORDER / สั่งซ้ำ
              </button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
};
