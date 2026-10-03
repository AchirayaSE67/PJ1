import { renderNav } from '../nav.js';
import { api, setSession } from '../api.js';

renderNav('login');

document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = new FormData(e.target);
  const msg = document.getElementById('msg');
  try {
    const data = await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: form.get('email'),
        password: form.get('password')
      })
    });
    setSession(data.token, data.user);
    const requestedNext = new URLSearchParams(location.search).get('next');
    const next = requestedNext || (data.user.role === 'admin' ? '/pages/admin.html' : '/pages/index.html');
    location.href = next;
  } catch (err) {
    msg.innerHTML = `<div class="alert error">${err.message}</div>`;
  }
});
