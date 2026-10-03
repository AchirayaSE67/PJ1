import { renderNav } from '../nav.js';
import { api, getToken } from '../api.js';
import { statusLabel, formatCountdown, formatMoney, formatDateTime } from '../format.js';
import { syncServerTime, serverNow } from '../serverClock.js';

renderNav('computers');

const id = new URLSearchParams(location.search).get('id');
const box = document.getElementById('content');
let { computer } = await api(`/computers/${id}`);
let loadedAt = Date.now();
// ขอเวลาปัจจุบันของเซิร์ฟเวอร์ (เวลาเริ่มในหน้าสรุปราคาคือเวลาเซิร์ฟเวอร์)
try {
  const q = await api(`/computers/quote?computerId=${id}&hours=1&startTime=${encodeURIComponent(new Date().toISOString())}`);
  syncServerTime(q.startTime);
} catch (err) {}

function remainingNow() {
  const elapsed = Math.floor((Date.now() - loadedAt) / 1000);
  return Math.max(0, Number(computer.remainingSeconds || 0) - elapsed);
}

function selectedHours() {
  const custom = Number(document.getElementById('hours-custom')?.value || 0);
  if (custom > 0) return custom;
  return Number(document.getElementById('hours')?.value || 1);
}

function getLiveStart() {
  const now = serverNow();
  const pad = (n) => String(n).padStart(2, '0');
  const value = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  const display = now.toLocaleTimeString('th-TH', { hour12: false });
  const input = document.getElementById('start');
  const text = document.getElementById('start-display');
  if (input) input.value = value;
  if (text) text.textContent = display;
  return value;
}

function updateCalc() {
  const hours = selectedHours();
  const start = getLiveStart();
  const total = computer.pricePerHour * hours;
  const end = new Date(new Date(start).getTime() + hours * 3600 * 1000);
  document.getElementById('end-time').textContent = end.toLocaleTimeString('th-TH', { hour12: false });
  document.getElementById('total-price').textContent = `${formatMoney(computer.pricePerHour)} × ${hours} ชั่วโมง = ${formatMoney(total)}`;
}

const isAvailable = computer.status === 'available';
const isInUse = computer.status === 'in_use';

const currentUse = isInUse ? `<div class="current-use-detail">
  <div><span>ผู้ใช้งาน</span><strong>${computer.activeCustomerName || 'สมาชิก'}</strong></div>
  <div><span>เริ่มใช้งาน</span><strong>${formatDateTime(computer.activeStartTime)}</strong></div>
  <div><span>สิ้นสุด</span><strong>${formatDateTime(computer.activeEndTime)}</strong></div>
  <div><span>เวลาที่เหลือ</span><strong class="countdown" id="remain">${formatCountdown(remainingNow())}</strong></div>
</div>` : '';

const bookingPanel = isAvailable ? `<article class="card booking-panel">
  <div class="kicker">BOOK THIS PC</div><h2>เลือกเวลาใช้งาน</h2><p class="muted">เลือกระยะเวลา แล้วตรวจสอบราคาได้ทันที</p>
  <label>เลือกใช้ชั่วโมง</label>
  <select id="hours" class="hours-select" aria-label="เลือกจำนวนชั่วโมง">
    ${[1,2,3,4,5,6,8,10,12].map(h => `<option value="${h}"${h === 1 ? ' selected' : ''}>${h} ชั่วโมง</option>`).join('')}
  </select>
  <div class="custom-hours custom-hours-newline">
    <span class="custom-hours-label">กำหนดระยะเวลาเอง</span>
    <div class="custom-hours-input-wrap"><input id="hours-custom" type="number" min="1" step="1" inputmode="numeric" aria-label="กำหนดจำนวนชั่วโมงเอง"><span class="custom-hours-unit">ชม.</span></div>
  </div>
  <label>เวลาเริ่มใช้งาน</label>
  <input id="start" type="hidden">
  <div class="live-time-display" id="start-display">--:--:--</div>
  <div class="quote-box"><div><span>เวลาสิ้นสุด</span><strong id="end-time">-</strong></div><div><span>ราคารวม</span><strong id="total-price">-</strong></div></div>
  <div class="btn-row"><button class="btn" id="go-book">ตรวจสอบและยืนยันการใช้บริการ</button></div>
  <p class="muted help-text">ระบบจะตรวจสอบสถานะเครื่อง ช่วงเวลาที่ว่าง และเครดิตคงเหลือก่อนยืนยัน</p>
</article>` : '';

const availabilityNote = isInUse
  ? '<div class="detail-status-note busy-note">เครื่องนี้กำลังมีผู้ใช้งานอยู่ จึงไม่สามารถจองหรือเลือกเวลาใช้งานซ้ำได้</div>'
  : computer.status === 'maintenance'
    ? '<div class="detail-status-note maintenance-note">เครื่องนี้อยู่ระหว่างการปรับปรุงและยังไม่เปิดให้จอง</div>'
    : '';

box.innerHTML = `<div class="detail-layout ${!bookingPanel ? 'detail-single' : ''}">
  <article class="card">
    <div class="row detail-title"><div><span class="small-label">Computer</span><h1>${computer.computerCode}</h1></div><span class="badge ${computer.status}">${statusLabel(computer.status)}</span></div>
    <p class="muted">รายละเอียดและสเปกหลักของเครื่องนี้</p>
    <div class="spec detail-spec">
      <div>CPU</div><div>${computer.cpu}</div>
      <div>GPU</div><div>${computer.gpu}</div>
      <div>RAM</div><div>${computer.ram}</div>
      <div>Storage</div><div>${computer.storage}</div>
    </div>
    <div class="price-highlight"><span>ราคาใช้งาน</span><strong>${formatMoney(computer.pricePerHour)}</strong><small>ต่อ 1 ชั่วโมง</small></div>
    ${currentUse}
    ${availabilityNote}
  </article>
  ${bookingPanel}
</div>`;

if (isAvailable) {
  const hoursSelect = document.getElementById('hours');
  const hoursCustom = document.getElementById('hours-custom');
  const goBook = document.getElementById('go-book');

  hoursSelect.addEventListener('change', () => {
    hoursCustom.value = '';
    updateCalc();
  });

  hoursCustom.addEventListener('input', () => {
    let value = hoursCustom.value.replace(/\D/g, '');

    if (value !== '') {
      value = Math.min(Number(value), 100);
      hoursCustom.value = value;
    }

    updateCalc();
  });

  updateCalc();
  setInterval(updateCalc, 1000);

  goBook.addEventListener('click', () => {
    const hours = selectedHours();

    if (!Number.isInteger(hours) || hours < 1 || hours > 100) {
      alert('กรุณาระบุจำนวนชั่วโมงตั้งแต่ 1–100 ชั่วโมง');
      hoursCustom.focus();
      return;
    }

    const start = document.getElementById('start').value;
    const url = `/pages/booking.html?id=${computer.computerId}&hours=${hours}&start=${encodeURIComponent(start)}`;

    if (!getToken()) {
      location.href = `/pages/login.html?next=${encodeURIComponent(url)}`;
      return;
    }

    location.href = url;
  });
}

if (isInUse) {
  setInterval(async () => {
    try {
      const fresh = await api(`/computers/${id}`);
      computer = fresh.computer;
      loadedAt = Date.now();
    } catch (err) {}
  }, 30000);
  setInterval(() => {
    const remain = document.getElementById('remain');
    if (remain) remain.textContent = formatCountdown(remainingNow());
  }, 1000);
}
