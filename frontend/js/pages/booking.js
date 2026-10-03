import { renderNav } from '../nav.js';
import { api, requireLogin } from '../api.js';
import { formatMoney, formatDateTime } from '../format.js';

renderNav('computers');
if (!requireLogin(location.pathname + location.search)) throw new Error('login');

const params = new URLSearchParams(location.search);
const computerId = Number(params.get('id'));
const hours = Number(params.get('hours'));
const start = params.get('start');
const box = document.getElementById('box');

function showError(message) {
  box.innerHTML = `
    <div class="kicker">CONFIRM SERVICE</div>
    <h2>ไม่สามารถเปิดหน้ายืนยันการใช้บริการได้</h2>
    <div class="alert error">${String(message || 'เกิดข้อผิดพลาด').replace(/[&<>\"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]))}</div>
    <div class="btn-row"><a class="btn secondary" href="/pages/computers.html">กลับไปเลือกเครื่อง</a></div>
  `;
}

if (!Number.isInteger(computerId) || computerId < 1 || !Number.isInteger(hours) || hours < 1 || !start) {
  showError('ข้อมูลการเลือกเครื่องหรือเวลาไม่ถูกต้อง กรุณากลับไปเลือกใหม่');
  throw new Error('invalid booking parameters');
}

try {
  const [quote, computerData, wallet] = await Promise.all([
    api(`/computers/quote?computerId=${computerId}&hours=${hours}&startTime=${encodeURIComponent(start)}`),
    api(`/computers/${computerId}`),
    api('/wallet')
  ]);
  const computer = computerData.computer;

  box.innerHTML = `
    <div class="kicker">CONFIRM SERVICE</div>
    <h2>ตรวจสอบและยืนยันการใช้บริการ ${computer.computerCode}</h2>
    <div class="row"><span>CPU / GPU</span><span>${computer.cpu} / ${computer.gpu}</span></div>
    <div class="row"><span>เริ่ม</span><span>${formatDateTime(quote.startTime)}</span></div>
    <div class="row"><span>สิ้นสุด</span><span>${formatDateTime(quote.endTime)}</span></div>
    <div class="row"><span>จำนวนชั่วโมง</span><span>${quote.hours}</span></div>
    <div class="row"><span>ราคารวม</span><b>${formatMoney(quote.totalPrice)}</b></div>
    <div class="row"><span>เครดิตคงเหลือ</span><span>${formatMoney(wallet.balance)}</span></div>
    <div id="msg"></div>
    <div class="btn-row">
      <button class="btn" id="confirm">ยืนยันการใช้บริการ</button>
      <a class="btn secondary" href="/pages/computer.html?id=${computerId}">ย้อนกลับ</a>
    </div>
  `;

  document.getElementById('confirm').addEventListener('click', async () => {
    const btn = document.getElementById('confirm');
    const msg = document.getElementById('msg');
    btn.disabled = true;
    btn.textContent = 'กำลังยืนยัน...';
    msg.innerHTML = '<div class="alert warn">กำลังตรวจสอบเครื่อง เวลา และเครดิต กรุณารอสักครู่</div>';
    try {
      const data = await api('/rentals/book', {
        method: 'POST',
        body: JSON.stringify({ computerId, hours, startTime: start })
      });
      if (!data?.rental?.rentalId) throw new Error('ระบบไม่พบรหัสรายการใช้งานหลังยืนยัน');
      location.href = '/pages/rental.html';
    } catch (err) {
      msg.innerHTML = `<div class="alert error">${String(err.message || 'ไม่สามารถยืนยันการใช้บริการได้').replace(/[&<>\"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]))}</div>`;
      btn.disabled = false;
      btn.textContent = 'ยืนยันการใช้บริการ';
    }
  });
} catch (err) {
  showError(err.message || 'กรุณาตรวจสอบว่าเครื่องยังว่างและเครดิตเพียงพอ');
}
