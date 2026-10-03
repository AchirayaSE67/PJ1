import { renderNav } from '../nav.js';
import { api } from '../api.js';

renderNav('login');

document.getElementById('forgot-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = document.getElementById('msg');
  const btn = document.getElementById('submit-btn');
  btn.disabled = true;
  try {
    const data = await api('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email: new FormData(e.target).get('email') })
    });
    msg.innerHTML = `<div class="alert ok">${data.message}</div>`;
    setTimeout(() => { btn.disabled = false; }, 60000);
  } catch (err) {
    msg.innerHTML = `<div class="alert error">${err.message}</div>`;
    btn.disabled = false;
  }
});
