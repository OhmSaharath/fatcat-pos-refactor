import React, { useState, useEffect } from 'react';
import { Save, Check, Store, ShieldCheck, Bell, Plus, Trash2, Users } from 'lucide-react';

interface AdminSettingsViewProps {
  token: string;
}

export const AdminSettingsView: React.FC<AdminSettingsViewProps> = ({ token }) => {
  const [settings, setSettings] = useState<any>({
    is_open: true,
    store_name: '',
    closed_message: '',
    announcement: '',
    promptpay_id: '',
    promptpay_name: '',
    require_slip_check_before_pos: true,
    line_channel_token: '',
    line_target_id: '',
    customer_line_channel_token: '',
    notify_customer_cooking: true,
    notify_customer_delivery: true,
    telegram_bot_token: '',
    telegram_chat_id: '',
    line_extra_targets: [],
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isTestingLine, setIsTestingLine] = useState(false);
  const [testLineFeedback, setTestLineFeedback] = useState<{ ok: boolean; msg: string } | null>(null);
  const [isTestingTelegram, setIsTestingTelegram] = useState(false);
  const [testTelegramFeedback, setTestTelegramFeedback] = useState<{ ok: boolean; msg: string } | null>(null);
  const [isTestingCustomerLine, setIsTestingCustomerLine] = useState(false);
  const [testCustomerLineFeedback, setTestCustomerLineFeedback] = useState<{ ok: boolean; msg: string } | null>(null);
  const [customerTestUid, setCustomerTestUid] = useState('');
  const [newExtraName, setNewExtraName] = useState('');
  const [newExtraId, setNewExtraId] = useState('');

  const handleAddExtraTarget = () => {
    if (!newExtraId.trim()) return;
    const current = settings.line_extra_targets || [];
    const updated = [
      ...current,
      {
        id: newExtraId.trim(),
        name: newExtraName.trim() || `ผู้ช่วยคนที่ ${current.length + 2}`,
        enabled: true,
      },
    ];
    setSettings({ ...settings, line_extra_targets: updated });
    setNewExtraName('');
    setNewExtraId('');
  };

  const handleRemoveExtraTarget = (index: number) => {
    const current = settings.line_extra_targets || [];
    setSettings({
      ...settings,
      line_extra_targets: current.filter((_: any, i: number) => i !== index),
    });
  };

  const handleToggleExtraTarget = (index: number) => {
    const current = [...(settings.line_extra_targets || [])];
    if (current[index]) {
      current[index] = { ...current[index], enabled: !current[index].enabled };
      setSettings({ ...settings, line_extra_targets: current });
    }
  };

  useEffect(() => {
    fetch('/api/admin/state', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.ok && data.settings) {
          setSettings(data.settings);
        }
      })
      .finally(() => setIsLoading(false));
  }, [token]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setFeedback(null);

    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (data.ok) {
        setFeedback('บันทึกการตั้งค่าร้านเรียบร้อยแล้ว!');
      } else {
        setFeedback('เกิดข้อผิดพลาดในการบันทึก');
      }
    } catch {
      setFeedback('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestLine = async (targetId?: string) => {
    setIsTestingLine(true);
    setTestLineFeedback(null);
    try {
      const res = await fetch('/api/admin/test-line-notification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          line_channel_token: settings.line_channel_token,
          line_target_id: settings.line_target_id,
          line_extra_targets: settings.line_extra_targets,
          target_id: targetId || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setTestLineFeedback({ ok: true, msg: '✅ ' + (data.message || 'ส่งทดสอบสำเร็จ! ตรวจสอบแอป LINE') });
      } else {
        setTestLineFeedback({ ok: false, msg: '❌ ' + (data.detail || data.error || 'เกิดข้อผิดพลาดในการทดสอบ') });
      }
    } catch {
      setTestLineFeedback({ ok: false, msg: '❌ ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้' });
    } finally {
      setIsTestingLine(false);
    }
  };

  const handleTestTelegram = async () => {
    setIsTestingTelegram(true);
    setTestTelegramFeedback(null);
    try {
      const res = await fetch('/api/admin/test-telegram-notification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          telegram_bot_token: settings.telegram_bot_token,
          telegram_chat_id: settings.telegram_chat_id,
        }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setTestTelegramFeedback({ ok: true, msg: '✅ ' + (data.message || 'ส่งทดสอบเข้า Telegram สำเร็จ! ตรวจสอบแอป Telegram') });
      } else {
        setTestTelegramFeedback({ ok: false, msg: '❌ ' + (data.detail || data.error || 'เกิดข้อผิดพลาดในการทดสอบ Telegram') });
      }
    } catch {
      setTestTelegramFeedback({ ok: false, msg: '❌ ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้' });
    } finally {
      setIsTestingTelegram(false);
    }
  };

  const handleTestCustomerLine = async () => {
    setIsTestingCustomerLine(true);
    setTestCustomerLineFeedback(null);
    try {
      const res = await fetch('/api/admin/test-customer-line-notification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          customer_line_channel_token: settings.customer_line_channel_token,
          target_id: customerTestUid.trim() || settings.line_target_id,
        }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setTestCustomerLineFeedback({ ok: true, msg: '✅ ' + (data.message || 'ส่งทดสอบเข้าแชทลูกค้าสำเร็จ! ตรวจสอบแอป LINE') });
      } else {
        setTestCustomerLineFeedback({ ok: false, msg: '❌ ' + (data.detail || data.error || 'เกิดข้อผิดพลาดในการทดสอบ') });
      }
    } catch {
      setTestCustomerLineFeedback({ ok: false, msg: '❌ ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้' });
    } finally {
      setIsTestingCustomerLine(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-12 text-center text-xs text-app-muted bg-white rounded-3xl border border-app-border">
        กำลังโหลดการตั้งค่า...
      </div>
    );
  }

  return (
    <form onSubmit={handleSave} className="space-y-4 max-w-2xl mx-auto">
      {feedback && (
        <div className="p-3 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs flex items-center gap-2">
          <Check className="w-4 h-4 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Store Open/Close Box */}
      <div className="p-4 bg-white rounded-2xl border border-app-border shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Store className="w-5 h-5 text-chipotle-brown" />
            <div>
              <h3 className="text-xs font-bold text-gray-900">สถานะเปิด/ปิดร้าน</h3>
              <p className="text-[11px] text-app-muted">
                {settings.is_open ? 'ร้านเปิดรับออเดอร์ตามปกติ' : 'ร้านปิดรับออเดอร์ชั่วคราว'}
              </p>
            </div>
          </div>

          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={settings.is_open}
              onChange={(e) => setSettings({ ...settings, is_open: e.target.checked })}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
          </label>
        </div>

        {!settings.is_open && (
          <div>
            <label className="block text-[11px] font-medium text-gray-700 mb-1">
              ข้อความแจ้งลูกค้าเมื่อร้านปิด
            </label>
            <input
              type="text"
              value={settings.closed_message || ''}
              onChange={(e) => setSettings({ ...settings, closed_message: e.target.value })}
              className="w-full text-xs p-2.5 rounded-xl border border-gray-300 bg-[#FDFBF9]"
            />
          </div>
        )}

        <div>
          <label className="block text-[11px] font-medium text-gray-700 mb-1">
            ข้อความประกาศแถบสีเขียวหน้าร้าน
          </label>
          <input
            type="text"
            value={settings.announcement || ''}
            onChange={(e) => setSettings({ ...settings, announcement: e.target.value })}
            className="w-full text-xs p-2.5 rounded-xl border border-gray-300 bg-[#FDFBF9]"
          />
        </div>
      </div>

      {/* Payment & PromptPay Settings */}
      <div className="p-4 bg-white rounded-2xl border border-app-border shadow-xs space-y-3">
        <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
          <ShieldCheck className="w-5 h-5 text-chipotle-gold" />
          <h3 className="text-xs font-bold text-gray-900">การรับชำระเงิน & พร้อมเพย์</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-medium text-gray-700 mb-1">
              เบอร์โทรหรือเลขพร้อมเพย์
            </label>
            <input
              type="text"
              value={settings.promptpay_id || ''}
              onChange={(e) => setSettings({ ...settings, promptpay_id: e.target.value })}
              className="w-full text-xs p-2.5 rounded-xl border border-gray-300 font-mono"
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-gray-700 mb-1">
              ชื่อบัญชีรับเงิน
            </label>
            <input
              type="text"
              value={settings.promptpay_name || ''}
              onChange={(e) => setSettings({ ...settings, promptpay_name: e.target.value })}
              className="w-full text-xs p-2.5 rounded-xl border border-gray-300"
            />
          </div>
        </div>

        <div className="pt-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.require_slip_check_before_pos}
              onChange={(e) =>
                setSettings({ ...settings, require_slip_check_before_pos: e.target.checked })
              }
              className="rounded text-chipotle-brown focus:ring-chipotle-brown w-4 h-4"
            />
            <span className="text-xs font-medium text-gray-800">
              ต้องให้ร้านกดตรวจสลิปก่อน จึงจะส่งออเดอร์เข้า Loyverse POS (แนะนำ)
            </span>
          </label>
        </div>
      </div>

      {/* Notifications Integration */}
      <div className="p-4 bg-white rounded-2xl border border-app-border shadow-xs space-y-3">
        <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
          <Bell className="w-5 h-5 text-chipotle-brown" />
          <h3 className="text-xs font-bold text-gray-900">แจ้งเตือน LINE & Telegram</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-medium text-gray-700 mb-1">
              LINE Channel Token (บอท)
            </label>
            <input
              type="password"
              placeholder={settings.has_line_token ? '•••••••• (ตั้งค่าแล้ว)' : 'วาง Channel access token ที่นี่'}
              value={settings.line_channel_token || ''}
              onChange={(e) => setSettings({ ...settings, line_channel_token: e.target.value })}
              className="w-full text-xs p-2.5 rounded-xl border border-gray-300 font-mono"
            />
            {settings.line_channel_token?.trim().startsWith('U') && settings.line_channel_token.trim().length === 33 && (
              <div className="mt-1 text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2 leading-relaxed">
                ⚠️ <strong>ข้อควรระวัง:</strong> ค่าที่ใส่ขึ้นต้นด้วย &quot;U...&quot; (33 ตัวอักษร) เป็น <strong>User ID</strong> ครับ ไม่ใช่ Token บอท<br />
                สำหรับ <strong>Channel Token</strong> ต้องเป็นสตริงขนาดยาว (~170+ ตัวอักษร) ที่กด <em>Issue</em> จากแท็บ <em>Messaging API &gt; Channel access token (long-lived)</em> ใน LINE Developers
              </div>
            )}
            <p className="text-[10px] text-app-muted mt-1">
              ได้จาก LINE Developers &gt; Messaging API &gt; ด้านล่างสุด &quot;Channel access token (long-lived)&quot;
            </p>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-gray-700 mb-1">
              LINE Target User/Group ID
            </label>
            <input
              type="text"
              placeholder="Uxxxxxxxxxxxxxxxxx หรือ Group ID"
              value={settings.line_target_id || ''}
              onChange={(e) => setSettings({ ...settings, line_target_id: e.target.value })}
              className="w-full text-xs p-2.5 rounded-xl border border-gray-300 font-mono"
            />
            <p className="text-[10px] text-app-muted mt-1">
              ใส่ Your user ID (ขึ้นต้นด้วย U...) หรือ Group ID ของกลุ่มที่คุณเชิญบอทเข้าไว้
            </p>
          </div>
        </div>

        {/* Extra LINE Recipients Section */}
        <div className="pt-2 border-t border-gray-100 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Users className="w-4 h-4 text-chipotle-brown" />
              <label className="text-[11px] font-bold text-gray-800">
                ส่งแจ้งเตือนหาคนดูหลังบ้านอีกคน (ผู้ช่วย / แม่ครัว / ไรเดอร์)
              </label>
            </div>
            <span className="text-[10px] text-app-muted">
              {(settings.line_extra_targets || []).length} คน
            </span>
          </div>

          {/* List of existing extra targets */}
          {(settings.line_extra_targets || []).length > 0 && (
            <div className="space-y-1.5">
              {settings.line_extra_targets.map((tgt: any, idx: number) => (
                <div
                  key={idx}
                  className="p-2 bg-stone-50 border border-app-border rounded-xl flex items-center justify-between gap-2 text-xs"
                >
                  <div className="min-w-0 flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={tgt.enabled !== false}
                      onChange={() => handleToggleExtraTarget(idx)}
                      className="w-4 h-4 text-emerald-600 rounded cursor-pointer"
                      title={tgt.enabled ? 'เปิดแจ้งเตือน' : 'ปิดแจ้งเตือนชั่วคราว'}
                    />
                    <div className="min-w-0">
                      <div className="font-semibold text-gray-900 text-xs truncate">
                        {tgt.name || `ผู้ช่วยคนที่ ${idx + 2}`}
                      </div>
                      <div className="text-[10px] text-app-muted font-mono truncate">
                        {tgt.id}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      disabled={isTestingLine}
                      onClick={() => handleTestLine(tgt.id)}
                      className="px-2 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-300 rounded-lg text-[10px] font-semibold flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-50"
                      title="ทดสอบส่งเฉพาะคนนี้"
                    >
                      <Bell className="w-3 h-3" />
                      <span>ทดสอบคนนี้</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveExtraTarget(idx)}
                      className="p-1 text-gray-400 hover:text-red-600 transition-colors rounded-lg cursor-pointer"
                      title="ลบผู้รับคนนี้"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Important Notice & Tip for LINE */}
          <div className="p-2.5 bg-sky-50 border border-sky-200 rounded-xl text-[11px] text-sky-950 space-y-1">
            <div className="font-bold flex items-center gap-1 text-sky-900">
              💡 ข้อสำคัญมากเกี่ยวกับการส่งแจ้งเตือน LINE:
            </div>
            <ul className="list-disc pl-4 space-y-0.5 text-[10.5px] leading-relaxed">
              <li>
                <b>ต้องเพิ่มเพื่อนก่อน:</b> บอท LINE จะส่งหาคนที่<b>ยังไม่เคยกดเพิ่มเพื่อน (Add Friend) กับบอทไม่ได้</b>เด็ดขาด (ระบบจะแจ้ง Not Found ทันที)
              </li>
              <li>
                <b>User ID:</b> ต้องเป็น User ID บัญชีบอทนี้ (ขึ้นต้นด้วย <code className="bg-sky-100 px-1 py-0.5 rounded font-mono">U...</code> ความยาว 33 ตัว) ไม่ใช่ Line ID ปกติที่ใช้พิมพ์ค้นหาเพื่อน
              </li>
              <li>
                ✨ <b>วิธีที่แนะนำที่สุด & ง่าย 100%:</b> สร้าง <b>กลุ่ม LINE (LINE Group)</b> ดึงทุกคนในร้านและ<b>เชิญบอทเข้ากลุ่ม</b> จากนั้นนำ <b>Group ID</b> มาใส่ในช่อง LINE Target ID ด้านบน ช่องเดียวแจ้งเตือนทุกคนในกลุ่มพร้อมกันทันที ไม่ต้องกรอก User ID แยกคน!
              </li>
            </ul>
          </div>

          {/* Add extra target input form */}
          <div className="p-2.5 bg-amber-50/50 border border-amber-200/80 rounded-xl space-y-2">
            <div className="text-[11px] font-semibold text-amber-900">
              + เพิ่มผู้รับข้อความแจ้งเตือนคนใหม่
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input
                type="text"
                placeholder="ชื่อเรียก (เช่น แม่ครัว, ผู้ช่วย 2)"
                value={newExtraName}
                onChange={(e) => setNewExtraName(e.target.value)}
                className="w-full text-xs p-2 rounded-lg border border-amber-300 bg-white"
              />
              <input
                type="text"
                placeholder="LINE User ID (U...) หรือ Group ID"
                value={newExtraId}
                onChange={(e) => setNewExtraId(e.target.value)}
                className="w-full text-xs p-2 rounded-lg border border-amber-300 bg-white font-mono"
              />
            </div>
            <button
              type="button"
              onClick={handleAddExtraTarget}
              disabled={!newExtraId.trim()}
              className="w-full py-1.5 bg-amber-700 hover:bg-amber-800 disabled:opacity-50 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>เพิ่มผู้รับการแจ้งเตือนคนนี้</span>
            </button>
          </div>
        </div>

        {/* LINE Test Button */}
        <div className="p-2.5 bg-[#F9F7F4] rounded-xl border border-app-border flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <button
            type="button"
            disabled={isTestingLine || (!settings.line_channel_token && !settings.has_line_token) || !settings.line_target_id}
            onClick={() => handleTestLine()}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-xs disabled:opacity-50 shrink-0"
          >
            <Bell className="w-3.5 h-3.5" />
            <span>{isTestingLine ? 'กำลังทดสอบส่ง...' : '📲 ทดสอบส่งข้อความแจ้งเตือนเข้า LINE'}</span>
          </button>
          {testLineFeedback && (
            <span className={`text-[11px] leading-tight ${testLineFeedback.ok ? 'text-emerald-700 font-semibold' : 'text-rose-600'}`}>
              {testLineFeedback.msg}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-medium text-gray-700 mb-1">
              Telegram Bot Token
            </label>
            <input
              type="password"
              placeholder={settings.has_tg_token ? '•••••••• (ตั้งค่าแล้ว)' : 'วาง Bot Token ที่นี่'}
              value={settings.telegram_bot_token || ''}
              onChange={(e) => setSettings({ ...settings, telegram_bot_token: e.target.value })}
              className="w-full text-xs p-2.5 rounded-xl border border-gray-300 font-mono"
            />
            <p className="text-[10px] text-app-muted mt-1">
              สร้างบอทผ่าน Telegram โดยคุยกับ @BotFather
            </p>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-gray-700 mb-1">
              Telegram Chat ID
            </label>
            <input
              type="text"
              placeholder="เช่น 123456789 หรือ Group ID"
              value={settings.telegram_chat_id || ''}
              onChange={(e) => setSettings({ ...settings, telegram_chat_id: e.target.value })}
              className="w-full text-xs p-2.5 rounded-xl border border-gray-300 font-mono"
            />
            <p className="text-[10px] text-app-muted mt-1">
              ดูเลข Chat ID ของตัวเองได้โดยทักไปคุยกับ @userinfobot
            </p>
          </div>
        </div>

        {/* Telegram Test Button & Sound Setup Guide */}
        <div className="space-y-2">
          <div className="p-2.5 bg-[#F9F7F4] rounded-xl border border-app-border flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <button
              type="button"
              disabled={isTestingTelegram || (!settings.telegram_bot_token && !settings.has_tg_token) || !settings.telegram_chat_id}
              onClick={handleTestTelegram}
              className="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 active:scale-95 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-xs disabled:opacity-50 shrink-0 cursor-pointer"
            >
              <Bell className="w-3.5 h-3.5" />
              <span>{isTestingTelegram ? 'กำลังทดสอบส่ง...' : '📲 ทดสอบส่งข้อความแจ้งเตือนเข้า Telegram'}</span>
            </button>
            {testTelegramFeedback && (
              <span className={`text-[11px] leading-tight ${testTelegramFeedback.ok ? 'text-emerald-700 font-semibold' : 'text-rose-600'}`}>
                {testTelegramFeedback.msg}
              </span>
            )}
          </div>

          {/* Telegram Sound Setup Tip Box */}
          <div className="p-3 bg-sky-50/70 border border-sky-200 rounded-xl text-[11px] text-sky-950 space-y-1.5 leading-relaxed">
            <div className="font-bold text-sky-900 flex items-center gap-1.5">
              <span>🔊 วิธีตั้งค่าให้ Telegram ร้องเสียงไซเรน/เตือนดังๆ เวลามีออเดอร์เข้า:</span>
            </div>
            <ol className="list-decimal list-inside space-y-1 text-sky-900/90 pl-1">
              <li>เปิดแอป Telegram ในมือถือ แล้วแตะเข้าไปที่แชตบอทของร้าน</li>
              <li>แตะที่รูปโปรไฟล์บอทด้านบน &gt; เลือก <strong>Notifications</strong> &gt; <strong>Customize</strong> (หรือ <strong>Sound</strong>)</li>
              <li>เลือกเสียงเตือนที่ยาวหรือดังเป็นพิเศษ (Telegram รองรับการเลือกเสียง Alarm หรืออัปโหลดไฟล์เสียง .mp3 ได้อิสระ)</li>
              <li><em>ข้อควรจำ:</em> ก่อนทดสอบ ให้กดปุ่ม <strong>Start</strong> ในแชตบอทบน Telegram 1 ครั้ง เพื่อให้บอทเริ่มส่งข้อความหาคุณได้ครับ</li>
            </ol>
          </div>
        </div>
      </div>

      {/* Customer-Facing LINE OA (Food Status & Photo Proof Notifications) */}
      <div className="p-4 bg-white rounded-2xl border border-app-border shadow-xs space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <span className="text-base">🛵</span>
            <div>
              <h3 className="text-xs font-bold text-gray-900">LINE OA ลูกค้า (แจ้งเตือนสถานะ &amp; ส่งรูปถ่ายหลักฐาน)</h3>
              <p className="text-[10px] text-app-muted">ส่งข้อความหาแชทลูกค้าโดยตรงเมื่ออาหารเริ่มปรุง หรือเมื่อส่งอาหารเสร็จพร้อมรูปภาพ</p>
            </div>
          </div>
          <span className="text-[10px] bg-emerald-50 text-emerald-700 font-bold px-2 py-0.5 rounded-full border border-emerald-200">
            ระบบอัตโนมัติ
          </span>
        </div>

        <div>
          <label className="block text-[11px] font-medium text-gray-700 mb-1">
            Channel Access Token ของ LINE OA ลูกค้า
          </label>
          <input
            type="password"
            placeholder={settings.has_customer_line_token ? '•••••••• (ตั้งค่าแล้ว)' : 'วาง Channel access token ของ LINE OA ลูกค้า (หรือเว้นว่างเพื่อใช้ Token หลัก)'}
            value={settings.customer_line_channel_token || ''}
            onChange={(e) => setSettings({ ...settings, customer_line_channel_token: e.target.value })}
            className="w-full text-xs p-2.5 rounded-xl border border-gray-300 font-mono"
          />
          <p className="text-[10px] text-app-muted mt-1">
            💡 <em>หากยังไม่ได้แยก LINE OA:</em> เว้นว่างไว้ได้เลยครับ ระบบจะใช้ Token ตัวหลักของร้านในการทดสอบส่งหาลูกค้าให้ก่อนอัตโนมัติ
          </p>
        </div>

        {/* Toggles */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
          <label className="flex items-center gap-2 p-2 bg-[#FAF7F3] rounded-xl border border-app-border/60 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.notify_customer_cooking !== false}
              onChange={(e) => setSettings({ ...settings, notify_customer_cooking: e.target.checked })}
              className="rounded text-chipotle-brown focus:ring-chipotle-brown w-4 h-4"
            />
            <div className="text-[11px]">
              <span className="font-semibold text-gray-900">แจ้งเมื่อเริ่มทำอาหาร</span>
              <p className="text-[10px] text-app-muted">เมื่อกดตรวจสลิป/เริ่มทำ (COOKING)</p>
            </div>
          </label>

          <label className="flex items-center gap-2 p-2 bg-[#FAF7F3] rounded-xl border border-app-border/60 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.notify_customer_delivery !== false}
              onChange={(e) => setSettings({ ...settings, notify_customer_delivery: e.target.checked })}
              className="rounded text-chipotle-brown focus:ring-chipotle-brown w-4 h-4"
            />
            <div className="text-[11px]">
              <span className="font-semibold text-gray-900">แจ้งเมื่อส่งเสร็จ + รูปถ่าย</span>
              <p className="text-[10px] text-app-muted">ส่งรูปหลักฐานจุดวางอาหารให้ลูกค้า</p>
            </div>
          </label>
        </div>

        {/* Customer Test Notification */}
        <div className="p-2.5 bg-amber-50/50 rounded-xl border border-amber-200/80 space-y-2">
          <div className="text-[11px] font-semibold text-amber-900 flex items-center gap-1.5">
            <Bell className="w-3.5 h-3.5" />
            <span>ทดสอบระบบส่งข้อความหาลูกค้า</span>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              placeholder="ใส่ LINE User ID (U...) ของคุณเพื่อทดสอบ"
              value={customerTestUid}
              onChange={(e) => setCustomerTestUid(e.target.value)}
              className="flex-1 text-xs p-2 rounded-lg border border-amber-300 bg-white font-mono"
            />
            <button
              type="button"
              disabled={isTestingCustomerLine}
              onClick={handleTestCustomerLine}
              className="px-3 py-2 bg-amber-700 hover:bg-amber-800 active:scale-95 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-2xs disabled:opacity-50 shrink-0 cursor-pointer"
            >
              <Bell className="w-3.5 h-3.5" />
              <span>{isTestingCustomerLine ? 'กำลังส่งทดสอบ...' : '📲 ทดสอบส่งหาลูกค้า'}</span>
            </button>
          </div>
          {testCustomerLineFeedback && (
            <div className={`text-[11px] leading-tight p-2 rounded-lg ${testCustomerLineFeedback.ok ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
              {testCustomerLineFeedback.msg}
            </div>
          )}
        </div>
      </div>

      {/* Save Button */}
      <button
        type="submit"
        disabled={isSaving}
        className="w-full py-3 bg-chipotle-brown hover:bg-[#3D1E0B] active:scale-98 disabled:opacity-50 text-white rounded-2xl text-xs font-semibold flex items-center justify-center gap-2 transition-all shadow-md"
      >
        <Save className="w-4 h-4" />
        <span>{isSaving ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่าทั้งหมด'}</span>
      </button>
    </form>
  );
};
