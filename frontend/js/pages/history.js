import { renderNav } from '../nav.js';
import { api, requireLogin } from '../api.js';
import { formatDateTime, formatMoney, statusLabel } from '../format.js';

renderNav('history');
if (!requireLogin('/pages/history.html')) throw new Error('login');

const { rentals } = await api('/rentals');

const completedRentals = rentals.filter((r) => r.status === 'completed');

document.getElementById('body').innerHTML = completedRentals.map((r) => `
  <tr>
    <td>${r.computerCode}</td>
    <td>${formatDateTime(r.createdAt || r.startTime)}</td>
    <td>${formatDateTime(r.startTime)}</td>
    <td>${formatDateTime(r.endTime)}</td>
    <td>${r.hours}</td>
    <td>${formatMoney(r.price)}</td>
    <td>${statusLabel(r.status)}</td>
  </tr>
`).join('');