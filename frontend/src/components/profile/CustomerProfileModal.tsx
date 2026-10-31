import React, { useState, useEffect } from 'react';
import { X, CheckCircle2, LogIn, LogOut, Phone, Building, User, ShieldCheck } from 'lucide-react';
import { LineUserProfile, loginWithLine, logoutLine } from '../../lib/liff';

interface CustomerProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  lineProfile: LineUserProfile | null;
  onProfileUpdated?: () => void;
}

export const CustomerProfileModal: React.FC<CustomerProfileModalProps> = ({
  isOpen,
  onClose,
  lineProfile,
  onProfileUpdated,
}) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [floor, setFloor] = useState('');
  const [room, setRoom] = useState('');
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('fatcat_customer_profile');
      if (saved) {
        const parsed = JSON.parse(saved);
        setName(parsed.name || lineProfile?.displayName || '');
        setPhone(parsed.phone || '');
        setFloor(parsed.floor || '');
        setRoom(parsed.room || '');
      } else if (lineProfile) {
        setName(lineProfile.displayName || '');
      }
    } catch {}
  }, [isOpen, lineProfile]);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const updated = {
      name: name.trim(),
      phone: phone.trim(),
      floor: floor.trim(),
      room: room.trim(),
    };
    try {
      localStorage.setItem('fatcat_customer_profile', JSON.stringify(updated));
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2500);
      if (onProfileUpdated) onProfileUpdated();
    } catch {}
  };

  const handleLogout = () => {
    if (confirm('คุณต้องการออกจากระบบ LINE หรือไม่?')) {
      logoutLine();
      window.location.reload();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-[420px] bg-white rounded-3xl shadow-2xl overflow-hidden border border-app-border flex flex-col">
        {/* Header */}
        <div className="relative bg-gradient-to-r from-chipotle-brown to-[#2D160C] text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative w-12 h-12 rounded-full border-2 border-white/20 bg-white/10 flex items-center justify-center overflow-hidden">
              {lineProfile?.pictureUrl ? (
                <img src={lineProfile.pictureUrl} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <User className="w-6 h-6 text-white/80" />
              )}
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-1.5">
                {lineProfile?.displayName || name || 'คุณลูกค้าแมวอ้วน'}
              </h3>
              <p className="text-xs text-white/70">
                {lineProfile ? '🟢 เชื่อมต่อ LINE สำเร็จ' : '⚪ ยังไม่ได้เชื่อมต่อ LINE'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body Form */}
        <div className="p-5 flex flex-col gap-4 max-h-[75vh] overflow-y-auto">
          {/* LINE Status Card */}
          {lineProfile ? (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                <div className="text-xs">
                  <p className="font-semibold text-emerald-900">เข้าสู่ระบบด้วย LINE แล้ว</p>
                  <p className="text-emerald-700 font-mono text-[11px]">ID: {lineProfile.userId.slice(0, 10)}...</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="text-xs text-red-600 hover:text-red-700 font-medium flex items-center gap-1 px-2.5 py-1 rounded-lg hover:bg-red-50 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                ออก
              </button>
            </div>
          ) : (
            <div className="bg-[#FBF8F5] border border-app-border rounded-2xl p-4 flex flex-col items-center text-center gap-2.5">
              <p className="text-xs text-app-muted">
                เข้าสู่ระบบด้วย LINE เพื่อความสะดวกในการติดตามสถานะและรับข้อมูลออเดอร์
              </p>
              <button
                type="button"
                onClick={loginWithLine}
                className="w-full py-2.5 px-4 bg-[#06C755] hover:bg-[#05b34c] text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-sm transition-transform active:scale-98"
              >
                <LogIn className="w-4 h-4" />
                เข้าสู่ระบบด้วย LINE (LIFF)
              </button>
            </div>
          )}

          {/* Delivery & Contact Information Form */}
          <form onSubmit={handleSave} className="flex flex-col gap-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-app-muted">
              ข้อมูลสำหรับจัดส่ง (คอนโด/หน้าร้าน)
            </h4>

            <div>
              <label className="text-xs font-medium text-app-primary mb-1 block">ชื่อผู้รับ</label>
              <div className="relative">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="เช่น คุณโอห์ม"
                  className="w-full px-3.5 py-2 pl-9 rounded-xl border border-app-border bg-[#FCFBF9] text-xs focus:outline-none focus:border-chipotle-brown"
                  required
                />
                <User className="w-4 h-4 text-app-muted absolute left-3 top-2.5" />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-app-primary mb-1 block">เบอร์โทรศัพท์</label>
              <div className="relative">
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="เช่น 0812345678"
                  className="w-full px-3.5 py-2 pl-9 rounded-xl border border-app-border bg-[#FCFBF9] text-xs focus:outline-none focus:border-chipotle-brown"
                  required
                />
                <Phone className="w-4 h-4 text-app-muted absolute left-3 top-2.5" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="text-xs font-medium text-app-primary mb-1 block">ชั้น (Floor)</label>
                <div className="relative">
                  <input
                    type="text"
                    value={floor}
                    onChange={(e) => setFloor(e.target.value)}
                    placeholder="เช่น 7"
                    className="w-full px-3.5 py-2 pl-9 rounded-xl border border-app-border bg-[#FCFBF9] text-xs focus:outline-none focus:border-chipotle-brown"
                  />
                  <Building className="w-4 h-4 text-app-muted absolute left-3 top-2.5" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-app-primary mb-1 block">ห้อง (Room)</label>
                <input
                  type="text"
                  value={room}
                  onChange={(e) => setRoom(e.target.value)}
                  placeholder="เช่น 702"
                  className="w-full px-3.5 py-2 rounded-xl border border-app-border bg-[#FCFBF9] text-xs focus:outline-none focus:border-chipotle-brown"
                />
              </div>
            </div>

            <button
              type="submit"
              className="mt-2 w-full py-2.5 bg-chipotle-brown hover:bg-[#381D10] text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-sm transition-transform active:scale-98"
            >
              <CheckCircle2 className="w-4 h-4" />
              บันทึกข้อมูลจัดส่ง
            </button>

            {savedSuccess && (
              <p className="text-center text-xs font-medium text-emerald-600 animate-fade-in">
                ✅ บันทึกข้อมูลเรียบร้อยแล้ว
              </p>
            )}
          </form>

          {/* Admin Portal Link */}
          <div className="pt-3 border-t border-app-border flex items-center justify-between text-xs text-app-muted">
            <span className="text-[11px]">ร้านแมวอ้วนต้มน้ำปลา POS 2.0</span>
            <a
              href="/admin"
              className="inline-flex items-center gap-1 text-chipotle-brown font-semibold hover:underline"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              สำหรับเจ้าของร้าน (Admin)
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
