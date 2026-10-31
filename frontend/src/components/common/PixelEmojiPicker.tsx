import React, { useState, useRef, useEffect } from 'react';
import { PIXEL_EMOJI_LIST } from '../../lib/renderEmoji';
import { Search, X, Sparkles } from 'lucide-react';

interface PixelEmojiPickerProps {
  onSelectEmoji: (char: string) => void;
  onSelectPresetTag?: (tag: string) => void;
}

const PRESET_TAGS = [
  '🔥 เมนูแนะนำวันนี้',
  '🏆 ขายดีอันดับ 1 ในคอนโด',
  '🍤 กุ้งเด้งเต็มคำ',
  '🍗 ไก่ทอดกรอบสูตรเด็ด',
  '🍳 ซิกเนเจอร์ข้าวไข่ข้น',
  '🛵 ส่งฟรีถึงหน้าห้องคอนโด',
  '🐱 แมวอ้วนคอนเฟิร์ม',
  '🍱 เซ็ตคู่หูสุดคุ้ม',
  '🍜 มาม่าเกาหลียอดฮิต',
  '🌶️ เผ็ดซี๊ดถึงใจ',
];

export const PixelEmojiPicker: React.FC<PixelEmojiPickerProps> = ({
  onSelectEmoji,
  onSelectPresetTag,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'highlight' | 'dish' | 'topping' | 'drink'>('all');
  const [search, setSearch] = useState('');
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isOpen]);

  const filteredEmojis = PIXEL_EMOJI_LIST.filter((item) => {
    const matchCategory = activeTab === 'all' || item.category === activeTab;
    const matchSearch =
      !search.trim() ||
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.shortcode.toLowerCase().includes(search.toLowerCase());
    return matchCategory && matchSearch;
  });

  return (
    <div className="relative inline-block" ref={popoverRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="px-2.5 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 text-xs font-medium flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer active:scale-95"
        title="เลือกแทรก Pixel Emoji อาหาร"
      >
        <img
          src="/pixel_emojis/cat.png"
          alt="cat"
          className="w-4 h-4 object-contain inline-block"
          style={{ imageRendering: 'pixelated' }}
        />
        <span className="hidden sm:inline">แทรก Pixel Emoji</span>
        <Sparkles className="w-3 h-3 text-amber-600" />
      </button>

      {/* Popover Card */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 z-50 w-[320px] sm:w-[360px] bg-white rounded-2xl shadow-xl border border-amber-200 p-3.5 animate-in fade-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="flex items-center justify-between pb-2 border-b border-gray-100 mb-2.5">
            <div className="flex items-center gap-2">
              <img
                src="/pixel_emojis/star.gif"
                alt="star"
                className="w-5 h-5 object-contain"
                style={{ imageRendering: 'pixelated' }}
              />
              <span className="text-xs font-bold text-chipotle-brown">คลัง Pixel Emoji (40+ แบบ)</span>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="w-6 h-6 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-700"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Quick Preset Tags (Click-to-Apply) */}
          {onSelectPresetTag && (
            <div className="mb-3">
              <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                ⚡ ป้ายสำเร็จรูปยอดฮิต (กดใส่ได้เลย):
              </div>
              <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto p-1 bg-amber-50/50 rounded-xl border border-amber-100">
                {PRESET_TAGS.map((tag, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      onSelectPresetTag(tag);
                      setIsOpen(false);
                    }}
                    className="text-[11px] px-2 py-0.5 rounded-lg bg-white hover:bg-amber-100 border border-amber-200 text-gray-800 font-medium transition-all hover:scale-[1.02] cursor-pointer shadow-2xs"
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Search Input */}
          <div className="relative mb-2.5">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ค้นหา เช่น กุ้ง, ไก่, ไข่, เผ็ด, แมว..."
              className="w-full text-xs pl-8 pr-3 py-1.5 rounded-lg border border-gray-200 bg-gray-50 focus:bg-white focus:border-amber-400 focus:outline-none"
            />
          </div>

          {/* Category Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 mb-2 text-[11px] border-b border-gray-100">
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={`px-2 py-0.5 rounded-md font-medium whitespace-nowrap cursor-pointer ${
                activeTab === 'all'
                  ? 'bg-chipotle-brown text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              ทั้งหมด ({PIXEL_EMOJI_LIST.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('highlight')}
              className={`px-2 py-0.5 rounded-md font-medium whitespace-nowrap cursor-pointer ${
                activeTab === 'highlight'
                  ? 'bg-chipotle-brown text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              🌟 ไฮไลต์
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('dish')}
              className={`px-2 py-0.5 rounded-md font-medium whitespace-nowrap cursor-pointer ${
                activeTab === 'dish'
                  ? 'bg-chipotle-brown text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              🍱 อาหาร
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('topping')}
              className={`px-2 py-0.5 rounded-md font-medium whitespace-nowrap cursor-pointer ${
                activeTab === 'topping'
                  ? 'bg-chipotle-brown text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              🌶️ ท็อปปิ้ง
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('drink')}
              className={`px-2 py-0.5 rounded-md font-medium whitespace-nowrap cursor-pointer ${
                activeTab === 'drink'
                  ? 'bg-chipotle-brown text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              🥤 เครื่องดื่ม
            </button>
          </div>

          {/* Emoji Grid */}
          <div className="grid grid-cols-6 sm:grid-cols-7 gap-1.5 max-h-48 overflow-y-auto p-1 bg-gray-50 rounded-xl border border-gray-200">
            {filteredEmojis.map((emoji) => (
              <button
                key={emoji.id}
                type="button"
                onClick={() => {
                  onSelectEmoji(emoji.char);
                  setIsOpen(false);
                }}
                className="group relative flex flex-col items-center justify-center p-1.5 rounded-lg bg-white hover:bg-amber-100 border border-gray-100 hover:border-amber-300 transition-all hover:scale-110 shadow-2xs cursor-pointer"
                title={`${emoji.name} (${emoji.char})`}
              >
                <img
                  src={emoji.src}
                  alt={emoji.name}
                  className="w-6 h-6 object-contain"
                  style={{ imageRendering: 'pixelated' }}
                />
                <span className="text-[8px] text-gray-500 group-hover:text-amber-900 truncate max-w-full mt-0.5 scale-90">
                  {emoji.name}
                </span>
              </button>
            ))}
          </div>

          {filteredEmojis.length === 0 && (
            <div className="text-center py-6 text-xs text-gray-400">
              ไม่พบ Pixel Emoji ที่ตรงกับคำค้นหา
            </div>
          )}
        </div>
      )}
    </div>
  );
};
