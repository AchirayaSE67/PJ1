import { renderNav } from '../nav.js';
import { api, getToken } from '../api.js';
import { statusLabel, formatCountdown, formatMoney } from '../format.js';

renderNav('home');

function card(c) {
  const remain = c.status === 'in_use' && c.remainingSeconds
    ? `<div class="computer-remaining"><span>เหลือเวลา</span><strong>${formatCountdown(c.remainingSeconds)}</strong></div>` : '';
  const isAvailable = c.status === 'available';
  const hasMyRental = myRentalComputerIds.has(String(c.computerId));
  const actionLabel = hasMyRental ? 'รายละเอียด' : 'เลือกเครื่อง';
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
      <div class="computer-footer"><div class="computer-price-box"><span class="small-label">ราคาเริ่มต้น</span><b><span class="coin-icon">🪙</span> ${formatMoney(c.pricePerHour)} / ชม.</b></div><a class="btn ${isAvailable ? '' : 'secondary'}" href="/pages/computer.html?id=${c.computerId}">${actionLabel} <span class="detail-arrow">→</span></a></div>
    </div>
  </article>`;
}

const { computers } = await api('/computers');
let myRentalComputerIds = new Set();
if (getToken()) {
  try {
    const active = await api('/rentals/active');
    myRentalComputerIds = new Set((active.rentals || []).map((r) => String(r.computerId)));
  } catch (err) {}
}
document.getElementById('stat-total').textContent = computers.length;
document.getElementById('stat-available').textContent = computers.filter((c) => c.status === 'available').length;
document.getElementById('stat-inuse').textContent = computers.filter((c) => c.status === 'in_use').length;
// แนะนำจากเครื่องที่ใช้งานได้ก่อน โดยดูจากจำนวนครั้งที่เคยเช่า → ราคา → คะแนน
// ถ้าช่วงนั้นไม่มีเครื่องว่างเลย ให้ยังแสดงเครื่องที่เปิดให้บริการอยู่ (ไม่รวม maintenance)
// เพื่อไม่ให้ส่วน "เครื่องแนะนำ" ว่างเปล่า
const recommended = [...computers]
  .filter((c) => c.status !== 'maintenance')
  .sort((a, b) => {
    const availableRank = Number(b.status === 'available') - Number(a.status === 'available');
    if (availableRank) return availableRank;
    return (Number(b.rentalCount || 0) - Number(a.rentalCount || 0))
      || (Number(a.pricePerHour || 0) - Number(b.pricePerHour || 0))
      || (Number(b.ratingAvg || 0) - Number(a.ratingAvg || 0));
  })
  .slice(0, 3);

document.getElementById('featured').innerHTML = recommended.length
  ? recommended.map(card).join('')
  : '<div class="card empty-state"><h3>ยังไม่มีเครื่องสำหรับแนะนำ</h3><p class="muted">กรุณาลองใหม่อีกครั้งในภายหลัง</p></div>';
