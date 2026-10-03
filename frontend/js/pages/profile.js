import { renderNav } from '../nav.js';
import { api, requireLogin, setSession, getToken } from '../api.js';

renderNav('profile');
if (!requireLogin('/pages/profile.html')) throw new Error('login');

const { user } = await api('/profile');
document.getElementById('email').value = user.email;
document.getElementById('profile-email').textContent = user.email;
document.getElementById('profile-name').textContent = user.fullName || 'ผู้ใช้';
document.getElementById('profile-avatar').textContent = (user.fullName || 'U').slice(0, 1).toUpperCase();
document.querySelector('[name=fullName]').value = user.fullName;
document.querySelector('[name=phone]').value = user.phone || '';

document.getElementById('profile-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = new FormData(e.target);
  try {
    const data = await api('/profile', {
      method: 'PUT',
      body: JSON.stringify({
        fullName: form.get('fullName'),
        phone: form.get('phone')
      })
    });
    const token = getToken();
    setSession(token, data.user);
    document.getElementById('profile-name').textContent = data.user.fullName || 'ผู้ใช้';
    document.getElementById('profile-avatar').textContent = (data.user.fullName || 'U').slice(0, 1).toUpperCase();
    document.getElementById('msg').innerHTML = '<div class="alert ok">บันทึกแล้ว</div>';
  } catch (err) {
    document.getElementById('msg').innerHTML = `<div class="alert error">${err.message}</div>`;
  }
});

document.getElementById('password-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = new FormData(e.target);
  try {
    await api('/profile/password', {
      method: 'PUT',
      body: JSON.stringify({
        currentPassword: form.get('currentPassword'),
        newPassword: form.get('newPassword')
      })
    });
    document.getElementById('pw-msg').innerHTML = '<div class="alert ok">เปลี่ยนรหัสผ่านแล้ว</div>';
    e.target.reset();
  } catch (err) {
    document.getElementById('pw-msg').innerHTML = `<div class="alert error">${err.message}</div>`;
  }
});
