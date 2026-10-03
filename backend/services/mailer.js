// ส่งอีเมลผ่าน Brevo API (HTTPS) — ใช้ได้บน Render แพ็กเกจฟรีที่บล็อกพอร์ต SMTP
// ถ้ายังไม่ได้ตั้ง BREVO_API_KEY จะพิมพ์ลิงก์ลงใน console แทน (สำหรับทดสอบในเครื่อง)

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function sendMail({ to, subject, html, text }) {
  const apiKey = process.env.BREVO_API_KEY;
  const fromEmail = process.env.MAIL_FROM_EMAIL;
  if (!apiKey || !fromEmail) {
    console.log(`[mail:dev] ยังไม่ได้ตั้งค่า BREVO_API_KEY / MAIL_FROM_EMAIL — ไม่ได้ส่งจริง\n  to: ${to}\n  subject: ${subject}\n  ${text}`);
    return { skipped: true };
  }
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': apiKey, 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({
      sender: { name: process.env.MAIL_FROM_NAME || 'SunFlowerPC', email: fromEmail },
      to: [{ email: to }],
      subject,
      htmlContent: html,
      textContent: text
    })
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Brevo ${res.status}: ${body.slice(0, 300)}`);
  }
  return { ok: true };
}

function layout(title, intro, buttonText, link, note) {
  return `<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px;color:#222">
  <h2 style="margin:0 0 12px">${escapeHtml(title)}</h2>
  <p>${intro}</p>
  <p style="margin:24px 0"><a href="${escapeHtml(link)}" style="background:#f5a623;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;display:inline-block">${escapeHtml(buttonText)}</a></p>
  <p style="font-size:13px;color:#666">หากปุ่มกดไม่ได้ ให้คัดลอกลิงก์นี้ไปเปิดในเบราว์เซอร์:<br>${escapeHtml(link)}</p>
  <p style="font-size:13px;color:#666">${note}</p></div>`;
}

function sendVerifyEmail(to, name, link) {
  return sendMail({
    to,
    subject: 'ยืนยันอีเมลของคุณ | SunFlowerPC',
    html: layout('ยืนยันอีเมล', `สวัสดีคุณ ${escapeHtml(name)} กรุณากดปุ่มด้านล่างเพื่อยืนยันอีเมล ลิงก์ใช้ได้ภายใน 24 ชั่วโมง`, 'ยืนยันอีเมล', link, 'หากคุณไม่ได้สมัครสมาชิก ไม่ต้องทำอะไร ปล่อยอีเมลนี้ไว้ได้เลย'),
    text: `ยืนยันอีเมลที่ลิงก์นี้ (ใช้ได้ 24 ชั่วโมง): ${link}`
  });
}

function sendResetEmail(to, name, link) {
  return sendMail({
    to,
    subject: 'ตั้งรหัสผ่านใหม่ | SunFlowerPC',
    html: layout('ตั้งรหัสผ่านใหม่', `สวัสดีคุณ ${escapeHtml(name)} มีคำขอตั้งรหัสผ่านใหม่สำหรับบัญชีนี้ กดปุ่มด้านล่างเพื่อดำเนินการ ลิงก์ใช้ได้ครั้งเดียวและหมดอายุใน 30 นาที`, 'ตั้งรหัสผ่านใหม่', link, 'หากคุณไม่ได้ขอ ไม่ต้องทำอะไร รหัสผ่านเดิมยังใช้ได้ตามปกติ'),
    text: `ตั้งรหัสผ่านใหม่ที่ลิงก์นี้ (ใช้ได้ครั้งเดียว หมดอายุใน 30 นาที): ${link}`
  });
}

module.exports = { sendMail, sendVerifyEmail, sendResetEmail };
