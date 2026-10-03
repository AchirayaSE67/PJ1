import { renderNav } from '../nav.js';
import { api, getToken, getUser, setSession } from '../api.js';

renderNav('');

const params = new URLSearchParams(location.search);
const token = params.get('token');
const msg = document.getElementById('msg');
const actions = document.getElementById('actions');

function showResend() {
  if (!getToken()) {
    actions.innerHTML = '<a class="btn" href="/pages/login.html?next=/pages/verify-email.html">เข้าสู่ระบบเพื่อส่งลิงก์ใหม่</a>';
    return;
  }
  actions.innerHTML = '<button class="btn secondary" id="resend">ส่งลิงก์ยืนยันอีกครั้ง</button>';
  document.getElementById('resend').addEventListener('click', async (e) => {
    e.target.disabled = true;
    try {
      const data = await api('/auth/resend-verification', { method: 'POST' });
      msg.innerHTML = `<div class="alert ok">${data.message}</div>`;
    } catch (err) {
      msg.innerHTML = `<div class="alert error">${err.message}</div>`;
    }
    setTimeout(() => { e.target.disabled = false; }, 60000);
  });
}

if (token) {
  try {
    const data = await api('/auth/verify-email', { method: 'POST', body: JSON.stringify({ token }) });
    msg.innerHTML = `<div class="alert ok">${data.message}</div>`;
    const user = getUser();
    if (user && getToken()) setSession(getToken(), { ...user, emailVerified: true });
    actions.innerHTML = '<a class="btn" href="/pages/computers.html">ไปเลือกเครื่อง</a>';
  } catch (err) {
    msg.innerHTML = `<div class="alert error">${err.message}</div>`;
    showResend();
  }
} else {
  msg.innerHTML = params.get('sent')
    ? '<div class="alert ok">สมัครสมาชิกสำเร็จ เราได้ส่งลิงก์ยืนยันไปที่อีเมลของคุณแล้ว กรุณาตรวจสอบกล่องจดหมาย (รวมถึงจดหมายขยะ) ระหว่างนี้คุณใช้งานเว็บได้ แต่ต้องยืนยันอีเมลก่อนจึงจะเช่าเครื่องได้</div>'
    : '<div class="alert warn">กรุณากดลิงก์ในอีเมลเพื่อยืนยัน หากยังไม่ได้รับให้กดส่งอีกครั้ง</div>';
  showResend();
}
