import { getUser, clearSession, api } from './api.js';
import { formatMoney, formatCountdown } from './format.js';

export function renderNav(current) {
  const user = getUser();
  const nav = document.querySelector('.nav-links');
  if (!nav) return;

  if (!user) {
    nav.innerHTML = `
      <a href="/pages/index.html" data-page="home">หน้าหลัก</a>
      <a href="/pages/computers.html" data-page="computers">เครื่องให้บริการ</a>
      <a href="/pages/login.html" data-page="login">เข้าสู่ระบบ</a>
      <a class="nav-cta" href="/pages/register.html" data-page="register">สมัครสมาชิก</a>`;
  } else if (user.role === 'admin') {
    nav.innerHTML = `
      <a class="desktop-link" href="/pages/admin.html" data-page="admin">แดชบอร์ดแอดมิน</a>
      <a class="desktop-link" href="/pages/computers.html" data-page="computers">ดูเครื่อง</a>
      <button class="profile-trigger admin-profile-trigger" id="profile-trigger" type="button" aria-label="เปิดเมนูผู้ดูแลระบบ">
        <span class="avatar">A</span>
        <span class="profile-name">${escapeHtml(user.fullName || 'ผู้ดูแลระบบ')}</span>
        <span class="chevron">⌄</span>
      </button>`;
  } else {
    nav.innerHTML = `
      <a class="desktop-link" href="/pages/index.html" data-page="home">หน้าหลัก</a>
      <a class="desktop-link" href="/pages/computers.html" data-page="computers">เครื่องให้บริการ</a>
      <a class="desktop-link" href="/pages/rental.html" data-page="rental">เครื่องของฉัน</a>
      <div class="wallet-balance-display" aria-label="เครดิตคงเหลือ">
        <span class="money-icon" aria-hidden="true">฿</span>
        <span id="nav-balance">กำลังโหลด...</span>
      </div>
      <a class="topup-nav-btn" href="/pages/wallet.html#topup" data-page="topup">+ เติมเครดิต</a>
      <button class="profile-trigger" id="profile-trigger" type="button" aria-label="เปิดเมนูโปรไฟล์">
        <span class="avatar">${escapeHtml((user.fullName || 'U').slice(0, 1).toUpperCase())}</span>
        <span class="profile-name">${escapeHtml(user.fullName || 'บัญชีของฉัน')}</span>
        <span class="chevron">⌄</span>
      </button>`;
  }

  document.querySelectorAll('.nav-links a').forEach((link) => {
    if (link.dataset.page === current) link.classList.add('active');
  });

  if (user) {
    mountProfileDrawer(user);
    if (user.role !== 'admin') loadNavBalance();
  }
}

async function loadNavBalance() {
  const el = document.getElementById('nav-balance');
  if (!el) return;
  try {
    const wallet = await api('/wallet');
    el.textContent = formatMoney(wallet.balance);
  } catch (err) {
    el.textContent = '฿0.00';
  }
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}

function mountProfileDrawer(user) {
  document.getElementById('profile-drawer-root')?.remove();
  const root = document.createElement('div');
  root.id = 'profile-drawer-root';
  root.innerHTML = `
    <div class="drawer-overlay" id="drawer-overlay"></div>
    <aside class="profile-drawer" id="profile-drawer" aria-hidden="true">
      <div class="drawer-head">
        <div>
          <div class="drawer-user">
            <span class="avatar avatar-lg">${escapeHtml((user.fullName || 'U').slice(0, 1).toUpperCase())}</span>
            <div><strong>${escapeHtml(user.fullName || 'ผู้ใช้')}</strong></div>
          </div>
        </div>
        <button class="icon-btn" id="drawer-close" type="button" aria-label="ปิด">×</button>
      </div>

      ${user.role === 'admin' ? `
      <div class="drawer-section">
        <div class="drawer-section-title">พื้นที่ผู้ดูแลระบบ</div>
        <a class="drawer-link" href="/pages/admin.html"><span>🛠️</span><div><strong>แดชบอร์ดแอดมิน</strong><small>จัดการเครื่อง สมาชิก รายการจอง และศูนย์ช่วยเหลือ</small></div></a>
      </div>` : `
      <div class="drawer-section">
        <div class="drawer-section-title">บัญชีของฉัน</div>
        <a class="drawer-link" href="/pages/rental.html"><span>💻</span><div><strong>เครื่องของฉัน</strong><small id="drawer-rental">กำลังตรวจสอบ...</small></div></a>
        <a class="drawer-link" href="/pages/history.html"><span>🕘</span><div><strong>ประวัติการใช้งาน</strong><small>ดูประวัติการใช้เครื่องที่ผ่านมา</small></div></a>
        <a class="drawer-link" href="/pages/wallet.html"><span>💰</span><div><strong>เครดิตและการเงิน</strong><small>เติมเครดิตและตรวจสอบรายการเงิน</small></div></a>
        <a class="drawer-link" href="/pages/profile.html"><span>⚙️</span><div><strong>ตั้งค่าโปรไฟล์</strong><small>ข้อมูลส่วนตัวและรหัสผ่าน</small></div></a>
        <a class="drawer-link" href="/pages/support.html"><span>💬</span><div><strong>ช่วยเหลือ</strong><small>แจ้งปัญหาการใช้งาน</small></div></a>
      </div>`}

      <button class="drawer-logout" id="logout-link" type="button">ออกจากระบบ</button>
    </aside>`;
  document.body.appendChild(root);

  const drawer = root.querySelector('#profile-drawer');
  const overlay = root.querySelector('#drawer-overlay');
  const open = () => { drawer.classList.add('open'); overlay.classList.add('open'); drawer.setAttribute('aria-hidden', 'false'); if (user.role !== 'admin') loadDrawerData(); };
  const close = () => { drawer.classList.remove('open'); overlay.classList.remove('open'); drawer.setAttribute('aria-hidden', 'true'); };

  document.getElementById('profile-trigger')?.addEventListener('click', open);
  document.getElementById('drawer-close')?.addEventListener('click', close);
  overlay.addEventListener('click', close);
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape') close(); }, { once: true });
  document.getElementById('logout-link')?.addEventListener('click', async () => {
    try { await api('/auth/logout', { method: 'POST' }); } catch (err) {}
    clearSession();
    location.href = '/pages/index.html';
  });
}

async function loadDrawerData() {
  try {
    const { rentals = [] } = await api('/rentals/active');
    const active = rentals.find((r) => r.status === 'active');
    const label = document.getElementById('drawer-rental');
    if (!label) return;
    if (active) {
      label.textContent = `${active.computerCode} · เหลือ ${formatCountdown(active.remainingSeconds)}`;
    } else if (rentals.length) {
      label.textContent = `${rentals.length} รายการจองที่กำลังจะเริ่ม`;
    } else {
      label.textContent = 'ยังไม่มีรายการใช้งานในขณะนี้';
    }
  } catch (err) {
    const label = document.getElementById('drawer-rental');
    if (label) label.textContent = 'ดูรายละเอียดการใช้งาน';
  }
}
