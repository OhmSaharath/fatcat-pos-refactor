import React, { useState } from 'react';
import { Lock, ArrowRight, ShieldCheck, AlertCircle } from 'lucide-react';

interface AdminLoginModalProps {
  onLoginSuccess: (token: string) => void;
  onCancel?: () => void;
}

export const AdminLoginModal: React.FC<AdminLoginModalProps> = ({ onLoginSuccess, onCancel }) => {
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      const data = await res.json();
      if (res.ok && data.ok && data.token) {
        sessionStorage.setItem('fatcat_admin_token', data.token);
        onLoginSuccess(data.token);
      } else {
        setError(data.error || data.detail || 'รหัสผ่านหลังบ้านไม่ถูกต้อง');
      }
    } catch (err: any) {
      setError(err.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อ');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl border border-app-border text-center">
        <div className="w-14 h-14 bg-amber-50 text-chipotle-brown rounded-2xl flex items-center justify-center mx-auto mb-4 border border-amber-200">
          <ShieldCheck className="w-7 h-7" />
        </div>

        <h2 className="text-lg font-bold text-chipotle-brown font-en tracking-tight">
          FATCAT POS ADMIN
        </h2>
        <p className="text-xs text-app-muted mt-1 mb-5">
          เข้าสู่ระบบผู้ดูแลร้าน / จอออเดอร์ในครัว
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-xl text-xs flex items-center gap-2 text-left border border-red-200">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <Lock className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="กรอกรหัสผ่านหลังบ้าน..."
              autoFocus
              className="w-full text-xs py-3 pl-10 pr-4 rounded-xl border border-app-border-dark bg-[#FDFBF9] focus:bg-white focus:outline-none focus:ring-2 focus:ring-chipotle-brown transition-all"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading || !password.trim()}
            className="w-full py-3 bg-chipotle-brown hover:bg-[#3D1E0B] active:scale-[0.98] disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all shadow-md"
          >
            {isLoading ? (
              <span>กำลังตรวจสอบ...</span>
            ) : (
              <>
                <span>เข้าสู่ระบบหลังบ้าน</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>

          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="w-full py-2 text-xs text-app-muted hover:text-chipotle-brown transition-colors"
            >
              ← กลับหน้าร้านลูกค้า
            </button>
          )}
        </form>
      </div>
    </div>
  );
};
