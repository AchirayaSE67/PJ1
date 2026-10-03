export const STATUS_TEXT = {
  available: 'ว่าง',
  reserved: 'ถูกจอง',
  in_use: 'กำลังใช้งาน',
  maintenance: 'ปิดปรับปรุง',
  active: 'กำลังใช้งาน',
  completed: 'เสร็จสิ้น',
  saved: 'เก็บเวลา',
  cancelled: 'ยกเลิก',
  confirmed: 'ยืนยันแล้ว',
  pending: 'รอดำเนินการ',
  open: 'Open',
  in_progress: 'In Progress',
  resolved: 'Resolved',
  closed: 'Closed',
  success: 'สำเร็จ',
  failed: 'ไม่สำเร็จ',
  rejected: 'ไม่สำเร็จ',
  expired: 'หมดอายุ'
};

export function statusLabel(value) {
  return STATUS_TEXT[value] || value || '-';
}

export function formatDateTime(value) {
  if (!value) return '-';
  return new Date(value).toLocaleString('th-TH', { hour12: false });
}

export function formatMoney(n) {
  return `${Number(n).toLocaleString('th-TH')} บาท`;
}

export function formatCountdown(totalSeconds) {
  const seconds = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const h = String(Math.floor(seconds / 3600)).padStart(2, '0');
  const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0');
  const s = String(seconds % 60).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

export function toDateTimeLocal(date) {
  const d = date instanceof Date ? date : new Date(date);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function startCountdown(getSeconds, render) {
  const tick = () => render(formatCountdown(getSeconds()));
  tick();
  return setInterval(tick, 1000);
}
