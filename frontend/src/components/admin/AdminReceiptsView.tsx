import React, { useState, useEffect } from 'react';
import { Receipt, RefreshCw, Calendar } from 'lucide-react';
import { formatPrice } from '../../lib/utils';

interface AdminReceiptsViewProps {
  token: string;
}

export const AdminReceiptsView: React.FC<AdminReceiptsViewProps> = ({ token }) => {
  const [receipts, setReceipts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchReceipts = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/receipts', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.ok) {
        setReceipts(data.receipts || []);
      }
    } catch {
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReceipts();
  }, [token]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-app-border">
        <div>
          <h2 className="text-sm font-bold text-chipotle-brown">ใบเสร็จ Loyverse POS ล่าสุด</h2>
          <p className="text-[11px] text-app-muted">
            ตรวจสอบรายการบิลที่สร้างเข้าสู่ระบบเครื่องคิดเงินหน้าร้าน
          </p>
        </div>

        <button
          type="button"
          onClick={fetchReceipts}
          disabled={isLoading}
          className="p-2 bg-stone-50 hover:bg-stone-100 border border-gray-200 rounded-xl text-gray-700 transition-colors"
          title="รีเฟรชใบเสร็จ"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {isLoading ? (
        <div className="p-12 text-center text-xs text-app-muted bg-white rounded-3xl border border-app-border">
          กำลังโหลดใบเสร็จ...
        </div>
      ) : receipts.length === 0 ? (
        <div className="p-12 text-center text-xs text-app-muted bg-white rounded-3xl border border-app-border">
          ไม่พบรายการใบเสร็จ
        </div>
      ) : (
        <div className="space-y-3">
          {receipts.map((r) => (
            <div
              key={r.receipt_number || r.id}
              className="p-4 bg-white rounded-2xl border border-app-border shadow-2xs space-y-2"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-chipotle-brown" />
                  <span className="text-xs font-bold font-mono text-gray-900">
                    #{r.receipt_number}
                  </span>
                  <span className="text-[10px] text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 font-semibold">
                    {r.receipt_type || 'SALE'}
                  </span>
                </div>

                <div className="text-xs font-bold text-chipotle-brown font-en">
                  ฿{formatPrice(r.total_money || 0)}
                </div>
              </div>

              {r.note && (
                <div className="text-[11px] text-gray-600 bg-stone-50 p-2 rounded-xl">
                  {r.note}
                </div>
              )}

              <div className="text-[10px] text-app-muted flex items-center gap-1 font-en">
                <Calendar className="w-3 h-3" />
                <span>{r.created_at}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
