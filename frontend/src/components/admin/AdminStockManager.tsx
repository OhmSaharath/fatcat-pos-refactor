import React, { useState, useEffect } from 'react';
import { RefreshCw, Search, Eye, EyeOff, Check, Camera, Trash2, Sparkles } from 'lucide-react';
import { cleanFrontName, formatPrice } from '../../lib/utils';

interface StockItem {
  id: string;
  variant_id: string;
  name: string;
  category_name?: string;
  price: number;
  image_url?: string;
  is_available: boolean;
  is_hidden: boolean;
  stock_count: number | null;
  loyverse_in_stock?: number | null;
  is_high_res?: boolean;
}

interface AdminStockManagerProps {
  token: string;
}

export const AdminStockManager: React.FC<AdminStockManagerProps> = ({ token }) => {
  const [items, setItems] = useState<StockItem[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [uploadingItemId, setUploadingItemId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedCat, setSelectedCat] = useState('all');
  const [feedback, setFeedback] = useState<string | null>(null);

  const fetchStock = async (force = false) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/admin/menu-stock?refresh=${force ? '1' : '0'}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.ok) {
        setItems(data.items || []);
        setCategories(data.categories || []);
      }
    } catch {
      setFeedback('ไม่สามารถโหลดข้อมูลสต็อกได้');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStock();
  }, [token]);

  const handleUpdate = async (variantId: string, updates: Partial<StockItem>) => {
    try {
      const res = await fetch('/api/admin/menu-stock', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ variant_id: variantId, ...updates }),
      });
      const data = await res.json();
      if (data.ok) {
        setItems((prev) =>
          prev.map((it) => (it.variant_id === variantId ? { ...it, ...updates } : it))
        );
      }
    } catch {
      setFeedback('เกิดข้อผิดพลาดในการอัปเดตสต็อก');
    }
  };

  const handleSyncLoyverse = async () => {
    setIsSyncing(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/admin/sync-loyverse-stock', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.ok) {
        setFeedback(`ซิงก์สต็อกสดเรียบร้อยแล้ว (${data.synced_count} รายการ)`);
        fetchStock(true);
      }
    } catch {
      setFeedback('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์เพื่อซิงก์สต็อกได้');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleFileUpload = async (itemId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingItemId(itemId);
    setFeedback(null);
    try {
      const formData = new FormData();
      formData.append('item_id', itemId);
      formData.append('file', file);

      const res = await fetch('/api/admin/upload-dish-image', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (data.ok) {
        setFeedback('📸 อัปโหลดรูปความละเอียดสูง HD สำเร็จแล้ว! หน้าเว็บจะแสดงภาพใหม่ทันที');
        fetchStock(true);
      } else {
        setFeedback(`❌ อัปโหลดรูปไม่สำเร็จ: ${data.detail || 'Error'}`);
      }
    } catch {
      setFeedback('❌ เกิดข้อผิดพลาดในการอัปโหลดรูปภาพ');
    } finally {
      setUploadingItemId(null);
    }
  };

  const handleRemoveCustomImage = async (itemId: string) => {
    if (!confirm('ต้องการยกเลิกรูป HD และกลับไปใช้รูปเดิมจาก Loyverse หรือไม่?')) return;
    setFeedback(null);
    try {
      const res = await fetch(`/api/admin/custom-dish-image/${itemId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.ok) {
        setFeedback('🔄 ยกเลิกรูป HD และกลับไปใช้รูปจาก Loyverse เรียบร้อยแล้ว');
        fetchStock(true);
      }
    } catch {
      setFeedback('❌ ไม่สามารถยกเลิกรูปภาพได้');
    }
  };

  const filteredItems = items.filter((it) => {
    const matchSearch =
      !search ||
      it.name.toLowerCase().includes(search.toLowerCase()) ||
      (it.category_name && it.category_name.toLowerCase().includes(search.toLowerCase()));
    const matchCat = selectedCat === 'all' || it.category_name === selectedCat;
    return matchSearch && matchCat;
  });

  return (
    <div className="space-y-4">
      {/* Action Banner */}
      <div className="p-4 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shadow-xs">
        <div>
          <h2 className="text-sm font-bold text-emerald-950 flex items-center gap-1.5">
            <RefreshCw className="w-4 h-4 text-emerald-700" />
            <span>จัดการสต็อก & รูปภาพความละเอียดสูง (HD Studio)</span>
          </h2>
          <p className="text-[11px] text-emerald-800/80">
            ระบบอัปเกรดภาพ Smart Sharpness อัตโนมัติ หรือกดไอคอน 📸 ที่เมนูเพื่ออัปโหลดรูป HD 4K คมชัดทับรูป Loyverse ได้อิสระ
          </p>
        </div>

        <button
          type="button"
          onClick={handleSyncLoyverse}
          disabled={isSyncing}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-xs"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
          <span>ซิงก์สต็อกสดจาก Loyverse Inventory</span>
        </button>
      </div>

      {feedback && (
        <div className="p-3 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs flex items-center gap-2">
          <Check className="w-4 h-4 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Filter Row */}
      <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center justify-between">
        <div className="flex gap-1 overflow-x-auto no-scrollbar py-0.5">
          <button
            type="button"
            onClick={() => setSelectedCat('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              selectedCat === 'all'
                ? 'bg-chipotle-brown text-white'
                : 'bg-white text-gray-700 border border-gray-200'
            }`}
          >
            ทั้งหมด ({items.length})
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setSelectedCat(c.name)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                selectedCat === c.name
                  ? 'bg-chipotle-brown text-white'
                  : 'bg-white text-gray-700 border border-gray-200'
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>

        <div className="relative min-w-[220px]">
          <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ค้นหาชื่อเมนู..."
            className="w-full text-xs py-2 pl-9 pr-3 rounded-xl border border-app-border-dark bg-white focus:outline-none focus:ring-1 focus:ring-chipotle-brown"
          />
        </div>
      </div>

      {/* Stock Cards Grid */}
      {isLoading ? (
        <div className="p-12 text-center text-xs text-app-muted bg-white rounded-3xl border border-app-border">
          กำลังโหลดรายการสต็อก...
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filteredItems.map((item) => {
            const isCustomHd = Boolean(item.image_url?.includes('/api/img/custom/'));
            const isUploading = uploadingItemId === item.id;

            return (
              <div
                key={item.variant_id}
                className={`p-3 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                  item.is_hidden
                    ? 'bg-gray-50 border-gray-200 opacity-60'
                    : !item.is_available
                    ? 'bg-red-50/40 border-red-200'
                    : 'bg-white border-app-border shadow-2xs'
                }`}
              >
                {/* Thumb & Name */}
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="relative group shrink-0">
                    <div className="w-12 h-12 rounded-xl bg-gray-100 overflow-hidden border border-gray-200">
                      {item.image_url ? (
                        <img
                          src={item.image_url}
                          alt={item.name}
                          className="w-full h-full object-cover"
                          style={{ imageRendering: '-webkit-optimize-contrast' }}
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xl">🍲</div>
                      )}
                    </div>

                    {/* Camera Upload Overlay */}
                    <label
                      className="absolute -bottom-1 -right-1 p-1 bg-chipotle-brown hover:bg-[#3D1E0B] text-white rounded-full cursor-pointer shadow-xs transition-transform active:scale-95"
                      title="คลิกเพื่ออัปโหลดรูปภาพความละเอียดสูง (HD 4K) สำหรับเมนูนี้"
                    >
                      <Camera className={`w-3 h-3 ${isUploading ? 'animate-spin' : ''}`} />
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        disabled={isUploading}
                        onChange={(e) => handleFileUpload(item.id, e)}
                      />
                    </label>
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-semibold text-gray-900 truncate">
                        {cleanFrontName(item.name)}
                      </span>
                      {isCustomHd && (
                        <span className="bg-purple-100 text-purple-900 text-[9px] font-bold px-1.5 py-0.2 rounded border border-purple-300 inline-flex items-center gap-0.5">
                          <Sparkles className="w-2.5 h-2.5 text-purple-600" />
                          <span>HD 4K</span>
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-app-muted flex items-center gap-2 mt-0.5">
                      <span>{item.category_name || 'ทั่วไป'}</span>
                      <span className="font-semibold text-chipotle-brown font-en">
                        ฿{formatPrice(item.price)}
                      </span>
                    </div>
                    {isCustomHd && (
                      <button
                        type="button"
                        onClick={() => handleRemoveCustomImage(item.id)}
                        className="text-[10px] text-red-600 hover:text-red-700 underline flex items-center gap-0.5 mt-0.5"
                      >
                        <Trash2 className="w-2.5 h-2.5" />
                        <span>กลับไปใช้รูป Loyverse</span>
                      </button>
                    )}
                    {item.loyverse_in_stock !== undefined && item.loyverse_in_stock !== null && (
                      <div className="text-[10px] text-blue-700 font-mono">
                        Loyverse Stock: {item.loyverse_in_stock}
                      </div>
                    )}
                  </div>
                </div>

                {/* Toggles & Stock Count */}
                <div className="flex items-center gap-2 shrink-0">
                  {/* Available Toggle */}
                  <button
                    type="button"
                    onClick={() => handleUpdate(item.variant_id, { is_available: !item.is_available })}
                    className={`px-2.5 py-1 rounded-xl text-[11px] font-semibold border transition-all ${
                      item.is_available
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                        : 'bg-red-100 text-red-800 border-red-300'
                    }`}
                    title="คลิกเพื่อสลับ พร้อมขาย / หมดชั่วคราว"
                  >
                    {item.is_available ? 'พร้อมขาย' : 'หมด'}
                  </button>

                  {/* Hidden Toggle */}
                  <button
                    type="button"
                    onClick={() => handleUpdate(item.variant_id, { is_hidden: !item.is_hidden })}
                    className={`p-1.5 rounded-xl border transition-all ${
                      item.is_hidden
                        ? 'bg-gray-200 text-gray-600 border-gray-400'
                        : 'bg-stone-50 text-gray-500 hover:text-chipotle-brown border-gray-200'
                    }`}
                    title={item.is_hidden ? 'ซ่อนอยู่ (ลูกค้ามองไม่เห็น)' : 'แสดงหน้าร้าน'}
                  >
                    {item.is_hidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
