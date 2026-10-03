import { renderNav } from '../nav.js';
import { api, requireLogin } from '../api.js';
import { formatDateTime, formatMoney, statusLabel } from '../format.js';

renderNav('wallet');
if (!requireLogin('/pages/wallet.html')) throw new Error('login');

let currentPaymentId = null;

function closePayment() {
  document.getElementById('payment-box').classList.add('hidden');
  currentPaymentId = null;
}

function showResult(success) {
  const modal = document.getElementById('payment-result');
  modal.classList.remove('hidden');
  modal.querySelector('.result-icon').textContent = success ? '✓' : '×';
  modal.querySelector('.result-title').textContent = success ? 'โอนเงินสำเร็จแล้ว' : 'โอนไม่สำเร็จ';
  modal.querySelector('.result-text').textContent = success
    ? 'ตรวจพบยอดเงินและเพิ่มเครดิตเข้าบัญชีเรียบร้อยแล้ว'
    : 'ไม่พบยอดเงินที่โอนเข้ามา จึงยังไม่ได้เพิ่มเครดิตให้บัญชี';
  modal.querySelector('.result-icon').classList.toggle('success', success);
  modal.querySelector('.result-icon').classList.toggle('failed', !success);
}

function showChecking() {
  const modal = document.getElementById('payment-checking');
  modal.classList.remove('hidden');
}

function hideChecking() {
  document.getElementById('payment-checking').classList.add('hidden');
}

async function reload() {
  try {
    const wallet = await api('/wallet');
    document.getElementById('balance').textContent = formatMoney(wallet.balance);
    document.getElementById('tx-body').innerHTML = wallet.transactions.map((t) => {
      const failed = ['failed','rejected','expired','cancelled'].includes(t.status);
      const sign = !failed && t.amount > 0 ? '+' : '';
      return `<tr><td>${formatDateTime(t.createdAt)}</td><td>${t.description}</td><td>${sign}${formatMoney(t.amount)}</td><td>${statusLabel(t.status)}</td></tr>`;
    }).join('') || '<tr><td colspan="4" class="muted">ยังไม่มีธุรกรรม</td></tr>';
  } catch (err) {
    document.getElementById('balance').textContent = '฿0.00';
    document.getElementById('tx-body').innerHTML = `<tr><td colspan="4"><div class="alert error">${err.message}</div></td></tr>`;
  }
}

async function chooseAmount(amount) {
  if (!Number.isFinite(amount) || amount < 10) {
    document.getElementById('msg').innerHTML = '<div class="alert error">กรุณาระบุจำนวนเงินอย่างน้อย 10 บาท</div>';
    return;
  }
  try {
    const result = await api('/wallet/topup', { method: 'POST', body: { amount } });
    currentPaymentId = result.payment.topupId;
    document.getElementById('msg').innerHTML = '';
    const box = document.getElementById('payment-box');
    box.classList.remove('hidden');
    document.getElementById('payment-amount').textContent = formatMoney(amount);
    document.getElementById('payment-amount-copy').textContent = formatMoney(amount);
    const qr = document.getElementById('payment-qr');
    qr.onerror = () => { qr.onerror = null; qr.src = '/assets/payment-qr.png'; };
    qr.src = result.payment.qrUrl || '/assets/payment-qr.png';
    box.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (err) {
    document.getElementById('msg').innerHTML = `<div class="alert error">${err.message}</div>`;
  }
}

document.querySelectorAll('[data-amount]').forEach((btn) => {
  btn.addEventListener('click', () => chooseAmount(Number(btn.dataset.amount)));
});

document.getElementById('topup-custom').addEventListener('click', () => {
  chooseAmount(Number(document.getElementById('custom-amount').value));
});

document.getElementById('payment-cancel').addEventListener('click', async () => {
  if (!currentPaymentId) return closePayment();
  try {
    await api(`/wallet/topup/${currentPaymentId}/cancel`, { method: 'POST' });
  } catch (err) {
    // ปิด QR ได้แม้ backend มีปัญหา เพื่อไม่ค้างหน้าชำระเงิน
  }
  closePayment();
  await reload();
});

document.getElementById('payment-confirm').addEventListener('click', async () => {
  if (!currentPaymentId) return;
  showChecking();
  try {
    const result = await api(`/wallet/topup/${currentPaymentId}/confirm`, { method: 'POST' });
    setTimeout(async () => {
      hideChecking();
      showResult(result.success);
      await reload();
    }, 1200);
  } catch (err) {
    setTimeout(() => {
      hideChecking();
      showResult(false);
    }, 1200);
  }
});

document.getElementById('payment-result-close').addEventListener('click', () => {
  document.getElementById('payment-result').classList.add('hidden');
  closePayment();
});

await reload();
