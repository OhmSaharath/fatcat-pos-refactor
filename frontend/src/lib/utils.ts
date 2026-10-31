import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPrice(amount: number): string {
  return `฿${Number(amount || 0).toFixed(0)}`;
}

export function cleanFrontName(name: string): string {
  if (!name) return '';
  return name
    .replace(/\s*\(หน้าร้าน\)/gi, '')
    .replace(/\s*\(เดลิเวอรี่\)/gi, '')
    .replace(/\s*\(เดลิเวอรี\)/gi, '')
    .trim();
}

export function parseDate(dateStr?: string | null): Date | null {
  if (!dateStr) return null;
  // If format is "YYYY-MM-DD HH:mm:ss" (Thai local time without timezone), treat as Asia/Bangkok (+07:00)
  if (/^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}/.test(dateStr)) {
    const isoLike = dateStr.replace(' ', 'T') + '+07:00';
    const d = new Date(isoLike);
    if (!isNaN(d.getTime())) return d;
  }
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
}

export function formatOrderTime(dateStr?: string | null): string {
  const d = parseDate(dateStr);
  if (!d) return dateStr || '-';
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes} น.`;
}

export function formatDuration(seconds: number): string {
  if (seconds < 0) seconds = 0;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins === 0) {
    return `${secs} วินาที`;
  }
  if (mins >= 60) {
    const hrs = Math.floor(mins / 60);
    const remMins = mins % 60;
    return `${hrs} ชม. ${remMins} นาที`;
  }
  return `${mins}:${String(secs).padStart(2, '0')} นาที`;
}
