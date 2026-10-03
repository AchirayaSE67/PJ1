import { renderNav } from '../nav.js';
import { api, requireLogin } from '../api.js';
import { formatDateTime, formatMoney, statusLabel } from '../format.js';

renderNav('wallet');
if (!requireLogin('/pages/topup-history.html')) throw new Error('login');

const { topups } = await api('/wallet/topups');
document.getElementById('body').innerHTML = topups.map((t) => `
  <tr>
    <td>${formatDateTime(t.createdAt)}</td>
    <td>${formatMoney(t.amount)}</td>
    <td>${t.method}</td>
    <td>${statusLabel(t.status)}</td>
  </tr>
`).join('');
