import { renderNav } from '../nav.js';
import { api, setSession } from '../api.js';

renderNav('register');

document.getElementById('register-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = new FormData(e.target);
  const msg = document.getElementById('msg');
  try {
    const data = await api('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        fullName: form.get('fullName'),
        email: form.get('email'),
        phone: form.get('phone'),
        password: form.get('password')
      })
    });
    setSession(data.token, data.user);
    location.href = '/pages/index.html';
  } catch (err) {
    msg.innerHTML = `<div class="alert error">${err.message}</div>`;
  }
});
