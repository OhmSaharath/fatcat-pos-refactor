import React, { useState, useEffect } from 'react';
import { ArrowUp, ArrowDown, Award, Sparkles, Check, Flame, Layers, UtensilsCrossed, ChevronsUp, Star, Trash2, Plus } from 'lucide-react';
import { cleanFrontName, cn, formatPrice } from '../../lib/utils';
import { AnimatedFlame, renderWithAnimatedEmojis } from '../../lib/renderEmoji';
import { PixelEmojiPicker } from '../common/PixelEmojiPicker';
import { DEFAULT_SHOWCASE_DISHES } from '../carousel/MenuCarousel';

interface AdminReorderViewProps {
  token: string;
}

export const AdminReorderView: React.FC<AdminReorderViewProps> = ({ token }) => {
  const [subTab, setSubTab] = useState<'carousel' | 'items' | 'categories'>('carousel');
  const [categories, setCategories] = useState<any[]>([]);
  const [categoryOrder, setCategoryOrder] = useState<string[]>([]);
  const [categoryConfig, setCategoryConfig] = useState<Record<string, any>>({});

  const [items, setItems] = useState<any[]>([]);
  const [itemOrder, setItemOrder] = useState<string[]>([]);
  const [itemConfig, setItemConfig] = useState<Record<string, any>>({});
  const [showcaseDishes, setShowcaseDishes] = useState<any[]>([]);
  const [selectedCatFilter, setSelectedCatFilter] = useState<string>('ALL');

  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const fetchReorder = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/admin/menu-reorder', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.ok) {
        setCategories(data.categories || []);
        setCategoryOrder(data.category_order || (data.categories || []).map((c: any) => c.id));
        setCategoryConfig(data.category_config || {});

        setItems(data.items || []);
        setItemOrder(data.item_order || (data.items || []).map((it: any) => it.id));
        setItemConfig(data.item_config || {});

        if (Array.isArray(data.showcase_dishes) && data.showcase_dishes.length > 0) {
          setShowcaseDishes(data.showcase_dishes);
        } else {
          setShowcaseDishes(
            DEFAULT_SHOWCASE_DISHES.map((d) => ({
              id: d.id,
              tag: d.tag,
            }))
          );
        }
      }
    } catch {
      setFeedback('ไม่สามารถโหลดข้อมูลลำดับเมนูได้');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReorder();
  }, [token]);

  const handleSyncBestsellers = async () => {
    setIsSyncing(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/admin/sync-bestsellers', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.ok) {
        setFeedback(`วิเคราะห์ยอดขายเสร็จสิ้น! เมนูอันดับ 1 คือ: "${data.top_1}"`);
        fetchReorder();
      } else {
        setFeedback('เกิดข้อผิดพลาดในการคำนวณยอดขาย');
      }
    } catch {
      setFeedback('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSaveOrder = async (
    customCatOrder?: string[],
    customCatConfig?: Record<string, any>,
    customItemOrder?: string[],
    customItemConfig?: Record<string, any>,
    customShowcaseDishes?: any[]
  ) => {
    setIsSaving(true);
    try {
      const res = await fetch('/api/admin/menu-reorder', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          category_order: customCatOrder || categoryOrder,
          category_config: customCatConfig || categoryConfig,
          item_order: customItemOrder || itemOrder,
          item_config: customItemConfig || itemConfig,
          showcase_dishes: customShowcaseDishes || showcaseDishes,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setFeedback('💾 บันทึกลำดับหมวดหมู่และการตั้งค่าเรียบร้อยแล้ว!');
      } else {
        setFeedback(`❌ บันทึกไม่สำเร็จ: ${data.error || 'Unknown error'}`);
      }
    } catch {
      setFeedback('❌ เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    } finally {
      setIsSaving(false);
    }
  };

  // --- Showcase Carousel Actions ---
  const moveCarouselDish = (index: number, direction: 'up' | 'down') => {
    const nextList = [...showcaseDishes];
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= nextList.length) return;
    const temp = nextList[index];
    nextList[index] = nextList[targetIdx];
    nextList[targetIdx] = temp;
    setShowcaseDishes(nextList);
    handleSaveOrder(categoryOrder, categoryConfig, itemOrder, itemConfig, nextList);
  };

  const changeCarouselDish = (index: number, itemId: string) => {
    const nextList = [...showcaseDishes];
    nextList[index] = { ...nextList[index], id: itemId };
    setShowcaseDishes(nextList);
    handleSaveOrder(categoryOrder, categoryConfig, itemOrder, itemConfig, nextList);
  };

  const changeCarouselTag = (index: number, tag: string) => {
    const nextList = [...showcaseDishes];
    nextList[index] = { ...nextList[index], tag };
    setShowcaseDishes(nextList);
  };

  const addCarouselSlot = () => {
    if (showcaseDishes.length >= 10) return;
    const firstUnused = items.find((it) => !showcaseDishes.some((s) => s.id === it.id)) || items[0];
    const nextList = [
      ...showcaseDishes,
      {
        id: firstUnused ? firstUnused.id : '',
        tag: '🔥 เมนูแนะนำวันนี้',
      },
    ];
    setShowcaseDishes(nextList);
    handleSaveOrder(categoryOrder, categoryConfig, itemOrder, itemConfig, nextList);
  };

  const removeCarouselSlot = (index: number) => {
    if (showcaseDishes.length <= 1) return;
    const nextList = showcaseDishes.filter((_, i) => i !== index);
    setShowcaseDishes(nextList);
    handleSaveOrder(categoryOrder, categoryConfig, itemOrder, itemConfig, nextList);
  };

  // --- Category Actions ---
  const moveCategory = (index: number, direction: 'up' | 'down') => {
    const newCats = [...categories];
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= newCats.length) return;

    const temp = newCats[index];
    newCats[index] = newCats[targetIdx];
    newCats[targetIdx] = temp;

    const newOrder = newCats.map((c) => c.id);
    setCategories(newCats);
    setCategoryOrder(newOrder);
    handleSaveOrder(newOrder, categoryConfig, itemOrder, itemConfig);
  };

  const toggleCategoryRecommend = (catId: string) => {
    const currentCfg = categoryConfig[catId] || {};
    const isNowRec = !Boolean(currentCfg.is_recommended);
    const updatedConfig = {
      ...categoryConfig,
      [catId]: {
        ...currentCfg,
        is_recommended: isNowRec,
        badge: isNowRec ? '🔥 แนะนำ' : '',
      },
    };
    setCategoryConfig(updatedConfig);
    // Update local category state for immediate visual feedback
    setCategories((prev) =>
      prev.map((c) =>
        c.id === catId
          ? { ...c, is_recommended: isNowRec, badge: isNowRec ? '🔥 แนะนำ' : '' }
          : c
      )
    );
    handleSaveOrder(categoryOrder, updatedConfig, itemOrder, itemConfig);
  };

  // --- Item Actions ---
  const filteredItems = items.filter((it) => {
    if (selectedCatFilter === 'ALL') return true;
    return it.category_id === selectedCatFilter;
  });

  const moveItem = (itemId: string, direction: 'up' | 'down') => {
    const globalIdx = items.findIndex((it) => it.id === itemId);
    if (globalIdx === -1) return;

    const newItems = [...items];
    if (selectedCatFilter === 'ALL') {
      const targetIdx = direction === 'up' ? globalIdx - 1 : globalIdx + 1;
      if (targetIdx < 0 || targetIdx >= newItems.length) return;

      const temp = newItems[globalIdx];
      newItems[globalIdx] = newItems[targetIdx];
      newItems[targetIdx] = temp;
    } else {
      const catItems = newItems.filter((it) => it.category_id === selectedCatFilter);
      const subIdx = catItems.findIndex((it) => it.id === itemId);
      const targetSubIdx = direction === 'up' ? subIdx - 1 : subIdx + 1;
      if (subIdx === -1 || targetSubIdx < 0 || targetSubIdx >= catItems.length) return;

      const otherItemId = catItems[targetSubIdx].id;
      const otherGlobalIdx = newItems.findIndex((it) => it.id === otherItemId);

      const temp = newItems[globalIdx];
      newItems[globalIdx] = newItems[otherGlobalIdx];
      newItems[otherGlobalIdx] = temp;
    }

    const newOrder = newItems.map((it) => it.id);
    setItems(newItems);
    setItemOrder(newOrder);
    handleSaveOrder(categoryOrder, categoryConfig, newOrder, itemConfig);
  };

  const moveItemToTop = (itemId: string) => {
    const globalIdx = items.findIndex((it) => it.id === itemId);
    if (globalIdx === -1) return;

    const newItems = [...items];
    const item = newItems.splice(globalIdx, 1)[0];
    newItems.unshift(item);

    const newOrder = newItems.map((it) => it.id);
    setItems(newItems);
    setItemOrder(newOrder);
    handleSaveOrder(categoryOrder, categoryConfig, newOrder, itemConfig);
  };

  const toggleItemRecommend = (itemId: string) => {
    const currentCfg = itemConfig[itemId] || {};
    const isNowRec = !Boolean(currentCfg.is_recommended);
    const updatedConfig = {
      ...itemConfig,
      [itemId]: {
        ...currentCfg,
        is_recommended: isNowRec,
        badge: isNowRec ? '⭐ แนะนำ' : '',
      },
    };
    setItemConfig(updatedConfig);
    setItems((prev) =>
      prev.map((it) =>
        it.id === itemId
          ? { ...it, is_recommended: isNowRec, badge: isNowRec ? '⭐ แนะนำ' : '' }
          : it
      )
    );
    handleSaveOrder(categoryOrder, categoryConfig, itemOrder, updatedConfig);
  };

  return (
    <div className="space-y-4">
      {/* Wongnai AI Action Banner */}
      <div className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shadow-xs">
        <div>
          <h2 className="text-sm font-bold text-amber-900 flex items-center gap-1.5">
            <Award className="w-4 h-4 text-amber-700" />
            <span>คำนวณเมนูขายดีจากใบเสร็จจริง (Wongnai AI)</span>
          </h2>
          <p className="text-[11px] text-amber-800/80">
            วิเคราะห์บิลใบเสร็จ 250 รายการล่าสุด และตั้งป้าย "🏆 ขายดีอันดับ 1" พร้อมดันขึ้นอันดับแรกให้อัตโนมัติ
          </p>
        </div>

        <button
          type="button"
          onClick={handleSyncBestsellers}
          disabled={isSyncing}
          className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-xs active:scale-95 disabled:opacity-50"
        >
          <Sparkles className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
          <span>ดึงยอดขาย & ติดป้ายอันดับ 1</span>
        </button>
      </div>

      {feedback && (
        <div className="p-3 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs flex items-center gap-2">
          <Check className="w-4 h-4 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Main Switcher: สไลด์เมนูแนะนำ vs เมนูอาหาร vs หมวดหมู่ */}
      <div className="flex items-center gap-2 border-b border-gray-200 pb-2 overflow-x-auto scrollbar-none">
        <button
          type="button"
          onClick={() => setSubTab('carousel')}
          className={cn(
            'flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap',
            subTab === 'carousel'
              ? 'bg-chipotle-brown text-white shadow-xs'
              : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
          )}
        >
          <Sparkles className="w-3.5 h-3.5 text-chipotle-gold" />
          <span>🌟 สไลด์เมนูแนะนำหน้าร้าน ({showcaseDishes.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab('items')}
          className={cn(
            'flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap',
            subTab === 'items'
              ? 'bg-chipotle-brown text-white shadow-xs'
              : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
          )}
        >
          <UtensilsCrossed className="w-3.5 h-3.5" />
          <span>จัดการลำดับเมนูอาหาร ({items.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab('categories')}
          className={cn(
            'flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap',
            subTab === 'categories'
              ? 'bg-chipotle-brown text-white shadow-xs'
              : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
          )}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>จัดการหมวดหมู่ ({categories.length})</span>
        </button>
      </div>

      {/* VIEW 0: สไลด์เมนูแนะนำหน้าร้าน (Top Showcase Carousel) */}
      {subTab === 'carousel' && (
        <div className="bg-white p-4 rounded-2xl border border-app-border space-y-4 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-gray-100 gap-2">
            <div>
              <h3 className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-chipotle-gold" />
                <span>เมนูสไลด์แนะนำด้านบนสุดหน้าร้าน (Top Showcase Carousel)</span>
              </h3>
              <p className="text-[11px] text-gray-500">
                เลือกเมนูเด่นประจำวันที่จะนำไปขึ้นสไลด์ 1:1 ด้านบนสุด (แนะนำ 4-6 เมนู) พร้อมกำหนดป้ายแท็กข้อความได้อิสระ
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={addCarouselSlot}
                disabled={showcaseDishes.length >= 10}
                className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded-xl text-xs font-semibold flex items-center gap-1 transition-all disabled:opacity-50 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>เพิ่มสไลด์</span>
              </button>

              <button
                type="button"
                onClick={() => handleSaveOrder(categoryOrder, categoryConfig, itemOrder, itemConfig, showcaseDishes)}
                disabled={isSaving}
                className="px-4 py-1.5 bg-chipotle-brown hover:bg-[#3D1E0B] text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs disabled:opacity-50 cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{isSaving ? 'กำลังบันทึก...' : '💾 บันทึกสไลด์แนะนำ'}</span>
              </button>
            </div>
          </div>

          {/* Slots list */}
          <div className="space-y-3">
            {showcaseDishes.map((slot, index) => {
              const matchedDish = items.find((it) => it.id === slot.id);
              const imgUrl = matchedDish?.image_url || (matchedDish ? `/api/img/${matchedDish.id}` : '');

              return (
                <div
                  key={index}
                  className="p-3 bg-[#FAF7F3] border border-app-border rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-chipotle-gold/60 transition-all"
                >
                  {/* Slot Number & Preview */}
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <span className="w-6 h-6 rounded-full bg-chipotle-brown text-white text-[11px] font-bold flex items-center justify-center shrink-0">
                      {index + 1}
                    </span>

                    <div className="w-12 h-12 rounded-xl bg-white border border-gray-200 overflow-hidden shrink-0 flex items-center justify-center">
                      {imgUrl ? (
                        <img src={imgUrl} alt="dish" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-xl">🍲</span>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <label className="block text-[10px] text-gray-500 font-medium mb-0.5">
                        เลือกเมนูสำหรับสไลด์ที่ {index + 1}:
                      </label>
                      <select
                        value={slot.id || ''}
                        onChange={(e) => changeCarouselDish(index, e.target.value)}
                        className="w-full text-xs p-1.5 rounded-lg border border-gray-300 bg-white font-medium text-gray-800"
                      >
                        <option value="">-- เลือกเมนูอาหาร --</option>
                        {items.map((it) => (
                          <option key={it.id} value={it.id}>
                            {cleanFrontName(it.name)} (฿{formatPrice(it.price)})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Tag editor & Controls */}
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 shrink-0">
                    <div>
                      <div className="flex items-center justify-between mb-0.5 gap-2">
                        <label className="block text-[10px] text-gray-500 font-medium">
                          ป้ายข้อความกำกับ (Tag Badge):
                        </label>
                        {slot.tag && (
                          <span className="text-[10px] text-amber-900 bg-amber-100/80 px-2 py-0.5 rounded-md border border-amber-300 inline-flex items-center gap-1 font-medium shadow-2xs">
                            <span className="text-[9px] text-amber-700 font-bold">PREVIEW:</span>
                            {renderWithAnimatedEmojis(slot.tag)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          value={slot.tag || ''}
                          onChange={(e) => changeCarouselTag(index, e.target.value)}
                          placeholder="เช่น 🏆 ขายดีอันดับ 1, 🔥 แนะนำวันนี้"
                          className="w-36 sm:w-44 text-xs p-1.5 rounded-lg border border-gray-300 bg-white"
                        />
                        <PixelEmojiPicker
                          onSelectEmoji={(char) => {
                            const cur = slot.tag || '';
                            const nextTag = cur ? `${cur} ${char}` : `${char} `;
                            changeCarouselTag(index, nextTag);
                          }}
                          onSelectPresetTag={(preset) => {
                            changeCarouselTag(index, preset);
                          }}
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-1 pt-3.5">
                      <button
                        type="button"
                        disabled={index === 0}
                        onClick={() => moveCarouselDish(index, 'up')}
                        className="p-1.5 rounded-lg bg-white hover:bg-gray-100 border border-gray-200 disabled:opacity-30 cursor-pointer"
                        title="เลื่อนขึ้น"
                      >
                        <ArrowUp className="w-3.5 h-3.5 text-gray-700" />
                      </button>
                      <button
                        type="button"
                        disabled={index === showcaseDishes.length - 1}
                        onClick={() => moveCarouselDish(index, 'down')}
                        className="p-1.5 rounded-lg bg-white hover:bg-gray-100 border border-gray-200 disabled:opacity-30 cursor-pointer"
                        title="เลื่อนลง"
                      >
                        <ArrowDown className="w-3.5 h-3.5 text-gray-700" />
                      </button>
                      <button
                        type="button"
                        disabled={showcaseDishes.length <= 1}
                        onClick={() => removeCarouselSlot(index)}
                        className="p-1.5 rounded-lg bg-white hover:bg-red-50 text-gray-400 hover:text-red-600 border border-gray-200 disabled:opacity-30 cursor-pointer"
                        title="ลบสไลด์นี้"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* VIEW 1: จัดการหมวดหมู่ (Category Management) */}
      {subTab === 'categories' && (
        <div className="bg-white p-4 rounded-2xl border border-app-border space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-gray-100">
            <div>
              <h3 className="text-xs font-bold text-gray-900">ลำดับหมวดหมู่ & หมวดแนะนำ</h3>
              <p className="text-[11px] text-gray-500">
                หมวดที่ตั้งเป็น "แนะนำ" จะติดป้าย 🔥 พร้อมไฮไลต์สีทองบนแถบเมนูด้านบนหน้าเว็บ
              </p>
            </div>
            <button
              type="button"
              disabled={isSaving}
              onClick={() => handleSaveOrder()}
              className="px-3 py-1 bg-chipotle-brown hover:bg-[#3D1E0B] text-white rounded-lg text-xs font-semibold disabled:opacity-50"
            >
              {isSaving ? 'กำลังบันทึก...' : '💾 บันทึก'}
            </button>
          </div>

          {isLoading ? (
            <div className="py-12 text-center text-xs text-app-muted">กำลังโหลดหมวดหมู่...</div>
          ) : (
            <div className="space-y-2">
              {categories.map((cat, idx) => {
                const cfg = categoryConfig[cat.id] || {};
                const isRec = Boolean(cfg.is_recommended || cat.is_recommended);
                const itemCount = items.filter((it) => it.category_id === cat.id).length;

                return (
                  <div
                    key={cat.id}
                    className={cn(
                      'p-3 rounded-xl border flex items-center justify-between gap-3 text-xs transition-all',
                      isRec
                        ? 'border-amber-300 bg-amber-50/70 shadow-2xs'
                        : 'border-gray-200 bg-stone-50/50'
                    )}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="font-mono text-gray-400 text-[11px] w-5 text-right font-bold">
                        #{idx + 1}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-gray-900">{cat.name}</span>
                          {isRec && (
                            <span className="bg-amber-100 text-amber-900 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-300 flex items-center gap-0.5">
                              <Flame className="w-3 h-3 text-amber-600 fill-amber-500" />
                              <span>หมวดแนะนำ</span>
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-gray-500">
                          {itemCount} เมนูในหมวดนี้
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => toggleCategoryRecommend(cat.id)}
                        className={cn(
                          'px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 border transition-all',
                          isRec
                            ? 'bg-amber-500 hover:bg-amber-600 text-white border-amber-600 shadow-2xs'
                            : 'bg-white hover:bg-gray-100 text-gray-700 border-gray-300'
                        )}
                        title="กดเพื่อตั้งเป็นหมวดแนะนำบนหัวเว็บ"
                      >
                        <Flame className={cn('w-3.5 h-3.5', isRec ? 'fill-white' : 'text-gray-400')} />
                        <span>{isRec ? 'แนะนำแล้ว' : 'ตั้งเป็นหมวดแนะนำ'}</span>
                      </button>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => moveCategory(idx, 'up')}
                          className="p-1.5 rounded-lg bg-white hover:bg-gray-100 border border-gray-200 disabled:opacity-30"
                          title="เลื่อนขึ้น"
                        >
                          <ArrowUp className="w-3.5 h-3.5 text-gray-700" />
                        </button>
                        <button
                          type="button"
                          disabled={idx === categories.length - 1}
                          onClick={() => moveCategory(idx, 'down')}
                          className="p-1.5 rounded-lg bg-white hover:bg-gray-100 border border-gray-200 disabled:opacity-30"
                          title="เลื่อนลง"
                        >
                          <ArrowDown className="w-3.5 h-3.5 text-gray-700" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* VIEW 2: จัดการลำดับเมนูอาหาร (Item Management) */}
      {subTab === 'items' && (
        <div className="bg-white p-4 rounded-2xl border border-app-border space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-gray-100 gap-2">
            <div>
              <h3 className="text-xs font-bold text-gray-900">ลำดับเมนูอาหาร</h3>
              <p className="text-[11px] text-gray-500">
                สามารถเลื่อนขึ้น/ลง ดันขึ้นบนสุด หรือติดป้าย ⭐ เมนูแนะนำ
              </p>
            </div>
            <button
              type="button"
              disabled={isSaving}
              onClick={() => handleSaveOrder()}
              className="px-3 py-1 bg-chipotle-brown hover:bg-[#3D1E0B] text-white rounded-lg text-xs font-semibold disabled:opacity-50 self-end sm:self-auto"
            >
              {isSaving ? 'กำลังบันทึก...' : '💾 บันทึก'}
            </button>
          </div>

          {/* Filter Pills by Category */}
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar py-1">
            <button
              type="button"
              onClick={() => setSelectedCatFilter('ALL')}
              className={cn(
                'px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-all',
                selectedCatFilter === 'ALL'
                  ? 'bg-chipotle-brown text-white'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              )}
            >
              ทั้งหมด ({items.length})
            </button>
            {categories.map((c) => {
              const count = items.filter((it) => it.category_id === c.id).length;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedCatFilter(c.id)}
                  className={cn(
                    'px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-all',
                    selectedCatFilter === c.id
                      ? 'bg-chipotle-brown text-white'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                  )}
                >
                  {c.is_recommended ? <AnimatedFlame className="mr-1" /> : null}
                  {c.name} ({count})
                </button>
              );
            })}
          </div>

          {isLoading ? (
            <div className="py-12 text-center text-xs text-app-muted">กำลังโหลดเมนู...</div>
          ) : (
            <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
              {filteredItems.map((it, idx) => {
                const cfg = itemConfig[it.id] || {};
                const isRec = Boolean(cfg.is_recommended || it.is_recommended);
                const badge = cfg.badge || (it.badge ? it.badge : '');

                return (
                  <div
                    key={it.id}
                    className={cn(
                      'p-2.5 rounded-xl border flex items-center justify-between gap-3 text-xs transition-all',
                      isRec
                        ? 'border-amber-200 bg-amber-50/50'
                        : 'border-gray-200 bg-stone-50/50'
                    )}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-mono text-gray-400 text-[11px] w-6 text-right font-bold shrink-0">
                        #{idx + 1}
                      </span>
                      {it.image_url ? (
                        <img
                          src={it.image_url}
                          alt={it.name}
                          className="w-9 h-9 rounded-lg object-cover shrink-0 border border-gray-200"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-lg bg-gray-200 flex items-center justify-center shrink-0 text-sm">
                          🍲
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-medium text-gray-900 truncate">
                            {cleanFrontName(it.name)}
                          </span>
                          {badge && (
                            <span className="bg-amber-100 text-amber-900 text-[10px] font-semibold px-2 py-0.5 rounded-full border border-amber-300 inline-flex items-center gap-1">
                              {renderWithAnimatedEmojis(badge)}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-gray-500">
                          ฿{it.price}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => toggleItemRecommend(it.id)}
                        className={cn(
                          'p-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1 transition-all',
                          isRec
                            ? 'bg-amber-500 text-white border-amber-600'
                            : 'bg-white hover:bg-gray-100 text-gray-600 border-gray-200'
                        )}
                        title="กดเพื่อติดป้ายเมนูแนะนำ"
                      >
                        <Star className={cn('w-3.5 h-3.5', isRec ? 'fill-white' : 'text-gray-400')} />
                        <span className="hidden sm:inline">{isRec ? 'แนะนำแล้ว' : 'แนะนำ'}</span>
                      </button>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => moveItemToTop(it.id)}
                          className="p-1.5 rounded-lg bg-white hover:bg-gray-100 border border-gray-200"
                          title="ดันขึ้นบนสุด (Top)"
                        >
                          <ChevronsUp className="w-3.5 h-3.5 text-gray-700" />
                        </button>
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => moveItem(it.id, 'up')}
                          className="p-1.5 rounded-lg bg-white hover:bg-gray-100 border border-gray-200 disabled:opacity-30"
                          title="เลื่อนขึ้น"
                        >
                          <ArrowUp className="w-3.5 h-3.5 text-gray-700" />
                        </button>
                        <button
                          type="button"
                          disabled={idx === filteredItems.length - 1}
                          onClick={() => moveItem(it.id, 'down')}
                          className="p-1.5 rounded-lg bg-white hover:bg-gray-100 border border-gray-200 disabled:opacity-30"
                          title="เลื่อนลง"
                        >
                          <ArrowDown className="w-3.5 h-3.5 text-gray-700" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
