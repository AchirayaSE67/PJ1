// เวลาอ้างอิงคือเวลาของเซิร์ฟเวอร์ ไม่ใช้นาฬิกาของผู้ใช้
let offsetMs = 0;

export function syncServerTime(serverIso) {
  const t = new Date(serverIso).getTime();
  if (Number.isFinite(t)) offsetMs = t - Date.now();
}

export function serverNow() {
  return new Date(Date.now() + offsetMs);
}
