import React, { useState, useMemo } from 'react';
import { X, Minus, Plus } from 'lucide-react';
import { MenuItem, CartItem, CartModifier } from '../../types/menu';
import { cleanFrontName, formatPrice } from '../../lib/utils';

interface ItemCustomizerModalProps {
  item: MenuItem | null;
  onClose: () => void;
  onAddToCart: (cartItem: CartItem) => void;
  isStoreOpen?: boolean;
}

export const ItemCustomizerModal: React.FC<ItemCustomizerModalProps> = ({
  item,
  onClose,
  onAddToCart,
  isStoreOpen = true,
}) => {
  const [quantity, setQuantity] = useState(1);
  const [selectedModifiers, setSelectedModifiers] = useState<Record<string, string[]>>({});
  const [itemNote, setItemNote] = useState('');

  // Reset state when a new item is opened
  React.useEffect(() => {
    if (item) {
      setQuantity(1);
      setItemNote('');
      const initial: Record<string, string[]> = {};
    (item.modifier_groups || []).forEach((grp) => {
      if ((grp.min_selection > 0 || grp.is_required) && grp.options.length > 0) {
        const firstAvail = grp.options.find((o) => o.is_available !== false);
        if (firstAvail && grp.max_selection === 1) {
          initial[grp.id] = [firstAvail.id];
        } else {
          initial[grp.id] = [];
        }
      } else {
        initial[grp.id] = [];
      }
    });
      setSelectedModifiers(initial);
    }
  }, [item]);

  // Calculate unit price including selected modifiers
  const unitPrice = useMemo(() => {
    if (!item) return 0;
    let price = Number(item.price || 0);
    (item.modifier_groups || []).forEach((grp) => {
      const selected = selectedModifiers[grp.id] || [];
      grp.options.forEach((opt) => {
        if (selected.includes(opt.id)) {
          price += Number(opt.price || 0);
        }
      });
    });
    return price;
  }, [item, selectedModifiers]);

  if (!item) return null;

  const totalPrice = unitPrice * quantity;

  const handleToggleOption = (groupId: string, optionId: string, maxSelection: number) => {
    setSelectedModifiers((prev) => {
      const current = prev[groupId] || [];
      if (maxSelection === 1) {
        return { ...prev, [groupId]: [optionId] };
      }
      if (current.includes(optionId)) {
        return { ...prev, [groupId]: current.filter((id) => id !== optionId) };
      }
      if (maxSelection > 0 && current.length >= maxSelection) {
        return prev;
      }
      return { ...prev, [groupId]: [...current, optionId] };
    });
  };

  const handleConfirm = () => {
    // Validate required groups and selection limits
    for (const grp of item.modifier_groups || []) {
      const selected = selectedModifiers[grp.id] || [];
      const isReq = grp.is_required || grp.min_selection > 0;
      const minReq = grp.min_selection > 0 ? grp.min_selection : (isReq ? 1 : 0);
      if (selected.length < minReq) {
        alert(`กรุณาเลือกตัวเลือกในกลุ่ม "${grp.name}" อย่างน้อย ${minReq} รายการก่อนครับ`);
        return;
      }
    }

    const flattenedModifiers: CartModifier[] = [];
    (item.modifier_groups || []).forEach((grp) => {
      const selected = selectedModifiers[grp.id] || [];
      grp.options.forEach((opt) => {
        if (selected.includes(opt.id)) {
          flattenedModifiers.push({
            group_id: grp.id,
            group_name: grp.name,
            option_id: opt.id,
            name: opt.name,
            price: opt.price,
          });
        }
      });
    });

    onAddToCart({
      id: `${item.id}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      item_id: item.id,
      name: item.name,
      base_price: item.price,
      unit_price: unitPrice,
      quantity,
      modifiers: flattenedModifiers,
      item_note: itemNote.trim(),
      image_url: item.image_url,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs">
      <div className="w-full max-w-[500px] bg-white rounded-t-3xl sm:rounded-2xl max-h-[88vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom duration-200">
        {/* Header */}
        <div className="h-12 px-4 border-b border-app-border flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="text-chipotle-brown hover:text-black font-semibold text-xs tracking-wider flex items-center gap-1"
          >
            ❮ BACK
          </button>
          <span className="font-en text-xs font-bold text-chipotle-gold tracking-widest">FATCAT POS</span>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-4 overflow-y-auto space-y-4">
          {/* 1:1 Square Image */}
          {item.image_url && (
            <div className="w-full aspect-square max-w-[360px] mx-auto rounded-2xl overflow-hidden shadow-md bg-[#F4EFE8] border border-gray-100">
              <img
                src={item.image_url}
                alt={cleanFrontName(item.name)}
                className="w-full h-full object-cover rounded-2xl"
                style={{ imageRendering: '-webkit-optimize-contrast' }}
              />
            </div>
          )}

          {/* Title & Price */}
          <div>
            <div className="text-[11px] font-bold text-chipotle-red tracking-widest uppercase font-en">
              BUILD YOUR MEAL
            </div>
            <h2 className="text-xl font-medium text-chipotle-brown leading-snug mt-0.5">
              {cleanFrontName(item.name)}
            </h2>
            <div className="text-base font-semibold text-chipotle-gold font-en mt-1">
              BASE PRICE: {formatPrice(item.price)}
            </div>
            {item.description && (
              <p className="text-xs text-app-muted mt-1 leading-relaxed">
                {item.description}
              </p>
            )}
          </div>

          {/* Modifier Groups */}
          {(item.modifier_groups || []).map((grp) => {
            const isSingle = grp.max_selection === 1;
            const currentSelected = selectedModifiers[grp.id] || [];
            const isReq = Boolean(grp.is_required || grp.min_selection > 0);
            const isAtMax = !isSingle && grp.max_selection > 0 && currentSelected.length >= grp.max_selection;

            return (
              <div key={grp.id} className="pt-2 border-t border-app-border">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-semibold text-chipotle-brown">{grp.name}</h4>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                    isReq
                      ? 'bg-rose-50 text-rose-800 border border-rose-200'
                      : 'bg-amber-50 text-amber-900 border border-amber-200'
                  }`}>
                    {isReq
                      ? (isSingle ? '🔴 บังคับเลือก 1 อย่าง' : `🔴 บังคับเลือก (สูงสุด ${grp.max_selection || 'ไม่จำกัด'})`)
                      : (isSingle ? '🔘 เลือกได้ 1 อย่าง (ไม่บังคับ)' : (grp.max_selection > 0 ? `เลือกได้สูงสุด ${grp.max_selection} อย่าง` : 'เลือกได้ตามใจ'))}
                  </span>
                </div>

                <div className="space-y-1.5">
                  {grp.options.map((opt) => {
                    const isChecked = currentSelected.includes(opt.id);
                    const isAvail = opt.is_available !== false;
                    const isDisabled = !isAvail || (isAtMax && !isChecked);

                    return (
                      <label
                        key={opt.id}
                        className={`flex items-center justify-between p-2.5 rounded-xl border transition-colors select-none ${
                          !isAvail
                            ? 'bg-gray-50 border-gray-200 opacity-60 cursor-not-allowed'
                            : isChecked
                            ? 'bg-amber-50/60 border-amber-300 cursor-pointer'
                            : isDisabled
                            ? 'bg-gray-50/50 border-gray-100 opacity-60 cursor-not-allowed'
                            : 'border-gray-100 hover:bg-gray-50 cursor-pointer'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <input
                            type={isSingle ? 'radio' : 'checkbox'}
                            name={`grp-${grp.id}`}
                            checked={isChecked}
                            disabled={isDisabled}
                            onChange={() => isAvail && handleToggleOption(grp.id, opt.id, grp.max_selection)}
                            className="w-4 h-4 accent-chipotle-brown cursor-pointer disabled:cursor-not-allowed"
                          />
                          <span className={`text-xs ${!isAvail ? 'text-gray-400 line-through' : 'text-gray-800 font-medium'}`}>
                            {opt.name}
                          </span>
                          {!isAvail && (
                            <span className="text-[9px] bg-red-100 text-red-700 px-1.5 py-0.2 rounded font-semibold">
                              หมดชั่วคราว
                            </span>
                          )}
                        </div>
                        <span className="text-xs font-semibold text-chipotle-gold font-en shrink-0">
                          {opt.price > 0 ? `+${formatPrice(opt.price)}` : 'ฟรี'}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Special Request Note */}
          <div className="pt-2 border-t border-app-border">
            <label className="block text-xs font-semibold text-chipotle-brown mb-1.5">
              โน้ตพิเศษถึงร้าน (ถ้ามี)
            </label>
            <input
              type="text"
              value={itemNote}
              onChange={(e) => setItemNote(e.target.value)}
              placeholder="เช่น ไม่ผักชี, ขอน้ำจิ้มเพิ่ม..."
              maxLength={150}
              className="w-full text-xs p-2.5 rounded-xl border border-app-border-dark bg-white focus:outline-none focus:ring-1 focus:ring-chipotle-brown"
            />
          </div>
        </div>

        {/* Sticky Footer */}
        <div className="p-3.5 border-t border-app-border bg-white flex items-center gap-3 shrink-0">
          {/* Stepper */}
          <div className="flex items-center border border-app-border-dark rounded-full px-2 py-1 bg-gray-50 shrink-0">
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              className="w-7 h-7 rounded-full bg-white shadow-xs flex items-center justify-center text-chipotle-brown hover:bg-gray-100 active:scale-95"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <span className="w-8 text-center text-sm font-semibold font-en text-chipotle-brown">
              {quantity}
            </span>
            <button
              type="button"
              onClick={() => setQuantity((q) => q + 1)}
              className="w-7 h-7 rounded-full bg-white shadow-xs flex items-center justify-center text-chipotle-brown hover:bg-gray-100 active:scale-95"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Add to Bag Button */}
          {isStoreOpen ? (
            <button
              type="button"
              onClick={handleConfirm}
              className="flex-1 bg-chipotle-brown hover:bg-chipotle-brown-hover active:scale-[0.98] text-white py-3 px-4 rounded-full font-semibold text-sm shadow-md transition-all font-en"
            >
              ADD TO BAG • {formatPrice(totalPrice)}
            </button>
          ) : (
            <button
              type="button"
              disabled
              className="flex-1 bg-gray-200 text-gray-500 py-3 px-4 rounded-full font-semibold text-xs transition-all cursor-not-allowed select-none text-center"
            >
              🔴 ร้านปิดรับออเดอร์ชั่วคราว
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
