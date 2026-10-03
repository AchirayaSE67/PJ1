import { renderNav } from '../nav.js';
import { api, getUser, requireLogin } from '../api.js';
import { formatDateTime, formatMoney, statusLabel } from '../format.js';

renderNav('admin');
const user = getUser();
if (!requireLogin('/pages/admin.html')) throw new Error('login');
if (!user || user.role !== 'admin') {
  document.querySelector('.container').innerHTML = '<div class="card">หน้านี้สำหรับ Admin เท่านั้น</div>';
  throw new Error('admin');
}

const adminName = document.getElementById('admin-name');
if (adminName) adminName.textContent = user.fullName || 'ผู้ดูแลระบบ';

function updateStats({ computers = [], customers = [], rentals = [], tickets = [] }) {
  document.getElementById('stat-computers').textContent = computers.length;
  document.getElementById('stat-active').textContent = computers.filter(c => c.status === 'in_use').length;
  document.getElementById('stat-customers').textContent = customers.filter(c => c.role !== 'admin').length;
  document.getElementById('stat-tickets').textContent = tickets.filter(t => t.status === 'open' || t.status === 'in_progress').length;
}

document.querySelectorAll('.tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((t) => t.classList.remove('on'));
    tab.classList.add('on');
    ['computers', 'customers', 'rentals', 'reservations', 'wallet', 'tickets'].forEach((name) => {
      document.getElementById(`panel-${name}`).classList.toggle('hidden', name !== tab.dataset.tab);
    });
  });
});

function table(headers, rows) {
  return `<table><thead><tr>${headers.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table>`;
}

async function loadComputers() {
  const { computers } = await api('/computers');
  document.getElementById('computer-table').innerHTML = table(
    ['รหัส', 'สเปก', 'ราคา', 'สถานะ', 'จัดการ'],
    computers.map((c) => `
      <tr>
        <td>${c.computerCode}</td>
        <td>${c.cpu} / ${c.ram} / ${c.gpu} / ${c.storage}</td>
        <td>${formatMoney(c.pricePerHour)}</td>
        <td>${statusLabel(c.status)}</td>
        <td>
          <button class="btn secondary" data-edit='${JSON.stringify(c)}'>แก้ไข</button>
          <button class="btn danger" data-del="${c.computerId}">ลบ</button>
        </td>
      </tr>`).join('')
  );
  document.querySelectorAll('[data-edit]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const c = JSON.parse(btn.dataset.edit);
      const form = document.getElementById('computer-form');
      form.computerId.value = c.computerId;
      form.computerCode.value = c.computerCode;
      form.cpu.value = c.cpu;
      form.ram.value = c.ram;
      form.gpu.value = c.gpu;
      form.storage.value = c.storage;
      form.pricePerHour.value = c.pricePerHour;
      form.status.value = c.status;
      form.connectionAddress.value = c.connectionAddress;
      form.connectionPort.value = c.connectionPort;
      form.connectionMethod.value = c.connectionMethod;
      document.getElementById('form-title').textContent = 'แก้ไขเครื่อง';
    });
  });
  document.querySelectorAll('[data-del]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('ลบเครื่องนี้?')) return;
      try {
        await api(`/admin/computers/${btn.dataset.del}`, { method: 'DELETE' });
        await loadComputers();
      } catch (err) {
        alert(err.message);
      }
    });
  });
}

document.getElementById('computer-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const msg = document.getElementById('computer-form-msg');
  const saveBtn = form.querySelector('button[type=submit]');
  const payload = {
    computerCode: form.computerCode.value.trim(),
    cpu: form.cpu.value.trim(),
    ram: form.ram.value.trim(),
    gpu: form.gpu.value.trim(),
    storage: form.storage.value.trim(),
    pricePerHour: Number(form.pricePerHour.value),
    status: form.status.value,
    connectionAddress: form.connectionAddress.value.trim(),
    connectionPort: Number(form.connectionPort.value),
    connectionMethod: form.connectionMethod.value.trim()
  };
  const id = form.computerId.value;
  saveBtn.disabled = true;
  saveBtn.textContent = 'กำลังบันทึก...';
  msg.innerHTML = '';
  try {
    if (!payload.computerCode || !payload.cpu || !payload.ram || !payload.gpu || !payload.storage || !Number.isFinite(payload.pricePerHour) || payload.pricePerHour <= 0) {
      throw new Error('กรุณากรอกข้อมูลเครื่องและราคาให้ครบ');
    }
    if (id) await api(`/admin/computers/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
    else await api('/admin/computers', { method: 'POST', body: JSON.stringify(payload) });
    msg.innerHTML = '<div class="alert ok">บันทึกข้อมูลเครื่องเรียบร้อยแล้ว</div>';
    form.reset();
    form.computerId.value = '';
    document.getElementById('form-title').textContent = 'เพิ่มเครื่อง';
    await loadComputers();
  } catch (err) {
    msg.innerHTML = `<div class="alert error">${err.message}</div>`;
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = 'บันทึกเครื่อง';
  }
});

document.getElementById('reset-form').addEventListener('click', () => {
  document.getElementById('computer-form').reset();
  document.getElementById('computer-form').computerId.value = '';
  document.getElementById('form-title').textContent = 'เพิ่มเครื่อง';
});

async function loadCustomers() {
  const { customers } = await api('/admin/customers');
  document.getElementById('customer-table').innerHTML = table(
    ['ชื่อ', 'อีเมล', 'สิทธิ์', 'เครดิต'],
    customers.map((c) => `<tr>
      <td>${c.fullName}</td><td>${c.email}</td><td>${c.role}</td>
      <td>${formatMoney(c.walletBalance)}</td>
    </tr>`).join('')
  );
}

async function loadRentals() {
  const { rentals } = await api('/admin/rentals');
  document.getElementById('rental-table').innerHTML = table(
    ['เครื่อง', 'เริ่ม', 'สิ้นสุด', 'ชั่วโมง', 'ราคา', 'สถานะ'],
    rentals.map((r) => `<tr>
      <td>${r.computerCode}</td><td>${formatDateTime(r.startTime)}</td>
      <td>${formatDateTime(r.endTime)}</td><td>${r.hours}</td>
      <td>${formatMoney(r.price)}</td><td>${statusLabel(r.status)}</td>
    </tr>`).join('')
  );
}

async function loadReservations() {
  const { reservations } = await api('/admin/reservations');

  document.getElementById('reservation-table').innerHTML = table(
    ['ลูกค้า', 'เครื่อง', 'เริ่ม', 'สิ้นสุด', 'ราคา', 'สถานะ'],
    reservations.map((r) => `<tr>
      <td>${r.customerName}</td>
      <td>${r.computerCode}</td>
      <td>${formatDateTime(r.startTime)}</td>
      <td>${formatDateTime(r.endTime)}</td>
      <td>${formatMoney(r.totalPrice)}</td>
      <td>${statusLabel(r.status)}</td>
    </tr>`).join('')
  );
}

async function loadWallet() {
  const { transactions } = await api('/admin/transactions');
  document.getElementById('wallet-table').innerHTML = table(
    ['ลูกค้า', 'ประเภท', 'จำนวน', 'รายละเอียด', 'วันที่'],
    transactions.map((t) => `<tr>
      <td>${t.customerName}</td><td>${t.type}</td>
      <td>${formatMoney(t.amount)}</td><td>${t.description}</td>
      <td>${formatDateTime(t.createdAt)}</td>
    </tr>`).join('')
  );
}


function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[char]));
}

function renderAdminTicketMessages(ticket) {
  const messages = Array.isArray(ticket.messages) ? [...ticket.messages] : [];

  if (
    ticket.adminReply &&
    !messages.some(
      (m) => m.senderRole === 'admin' && m.message === ticket.adminReply
    )
  ) {
    messages.unshift({
      senderRole: 'admin',
      senderName: 'Admin',
      message: ticket.adminReply,
      createdAt: ticket.updatedAt
    });
  }

  return messages.map((message) => `
    <div class="ticket-message ${message.senderRole === 'admin' ? 'ticket-message-admin' : 'ticket-message-customer'}">
      <div class="ticket-message-head">
        <strong>${message.senderRole === 'admin' ? 'Admin' : 'ลูกค้า'}</strong>
        <span>${formatDateTime(message.createdAt)}</span>
      </div>
      <p>${escapeHtml(message.message)}</p>
    </div>
  `).join('');
}

async function loadTickets() {
  const { tickets = [] } = await api('/admin/tickets');

  document.getElementById('ticket-table').innerHTML = tickets.map((t) => `
    <div class="card ticket-admin-card">
      <div class="ticket-thread-head">
        <div>
          <div class="ticket-thread-title">#${t.ticketId} ${escapeHtml(t.subject)}</div>
          <p class="muted">${escapeHtml(t.customerName)} · ${escapeHtml(t.computerCode || '-')} · ${escapeHtml(t.issueType)} · ${formatDateTime(t.createdAt)}</p>
        </div>
        <span class="badge ${t.status === 'open' ? 'warn' : 'available'}">${escapeHtml(statusLabel(t.status))}</span>
      </div>

      <div class="ticket-message ticket-message-customer">
        <div class="ticket-message-head">
          <strong>ลูกค้า</strong>
          <span>${formatDateTime(t.createdAt)}</span>
        </div>
        <p>${escapeHtml(t.description)}</p>
      </div>

      ${renderAdminTicketMessages(t)}

      <div class="ticket-admin-controls">
        <div class="admin-ticket-field">
          <label for="ticket-status-${t.ticketId}">สถานะ</label>
          <select id="ticket-status-${t.ticketId}" data-status="${t.ticketId}">
            <option ${t.status === 'open' ? 'selected' : ''} value="open">Open</option>
            <option ${t.status === 'in_progress' ? 'selected' : ''} value="in_progress">In Progress</option>
            <option ${t.status === 'resolved' ? 'selected' : ''} value="resolved">Resolved</option>
            <option ${t.status === 'closed' ? 'selected' : ''} value="closed">Closed</option>
          </select>
        </div>

        ${t.status !== 'closed' ? `
          <div class="admin-ticket-field">
            <label for="ticket-reply-${t.ticketId}">ตอบกลับ</label>
            <textarea
              id="ticket-reply-${t.ticketId}"
              data-reply="${t.ticketId}"
              maxlength="2000"
              placeholder="พิมพ์ข้อความตอบกลับ..."
            ></textarea>
          </div>
        ` : ''}

        <div class="btn-row">
          <button class="btn" type="button" data-save="${t.ticketId}">บันทึก Ticket</button>
        </div>
      </div>
    </div>
  `).join('') || '<p class="muted">ยังไม่มี Ticket</p>';

  document.querySelectorAll('[data-save]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.save;
      const status = document.querySelector(`[data-status="${id}"]`)?.value;
      const reply = document.querySelector(`[data-reply="${id}"]`)?.value.trim() || '';

      btn.disabled = true;
      btn.textContent = 'กำลังบันทึก...';

      try {
        await api(`/admin/tickets/${id}`, {
          method: 'PUT',
          body: JSON.stringify({
            status,
            adminReply: reply
          })
        });
        await loadTickets();
      } catch (err) {
        alert(err.message);
        btn.disabled = false;
        btn.textContent = 'บันทึก Ticket';
      }
    });
  });
}

async function loadAdminDashboard() {
  try {
    const [computerData, customerData, rentalData, reservationData, walletData, ticketData] = await Promise.all([
      api('/computers'),
      api('/admin/customers'),
      api('/admin/rentals'),
      api('/admin/reservations'),
      api('/admin/transactions'),
      api('/admin/tickets')
    ]);
    updateStats({ computers: computerData.computers || [], customers: customerData.customers || [], rentals: rentalData.rentals || [], tickets: ticketData.tickets || [] });
    await loadComputers();
    document.getElementById('customer-table').innerHTML = table(
      ['ชื่อ', 'อีเมล', 'สิทธิ์', 'เครดิต'],
      (customerData.customers || []).map((c) => `<tr><td>${c.fullName}</td><td>${c.email}</td><td>${c.role}</td><td>${formatMoney(c.walletBalance)}</td></tr>`).join('')
    );
    document.getElementById('rental-table').innerHTML = table(
      ['เครื่อง', 'เริ่ม', 'สิ้นสุด', 'ชั่วโมง', 'ราคา', 'สถานะ'],
      (rentalData.rentals || []).map((r) => `<tr><td>${r.computerCode}</td><td>${formatDateTime(r.startTime)}</td><td>${formatDateTime(r.endTime)}</td><td>${r.hours}</td><td>${formatMoney(r.price)}</td><td>${statusLabel(r.status)}</td></tr>`).join('')
    );
    document.getElementById('reservation-table').innerHTML = table(
  ['ลูกค้า', 'เครื่อง', 'เริ่ม', 'สิ้นสุด', 'ราคา', 'สถานะ'],
  (reservationData.reservations || []).map((r) => `
    <tr>
      <td>${r.customerName}</td>
      <td>${r.computerCode}</td>
      <td>${formatDateTime(r.startTime)}</td>
      <td>${formatDateTime(r.endTime)}</td>
      <td>${formatMoney(r.totalPrice)}</td>
      <td>${statusLabel(r.status)}</td>
    </tr>
  `).join('')
);
    document.querySelectorAll('[data-res]').forEach((sel) => sel.addEventListener('change', async () => { try { await api(`/admin/reservations/${sel.dataset.res}`, { method: 'PUT', body: JSON.stringify({ status: sel.value }) }); } catch (err) { alert(err.message); } }));
    document.getElementById('wallet-table').innerHTML = table(
      ['ลูกค้า', 'ประเภท', 'จำนวน', 'รายละเอียด', 'วันที่'],
      (walletData.transactions || []).map((t) => `<tr><td>${t.customerName}</td><td>${t.type}</td><td>${formatMoney(t.amount)}</td><td>${t.description}</td><td>${formatDateTime(t.createdAt)}</td></tr>`).join('')
    );
    await loadTickets();
  } catch (err) {
    document.querySelector('.admin-panels').insertAdjacentHTML('afterbegin', `<div class="alert error">โหลดข้อมูลแอดมินไม่สำเร็จ: ${err.message}</div>`);
  }
}

await loadAdminDashboard();
