import { renderNav } from '../nav.js';
import { api, requireLogin } from '../api.js';
import { formatCountdown, formatDateTime, formatMoney, statusLabel } from '../format.js';

renderNav('rental');
if (!requireLogin(location.pathname + location.search)) throw new Error('login');

const box = document.getElementById('content');
const id = new URLSearchParams(location.search).get('id');
const loadedAt = Date.now();
let currentRentals = [];
let walletBalance = 0;
let extensionRental = null;
let warningState = new Map();
let actionCooldown = new Map();

function remainingOf(rental) {
  const elapsed = Math.floor((Date.now() - loadedAt) / 1000);
  const base = Number(rental.remainingSeconds || 0);
  if (rental.status !== 'active') return base;
  return Math.max(0, base - elapsed);
}

function cooldownKey(rentalId, action) { return `${rentalId}:${action}`; }
function startCooldown(button, rentalId, action) {
  const key = cooldownKey(rentalId, action);
  let left = 60;
  actionCooldown.set(key, Date.now() + 60000);
  button.disabled = true;
  const original = button.dataset.original || button.textContent;
  button.dataset.original = original;
  button.textContent = `${action === 'open' ? 'เปิดเครื่อง' : 'ปิดเครื่อง'} (${left}s)`;
  const timer = setInterval(() => {
    left -= 1;
    if (left <= 0) {
      clearInterval(timer);
      actionCooldown.delete(key);
      button.disabled = false;
      button.textContent = original;
      return;
    }
    button.textContent = `${action === 'open' ? 'เปิดเครื่อง' : 'ปิดเครื่อง'} (${left}s)`;
  }, 1000);
}
function isCooling(rentalId, action) {
  return (actionCooldown.get(cooldownKey(rentalId, action)) || 0) > Date.now();
}

function extensionModal() {
  if (document.getElementById('extend-modal')) return;
  const modal = document.createElement('div');
  modal.id = 'extend-modal';
  modal.className = 'modal-backdrop hidden';
  modal.innerHTML = `<div class="modal-card" role="dialog" aria-modal="true">
    <div class="modal-head"><div><div class="kicker">EXTEND SESSION</div><h2>เพิ่มเวลาใช้งาน</h2></div><button class="icon-btn" id="extend-close">×</button></div>
    <div id="extend-machine" class="modal-machine"></div>
    <div class="extend-options" id="extend-options">
      <button class="extend-option" data-minutes="30"><strong>30 นาที</strong><span></span></button>
      <button class="extend-option selected" data-minutes="60"><strong>1 ชั่วโมง</strong><span></span></button>
      <button class="extend-option" data-minutes="120"><strong>2 ชั่วโมง</strong><span></span></button>
    </div>
    <div class="extend-custom extend-custom-newline">
      <span class="extend-custom-label">กำหนดระยะเวลาเอง</span>
      <div class="extend-custom-input-wrap"><input id="extend-custom-hours" type="number" min="1" step="1" inputmode="numeric" aria-label="กำหนดจำนวนชั่วโมงเอง"><span class="extend-unit">ชม.</span></div>
    </div>
    <div class="extend-summary"><div><span>เครดิตคงเหลือ</span><strong id="extend-balance">-</strong></div><div><span>ค่าบริการเพิ่ม</span><strong id="extend-cost">-</strong></div><div><span>เครดิตหลังต่อเวลา</span><strong id="extend-after">-</strong></div></div>
    <div id="extend-msg"></div>
    <div class="btn-row modal-actions"><button class="btn secondary" id="extend-cancel">ยกเลิก</button><button class="btn" id="extend-confirm">ยืนยันเพิ่มเวลา</button></div>
  </div>`;
  document.body.appendChild(modal);
  const close = () => modal.classList.add('hidden');
  document.getElementById('extend-close').onclick = close;
  document.getElementById('extend-cancel').onclick = close;
  modal.addEventListener('click', e => { if (e.target === modal) close(); });
  modal.querySelectorAll('.extend-option').forEach(b => b.onclick = () => {
    modal.querySelectorAll('.extend-option').forEach(x => x.classList.remove('selected'));
    b.classList.add('selected');
    const custom = document.getElementById('extend-custom-hours'); if (custom) custom.value = '';
    updateExtensionQuote();
  });
  document.getElementById('extend-custom-hours').addEventListener('input', () => {
  const input = document.getElementById('extend-custom-hours');
  let value = input.value.replace(/\D/g, '');

  if (value !== '') {
    value = Math.min(Number(value), 100);
    input.value = value;
  }

  if (input.value) modal.querySelectorAll('.extend-option').forEach(x => x.classList.remove('selected'));
  updateExtensionQuote();
});
}

function updateExtensionQuote() {
  if (!extensionRental) return;
  const customHours = Number(document.getElementById('extend-custom-hours')?.value || 0);
  const m = customHours > 0 ? customHours * 60 : Number(document.querySelector('.extend-option.selected')?.dataset.minutes || 60);
  const hourly = Number(extensionRental.price) / Math.max(Number(extensionRental.hours), .01);
  const cost = Number((hourly * m / 60).toFixed(2));
  document.getElementById('extend-balance').textContent = formatMoney(walletBalance);
  document.getElementById('extend-cost').textContent = formatMoney(cost);
  document.getElementById('extend-after').textContent = formatMoney(Math.max(0, walletBalance - cost));
  document.getElementById('extend-confirm').disabled = walletBalance < cost;
}

function openExtension(rental) {
  extensionModal();
  extensionRental = rental;
  document.getElementById('extend-machine').innerHTML = `<strong>เครื่อง ${rental.computerCode}</strong><span>เหลือเวลา ${formatCountdown(remainingOf(rental))}</span>`;
  document.getElementById('extend-msg').innerHTML = '';
  document.querySelectorAll('.extend-option').forEach(b => b.classList.remove('selected'));
  document.querySelector('.extend-option[data-minutes="60"]').classList.add('selected');
  updateExtensionQuote();
  document.getElementById('extend-modal').classList.remove('hidden');
}

async function confirmExtension() {
  if (!extensionRental) return;
  const customHours = Number(document.getElementById('extend-custom-hours')?.value || 0);
  const m = customHours > 0 ? customHours * 60 : Number(document.querySelector('.extend-option.selected')?.dataset.minutes || 60);
  const btn = document.getElementById('extend-confirm');
  const msg = document.getElementById('extend-msg');
  btn.disabled = true;
  btn.textContent = 'กำลังดำเนินการ...';
  try {
    const data = await api(`/rentals/${extensionRental.rentalId}/extend-time`, { method: 'POST', body: JSON.stringify({ minutes: m }) });
    walletBalance = Number(data.balance);
    msg.innerHTML = `<div class="alert ok">${data.message} · เครดิตคงเหลือ ${formatMoney(walletBalance)}</div>`;
    await load();
    setTimeout(() => document.getElementById('extend-modal')?.classList.add('hidden'), 700);
  } catch (err) {
    msg.innerHTML = `<div class="alert error">${err.message}</div>`;
    btn.disabled = false;
    btn.textContent = 'ยืนยันเพิ่มเวลา';
  }
}

function shutdownModal() {
  if (document.getElementById('shutdown-modal')) return;
  const modal = document.createElement('div');
  modal.id = 'shutdown-modal';
  modal.className = 'modal-backdrop hidden';
  modal.innerHTML = `<div class="modal-card confirm-modal">
    <div class="confirm-icon">!</div><div class="kicker">END SESSION</div><h2>ปิดเครื่องและสิ้นสุดการใช้งาน?</h2>
    <p class="muted">เมื่อยืนยัน ระบบจะสิ้นสุดเซสชันของเครื่องทันที และไม่สามารถนำเวลาที่เหลือกลับมาได้ตามกติกาของร้าน</p>
    <div id="shutdown-msg"></div>
    <div class="btn-row modal-actions"><button class="btn secondary" id="shutdown-cancel">ยกเลิก</button><button class="btn danger" id="shutdown-confirm">ยืนยันปิดเครื่อง</button></div>
  </div>`;
  document.body.appendChild(modal);
  const close = () => modal.classList.add('hidden');
  document.getElementById('shutdown-cancel').onclick = close;
  modal.addEventListener('click', e => { if (e.target === modal) close(); });
}

function openShutdown(rental) {
  shutdownModal();
  const modal = document.getElementById('shutdown-modal');
  modal.dataset.rentalId = rental.rentalId;
  modal.querySelector('#shutdown-msg').innerHTML = '';
  modal.classList.remove('hidden');
}

async function confirmShutdown() {
  const modal = document.getElementById('shutdown-modal');
  const rentalId = modal.dataset.rentalId;
  const btn = document.getElementById('shutdown-confirm');
  const msg = document.getElementById('shutdown-msg');
  btn.disabled = true;
  btn.textContent = 'กำลังปิดเครื่อง...';
  try {
    const data = await api(`/rentals/${rentalId}/end`, { method: 'POST' });
    msg.innerHTML = `<div class="alert ok">${data.message}</div>`;
    await load();
    const sourceBtn = document.querySelector(`.rental-card[data-id="${rentalId}"] .shutdown-btn`);
    if (sourceBtn) startCooldown(sourceBtn, rentalId, 'close');
    setTimeout(() => modal.classList.add('hidden'), 700);
  } catch (err) {
    msg.innerHTML = `<div class="alert error">${err.message}</div>`;
    btn.disabled = false;
    btn.textContent = 'ยืนยันปิดเครื่อง';
  }
}

function connectionControls(rental) {
  const can = rental.status === 'active' && rental.connectionEnabled;
  return `<div class="machine-controls">
    <div class="controls-heading"><div><span class="small-label">ควบคุมเครื่อง</span><strong>การจัดการเครื่อง</strong></div><span class="connection-method">${rental.connectionMethod || 'Remote'}</span></div>
    <div class="btn-row control-buttons">
      <button class="btn connect-btn" ${can ? '' : 'disabled'}>เปิดเครื่อง</button>
      <button class="btn secondary extend-time" ${can ? '' : 'disabled'}>เพิ่มเวลา</button>
      <button class="btn danger shutdown-btn" ${can ? '' : 'disabled'}>ปิดเครื่อง</button>
    </div>
    <div class="connect-msg"></div>
  </div>`;
}

function renderCard(rental) {
  const remain = remainingOf(rental);
  const active = rental.status === 'active';
  return `<article class="card rental-card" data-id="${rental.rentalId}">
    <div class="rental-card-head">
      <div><span class="small-label">เครื่อง</span><h2>${rental.computerCode}</h2></div>
      <span class="badge ${active ? 'in_use' : rental.status}">${active ? 'กำลังใช้งาน' : statusLabel(rental.status)}</span>
    </div>
    <div class="rental-info-grid">
      <div><span>เริ่มใช้งาน</span><strong>${formatDateTime(rental.startTime)}</strong></div>
      <div><span>สิ้นสุด</span><strong>${formatDateTime(rental.endTime)}</strong></div>
      <div><span>ค่าบริการ</span><strong>${formatMoney(rental.price)}</strong></div>
      <div class="rental-remaining"><span>เวลาที่เหลือ</span><strong class="remain-clock">${active ? formatCountdown(remain) : '-'}</strong></div>
    </div>
    ${active ? connectionControls(rental) : '<div class="ended-note">การใช้งานรายการนี้สิ้นสุดแล้ว</div>'}
  </article>`;
}

function renderCards(rentals) {
  return `<div class="rental-list">${rentals.map(renderCard).join('')}</div>`;
}

async function load() {
  const [rentalData, wallet] = await Promise.all([
    id ? api(`/rentals/${id}`).then(d => ({ rentals: [d.rental] })) : api('/rentals/active'),
    api('/wallet')
  ]);
  currentRentals = rentalData.rentals || [];
  walletBalance = Number(wallet.balance || 0);
  document.getElementById('rental-count').textContent = `${currentRentals.filter(r => r.status === 'active').length} เครื่อง`;
  document.getElementById('machine-balance').textContent = formatMoney(walletBalance);

  if (!currentRentals.length) {
    box.innerHTML = '<div class="card empty-state"><div class="empty-icon">💻</div><h3>ยังไม่มีเครื่องที่กำลังใช้งาน</h3><p class="muted">เลือกเครื่องที่พร้อมให้บริการเพื่อเริ่มใช้งาน</p><a class="btn" href="/pages/computers.html">เลือกเครื่องที่พร้อมให้บริการ</a></div>';
    return;
  }

  box.innerHTML = renderCards(currentRentals);
  box.querySelectorAll('.extend-time').forEach(btn => btn.onclick = () => {
    const rental = currentRentals.find(r => String(r.rentalId) === btn.closest('.rental-card').dataset.id);
    if (rental) openExtension(rental);
  });
  box.querySelectorAll('.shutdown-btn').forEach(btn => btn.onclick = () => {
    const rental = currentRentals.find(r => String(r.rentalId) === btn.closest('.rental-card').dataset.id);
    if (rental && !isCooling(rental.rentalId, 'close')) openShutdown(rental);
  });
  box.querySelectorAll('.connect-btn').forEach(btn => btn.onclick = () => {
    const card = btn.closest('.rental-card');
    const rental = currentRentals.find(r => String(r.rentalId) === card.dataset.id);
    if (!rental || isCooling(rental.rentalId, 'open')) return;
    startCooldown(btn, rental.rentalId, 'open');
    card.querySelector('.connect-msg').innerHTML = '<div class="alert ok">ส่งคำสั่งเปิดเครื่องแล้ว กรุณารอสักครู่ ระบบกำลังเตรียมเครื่องสำหรับการเชื่อมต่อ</div>';
  });
}

document.addEventListener('click', e => {
  if (e.target.id === 'extend-confirm') void confirmExtension();
  if (e.target.id === 'shutdown-confirm') void confirmShutdown();
});

await load();
setInterval(() => {
  box.querySelectorAll('.rental-card').forEach(card => {
    const rental = currentRentals.find(x => String(x.rentalId) === card.dataset.id);
    if (!rental || rental.status !== 'active') return;
    const sec = remainingOf(rental);
    const clock = card.querySelector('.remain-clock');
    if (clock) clock.textContent = formatCountdown(sec);
    if (sec <= 0 && !card.dataset.expired) {
      card.dataset.expired = '1';
      setTimeout(load, 300);
    }
    if (sec <= 900 && sec > 0) {
      const level = sec <= 300 ? '5' : '15';
      if (warningState.get(rental.rentalId) !== level) warningState.set(rental.rentalId, level);
    }
  });
}, 1000);

