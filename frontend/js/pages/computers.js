import { renderNav } from '../nav.js';
import { api } from '../api.js';
import { statusLabel, formatCountdown, formatMoney } from '../format.js';

renderNav('computers');
const listEl = document.getElementById('list');
let computers = [];
const loadedAt = Date.now();

function remainingNow(pc) {
  if (pc.status !== 'in_use') return 0;
  return Math.max(0, Number(pc.remainingSeconds || 0) - Math.floor((Date.now() - loadedAt) / 1000));
}

function render() {
  listEl.innerHTML = computers.map((c) => {
    const isAvailable = c.status === 'available';
    const remain = c.status === 'in_use' ? `<div class="computer-remaining"><span>เหลือเวลา</span><strong class="countdown" data-pc="${c.computerId}">${formatCountdown(remainingNow(c))}</strong></div>` : '';
    return `<article class="card computer-card">
      <div class="computer-image"><img src="/assets/pc-machine.png" alt="${c.computerCode}"></div>
      <div class="computer-content">
        <div class="row"><div><span class="small-label">เครื่อง</span><h3>${c.computerCode}</h3></div><span class="badge ${c.status}">${statusLabel(c.status)}</span></div>
        <div class="computer-specs">
          <div><span>CPU</span><strong>${c.cpu}</strong></div>
          <div><span>GPU</span><strong>${c.gpu}</strong></div>
          <div><span>RAM</span><strong>${c.ram}</strong></div>
          <div><span>SSD</span><strong>${c.storage}</strong></div>
        </div>
        ${remain}
        <div class="computer-footer"><div class="computer-price-box"><span class="small-label">ราคาเริ่มต้น</span><b><span class="coin-icon">🪙</span> ${formatMoney(c.pricePerHour)} / ชม.</b></div><a class="btn ${isAvailable ? '' : 'secondary'}" href="/pages/computer.html?id=${c.computerId}">${isAvailable ? 'เลือกเครื่อง' : 'ดูรายละเอียด'} <span class="detail-arrow">→</span></a></div>
      </div>
    </article>`;
  }).join('');
}

computers = (await api('/computers')).computers;
render();
setInterval(() => {
  listEl.querySelectorAll('[data-pc]').forEach((el) => {
    const pc = computers.find((c) => String(c.computerId) === el.dataset.pc);
    if (pc) el.textContent = formatCountdown(remainingNow(pc));
  });
}, 1000);
