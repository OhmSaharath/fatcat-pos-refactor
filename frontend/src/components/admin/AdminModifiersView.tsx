import React, { useState, useEffect, useMemo } from 'react';
import {
  SlidersHorizontal,
  Search,
  Check,
  AlertCircle,
  Eye,
  RefreshCw,
  X,
  Save,
  Layers,
  UtensilsCrossed,
  Sparkles,
} from 'lucide-react';
import { ModifierGroup } from '../../types/menu';
import { formatPrice } from '../../lib/utils';

interface AdminModifiersViewProps {
  token: string;
}

export const AdminModifiersView: React.FC<AdminModifiersViewProps> = ({ token }) => {
  const [modifiers, setModifiers] = useState<ModifierGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'required' | 'optional' | 'single' | 'multi'>('all');
  const [selectedGroup, setSelectedGroup] = useState<ModifierGroup | null>(null);
  const [viewingLinkedItems, setViewingLinkedItems] = useState<ModifierGroup | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const fetchModifiers = async (force: boolean = false) => {
    if (force) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      const res = await fetch(`/api/admin/modifiers${force ? '?refresh=1' : ''}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.ok && Array.isArray(data.modifiers)) {
        setModifiers(data.modifiers);
      }
    } catch (e) {
      console.error('Fetch modifiers error:', e);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchModifiers();
  }, [token]);

  // Quick stats
  const stats = useMemo(() => {
    const total = modifiers.length;
    const required = modifiers.filter((m) => m.is_required || m.min_selection > 0).length;
    const optional = total - required;
    const single = modifiers.filter((m) => m.max_selection === 1).length;
    const multi = total - single;
    return { total, required, optional, single, multi };
  }, [modifiers]);

  // Filtered list
  const filteredModifiers = useMemo(() => {
    return modifiers.filter((grp) => {
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        grp.name.toLowerCase().includes(q) ||
        (grp.custom_name && grp.custom_name.toLowerCase().includes(q)) ||
        grp.options.some((o) => o.name.toLowerCase().includes(q)) ||
        (grp.linked_items && grp.linked_items.some((it) => it.name.toLowerCase().includes(q)));

      if (!matchSearch) return false;

      const isReq = grp.is_required || grp.min_selection > 0;
      const isSingle = grp.max_selection === 1;

      if (filterType === 'required') return isReq;
      if (filterType === 'optional') return !isReq;
      if (filterType === 'single') return isSingle;
      if (filterType === 'multi') return !isSingle;
      return true;
    });
  }, [modifiers, searchQuery, filterType]);

  const handleSaveGroup = (updated: ModifierGroup) => {
    setModifiers((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
    setSelectedGroup(null);
    setFeedback(`บันทึกการตั้งค่า "${updated.custom_name || updated.name}" เรียบร้อยแล้ว`);
    setTimeout(() => setFeedback(null), 4000);
  };

  if (isLoading) {
    return (
      <div className="p-12 text-center text-xs text-app-muted bg-white rounded-3xl border border-app-border space-y-2">
        <div className="w-6 h-6 border-2 border-chipotle-brown border-t-transparent rounded-full animate-spin mx-auto" />
        <p>กำลังโหลดกลุ่มตัวเลือกเสริมจากระบบ...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      {/* Top Banner & Stats */}
      <div className="p-4 bg-white rounded-2xl border border-app-border shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-100">
          <div>
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="w-5 h-5 text-chipotle-brown" />
              <h2 className="text-sm font-bold text-gray-900">จัดการตัวเลือกเสริม (Modifier Groups)</h2>
            </div>
            <p className="text-[11px] text-app-muted mt-0.5">
              กำหนดเงื่อนไขการเลือกแบบ Wongnai POS: บังคับเลือก, เลือกได้ 1 อย่าง (Radio), เลือกได้หลายอย่าง (Checkbox), และตั้งราคา/เปิด-ปิดตัวเลือกย่อย
            </p>
          </div>

          <button
            type="button"
            disabled={isRefreshing}
            onClick={() => fetchModifiers(true)}
            className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 active:scale-95 text-gray-700 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-all self-start sm:self-auto shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>{isRefreshing ? 'กำลังซิงค์...' : 'รีเฟรชจาก Loyverse'}</span>
          </button>
        </div>

        {/* Quick KPI Badges */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1 text-center text-xs">
          <div className="p-2.5 bg-stone-50 rounded-xl border border-stone-200">
            <span className="text-[10px] text-gray-500 block">ทั้งหมด</span>
            <span className="text-base font-bold text-chipotle-brown font-en">{stats.total} กลุ่ม</span>
          </div>
          <div className="p-2.5 bg-rose-50 rounded-xl border border-rose-200">
            <span className="text-[10px] text-rose-700 block font-medium">🔴 บังคับเลือก (จำเป็น)</span>
            <span className="text-base font-bold text-rose-800 font-en">{stats.required} กลุ่ม</span>
          </div>
          <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-200">
            <span className="text-[10px] text-emerald-700 block font-medium">🟢 ไม่บังคับ (ตามใจ)</span>
            <span className="text-base font-bold text-emerald-800 font-en">{stats.optional} กลุ่ม</span>
          </div>
          <div className="p-2.5 bg-blue-50 rounded-xl border border-blue-200">
            <span className="text-[10px] text-blue-700 block font-medium">🔘 เลือกได้ 1 อย่าง (Radio)</span>
            <span className="text-base font-bold text-blue-800 font-en">{stats.single} กลุ่ม</span>
          </div>
          <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-200">
            <span className="text-[10px] text-amber-800 block font-medium">☑️ เลือกได้หลายอย่าง</span>
            <span className="text-base font-bold text-amber-900 font-en">{stats.multi} กลุ่ม</span>
          </div>
        </div>
      </div>

      {feedback && (
        <div className="p-3 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs flex items-center gap-2 shadow-xs animate-in fade-in">
          <Check className="w-4 h-4 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Search & Filter Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ค้นหาชื่อกลุ่มตัวเลือก, ตัวเลือกย่อย หรือชื่ออาหาร..."
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-app-border-dark bg-white focus:outline-none focus:ring-1 focus:ring-chipotle-brown"
          />
        </div>

        <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          <button
            type="button"
            onClick={() => setFilterType('all')}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
              filterType === 'all'
                ? 'bg-chipotle-brown text-white shadow-xs'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            ทั้งหมด ({stats.total})
          </button>
          <button
            type="button"
            onClick={() => setFilterType('required')}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
              filterType === 'required'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-white text-rose-800 border border-rose-200 hover:bg-rose-50'
            }`}
          >
            🔴 บังคับเลือก ({stats.required})
          </button>
          <button
            type="button"
            onClick={() => setFilterType('optional')}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
              filterType === 'optional'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'bg-white text-emerald-800 border border-emerald-200 hover:bg-emerald-50'
            }`}
          >
            🟢 ไม่บังคับ ({stats.optional})
          </button>
          <button
            type="button"
            onClick={() => setFilterType('single')}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
              filterType === 'single'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white text-blue-800 border border-blue-200 hover:bg-blue-50'
            }`}
          >
            🔘 เลือกได้ 1 อย่าง ({stats.single})
          </button>
          <button
            type="button"
            onClick={() => setFilterType('multi')}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
              filterType === 'multi'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-white text-amber-900 border border-amber-200 hover:bg-amber-50'
            }`}
          >
            ☑️ หลายอย่าง ({stats.multi})
          </button>
        </div>
      </div>

      {/* Modifier Group Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {filteredModifiers.map((grp) => {
          const isReq = grp.is_required || grp.min_selection > 0;
          const isSingle = grp.max_selection === 1;
          const itemsCount = grp.items_count || (grp.linked_items ? grp.linked_items.length : 0);
          const disabledCount = grp.options.filter((o) => o.is_available === false).length;

          return (
            <div
              key={grp.id}
              className="p-4 bg-white rounded-2xl border border-app-border shadow-xs hover:border-chipotle-gold/60 transition-all flex flex-col justify-between space-y-3"
            >
              <div>
                {/* Header row */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-gray-900 truncate">
                      {grp.custom_name || grp.name}
                    </h3>
                    {grp.custom_name && grp.custom_name !== grp.name && (
                      <span className="text-[10px] text-gray-400 block truncate">
                        (ชื่อใน Loyverse: {grp.name})
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        isReq
                          ? 'bg-rose-100 text-rose-800 border border-rose-200'
                          : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      }`}
                    >
                      {isReq ? '🔴 บังคับเลือก' : '🟢 ไม่บังคับ'}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        isSingle
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : 'bg-amber-50 text-amber-800 border border-amber-200'
                      }`}
                    >
                      {isSingle
                        ? '🔘 เลือกได้ 1 อย่าง'
                        : grp.max_selection > 0
                        ? `☑️ สูงสุด ${grp.max_selection} อย่าง`
                        : '☑️ ไม่จำกัด'}
                    </span>
                  </div>
                </div>

                {/* Sub info */}
                <div className="flex items-center gap-3 mt-1.5 text-[11px] text-gray-500">
                  <button
                    type="button"
                    onClick={() => setViewingLinkedItems(grp)}
                    className="hover:text-chipotle-brown hover:underline flex items-center gap-1 font-medium text-chipotle-brown cursor-pointer"
                  >
                    <UtensilsCrossed className="w-3 h-3" />
                    <span>ผูกกับ {itemsCount} รายการอาหาร</span>
                  </button>
                  <span>•</span>
                  <span>{grp.options.length} ตัวเลือก</span>
                  {disabledCount > 0 && (
                    <>
                      <span>•</span>
                      <span className="text-rose-600 font-semibold">ปิดขาย {disabledCount} รายการ</span>
                    </>
                  )}
                </div>

                {/* Options preview tags */}
                <div className="mt-3 flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                  {grp.options.map((opt) => {
                    const isAvail = opt.is_available !== false;
                    const price = opt.effective_price ?? opt.price;
                    return (
                      <span
                        key={opt.id}
                        className={`text-[11px] px-2 py-0.5 rounded-lg border font-medium flex items-center gap-1 ${
                          !isAvail
                            ? 'bg-gray-100 text-gray-400 border-gray-200 line-through'
                            : 'bg-[#FAF7F3] text-gray-800 border-app-border'
                        }`}
                      >
                        <span>{opt.name}</span>
                        <span className="font-en text-[10px] font-bold text-chipotle-brown">
                          {price > 0 ? `+฿${formatPrice(price)}` : '(ฟรี)'}
                        </span>
                        {!isAvail && (
                          <span className="text-[9px] text-rose-600 no-underline font-bold">
                            (หมด)
                          </span>
                        )}
                      </span>
                    );
                  })}
                </div>
              </div>

              {/* Action Button */}
              <button
                type="button"
                onClick={() => setSelectedGroup(grp)}
                className="w-full mt-2 py-2 bg-[#FAF7F3] hover:bg-[#F0EBE1] active:scale-[0.99] text-chipotle-brown border border-app-border-dark rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-2xs"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>⚙️ จัดการเงื่อนไข & ราคา (แบบ Wongnai)</span>
              </button>
            </div>
          );
        })}
      </div>

      {filteredModifiers.length === 0 && (
        <div className="p-12 text-center text-xs text-app-muted bg-white rounded-3xl border border-app-border">
          ไม่พบกลุ่มตัวเลือกที่ตรงกับการค้นหา
        </div>
      )}

      {/* Edit Modal (Wongnai POS Style) */}
      {selectedGroup && (
        <ModifierEditModal
          group={selectedGroup}
          token={token}
          onClose={() => setSelectedGroup(null)}
          onSaved={handleSaveGroup}
        />
      )}

      {/* Linked Items Modal */}
      {viewingLinkedItems && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-5 space-y-4 max-h-[85vh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-app-border shrink-0">
              <div>
                <h3 className="text-xs font-bold text-gray-900">
                  รายการอาหารที่ใช้กลุ่ม: {viewingLinkedItems.custom_name || viewingLinkedItems.name}
                </h3>
                <span className="text-[11px] text-app-muted">
                  ทั้งหมด {viewingLinkedItems.linked_items?.length || 0} เมนู
                </span>
              </div>
              <button
                type="button"
                onClick={() => setViewingLinkedItems(null)}
                className="w-7 h-7 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="overflow-y-auto space-y-2 flex-1 pr-1">
              {viewingLinkedItems.linked_items && viewingLinkedItems.linked_items.length > 0 ? (
                viewingLinkedItems.linked_items.map((it) => (
                  <div
                    key={it.id}
                    className="p-2.5 bg-stone-50 border border-stone-200 rounded-xl flex items-center justify-between text-xs"
                  >
                    <span className="font-medium text-gray-800">{it.name}</span>
                    <span className="font-en font-bold text-chipotle-brown">฿{formatPrice(it.price)}</span>
                  </div>
                ))
              ) : (
                <div className="p-6 text-center text-xs text-gray-400">
                  กลุ่มนี้ยังไม่ได้ผูกกับเมนูอาหารหน้าร้านใดๆ
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setViewingLinkedItems(null)}
              className="w-full py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl text-xs transition-all shrink-0"
            >
              ปิดหน้าต่าง
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* Modal: ModifierEditModal (Wongnai POS Style)                               */
/* -------------------------------------------------------------------------- */

interface ModifierEditModalProps {
  group: ModifierGroup;
  token: string;
  onClose: () => void;
  onSaved: (updated: ModifierGroup) => void;
}

const ModifierEditModal: React.FC<ModifierEditModalProps> = ({ group, token, onClose, onSaved }) => {
  const [customName, setCustomName] = useState(group.custom_name || group.name);
  const [isRequired, setIsRequired] = useState(Boolean(group.is_required || group.min_selection > 0));
  const [selectionMode, setSelectionMode] = useState<'single' | 'multi'>(
    group.max_selection === 1 ? 'single' : 'multi'
  );
  const [hasMaxLimit, setHasMaxLimit] = useState(group.max_selection > 1);
  const [maxLimit, setMaxLimit] = useState<number>(group.max_selection > 1 ? group.max_selection : 2);
  const [disabledOptions, setDisabledOptions] = useState<Set<string>>(() => {
    const s = new Set<string>();
    group.options.forEach((o) => {
      if (o.is_available === false) s.add(o.id);
    });
    return s;
  });
  const [customPrices, setCustomPrices] = useState<Record<string, number>>(() => {
    const p: Record<string, number> = {};
    group.options.forEach((o) => {
      if (o.custom_price !== undefined && o.custom_price !== null) {
        p[o.id] = o.custom_price;
      }
    });
    return p;
  });

  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Compute final min and max
  const computedMin = isRequired ? 1 : 0;
  const computedMax = selectionMode === 'single' ? 1 : hasMaxLimit ? Math.max(1, maxLimit) : 0;

  const toggleOptionAvailability = (id: string) => {
    setDisabledOptions((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handlePriceChange = (id: string, val: string) => {
    const num = parseFloat(val);
    setCustomPrices((prev) => {
      if (isNaN(num)) {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      }
      return { ...prev, [id]: Math.max(0, num) };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setErrorMsg(null);

    try {
      const payload = {
        modifier_id: group.id,
        custom_name: customName.trim(),
        is_required: isRequired,
        min_selection: computedMin,
        max_selection: computedMax,
        disabled_options: Array.from(disabledOptions),
        custom_prices: customPrices,
      };

      const res = await fetch('/api/admin/modifiers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok && data.ok) {
        const updatedGroup: ModifierGroup = {
          ...group,
          custom_name: customName.trim(),
          is_required: isRequired,
          min_selection: computedMin,
          max_selection: computedMax,
          options: group.options.map((opt) => ({
            ...opt,
            custom_price: customPrices[opt.id] !== undefined ? customPrices[opt.id] : null,
            effective_price: customPrices[opt.id] !== undefined ? customPrices[opt.id] : opt.price,
            is_available: !disabledOptions.has(opt.id),
          })),
        };
        onSaved(updatedGroup);
      } else {
        setErrorMsg(data.detail || data.error || 'เกิดข้อผิดพลาดในการบันทึก');
      }
    } catch (e: any) {
      setErrorMsg(e.message || 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4">
      <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="h-14 px-5 border-b border-app-border flex items-center justify-between shrink-0 bg-[#FAF7F3]">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-chipotle-brown" />
            <h3 className="text-xs font-bold text-chipotle-brown font-en tracking-wider">
              WONGNAI OPTION CONFIGURATION
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-5">
          {errorMsg && (
            <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded-xl text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Section 1: General Info */}
          <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200 space-y-3">
            <h4 className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
              <span>1. ข้อมูลทั่วไป</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-gray-500 mb-1">
                  ชื่อกลุ่มเดิม (จาก Loyverse)
                </label>
                <input
                  type="text"
                  disabled
                  value={group.name}
                  className="w-full text-xs p-2.5 rounded-xl border border-gray-200 bg-gray-100 text-gray-500 cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-gray-700 mb-1">
                  ชื่อแสดงที่หน้าร้าน (Custom Display Name)
                </label>
                <input
                  type="text"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="เช่น ระดับความเผ็ด, ซอสเสริม..."
                  className="w-full text-xs p-2.5 rounded-xl border border-app-border-dark bg-white focus:ring-1 focus:ring-chipotle-brown"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Wongnai Selection Rules */}
          <div className="p-4 bg-white rounded-2xl border-2 border-amber-200/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-chipotle-brown flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-chipotle-gold" />
                <span>2. กฎการเลือกตัวเลือก (Wongnai POS Style)</span>
              </h4>
              <span className="text-[10px] bg-amber-100 text-amber-900 px-2 py-0.5 rounded-full font-bold">
                เหมือน Lineman / Wongnai
              </span>
            </div>

            {/* Rule 1: Requirement (บังคับหรือไม่) */}
            <div className="space-y-2 pt-1 border-t border-gray-100">
              <label className="block text-xs font-semibold text-gray-800">
                ความจำเป็นในการเลือก:
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <label
                  className={`p-3 rounded-xl border-2 cursor-pointer transition-all flex items-start gap-2.5 ${
                    isRequired
                      ? 'border-rose-500 bg-rose-50/50 shadow-xs'
                      : 'border-gray-200 bg-white hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="is_required"
                    checked={isRequired}
                    onChange={() => setIsRequired(true)}
                    className="mt-0.5 accent-rose-600 w-4 h-4"
                  />
                  <div>
                    <span className="text-xs font-bold text-rose-900 block">
                      🔴 จำเป็นต้องเลือก (บังคับ)
                    </span>
                    <span className="text-[11px] text-gray-500 leading-snug block mt-0.5">
                      ลูกค้าต้องเลือกอย่างน้อย 1 รายการก่อนหยิบใส่ตะกร้า (เช่น ระดับความเผ็ด, ความสุก, แยกถุง)
                    </span>
                  </div>
                </label>

                <label
                  className={`p-3 rounded-xl border-2 cursor-pointer transition-all flex items-start gap-2.5 ${
                    !isRequired
                      ? 'border-emerald-500 bg-emerald-50/50 shadow-xs'
                      : 'border-gray-200 bg-white hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="is_required"
                    checked={!isRequired}
                    onChange={() => setIsRequired(false)}
                    className="mt-0.5 accent-emerald-600 w-4 h-4"
                  />
                  <div>
                    <span className="text-xs font-bold text-emerald-900 block">
                      🟢 ไม่บังคับเลือก (ตามใจชอบ)
                    </span>
                    <span className="text-[11px] text-gray-500 leading-snug block mt-0.5">
                      ลูกค้าสามารถเลือกหรือไม่เลือกก็ได้ (เช่น ท็อปปิ้งเสริม, เพิ่มข้าว, น้ำจิ้มพิเศษ)
                    </span>
                  </div>
                </label>
              </div>
            </div>

            {/* Rule 2: Single vs Multiple Choice */}
            <div className="space-y-2 pt-2 border-t border-gray-100">
              <label className="block text-xs font-semibold text-gray-800">
                รูปแบบและจำนวนที่เลือกได้:
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <label
                  className={`p-3 rounded-xl border-2 cursor-pointer transition-all flex items-start gap-2.5 ${
                    selectionMode === 'single'
                      ? 'border-blue-500 bg-blue-50/50 shadow-xs'
                      : 'border-gray-200 bg-white hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="selection_mode"
                    checked={selectionMode === 'single'}
                    onChange={() => setSelectionMode('single')}
                    className="mt-0.5 accent-blue-600 w-4 h-4"
                  />
                  <div>
                    <span className="text-xs font-bold text-blue-900 block">
                      🔘 เลือกได้ 1 รายการเท่านั้น (Radio)
                    </span>
                    <span className="text-[11px] text-gray-500 leading-snug block mt-0.5">
                      เลือกได้อันเดียว เมื่อเลือกอันใหม่จะแทนที่อันเก่าทันที (เหมาะสำหรับ ขนาด, ความเผ็ด, ความสุก)
                    </span>
                  </div>
                </label>

                <label
                  className={`p-3 rounded-xl border-2 cursor-pointer transition-all flex items-start gap-2.5 ${
                    selectionMode === 'multi'
                      ? 'border-amber-500 bg-amber-50/50 shadow-xs'
                      : 'border-gray-200 bg-white hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="selection_mode"
                    checked={selectionMode === 'multi'}
                    onChange={() => setSelectionMode('multi')}
                    className="mt-0.5 accent-amber-600 w-4 h-4"
                  />
                  <div>
                    <span className="text-xs font-bold text-amber-900 block">
                      ☑️ เลือกได้หลายรายการ (Checkbox)
                    </span>
                    <span className="text-[11px] text-gray-500 leading-snug block mt-0.5">
                      เลือกได้หลายอย่างพร้อมกัน สามารถกำหนดจำนวนสูงสุดได้ (เหมาะสำหรับ ท็อปปิ้ง, ซอส)
                    </span>
                  </div>
                </label>
              </div>

              {/* Sub-config for Multi selection */}
              {selectionMode === 'multi' && (
                <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl space-y-2 mt-2">
                  <span className="text-xs font-bold text-amber-950 block">
                    กำหนดเพดานจำนวนที่เลือกได้สูงสุด (Max Selection):
                  </span>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="has_max_limit"
                        checked={!hasMaxLimit}
                        onChange={() => setHasMaxLimit(false)}
                        className="w-4 h-4 accent-amber-700"
                      />
                      <span className="text-xs text-amber-900 font-medium">ไม่จำกัดจำนวน (เลือกได้ไม่อั้น)</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="has_max_limit"
                        checked={hasMaxLimit}
                        onChange={() => setHasMaxLimit(true)}
                        className="w-4 h-4 accent-amber-700"
                      />
                      <span className="text-xs text-amber-900 font-medium">กำหนดสูงสุดไม่เกิน:</span>
                      <input
                        type="number"
                        min="1"
                        max="20"
                        disabled={!hasMaxLimit}
                        value={maxLimit}
                        onChange={(e) => setMaxLimit(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-16 text-xs p-1.5 rounded-lg border border-amber-300 bg-white text-center font-bold text-amber-950 disabled:bg-gray-100 disabled:opacity-50"
                      />
                      <span className="text-xs text-amber-900">รายการ</span>
                    </label>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Section 3: Options List, Prices & Availability */}
          <div className="p-4 bg-white rounded-2xl border border-app-border shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
              <h4 className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-chipotle-brown" />
                <span>3. จัดการตัวเลือกย่อย & ราคา & เปิด/ปิดการขาย</span>
              </h4>
              <span className="text-[11px] text-gray-500">
                ปิดขาย {disabledOptions.size} จาก {group.options.length} รายการ
              </span>
            </div>

            <div className="divide-y divide-gray-100 max-h-60 overflow-y-auto pr-1">
              {group.options.map((opt) => {
                const isAvail = !disabledOptions.has(opt.id);
                const customP = customPrices[opt.id];
                const displayPrice = customP !== undefined ? customP : opt.price;

                return (
                  <div
                    key={opt.id}
                    className={`py-2.5 flex items-center justify-between gap-3 ${
                      !isAvail ? 'opacity-60 bg-gray-50/50' : ''
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-semibold ${!isAvail ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                          {opt.name}
                        </span>
                        {!isAvail && (
                          <span className="text-[9px] font-bold text-red-700 bg-red-100 px-1.5 py-0.2 rounded">
                            ปิดขายชั่วคราว
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-gray-400 block font-en">
                        ราคาต้นทาง: ฿{formatPrice(opt.price)}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      {/* Price override input */}
                      <div className="flex items-center gap-1">
                        <span className="text-[11px] text-gray-500 font-medium">+฿</span>
                        <input
                          type="number"
                          step="1"
                          min="0"
                          value={displayPrice}
                          onChange={(e) => handlePriceChange(opt.id, e.target.value)}
                          className="w-16 text-xs p-1.5 rounded-lg border border-gray-300 text-center font-bold font-en text-chipotle-brown focus:ring-1 focus:ring-chipotle-brown"
                        />
                      </div>

                      {/* Availability toggle switch */}
                      <button
                        type="button"
                        onClick={() => toggleOptionAvailability(opt.id)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                          isAvail
                            ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                            : 'bg-red-100 text-red-800 hover:bg-red-200'
                        }`}
                      >
                        {isAvail ? '✓ เปิดขาย' : '✕ ปิดขาย'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section 4: Customer Live Preview */}
          <div className="p-4 bg-[#FAF7F3] rounded-2xl border border-app-border shadow-xs space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-chipotle-brown">
              <Eye className="w-4 h-4 text-chipotle-gold" />
              <span>4. ตัวอย่างมุมมองลูกค้า (Customer Live Preview)</span>
            </div>
            <div className="p-3 bg-white rounded-xl border border-gray-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-chipotle-brown">{customName || group.name}</span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                    isRequired
                      ? 'bg-rose-50 text-rose-800 border border-rose-200'
                      : 'bg-amber-50 text-amber-900 border border-amber-200'
                  }`}
                >
                  {isRequired
                    ? selectionMode === 'single'
                      ? '🔴 บังคับเลือก 1 อย่าง'
                      : `🔴 บังคับเลือก (สูงสุด ${hasMaxLimit ? maxLimit : 'ไม่จำกัด'})`
                    : selectionMode === 'single'
                    ? '🔘 เลือกได้ 1 อย่าง (ไม่บังคับ)'
                    : hasMaxLimit
                    ? `เลือกได้สูงสุด ${maxLimit} อย่าง`
                    : 'เลือกได้ตามใจ'}
                </span>
              </div>
              <div className="space-y-1">
                {group.options.slice(0, 3).map((opt) => {
                  const isAvail = !disabledOptions.has(opt.id);
                  const price = customPrices[opt.id] !== undefined ? customPrices[opt.id] : opt.price;
                  return (
                    <div
                      key={opt.id}
                      className="p-2 rounded-lg border border-gray-100 flex items-center justify-between text-xs text-gray-700 bg-gray-50/40"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-3.5 h-3.5 rounded-full border border-gray-400 flex items-center justify-center text-[8px]">
                          {selectionMode === 'single' ? '○' : '□'}
                        </span>
                        <span className={!isAvail ? 'line-through text-gray-400' : ''}>{opt.name}</span>
                      </div>
                      <span className="font-en text-chipotle-gold font-bold text-[11px]">
                        {price > 0 ? `+฿${formatPrice(price)}` : 'ฟรี'}
                      </span>
                    </div>
                  );
                })}
                {group.options.length > 3 && (
                  <span className="text-[10px] text-gray-400 block text-center pt-0.5">
                    ... และอีก {group.options.length - 3} ตัวเลือก
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-2xl text-xs transition-all"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex-2 py-3 bg-chipotle-brown hover:bg-[#3D1E0B] text-white font-bold rounded-2xl text-xs transition-all shadow-md flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่าตัวเลือกนี้'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
