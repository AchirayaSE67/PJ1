import { renderNav } from '../nav.js';
import { api, requireLogin } from '../api.js';
import { formatDateTime, statusLabel } from '../format.js';

renderNav('support');
if (!requireLogin('/pages/support.html')) throw new Error('login');

const select = document.getElementById('computer-select');

async function loadComputers() {
  try {
    const { computers = [] } = await api('/computers');
    select.innerHTML = '<option value="">ไม่ระบุ</option>' + computers.map((c) => `<option value="${c.computerId}">${c.computerCode}</option>`).join('');
  } catch (err) {
    select.innerHTML = '<option value="">ไม่ระบุ</option>';
    document.getElementById('computer-load-msg').textContent = 'ไม่สามารถโหลดรายการเครื่องได้ แต่ยังสามารถส่ง Ticket ได้';
  }
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[char]));
}

function renderMessages(ticket) {
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
        <strong>${message.senderRole === 'admin' ? 'Admin' : 'คุณ'}</strong>
        <span>${formatDateTime(message.createdAt)}</span>
      </div>
      <p>${escapeHtml(message.message)}</p>
    </div>
  `).join('');
}

async function loadTickets() {
  try {
    const { tickets = [] } = await api('/tickets');

    document.getElementById('tickets').innerHTML = tickets.map((t) => `
      <div class="card ticket-thread-card">
        <div class="ticket-thread-head">
          <div>
            <div class="ticket-thread-title">#${t.ticketId} ${escapeHtml(t.subject)}</div>
            <p class="muted">${escapeHtml(t.computerCode || '-')} · ${escapeHtml(t.issueType)} · ${formatDateTime(t.createdAt)}</p>
          </div>
          <span class="badge ${t.status === 'open' ? 'warn' : 'available'}">${escapeHtml(statusLabel(t.status))}</span>
        </div>

        <div class="ticket-message ticket-message-customer">
          <div class="ticket-message-head">
            <strong>คุณ</strong>
            <span>${formatDateTime(t.createdAt)}</span>
          </div>
          <p>${escapeHtml(t.description)}</p>
        </div>

        ${renderMessages(t)}

${(() => {
  const messages = Array.isArray(t.messages)
    ? t.messages
    : [];

  const lastMessage = messages.length
    ? messages[messages.length - 1]
    : null;

  const canReply =
    t.status !== 'closed' &&
    (
      lastMessage?.senderRole === 'admin' ||
      (!lastMessage && Boolean(t.adminReply))
    );

  if (canReply) {
    return `
      <div class="ticket-reply-box">
        <label for="ticket-reply-${t.ticketId}">
          ตอบกลับ Ticket
        </label>

        <textarea
          id="ticket-reply-${t.ticketId}"
          data-ticket-reply="${t.ticketId}"
          maxlength="2000"
          placeholder="พิมพ์ข้อความตอบกลับ..."
        ></textarea>

        <div class="btn-row">
          <button
            class="btn"
            type="button"
            data-ticket-send="${t.ticketId}"
          >
            ตอบกลับ
          </button>
        </div>
      </div>
    `;
  }

  if (t.status === 'closed') {
    return `
      <p class="muted ticket-closed-note">
        Ticket นี้ปิดแล้ว ไม่สามารถตอบกลับได้
      </p>
    `;
  }

  return `
    <p class="muted ticket-closed-note">
      กรุณารอการตอบกลับจาก Admin ก่อน
    </p>
  `;
})()}

      </div>
    `).join('') || '<p class="muted">ยังไม่มี Ticket</p>';

    document.querySelectorAll('[data-ticket-send]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.ticketSend;
        const textarea = document.querySelector(`[data-ticket-reply="${id}"]`);
        const message = textarea?.value.trim() || '';

        if (!message) {
          alert('กรุณากรอกข้อความตอบกลับ');
          textarea?.focus();
          return;
        }

        btn.disabled = true;
        btn.textContent = 'กำลังส่ง...';

        try {
          await api(`/tickets/${id}/messages`, {
            method: 'POST',
            body: JSON.stringify({ message })
          });
          await loadTickets();
        } catch (err) {
          alert(err.message);
          btn.disabled = false;
          btn.textContent = 'ตอบกลับ';
        }
      });
    });
  } catch (err) {
    document.getElementById('tickets').innerHTML = `<div class="alert error">${escapeHtml(err.message)}</div>`;
  }
}

document.getElementById('ticket-form-element').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = new FormData(e.target);
  const btn = e.target.querySelector('button[type="submit"]');
  const msg = document.getElementById('msg');
  btn.disabled = true;
  btn.textContent = 'กำลังส่ง...';
  msg.innerHTML = '';
  try {
    await api('/tickets', {
      method: 'POST',
      body: JSON.stringify({
        subject: String(form.get('subject') || '').trim(),
        description: String(form.get('description') || '').trim(),
        issueType: String(form.get('issueType') || 'other'),
        computerId: form.get('computerId') ? Number(form.get('computerId')) : null
      })
    });
    msg.innerHTML = '<div class="alert ok">ส่ง Ticket แล้ว</div>';
    e.target.reset();
    await loadTickets();
  } catch (err) {
    msg.innerHTML = `<div class="alert error">${escapeHtml(err.message)}</div>`;
  } finally {
    btn.disabled = false;
    btn.textContent = 'ส่ง Ticket';
  }
});

await Promise.all([loadComputers(), loadTickets()]);
