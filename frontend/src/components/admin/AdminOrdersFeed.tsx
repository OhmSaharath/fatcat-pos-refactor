import React, { useState, useMemo } from 'react';
import { AdminOrderRecord, AdminOrderCard } from './AdminOrderCard';
import { Clock, Search } from 'lucide-react';

interface AdminOrdersFeedProps {
  orders: AdminOrderRecord[];
  onAction: (orderCode: string, action: 'approve_and_push_pos' | 'mark_done' | 'cancel') => void;
  onViewSlip: (order: AdminOrderRecord) => void;
  onUploadProof?: (orderCode: string, file: File) => Promise<void>;
  onViewProof?: (url: string, orderCode: string) => void;
  onResendNotification?: (orderCode: string) => Promise<void>;
  isActionLoading?: boolean;
}

type OrderFilter = 'all' | 'pending' | 'cooking' | 'done' | 'cancelled';

export const AdminOrdersFeed: React.FC<AdminOrdersFeedProps> = ({
  orders,
  onAction,
  onViewSlip,
  onUploadProof,
  onViewProof,
  onResendNotification,
  isActionLoading,
}) => {
  const [filter, setFilter] = useState<OrderFilter>('pending');
  const [search, setSearch] = useState('');

  const counts = useMemo(() => {
    return {
      all: orders.length,
      pending: orders.filter((o) => o.status === 'PENDING_SLIP').length,
      cooking: orders.filter((o) => o.status === 'COOKING').length,
      done: orders.filter((o) => o.status === 'COMPLETED').length,
      cancelled: orders.filter((o) => o.status === 'CANCELLED').length,
    };
  }, [orders]);

  const filteredOrders = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders.filter((o) => {
      // Status filter
      if (filter === 'pending' && o.status !== 'PENDING_SLIP') return false;
      if (filter === 'cooking' && o.status !== 'COOKING') return false;
      if (filter === 'done' && o.status !== 'COMPLETED') return false;
      if (filter === 'cancelled' && o.status !== 'CANCELLED') return false;

      // Search filter
      if (q) {
        const matchesCode = o.order_code.toLowerCase().includes(q);
        const matchesName = o.customer_name.toLowerCase().includes(q);
        const matchesPhone = o.phone && o.phone.includes(q);
        const matchesRoom = o.room && o.room.includes(q);
        return matchesCode || matchesName || matchesPhone || matchesRoom;
      }
      return true;
    });
  }, [orders, filter, search]);

  return (
    <div className="space-y-4">
      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center justify-between">
        <div className="flex gap-1 overflow-x-auto no-scrollbar py-0.5">
          <button
            type="button"
            onClick={() => setFilter('pending')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
              filter === 'pending'
                ? 'bg-amber-500 text-white shadow-xs'
                : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            <span>รอตรวจสลิป</span>
            <span className="bg-white/30 text-current text-[10px] font-bold px-1.5 py-0.2 rounded-full font-en">
              {counts.pending}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setFilter('cooking')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
              filter === 'cooking'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            <span>กำลังปรุง</span>
            <span className="bg-white/30 text-current text-[10px] font-bold px-1.5 py-0.2 rounded-full font-en">
              {counts.cooking}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setFilter('done')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
              filter === 'done'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            <span>เสร็จสิ้น</span>
            <span className="bg-white/30 text-current text-[10px] font-bold px-1.5 py-0.2 rounded-full font-en">
              {counts.done}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
              filter === 'all'
                ? 'bg-chipotle-brown text-white shadow-xs'
                : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            <span>ทั้งหมด</span>
            <span className="bg-white/30 text-current text-[10px] font-bold px-1.5 py-0.2 rounded-full font-en">
              {counts.all}
            </span>
          </button>

          {counts.cancelled > 0 && (
            <button
              type="button"
              onClick={() => setFilter('cancelled')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                filter === 'cancelled'
                  ? 'bg-gray-600 text-white shadow-xs'
                  : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              <span>ยกเลิก</span>
              <span className="bg-white/30 text-current text-[10px] font-bold px-1.5 py-0.2 rounded-full font-en">
                {counts.cancelled}
              </span>
            </button>
          )}
        </div>

        {/* Search Input */}
        <div className="relative min-w-[200px]">
          <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ค้นหา #A101, ชื่อลูกค้า, เบอร์โทร..."
            className="w-full text-xs py-2 pl-9 pr-3 rounded-xl border border-app-border-dark bg-white focus:outline-none focus:ring-1 focus:ring-chipotle-brown"
          />
        </div>
      </div>

      {/* Orders Grid */}
      {filteredOrders.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-3xl border border-app-border text-app-muted text-xs">
          <Clock className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <div>ไม่มีรายการออเดอร์ในหมวดหมู่นี้</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {filteredOrders.map((order) => (
            <AdminOrderCard
              key={order.order_code}
              order={order}
              onAction={onAction}
              onViewSlip={onViewSlip}
              onUploadProof={onUploadProof}
              onViewProof={onViewProof}
              onResendNotification={onResendNotification}
              isActionLoading={isActionLoading}
            />
          ))}
        </div>
      )}
    </div>
  );
};
