import React from 'react';
import { X, CheckCircle, AlertTriangle, QrCode } from 'lucide-react';

interface AdminSlipModalProps {
  isOpen: boolean;
  onClose: () => void;
  slipImage: string;
  orderCode: string;
  totalMoney: number;
  isLoading?: boolean;
  errorMessage?: string | null;
  verification?: {
    is_unique?: boolean;
    has_bank_qr?: boolean;
    bank_name?: string;
    bank_code?: string;
    qr_ref_short?: string;
    amount_matched?: boolean;
    recipient_matched?: boolean;
  };
}

export const AdminSlipModal: React.FC<AdminSlipModalProps> = ({
  isOpen,
  onClose,
  slipImage,
  orderCode,
  totalMoney,
  isLoading,
  errorMessage,
  verification,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-white rounded-3xl overflow-hidden shadow-2xl border border-app-border flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="h-12 px-4 border-b border-app-border flex items-center justify-between bg-stone-50 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-chipotle-brown font-en">SLIP #{orderCode}</span>
            <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              ฿{totalMoney.toFixed(2)}
            </span>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Slip Image Container */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col items-center justify-center bg-stone-100/60 min-h-[260px]">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-app-muted">
              <div className="w-8 h-8 border-3 border-chipotle-gold border-t-transparent rounded-full animate-spin" />
              <span className="text-xs font-medium">กำลังโหลดรูปสลิปจากเซิร์ฟเวอร์...</span>
            </div>
          ) : errorMessage ? (
            <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
              <AlertTriangle className="w-10 h-10 text-amber-500 mb-2" />
              <span className="text-xs font-bold text-gray-800 mb-1">ไม่สามารถเปิดรูปสลิปได้</span>
              <span className="text-[11px] text-app-muted max-w-xs">{errorMessage}</span>
            </div>
          ) : slipImage ? (
            <img
              src={slipImage}
              alt={`สลิปโอนเงิน #${orderCode}`}
              className="max-h-[55vh] w-auto object-contain rounded-xl border border-gray-200 shadow-md"
            />
          ) : (
            <div className="flex flex-col items-center justify-center py-10 px-4 text-center text-app-muted">
              <AlertTriangle className="w-8 h-8 text-gray-400 mb-2" />
              <span className="text-xs">ไม่พบรูปสลิปสำหรับออเดอร์นี้</span>
            </div>
          )}
        </div>

        {/* Verification Report */}
        <div className="p-4 bg-white border-t border-app-border space-y-2 shrink-0">
          <div className="text-[11px] font-bold text-gray-700 font-en tracking-wider uppercase">
            3-Layer Vision AI Verification
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2 rounded-xl bg-stone-50 border border-gray-200 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
              <div>
                <div className="text-[10px] text-app-muted">Image SHA-256</div>
                <div className="font-semibold text-gray-800">ไม่ซ้ำในระบบ</div>
              </div>
            </div>

            <div className="p-2 rounded-xl bg-stone-50 border border-gray-200 flex items-center gap-2">
              {verification?.has_bank_qr ? (
                <QrCode className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
              )}
              <div className="min-w-0">
                <div className="text-[10px] text-app-muted truncate">
                  {verification?.bank_name ? `Bank QR (${verification.bank_name})` : 'Bank QR Ref'}
                </div>
                <div className="font-semibold text-gray-800 font-mono text-[11px] truncate" title={verification?.qr_ref_short}>
                  {verification?.qr_ref_short || 'ตรวจไม่พบ QR'}
                </div>
              </div>
            </div>

            <div className="p-2 rounded-xl bg-stone-50 border border-gray-200 flex items-center gap-2">
              {verification?.amount_matched ? (
                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
              )}
              <div>
                <div className="text-[10px] text-app-muted">Vision OCR ยอดเงิน</div>
                <div className="font-semibold text-gray-800">
                  {verification?.amount_matched ? 'ยอดเงินตรงเป๊ะ' : 'ตรวจยอดด้วยตา'}
                </div>
              </div>
            </div>

            <div className="p-2 rounded-xl bg-stone-50 border border-gray-200 flex items-center gap-2">
              {verification?.recipient_matched ? (
                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
              )}
              <div>
                <div className="text-[10px] text-app-muted">ผู้รับเงิน</div>
                <div className="font-semibold text-gray-800">
                  {verification?.recipient_matched ? 'ตรงชื่อร้าน' : 'ตรวจชื่อด้วยตา'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
