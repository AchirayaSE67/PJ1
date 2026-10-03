import { renderNav } from '../nav.js';
import { api } from '../api.js';

renderNav('login');

const token = new URLSearchParams(location.search).get('token');
const msg = document.getElementById('msg');
if (!token) {
  msg.innerHTML = '<div class="alert error">ลิงก์ไม่ถูกต้อง กรุณาขอลิงก์ใหม่จากหน้า "ลืมรหัสผ่าน"</div>';
  document.getElementById('submit-btn').disabled = true;
}

document.getElementById('reset-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = new FormData(e.target);
  if (form.get('password') !== form.get('confirm')) {
    msg.innerHTML = '<div class="alert error">รหัสผ่านทั้งสองช่องไม่ตรงกัน</div>';
    return;
  }
  try {
    const data = await api('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, password: form.get('password') })
    });
    msg.innerHTML = `<div class="alert ok">${data.message}</div>`;
    document.getElementById('submit-btn').disabled = true;
    setTimeout(() => { location.href = '/pages/login.html'; }, 2000);
  } catch (err) {
    msg.innerHTML = `<div class="alert error">${err.message}</div>`;
  }
});
