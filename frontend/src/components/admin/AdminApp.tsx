import React, { useState, useEffect, useRef, useCallback } from 'react';
import { VolumeX, BellRing, X } from 'lucide-react';
import { AdminHeader, AdminTab } from './AdminHeader';
import { AdminLoginModal } from './AdminLoginModal';
import { AdminOrdersFeed } from './AdminOrdersFeed';
import { AdminSlipModal } from './AdminSlipModal';
import { AdminStockManager } from './AdminStockManager';
import { AdminSettingsView } from './AdminSettingsView';
import { AdminReorderView } from './AdminReorderView';
import { AdminReceiptsView } from './AdminReceiptsView';
import { AdminCustomersView } from './AdminCustomersView';
import { AdminModifiersView } from './AdminModifiersView';
import { AdminOrderRecord } from './AdminOrderCard';

export const AdminApp: React.FC = () => {
  const [token, setToken] = useState<string | null>(() => {
    return sessionStorage.getItem('fatcat_admin_token');
  });

  const [activeTab, setActiveTab] = useState<AdminTab>('orders');
  const [orders, setOrders] = useState<AdminOrderRecord[]>([]);
  const [settings, setSettings] = useState<any>({ is_open: true });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Audio Notifications
  const [soundEnabled, setSoundEnabled] = useState(() => {
    return localStorage.getItem('fatcat_admin_sound_enabled') !== 'false';
  });
  const [soundType, setSoundType] = useState<'kathoey' | 'siri'>(() => {
    return (localStorage.getItem('fatcat_admin_sound_type') as any) || 'kathoey';
  });
  const [soundMode, setSoundMode] = useState<'3x' | 'continuous'>(() => {
    return (localStorage.getItem('fatcat_admin_sound_mode') as any) || '3x';
  });
  const [isPlayingSound, setIsPlayingSound] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const prevPendingOrdersCountRef = useRef<number>(0);

  // Slip Modal state
  const [viewingSlipOrder, setViewingSlipOrder] = useState<AdminOrderRecord | null>(null);
  const [isSlipLoading, setIsSlipLoading] = useState(false);
  const [slipErrorMessage, setSlipErrorMessage] = useState<string | null>(null);

  // Delivery Proof modal state
  const [viewingProof, setViewingProof] = useState<{ url: string; orderCode: string } | null>(null);

  const stopSound = useCallback(() => {
    if (audioRef.current) {
      try {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      } catch {}
    }
    setIsPlayingSound(false);
  }, []);

  const playNotificationSound = useCallback(() => {
    if (!soundEnabled) return;
    try {
      const audioFile = soundType === 'kathoey' ? '/alarm_kathoey_3x.mp3' : '/alarm_siri_diva_3x.mp3';
      if (!audioRef.current || audioRef.current.src !== window.location.origin + audioFile) {
        audioRef.current = new Audio(audioFile);
      }
      const audio = audioRef.current;
      audio.loop = (soundMode === 'continuous');
      audio.onplay = () => setIsPlayingSound(true);
      audio.onpause = () => setIsPlayingSound(false);
      audio.onended = () => {
        if (soundMode !== 'continuous') {
          setIsPlayingSound(false);
        }
      };
      audio.currentTime = 0;
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => setIsPlayingSound(true))
          .catch((err) => {
            console.warn('Audio play restricted or waiting for user interaction:', err);
          });
      }
    } catch (e) {
      console.error('Audio play error:', e);
    }
  }, [soundEnabled, soundType, soundMode]);

  // Keyboard shortcut: Press Escape or Spacebar to hush audio alert
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isPlayingSound && (e.key === 'Escape' || e.key === ' ')) {
        stopSound();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlayingSound, stopSound]);

  const fetchAdminState = useCallback(async () => {
    if (!token) return;
    setIsRefreshing(true);
    try {
      const res = await fetch('/api/admin/state', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 401) {
        sessionStorage.removeItem('fatcat_admin_token');
        setToken(null);
        return;
      }

      const data = await res.json();
      if (data.ok) {
        const fetchedOrders: AdminOrderRecord[] = data.orders || [];
        setOrders(fetchedOrders);
        if (data.settings) setSettings(data.settings);

        // Check if there are new pending slip orders
        const currentPending = fetchedOrders.filter((o) => o.status === 'PENDING_SLIP').length;
        if (currentPending > prevPendingOrdersCountRef.current) {
          playNotificationSound();
        }
        prevPendingOrdersCountRef.current = currentPending;
      }
    } catch (e) {
      console.error('Fetch admin state error:', e);
    } finally {
      setIsRefreshing(false);
    }
  }, [token, playNotificationSound]);

  // Smart low-bandwidth polling for kitchen workload
  // 1. Polls every 12 seconds when tab is active (saves > 65% bandwidth vs 4s).
  // 2. PAUSES COMPLETELY when tab is backgrounded/hidden to avoid wasting bandwidth.
  // 3. Immediately polls once when tab returns to focus (visibilitychange).
  // 4. Slows down to 45s if idle for > 15 minutes.
  useEffect(() => {
    if (!token) return;
    fetchAdminState();

    let lastInteraction = Date.now();
    const onUserActivity = () => {
      lastInteraction = Date.now();
    };
    window.addEventListener('mousemove', onUserActivity, { passive: true });
    window.addEventListener('keydown', onUserActivity, { passive: true });
    window.addEventListener('touchstart', onUserActivity, { passive: true });

    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      const isIdle = Date.now() - lastInteraction > 15 * 60 * 1000;
      if (isIdle) {
        // Slow poll every ~48s when idle
        if (Math.random() < 0.25) {
          fetchAdminState();
        }
        return;
      }
      fetchAdminState();
    }, 12000);

    const handleVisibilityChange = () => {
      if (typeof document !== 'undefined' && !document.hidden) {
        lastInteraction = Date.now();
        fetchAdminState();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      window.removeEventListener('mousemove', onUserActivity);
      window.removeEventListener('keydown', onUserActivity);
      window.removeEventListener('touchstart', onUserActivity);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [token, fetchAdminState]);

  const handleToggleSound = () => {
    setSoundEnabled((prev) => {
      const next = !prev;
      localStorage.setItem('fatcat_admin_sound_enabled', String(next));
      if (!next) {
        stopSound();
      }
      return next;
    });
  };

  const handleChangeSoundType = (type: 'kathoey' | 'siri') => {
    setSoundType(type);
    localStorage.setItem('fatcat_admin_sound_type', type);
    if (audioRef.current) {
      stopSound();
      audioRef.current = null;
    }
  };

  const handleChangeSoundMode = (mode: '3x' | 'continuous') => {
    setSoundMode(mode);
    localStorage.setItem('fatcat_admin_sound_mode', mode);
    if (audioRef.current) {
      audioRef.current.loop = (mode === 'continuous');
    }
  };

  const handleTestSound = () => {
    stopSound();
    setTimeout(() => {
      playNotificationSound();
    }, 50);
  };

  const handleOrderAction = async (
    orderCode: string,
    action: 'approve_and_push_pos' | 'mark_done' | 'cancel'
  ) => {
    if (!token) return;
    stopSound();
    setActionLoading(true);
    try {
      const res = await fetch('/api/admin/order-action', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ order_code: orderCode, action }),
      });
      let data: any = {};
      try {
        data = await res.json();
      } catch {
        throw new Error(`เกิดข้อผิดพลาดในการเชื่อมต่อ (HTTP ${res.status})`);
      }
      if (res.ok && data.ok) {
        fetchAdminState();
      } else {
        alert(data.detail || data.error || 'เกิดข้อผิดพลาดในการอัปเดตสถานะ');
      }
    } catch (e: any) {
      alert(e.message || 'การเชื่อมต่อขัดข้อง');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUploadProof = async (orderCode: string, file: File) => {
    if (!token) return;
    try {
      const formData = new FormData();
      formData.append('order_code', orderCode);
      formData.append('file', file);
      const res = await fetch('/api/admin/order-proof', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const d = await res.json();
      if (res.ok && d.ok) {
        fetchAdminState();
      } else {
        alert(d.detail || d.error || 'อัปโหลดหลักฐานส่งอาหารไม่สำเร็จ');
      }
    } catch (e: any) {
      alert(e.message || 'การเชื่อมต่อขัดข้อง');
    }
  };

  const handleResendNotification = async (orderCode: string) => {
    if (!token) return;
    try {
      const res = await fetch('/api/admin/resend-customer-notification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ order_code: orderCode }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        alert('✅ ' + (data.message || 'ส่งข้อความหาลูกค้าสำเร็จแล้ว!'));
        fetchAdminState();
      } else {
        alert('❌ ' + (data.detail || data.error || 'ส่งข้อความหาลูกค้าไม่สำเร็จ'));
      }
    } catch (e: any) {
      alert(e.message || 'การเชื่อมต่อขัดข้อง');
    }
  };

  const handleLogout = () => {
    stopSound();
    sessionStorage.removeItem('fatcat_admin_token');
    setToken(null);
  };

  if (!token) {
    return (
      <AdminLoginModal
        onLoginSuccess={(tok) => setToken(tok)}
        onCancel={() => (window.location.href = '/')}
      />
    );
  }

  const pendingCount = orders.filter((o) => o.status === 'PENDING_SLIP').length;

  return (
    <div className="min-h-screen bg-[#FBF8F5] text-app-primary flex flex-col font-sans relative">
      {/* High-Priority Floating Audio Alert & Stop Banner (z-[9999] so it floats above modals) */}
      {isPlayingSound && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-3 bg-red-600 text-white px-4 py-2.5 rounded-2xl shadow-2xl border-2 border-white/90 animate-bounce">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-yellow-300 animate-ping shrink-0" />
            <BellRing className="w-4 h-4 text-yellow-300 animate-wiggle shrink-0" />
            <span className="text-xs sm:text-sm font-bold tracking-wide">
              มีออเดอร์ใหม่เข้า! กำลังส่งเสียงเตือน...
            </span>
          </div>
          <button
            type="button"
            onClick={stopSound}
            className="bg-white text-red-700 font-bold px-3 py-1 rounded-xl text-xs hover:bg-stone-100 active:scale-95 transition-all shadow-md flex items-center gap-1.5 cursor-pointer shrink-0"
            title="กดหยุดเสียงทันที หรือกดปุ่ม ESC / Spacebar บนคีย์บอร์ด"
          >
            <VolumeX className="w-3.5 h-3.5 text-red-600" />
            <span>[ 🔇 หยุดเสียงทันที ]</span>
          </button>
        </div>
      )}

      {/* 1. Header */}
      <AdminHeader
        isOpen={Boolean(settings.is_open)}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        pendingCount={pendingCount}
        onRefresh={fetchAdminState}
        isRefreshing={isRefreshing}
        soundEnabled={soundEnabled}
        onToggleSound={handleToggleSound}
        soundType={soundType}
        onChangeSoundType={handleChangeSoundType}
        soundMode={soundMode}
        onChangeSoundMode={handleChangeSoundMode}
        isPlayingSound={isPlayingSound}
        onStopSound={stopSound}
        onTestSound={handleTestSound}
        onLogout={handleLogout}
      />

      {/* 2. Content Body */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6">
        {activeTab === 'orders' && (
          <AdminOrdersFeed
            orders={orders}
            onAction={handleOrderAction}
            onViewSlip={async (o) => {
              stopSound();
              setSlipErrorMessage(null);
              setViewingSlipOrder(o);
              if (!o.slip_image) {
                setIsSlipLoading(true);
                try {
                  const res = await fetch(`/api/admin/order-slip/${o.order_code}`, {
                    headers: { Authorization: `Bearer ${token}` }
                  });
                  const d = await res.json();
                  if (res.ok && d.ok && d.slip_image) {
                    setViewingSlipOrder({ ...o, slip_image: d.slip_image });
                  } else {
                    setSlipErrorMessage(d.detail || d.error || 'ไม่พบรูปสลิปในฐานข้อมูลสำหรับออเดอร์นี้');
                  }
                } catch (e: any) {
                  setSlipErrorMessage(e.message || 'ไม่สามารถโหลดรูปสลิปได้');
                } finally {
                  setIsSlipLoading(false);
                }
              }
            }}
            onUploadProof={handleUploadProof}
            onViewProof={(url, orderCode) => setViewingProof({ url, orderCode })}
            onResendNotification={handleResendNotification}
            isActionLoading={actionLoading}
          />
        )}

        {activeTab === 'stock' && <AdminStockManager token={token} />}

        {activeTab === 'reorder' && <AdminReorderView token={token} />}

        {activeTab === 'options' && <AdminModifiersView token={token} />}

        {activeTab === 'customers' && <AdminCustomersView token={token} />}

        {activeTab === 'settings' && <AdminSettingsView token={token} />}

        {activeTab === 'receipts' && <AdminReceiptsView token={token} />}
      </main>

      {/* 3. Slip Inspection Modal */}
      {viewingSlipOrder && (
        <AdminSlipModal
          isOpen={Boolean(viewingSlipOrder)}
          onClose={() => {
            setViewingSlipOrder(null);
            setSlipErrorMessage(null);
          }}
          slipImage={viewingSlipOrder.slip_image || ''}
          orderCode={viewingSlipOrder.order_code}
          totalMoney={viewingSlipOrder.total_money}
          isLoading={isSlipLoading}
          errorMessage={slipErrorMessage}
          verification={viewingSlipOrder.slip_verification}
        />
      )}

      {/* 4. Full-size Delivery Proof Modal */}
      {viewingProof && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-white rounded-3xl overflow-hidden shadow-2xl border border-app-border flex flex-col max-h-[90vh]">
            <div className="h-12 px-4 border-b border-app-border flex items-center justify-between bg-stone-50 shrink-0">
              <span className="text-xs font-bold text-chipotle-brown font-en">
                📸 หลักฐานการส่งอาหาร #{viewingProof.orderCode}
              </span>
              <button
                type="button"
                onClick={() => setViewingProof(null)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-3 flex items-center justify-center bg-black/5 min-h-[300px]">
              <img
                src={viewingProof.url}
                alt={`หลักฐานส่ง #${viewingProof.orderCode}`}
                className="max-h-[70vh] w-auto object-contain rounded-2xl shadow-lg border border-gray-200"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
