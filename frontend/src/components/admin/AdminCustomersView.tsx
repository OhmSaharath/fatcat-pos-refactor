import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  Search,
  Plus,
  Minus,
  History,
  Copy,
  Check,
  RefreshCw,
  Phone,
  Home,
  Sliders,
  X,
} from 'lucide-react';
import { CustomerProfile, AdminCustomerMetrics } from '../../types/customer';
import { formatPrice } from '../../lib/utils';

interface AdminCustomersViewProps {
  token: string;
}

export const AdminCustomersView: React.FC<AdminCustomersViewProps> = ({ token }) => {
  const [customers, setCustomers] = useState<CustomerProfile[]>([]);
  const [metrics, setMetrics] = useState<AdminCustomerMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'has_stamps' | 'has_rewards'>('all');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [copiedUid, setCopiedUid] = useState<string | null>(null);

  // Modal states
  const [selectedCustomerForLogs, setSelectedCustomerForLogs] = useState<CustomerProfile | null>(null);
  const [stampModalCustomer, setStampModalCustomer] = useState<CustomerProfile | null>(null);
  const [manualAction, setManualAction] = useState<'add' | 'deduct' | 'set' | 'add_reward' | 'use_reward'>('add');
  const [manualAmount, setManualAmount] = useState<number>(1);
  const [manualNote, setManualNote] = useState<string>('สั่งผ่าน Line OA โดยตรง');

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/customers', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.ok) {
        setCustomers(data.customers || []);
        if (data.metrics) setMetrics(data.metrics);
      }
    } catch (err) {
      console.error('Fetch admin customers error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, [token]);

  const handleCopyUid = (uid: string) => {
    navigator.clipboard.writeText(uid);
    setCopiedUid(uid);
    setTimeout(() => setCopiedUid(null), 2000);
  };

  const handleQuickStamp = async (customer: CustomerProfile, action: 'add' | 'deduct', note: string, amount: number = 1) => {
    const custId = customer.line_user_id ? `line:${customer.line_user_id}` : customer.id || '';
    if (!custId) return;

    setActionLoadingId(custId);
    try {
      const res = await fetch('/api/admin/customer-stamp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          customer_id: custId,
          action,
          amount,
          note,
        }),
      });
      const data = await res.json();
      if (data.ok && data.customer) {
        // Update local customer state
        setCustomers((prev) =>
          prev.map((c) =>
            (c.line_user_id && c.line_user_id === customer.line_user_id) || c.id === customer.id
              ? { ...c, ...data.customer }
              : c
          )
        );
      } else {
        alert(data.detail || data.error || 'เกิดข้อผิดพลาดในการบันทึกสแตมป์');
      }
    } catch (err: any) {
      alert(err.message || 'การเชื่อมต่อขัดข้อง');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleModalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stampModalCustomer) return;
    const custId = stampModalCustomer.line_user_id
      ? `line:${stampModalCustomer.line_user_id}`
      : stampModalCustomer.id || '';
    if (!custId) return;

    setActionLoadingId(custId);
    try {
      const res = await fetch('/api/admin/customer-stamp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          customer_id: custId,
          action: manualAction,
          amount: Number(manualAmount) || 1,
          note: manualNote.trim(),
        }),
      });
      const data = await res.json();
      if (data.ok && data.customer) {
        setCustomers((prev) =>
          prev.map((c) =>
            (c.line_user_id && c.line_user_id === stampModalCustomer.line_user_id) || c.id === stampModalCustomer.id
              ? { ...c, ...data.customer }
              : c
          )
        );
        setStampModalCustomer(null);
      } else {
        alert(data.detail || data.error || 'เกิดข้อผิดพลาด');
      }
    } catch (err: any) {
      alert(err.message || 'การเชื่อมต่อขัดข้อง');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Filtered customer list
  const filteredCustomers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return customers.filter((c) => {
      if (filterType === 'has_stamps' && (c.stamps || 0) === 0) return false;
      if (filterType === 'has_rewards' && (c.available_rewards || 0) === 0) return false;

      if (!q) return true;
      const matchName = (c.customer_name || '').toLowerCase().includes(q);
      const matchLine = (c.line_display_name || '').toLowerCase().includes(q);
      const matchPhone = (c.phone || '').includes(q);
      const matchRoom = (c.room || '').toLowerCase().includes(q);
      const matchUid = (c.line_user_id || '').toLowerCase().includes(q);

      return matchName || matchLine || matchPhone || matchRoom || matchUid;
    });
  }, [customers, searchQuery, filterType]);

  return (
    <div className="space-y-5">
      {/* 1. Header & Top Metrics */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-chipotle-brown flex items-center gap-2">
            <Users className="w-5 h-5 text-chipotle-brown" />
            <span>ลูกค้าที่ใช้งานระบบ & สะสมแต้ม</span>
          </h1>
          <p className="text-xs text-gray-500">
            ดูรายชื่อลูกค้าที่เคยเข้าใช้งาน app, ตรวจสอบแต้มสะสม, และ Stamp แต้มแบบ Manual ให้ลูกค้าที่สั่งผ่าน LINE OA
          </p>
        </div>

        <button
          type="button"
          onClick={fetchCustomers}
          disabled={loading}
          className="bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs self-start sm:self-auto cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>รีเฟรชข้อมูล</span>
        </button>
      </div>

      {/* Metrics Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-3.5 rounded-2xl border border-app-border shadow-xs">
          <span className="text-[11px] font-medium text-gray-500 block">👥 สมาชิกลูกค้าทั้งหมด</span>
          <span className="text-2xl font-black text-chipotle-brown font-en block mt-0.5">
            {metrics?.total_customers ?? customers.length}
          </span>
          <span className="text-[10px] text-gray-400">เข้าใช้งานผ่าน LINE / App</span>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-app-border shadow-xs">
          <span className="text-[11px] font-medium text-gray-500 block">🐾 สแตมป์ที่สะสมอยู่</span>
          <span className="text-2xl font-black text-amber-600 font-en block mt-0.5">
            {metrics?.total_stamps ?? customers.reduce((s, c) => s + (c.stamps || 0), 0)}
          </span>
          <span className="text-[10px] text-gray-400">ดวง (รอบปัจจุบัน)</span>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-app-border shadow-xs">
          <span className="text-[11px] font-medium text-gray-500 block">🎟️ คูปอง 10฿ พร้อมใช้</span>
          <span className="text-2xl font-black text-emerald-600 font-en block mt-0.5">
            {metrics?.total_available_rewards ?? customers.reduce((s, c) => s + (c.available_rewards || 0), 0)}
          </span>
          <span className="text-[10px] text-gray-400">สิทธิ์ส่วนลดที่ยังไม่ได้ใช้</span>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-app-border shadow-xs">
          <span className="text-[11px] font-medium text-gray-500 block">💰 ยอดสั่งซื้อสะสมรวม</span>
          <span className="text-2xl font-black text-chipotle-brown font-en block mt-0.5">
            {formatPrice(metrics?.total_spent ?? customers.reduce((s, c) => s + (c.total_spent || 0), 0))}฿
          </span>
          <span className="text-[10px] text-gray-400">
            จาก {metrics?.total_orders ?? customers.reduce((s, c) => s + (c.total_orders || 0), 0)} ออเดอร์
          </span>
        </div>
      </div>

      {/* 2. Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-app-border shadow-xs">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ค้นหาชื่อ LINE, ชื่อลูกค้า, เบอร์โทร, ห้องคอนโด หรือ UID..."
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-gray-200 focus:outline-hidden focus:ring-1 focus:ring-chipotle-brown"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs"
            >
              ✕
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <button
            type="button"
            onClick={() => setFilterType('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              filterType === 'all'
                ? 'bg-chipotle-brown text-white shadow-xs'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            ทั้งหมด ({customers.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterType('has_stamps')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              filterType === 'has_stamps'
                ? 'bg-chipotle-brown text-white shadow-xs'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            🐾 มีแสตมป์สะสม ({customers.filter((c) => (c.stamps || 0) > 0).length})
          </button>
          <button
            type="button"
            onClick={() => setFilterType('has_rewards')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              filterType === 'has_rewards'
                ? 'bg-chipotle-brown text-white shadow-xs'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            🎟️ มีส่วนลดพร้อมใช้ ({customers.filter((c) => (c.available_rewards || 0) > 0).length})
          </button>
        </div>
      </div>

      {/* 3. Customers Cards / List */}
      {loading ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-app-border shadow-xs">
          <div className="w-8 h-8 border-2 border-chipotle-brown border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs text-gray-500">กำลังโหลดรายชื่อลูกค้า...</p>
        </div>
      ) : filteredCustomers.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-app-border shadow-xs">
          <div className="text-4xl mb-2">👤</div>
          <h3 className="text-sm font-bold text-gray-700">ไม่พบข้อมูลลูกค้า</h3>
          <p className="text-xs text-gray-400 mt-1">
            {searchQuery ? 'ลองเปลี่ยนคำค้นหาใหม่' : 'เมื่อมีลูกค้าเปิดเข้าใช้งาน web app รายชื่อจะปรากฏที่นี่'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredCustomers.map((cust, idx) => {
            const stamps = cust.stamps || 0;
            const availRewards = cust.available_rewards || 0;
            const custKey = cust.line_user_id ? `line:${cust.line_user_id}` : cust.id || String(idx);
            const isActing = actionLoadingId === custKey;

            return (
              <div
                key={custKey}
                className="bg-white rounded-2xl border border-app-border p-4 shadow-xs hover:border-chipotle-brown/40 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                {/* Left: Customer Profile Info */}
                <div className="flex items-start gap-3.5 min-w-0">
                  <div className="w-12 h-12 rounded-2xl bg-stone-100 border border-stone-200 flex items-center justify-center overflow-hidden shrink-0">
                    {cust.picture_url ? (
                      <img src={cust.picture_url} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-2xl">🐱</span>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-bold text-gray-900 truncate">
                        {cust.line_display_name || cust.customer_name || 'ลูกค้าไม่มีชื่อ'}
                      </h3>
                      {cust.customer_name && cust.customer_name !== cust.line_display_name && (
                        <span className="text-[11px] text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                          ชื่อสั่งอาหาร: {cust.customer_name}
                        </span>
                      )}
                    </div>

                    {cust.status_message && (
                      <p className="text-[11px] text-gray-400 truncate italic">"{cust.status_message}"</p>
                    )}

                    <div className="flex items-center gap-3 mt-1.5 flex-wrap text-xs text-gray-600">
                      {cust.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3 text-gray-400" />
                          <span>{cust.phone}</span>
                        </span>
                      )}
                      {(cust.floor || cust.room) && (
                        <span className="flex items-center gap-1">
                          <Home className="w-3 h-3 text-gray-400" />
                          <span>{cust.floor ? `ชั้น ${cust.floor}` : ''} {cust.room ? `ห้อง ${cust.room}` : ''}</span>
                        </span>
                      )}
                      {cust.line_user_id && (
                        <button
                          type="button"
                          onClick={() => handleCopyUid(cust.line_user_id)}
                          className="flex items-center gap-1 text-[10px] text-chipotle-brown bg-[#FAF7F3] hover:bg-[#F2ECE4] px-2 py-0.5 rounded-md border border-app-border transition-colors cursor-pointer"
                          title="คลิกเพื่อคัดลอก LINE UID"
                        >
                          {copiedUid === cust.line_user_id ? (
                            <>
                              <Check className="w-2.5 h-2.5 text-emerald-600" />
                              <span className="text-emerald-700 font-semibold">คัดลอกแล้ว</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-2.5 h-2.5 text-gray-400" />
                              <span className="font-mono text-gray-500 truncate max-w-[100px]">
                                {cust.line_user_id}
                              </span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Center: Stamp Status & Rewards Counter */}
                <div className="flex items-center gap-3 bg-[#FAF7F3] p-2.5 rounded-xl border border-app-border shrink-0 justify-around sm:justify-start">
                  {/* Stamps count */}
                  <div className="text-center px-2">
                    <span className="text-[10px] text-gray-500 block">แสตมป์สะสม</span>
                    <div className="flex items-baseline justify-center gap-1 mt-0.5">
                      <span className="text-lg font-black text-amber-600 font-en">{stamps}</span>
                      <span className="text-xs text-gray-400 font-en">/ 10</span>
                    </div>
                    {/* mini progress bar */}
                    <div className="w-16 bg-gray-200 h-1 rounded-full mt-1 overflow-hidden">
                      <div
                        className="bg-amber-500 h-full rounded-full"
                        style={{ width: `${Math.min(100, stamps * 10)}%` }}
                      />
                    </div>
                  </div>

                  <div className="w-[1px] h-8 bg-gray-200" />

                  {/* Available Rewards */}
                  <div className="text-center px-2">
                    <span className="text-[10px] text-gray-500 block">ส่วนลด 10฿</span>
                    <div className="flex items-baseline justify-center gap-1 mt-0.5">
                      <span className="text-lg font-black text-emerald-600 font-en">{availRewards}</span>
                      <span className="text-xs text-gray-400">ใบ</span>
                    </div>
                    <span className="text-[9px] text-emerald-700 font-medium">พร้อมใช้</span>
                  </div>

                  <div className="w-[1px] h-8 bg-gray-200" />

                  {/* Orders & Spend */}
                  <div className="text-center px-2">
                    <span className="text-[10px] text-gray-500 block">สั่งซื้อแล้ว</span>
                    <span className="text-sm font-bold text-gray-800 font-en block mt-0.5">
                      {cust.total_orders || 0} ครั้ง
                    </span>
                    <span className="text-[10px] text-gray-500 font-en">
                      {formatPrice(cust.total_spent || 0)}฿
                    </span>
                  </div>
                </div>

                {/* Right: Manual Stamp Actions */}
                <div className="flex items-center gap-1.5 flex-wrap justify-end shrink-0">
                  {/* Quick +1 Stamp for LINE OA (1 กล่อง) */}
                  <button
                    type="button"
                    disabled={isActing}
                    onClick={() => handleQuickStamp(cust, 'add', 'สั่งผ่าน Line OA โดยตรง (1 กล่องเดี่ยว)', 1)}
                    className="bg-amber-600 hover:bg-amber-700 active:scale-95 disabled:opacity-50 text-white px-2.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1 shadow-xs transition-all cursor-pointer"
                    title="เพิ่ม +1 แสตมป์ทันที (1 กล่อง/เซ็ตเดี่ยว)"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+1 (1 กล่อง)</span>
                  </button>

                  {/* Quick +2 Stamps for LINE OA (เซ็ตคู่) */}
                  <button
                    type="button"
                    disabled={isActing}
                    onClick={() => handleQuickStamp(cust, 'add', 'สั่งผ่าน Line OA โดยตรง (เซ็ตคู่)', 2)}
                    className="bg-orange-600 hover:bg-orange-700 active:scale-95 disabled:opacity-50 text-white px-2.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1 shadow-xs transition-all cursor-pointer"
                    title="เพิ่ม +2 แสตมป์ทันที (เซ็ตคู่/กล่องคู่)"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+2 (เซ็ตคู่)</span>
                  </button>

                  {/* Quick -1 Stamp */}
                  <button
                    type="button"
                    disabled={isActing || stamps <= 0}
                    onClick={() => handleQuickStamp(cust, 'deduct', 'ลดแต้มโดยผู้ดูแลระบบ', 1)}
                    className="bg-gray-100 hover:bg-gray-200 text-gray-700 disabled:opacity-40 p-1.5 rounded-xl transition-all cursor-pointer"
                    title="ลดแต้ม 1 ดวง"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>

                  {/* Detailed Manual Adjustment Modal Trigger */}
                  <button
                    type="button"
                    onClick={() => {
                      setStampModalCustomer(cust);
                      setManualAmount(1);
                      setManualAction('add');
                      setManualNote('สั่งผ่าน Line OA โดยตรง');
                    }}
                    className="bg-[#FAF7F3] hover:bg-[#F2ECE4] text-chipotle-brown border border-app-border p-1.5 rounded-xl transition-all cursor-pointer"
                    title="ปรับแต้มหรือแจกคูปองแบบกำหนดเอง"
                  >
                    <Sliders className="w-3.5 h-3.5" />
                  </button>

                  {/* Stamp History Log Modal */}
                  <button
                    type="button"
                    onClick={() => setSelectedCustomerForLogs(cust)}
                    className="bg-stone-100 hover:bg-stone-200 text-stone-700 p-1.5 rounded-xl transition-all cursor-pointer"
                    title="ดูประวัติการสะสมแต้ม"
                  >
                    <History className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 4. Stamp Logs Modal */}
      {selectedCustomerForLogs && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-app-border overflow-hidden animate-in fade-in duration-200">
            <div className="h-14 px-5 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-chipotle-brown" />
                <h3 className="text-sm font-bold text-chipotle-brown">
                  ประวัติแสตมป์: {selectedCustomerForLogs.line_display_name || selectedCustomerForLogs.customer_name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCustomerForLogs(null)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 max-h-[60vh] overflow-y-auto space-y-3">
              {selectedCustomerForLogs.stamp_logs && selectedCustomerForLogs.stamp_logs.length > 0 ? (
                <div className="divide-y divide-gray-100">
                  {selectedCustomerForLogs.stamp_logs.map((log, i) => (
                    <div key={i} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-800 truncate">{log.note}</p>
                        <span className="text-[10px] text-gray-400">{log.created_at}</span>
                      </div>
                      <div className="text-right shrink-0">
                        {log.delta_stamps !== 0 && (
                          <span
                            className={`font-bold font-en text-xs block ${
                              log.delta_stamps > 0 ? 'text-emerald-600' : 'text-rose-600'
                            }`}
                          >
                            {log.delta_stamps > 0 ? `+${log.delta_stamps}` : log.delta_stamps} แต้ม
                          </span>
                        )}
                        {log.delta_rewards !== 0 && (
                          <span className="text-[11px] font-bold text-amber-600 block">
                            {log.delta_rewards > 0 ? `+${log.delta_rewards}` : log.delta_rewards} คูปอง
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-12 text-center text-gray-400 text-xs">
                  ยังไม่มีประวัติแสตมป์ของลูกค้ารายนี้
                </div>
              )}
            </div>

            <div className="p-4 bg-gray-50 border-t border-gray-100 text-right">
              <button
                type="button"
                onClick={() => setSelectedCustomerForLogs(null)}
                className="bg-gray-200 hover:bg-gray-300 text-gray-800 text-xs font-semibold px-4 py-2 rounded-xl"
              >
                ปิด
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Manual Stamp Adjustment Modal */}
      {stampModalCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-app-border overflow-hidden animate-in fade-in duration-200">
            <div className="h-14 px-5 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-chipotle-brown" />
                <h3 className="text-sm font-bold text-chipotle-brown">
                  จัดการแต้ม & คูปองแบบกำหนดเอง
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setStampModalCustomer(null)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleModalSubmit} className="p-5 space-y-4">
              <div className="bg-[#FAF7F3] p-3 rounded-2xl border border-app-border flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-xl shrink-0">
                  {stampModalCustomer.picture_url ? (
                    <img
                      src={stampModalCustomer.picture_url}
                      alt="Avatar"
                      className="w-full h-full object-cover rounded-xl"
                    />
                  ) : (
                    '🐱'
                  )}
                </div>
                <div>
                  <h4 className="text-xs font-bold text-gray-900">
                    {stampModalCustomer.line_display_name || stampModalCustomer.customer_name}
                  </h4>
                  <p className="text-[10px] text-gray-500">
                    แต้มปัจจุบัน: <b className="text-amber-600">{stampModalCustomer.stamps || 0}/10 ดวง</b> | คูปองส่วนลด:{' '}
                    <b className="text-emerald-600">{stampModalCustomer.available_rewards || 0} ใบ</b>
                  </p>
                </div>
              </div>

              {/* Action selection */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  เลือกการดำเนินการ:
                </label>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setManualAction('add');
                      setManualNote('สั่งผ่าน Line OA โดยตรง');
                    }}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      manualAction === 'add'
                        ? 'border-amber-500 bg-amber-50 text-amber-900 font-bold'
                        : 'border-gray-200 bg-white text-gray-700'
                    }`}
                  >
                    🐾 เพิ่มแสตมป์ (+)
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setManualAction('deduct');
                      setManualNote('ลดแต้มโดยผู้ดูแลระบบ');
                    }}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      manualAction === 'deduct'
                        ? 'border-rose-500 bg-rose-50 text-rose-900 font-bold'
                        : 'border-gray-200 bg-white text-gray-700'
                    }`}
                  >
                    ➖ ลดแสตมป์ (-)
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setManualAction('add_reward');
                      setManualNote('แจกคูปองส่วนลด 10 บาท พิเศษ');
                    }}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      manualAction === 'add_reward'
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-900 font-bold'
                        : 'border-gray-200 bg-white text-gray-700'
                    }`}
                  >
                    🎟️ แจกคูปอง 10฿ (+)
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setManualAction('set');
                      setManualNote('ตั้งค่าจำนวนแต้มสะสมโดยตรง');
                    }}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      manualAction === 'set'
                        ? 'border-chipotle-brown bg-[#FAF7F3] text-chipotle-brown font-bold'
                        : 'border-gray-200 bg-white text-gray-700'
                    }`}
                  >
                    ⚙️ ตั้งค่าแต้มเจาะจง
                  </button>
                </div>
              </div>

              {/* Amount input */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  {manualAction === 'set' ? 'จำนวนแต้มที่ต้องการตั้ง (0-9):' : 'จำนวนดวง / จำนวนคูปอง:'}
                </label>
                <input
                  type="number"
                  min="0"
                  max="50"
                  value={manualAmount}
                  onChange={(e) => setManualAmount(parseInt(e.target.value) || 0)}
                  className="w-full text-xs p-2.5 rounded-xl border border-gray-300 focus:ring-1 focus:ring-chipotle-brown"
                  required
                />
              </div>

              {/* Note / Reason */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  หมายเหตุ / เหตุผลการบันทึก:
                </label>
                <input
                  type="text"
                  value={manualNote}
                  onChange={(e) => setManualNote(e.target.value)}
                  placeholder="เช่น สั่งผ่าน LINE OA (ต้มน้ำปลา + ปีกไก่)"
                  className="w-full text-xs p-2.5 rounded-xl border border-gray-300 focus:ring-1 focus:ring-chipotle-brown"
                  required
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setStampModalCustomer(null)}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold px-4 py-2 rounded-xl"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={actionLoadingId !== null}
                  className="bg-chipotle-brown hover:bg-chipotle-brown-hover active:scale-95 disabled:opacity-50 text-white text-xs font-bold px-5 py-2 rounded-xl shadow-xs transition-all"
                >
                  {actionLoadingId ? 'กำลังบันทึก...' : 'บันทึกการปรับแต้ม'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
