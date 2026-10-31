import React from 'react';
import {
  Volume2,
  VolumeX,
  RefreshCw,
  LogOut,
  ExternalLink,
  Store,
  Layers,
  Sliders,
  SlidersHorizontal,
  Receipt,
  UtensilsCrossed,
  Users,
} from 'lucide-react';

export type AdminTab = 'orders' | 'stock' | 'reorder' | 'options' | 'customers' | 'settings' | 'receipts';

interface AdminHeaderProps {
  isOpen: boolean;
  activeTab: AdminTab;
  onTabChange: (tab: AdminTab) => void;
  pendingCount: number;
  onRefresh: () => void;
  isRefreshing: boolean;
  soundEnabled: boolean;
  onToggleSound: () => void;
  soundType: 'kathoey' | 'siri';
  onChangeSoundType: (type: 'kathoey' | 'siri') => void;
  soundMode: '3x' | 'continuous';
  onChangeSoundMode: (mode: '3x' | 'continuous') => void;
  isPlayingSound: boolean;
  onStopSound: () => void;
  onTestSound: () => void;
  onLogout: () => void;
}

export const AdminHeader: React.FC<AdminHeaderProps> = ({
  isOpen,
  activeTab,
  onTabChange,
  pendingCount,
  onRefresh,
  isRefreshing,
  soundEnabled,
  onToggleSound,
  soundType,
  onChangeSoundType,
  soundMode,
  onChangeSoundMode,
  isPlayingSound,
  onStopSound,
  onTestSound,
  onLogout,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-white border-b border-app-border shadow-xs">
      {/* Top Bar */}
      <div className="h-14 px-4 flex items-center justify-between gap-3 max-w-5xl mx-auto">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-chipotle-brown text-white flex items-center justify-center font-bold text-sm font-en shadow-xs">
            FC
          </div>
          <div>
            <div className="text-xs font-bold text-chipotle-brown flex items-center gap-1.5 leading-none">
              <span>แมวอ้วน POS KITCHEN</span>
              <span
                className={`w-2 h-2 rounded-full ${isOpen ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}
              ></span>
            </div>
            <div className="text-[10px] text-app-muted mt-0.5">
              {isOpen ? '🟢 ร้านเปิดรับออเดอร์' : '🔴 ร้านปิดรับออเดอร์'}
            </div>
          </div>
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-1.5">
          {/* Active Sound Stop Button (Glowing when ringing) */}
          {isPlayingSound && (
            <button
              type="button"
              onClick={onStopSound}
              className="px-2.5 py-1.5 rounded-xl bg-red-600 text-white font-bold text-xs flex items-center gap-1.5 animate-pulse shadow-md hover:bg-red-700 active:scale-95 cursor-pointer"
              title="กดเพื่อหยุดเสียงเตือนทันที (ESC)"
            >
              <VolumeX className="w-4 h-4 text-white" />
              <span className="font-sans">หยุดเสียง!</span>
            </button>
          )}

          {/* Sound Notification Controls */}
          <div className="flex items-center bg-[#F4EFE8] rounded-xl p-0.5 border border-app-border">
            <button
              type="button"
              onClick={onToggleSound}
              className={`px-2 py-1.5 rounded-lg text-xs flex items-center gap-1.5 transition-all ${
                soundEnabled ? 'bg-white text-emerald-800 shadow-2xs font-semibold' : 'bg-red-50 text-red-600 font-semibold'
              }`}
              title={soundEnabled ? 'คลิกเพื่อปิดเสียงเตือน' : 'คลิกเพื่อเปิดเสียงเตือน'}
            >
              {soundEnabled ? (
                <>
                  <Volume2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-[11px] text-emerald-700 hidden sm:inline">เปิดเสียง</span>
                </>
              ) : (
                <>
                  <VolumeX className="w-3.5 h-3.5 text-red-500" />
                  <span className="text-[11px] text-red-600 hidden sm:inline">ปิดเสียง</span>
                </>
              )}
            </button>

            {soundEnabled && (
              <>
                <select
                  value={soundType}
                  onChange={(e) => onChangeSoundType(e.target.value as any)}
                  className="text-[10px] bg-transparent font-medium text-chipotle-brown pl-1 pr-1 focus:outline-none cursor-pointer"
                  title="เลือกเสียงพากย์"
                >
                  <option value="kathoey">💅 กะเทย</option>
                  <option value="siri">🎙️ Siri</option>
                </select>

                <select
                  value={soundMode}
                  onChange={(e) => onChangeSoundMode(e.target.value as any)}
                  className="text-[10px] bg-transparent font-medium text-chipotle-brown pl-1 pr-1.5 border-l border-app-border focus:outline-none cursor-pointer hidden md:inline-block"
                  title="เลือกโหมดการเตือน: 3 ครั้ง หรือวนลูปต่อเนื่อง"
                >
                  <option value="3x">⏹️ เตือน 3 ครั้ง</option>
                  <option value="continuous">🔁 วนลูปต่อเนื่อง</option>
                </select>

                {!isPlayingSound && (
                  <button
                    type="button"
                    onClick={onTestSound}
                    className="text-[10px] px-1.5 py-0.5 text-app-muted hover:text-chipotle-brown hover:bg-white rounded transition-colors hidden sm:inline-block"
                    title="ทดสอบฟังเสียงเตือน"
                  >
                    🔊 ลอง
                  </button>
                )}
              </>
            )}
          </div>

          {/* Refresh Button */}
          <button
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="w-8 h-8 rounded-xl bg-[#F4EFE8] hover:bg-[#EAE4DC] text-chipotle-brown flex items-center justify-center transition-all border border-app-border"
            title="รีเฟรชข้อมูลสด"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>

          {/* Storefront Link */}
          <a
            href="/"
            target="_blank"
            rel="noreferrer"
            className="w-8 h-8 rounded-xl bg-[#F4EFE8] hover:bg-[#EAE4DC] text-chipotle-brown flex items-center justify-center transition-all border border-app-border"
            title="เปิดหน้าร้านลูกค้า"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>

          {/* Logout Button */}
          <button
            type="button"
            onClick={onLogout}
            className="w-8 h-8 rounded-xl hover:bg-red-50 text-gray-400 hover:text-red-600 flex items-center justify-center transition-all"
            title="ออกจากระบบ"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="px-4 border-t border-app-border/70 overflow-x-auto no-scrollbar max-w-5xl mx-auto flex items-center gap-1 py-1.5">
        <button
          type="button"
          onClick={() => onTabChange('orders')}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
            activeTab === 'orders'
              ? 'bg-chipotle-brown text-white shadow-xs'
              : 'text-gray-600 hover:text-chipotle-brown hover:bg-gray-100'
          }`}
        >
          <UtensilsCrossed className="w-3.5 h-3.5" />
          <span>ออเดอร์หน้าร้าน</span>
          {pendingCount > 0 && (
            <span className="bg-amber-400 text-black text-[10px] font-bold px-1.5 py-0.2 rounded-full font-en ml-0.5">
              {pendingCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => onTabChange('stock')}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
            activeTab === 'stock'
              ? 'bg-chipotle-brown text-white shadow-xs'
              : 'text-gray-600 hover:text-chipotle-brown hover:bg-gray-100'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>จัดการสต็อก</span>
        </button>

        <button
          type="button"
          onClick={() => onTabChange('reorder')}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
            activeTab === 'reorder'
              ? 'bg-chipotle-brown text-white shadow-xs'
              : 'text-gray-600 hover:text-chipotle-brown hover:bg-gray-100'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>จัดลำดับเมนู & ขายดี</span>
        </button>

        <button
          type="button"
          onClick={() => onTabChange('options')}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
            activeTab === 'options'
              ? 'bg-chipotle-brown text-white shadow-xs'
              : 'text-gray-600 hover:text-chipotle-brown hover:bg-gray-100'
          }`}
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          <span>จัดการ Option</span>
        </button>

        <button
          type="button"
          onClick={() => onTabChange('customers')}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
            activeTab === 'customers'
              ? 'bg-chipotle-brown text-white shadow-xs'
              : 'text-gray-600 hover:text-chipotle-brown hover:bg-gray-100'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>ลูกค้า & สะสมแต้ม</span>
        </button>

        <button
          type="button"
          onClick={() => onTabChange('settings')}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
            activeTab === 'settings'
              ? 'bg-chipotle-brown text-white shadow-xs'
              : 'text-gray-600 hover:text-chipotle-brown hover:bg-gray-100'
          }`}
        >
          <Store className="w-3.5 h-3.5" />
          <span>ตั้งค่าร้าน</span>
        </button>

        <button
          type="button"
          onClick={() => onTabChange('receipts')}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
            activeTab === 'receipts'
              ? 'bg-chipotle-brown text-white shadow-xs'
              : 'text-gray-600 hover:text-chipotle-brown hover:bg-gray-100'
          }`}
        >
          <Receipt className="w-3.5 h-3.5" />
          <span>ใบเสร็จ POS</span>
        </button>
      </div>
    </header>
  );
};
