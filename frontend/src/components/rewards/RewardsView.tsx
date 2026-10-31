import React, { useState, useEffect } from 'react';
import { Gift, Sparkles, History, ArrowRight, ShieldCheck, Star } from 'lucide-react';
import { CustomerProfile } from '../../types/customer';
import { LineUserProfile } from '../../lib/liff';

interface RewardsViewProps {
  lineProfile: LineUserProfile | null;
  onGoToMenu: () => void;
}

export const RewardsView: React.FC<RewardsViewProps> = ({ lineProfile, onGoToMenu }) => {
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let lineUid = lineProfile?.userId || localStorage.getItem('fatcat_line_user_id') || '';
    let phone = '';
    try {
      const saved = localStorage.getItem('fatcat_customer_profile');
      if (saved) {
        const p = JSON.parse(saved);
        if (p.phone) phone = p.phone;
        if (!lineUid && p.line_user_id) lineUid = p.line_user_id;
      }
    } catch {}

    const params = new URLSearchParams();
    if (lineUid) params.set('line_user_id', lineUid);
    if (phone) params.set('phone', phone);

    fetch(`/api/customer-profile?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.ok && data.found && data.profile) {
          setProfile(data.profile);
        } else if (lineProfile) {
          // Fallback optimistic profile
          setProfile({
            line_user_id: lineProfile.userId,
            customer_name: lineProfile.displayName,
            line_display_name: lineProfile.displayName,
            picture_url: lineProfile.pictureUrl,
            total_orders: 0,
            total_spent: 0,
            stamps: 0,
            available_rewards: 0,
            stamp_logs: [],
          });
        }
      })
      .catch((err) => console.error('Fetch customer profile error:', err))
      .finally(() => setLoading(false));
  }, [lineProfile]);

  const stampsCount = profile?.stamps ?? 0;
  const availableRewards = profile?.available_rewards ?? 0;
  const remainingForReward = 10 - stampsCount;
  const progressPercent = Math.min(100, Math.round((stampsCount / 10) * 100));

  if (loading) {
    return (
      <div className="p-4 space-y-4 pb-12 animate-pulse">
        <div className="h-40 bg-stone-200/70 rounded-3xl" />
        <div className="h-20 bg-stone-100 rounded-2xl" />
        <div className="h-64 bg-stone-100 rounded-3xl" />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 pb-12">
      {/* 1. Header Banner */}
      <div className="bg-gradient-to-br from-chipotle-brown via-[#4A1F15] to-[#2B100A] text-white rounded-3xl p-5 shadow-lg relative overflow-hidden">
        <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute right-4 top-4 text-4xl opacity-20 pointer-events-none select-none">🐾</div>

        <div className="flex items-center gap-3.5 mb-4">
          <div className="w-14 h-14 rounded-2xl bg-white/10 p-0.5 border border-white/20 shadow-inner flex items-center justify-center overflow-hidden shrink-0">
            {profile?.picture_url || lineProfile?.pictureUrl ? (
              <img
                src={profile?.picture_url || lineProfile?.pictureUrl}
                alt="Avatar"
                className="w-full h-full object-cover rounded-[14px]"
              />
            ) : (
              <span className="text-2xl">🐱</span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold tracking-wider uppercase text-amber-300 font-en">
                FATCAT REWARDS CLUB
              </span>
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            </div>
            <h1 className="text-lg font-bold truncate text-white">
              {profile?.line_display_name || profile?.customer_name || lineProfile?.displayName || 'สมาชิกร้านแมวอ้วน'}
            </h1>
            <p className="text-[11px] text-white/70">
              สะสมครบ 10 กล่อง แลกรับส่วนลด 10 บาท
            </p>
          </div>
        </div>

        {/* Highlight counter pills */}
        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/10">
          <div className="bg-black/20 rounded-2xl p-2.5 text-center border border-white/5">
            <span className="text-[10px] text-white/70 block">แสตมป์ปัจจุบัน</span>
            <div className="flex items-baseline justify-center gap-1 mt-0.5">
              <span className="text-2xl font-black text-amber-300 font-en">{stampsCount}</span>
              <span className="text-xs text-white/60 font-en">/ 10</span>
            </div>
          </div>
          <div className="bg-black/20 rounded-2xl p-2.5 text-center border border-white/5">
            <span className="text-[10px] text-white/70 block">สิทธิ์ส่วนลด 10฿</span>
            <div className="flex items-baseline justify-center gap-1 mt-0.5">
              <span className="text-2xl font-black text-emerald-400 font-en">{availableRewards}</span>
              <span className="text-xs text-white/60">ใบ</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Available Rewards Voucher Card */}
      {availableRewards > 0 ? (
        <div className="bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-emerald-50 border-2 border-emerald-500/30 rounded-3xl p-4 shadow-sm relative overflow-hidden">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center text-xl shadow-md shrink-0">
                🎟️
              </div>
              <div>
                <span className="bg-emerald-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full inline-block mb-1">
                  พร้อมใช้งาน ({availableRewards} สิทธิ์)
                </span>
                <h3 className="text-sm font-bold text-gray-900">
                  คูปองส่วนลด 10 บาท (สะสมครบ 10 กล่อง)
                </h3>
                <p className="text-[11px] text-gray-600">
                  ใช้เป็นส่วนลดในขั้นตอนยืนยันออเดอร์ได้ทันที
                </p>
              </div>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-emerald-200/60 flex items-center justify-between">
            <span className="text-[11px] text-emerald-800 font-medium">
              💡 ติ๊กเลือกใช้ส่วนลดนี้ในหน้าสรุปออเดอร์
            </span>
            <button
              type="button"
              onClick={onGoToMenu}
              className="bg-emerald-700 hover:bg-emerald-800 active:scale-95 text-white text-xs font-bold px-3.5 py-1.5 rounded-full transition-all flex items-center gap-1 shadow-xs"
            >
              <span>สั่งอาหารเลย</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-amber-50/80 border border-amber-200/80 rounded-2xl p-3.5 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-800 flex items-center justify-center shrink-0">
            <Gift className="w-5 h-5 text-amber-700" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-xs font-bold text-amber-950">
              สั่งอีกเพียง {remainingForReward} กล่อง รับส่วนลด 10 บาททันที!
            </h4>
            <div className="w-full bg-amber-200/60 h-1.5 rounded-full mt-1.5 overflow-hidden">
              <div
                className="bg-amber-600 h-full rounded-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* 3. The 10-Slot Stamp Card */}
      <div className="bg-white rounded-3xl p-5 border border-app-border shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-bold text-chipotle-brown flex items-center gap-1.5">
              <span>บัตรสะสมแสตมป์</span>
              <span className="text-xs font-normal text-app-muted">(10 กล่อง = ลด 10฿)</span>
            </h2>
            <p className="text-[11px] text-app-muted mt-0.5">
              เซ็ตเดี่ยว = 1 แสตมป์/กล่อง • เซ็ตคู่ = 2 แสตมป์/กล่อง
            </p>
          </div>
          <span className="bg-[#F6EFE9] text-chipotle-brown text-xs font-bold px-2.5 py-1 rounded-full font-en">
            {stampsCount} / 10
          </span>
        </div>

        {/* 5x2 Grid of 10 stamps */}
        <div className="grid grid-cols-5 gap-2.5 sm:gap-3 py-2">
          {Array.from({ length: 10 }).map((_, idx) => {
            const slotNum = idx + 1;
            const isStamped = stampsCount >= slotNum;
            const isNext = stampsCount + 1 === slotNum;
            const isTenth = slotNum === 10;

            return (
              <div
                key={slotNum}
                className={`aspect-square rounded-2xl flex flex-col items-center justify-center relative transition-all duration-300 ${
                  isTenth
                    ? isStamped
                      ? 'bg-gradient-to-br from-amber-400 to-amber-600 text-white shadow-md border-2 border-amber-300 scale-105'
                      : 'bg-gradient-to-br from-amber-50 to-amber-100/60 border-2 border-dashed border-amber-400 text-amber-800'
                    : isStamped
                    ? 'bg-gradient-to-br from-chipotle-brown to-[#5A2518] text-white shadow-sm border border-chipotle-brown'
                    : isNext
                    ? 'bg-amber-50/70 border-2 border-dashed border-amber-500/80 text-amber-700 animate-pulse'
                    : 'bg-[#FBF8F5] border-2 border-dashed border-gray-200 text-gray-400'
                }`}
              >
                {/* Stamp Icon / State */}
                {isStamped ? (
                  <>
                    <div className="text-lg select-none">🐾</div>
                    <span className="text-[9px] font-bold font-en leading-tight mt-0.5">
                      #{slotNum}
                    </span>
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 text-white rounded-full flex items-center justify-center text-[9px] shadow-xs">
                      ✓
                    </span>
                  </>
                ) : isTenth ? (
                  <>
                    <Gift className="w-5 h-5 text-amber-600" />
                    <span className="text-[8px] font-bold mt-0.5 text-center leading-none text-amber-800">
                      ลด 10฿
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-xs font-bold font-en text-gray-400">
                      {slotNum}
                    </span>
                    <span className="text-[8px] text-gray-400">ว่าง</span>
                  </>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-500">
          <span className="flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>นับแต้มอัตโนมัติทุกครั้งที่สั่งซื้อ</span>
          </span>
          <span className="font-medium text-chipotle-brown">
            สะสมได้ต่อเนื่องไม่จำกัดรอบ
          </span>
        </div>
      </div>

      {/* 4. Stamp Activity Log */}
      <div className="bg-white rounded-3xl p-5 border border-app-border shadow-xs">
        <h3 className="text-sm font-bold text-chipotle-brown flex items-center gap-2 mb-3">
          <History className="w-4 h-4 text-chipotle-brown" />
          <span>ประวัติการสะสม & ใช้ส่วนลด</span>
        </h3>

        {profile?.stamp_logs && profile.stamp_logs.length > 0 ? (
          <div className="divide-y divide-gray-100">
            {profile.stamp_logs.slice(0, 10).map((log, idx) => (
              <div key={idx} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 text-sm ${
                      log.delta_rewards > 0
                        ? 'bg-amber-100 text-amber-700'
                        : log.delta_rewards < 0
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-stone-100 text-stone-700'
                    }`}
                  >
                    {log.delta_rewards > 0 ? '🎁' : log.delta_rewards < 0 ? '🎟️' : '🐾'}
                  </span>
                  <div className="min-w-0">
                    <p className="font-medium text-gray-800 truncate">{log.note}</p>
                    <span className="text-[10px] text-gray-400">{log.created_at}</span>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  {log.delta_stamps !== 0 && (
                    <span
                      className={`font-bold font-en text-xs ${
                        log.delta_stamps > 0 ? 'text-emerald-600' : 'text-gray-500'
                      }`}
                    >
                      {log.delta_stamps > 0 ? `+${log.delta_stamps}` : log.delta_stamps} แต้ม
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-8 text-center text-gray-400">
            <span className="text-3xl block mb-1">🐾</span>
            <p className="text-xs">ยังไม่มีประวัติแสตมป์ เริ่มสั่งซื้อเพื่อสะสมแต้มแรกได้เลย!</p>
          </div>
        )}
      </div>

      {/* 5. How It Works Accordion */}
      <div className="bg-[#FAF7F3] rounded-2xl p-4 border border-app-border text-xs space-y-2 text-gray-600">
        <h4 className="font-bold text-chipotle-brown flex items-center gap-1.5">
          <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
          <span>เงื่อนไขการสะสมแต้ม FatCat Rewards:</span>
        </h4>
        <ul className="list-disc pl-4 space-y-1 text-[11px] leading-relaxed">
          <li><b>เซ็ตเดี่ยว:</b> ได้รับ 1 แสตมป์ต่อกล่อง (นับตามจำนวนกล่องที่สั่ง)</li>
          <li><b>เซ็ตคู่:</b> ได้รับ 2 แสตมป์ต่อกล่อง (สั่งกี่กล่องคำนวณแต้มให้ทันที)</li>
          <li>กรณีสั่งอาหารผ่าน LINE OA โดยตรง แอดมินสามารถบันทึกสแตมป์ย้อนหลังให้ได้</li>
          <li>เมื่อสะสมครบ 10 แสตมป์ (10 กล่อง) รับทันที <b>คูปองส่วนลด 10 บาท</b> สำหรับใช้ลดค่าอาหารในออเดอร์ถัดไป</li>
          <li>สามารถสะสมได้ไม่จำกัดจำนวนรอบ</li>
        </ul>
      </div>
    </div>
  );
};
