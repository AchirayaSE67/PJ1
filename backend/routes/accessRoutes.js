const express = require('express');
const crypto = require('crypto');
const pool = require('../config/db');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

function safeEqual(a, b) {
  const x = Buffer.from(String(a || ''));
  const y = Buffer.from(String(b || ''));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

// รับคีย์ได้ทั้งตัวพิมพ์เล็ก/ใหญ่ และมีหรือไม่มีขีด แล้วแปลงเป็น XXXX-XXXX-XXXX
function normalizeKey(input) {
  const raw = String(input || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (raw.length !== 12) return null;
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8)}`;
}

// ตรวจคีย์เข้าเครื่อง (ไว้ให้โปรแกรมบนเครื่องที่ให้เช่าเรียกในอนาคต)
// POST /api/access/verify
// header: x-agent-secret   body: { computerCode, key }
// คีย์ใช้ได้เมื่อ: เป็นของเครื่องนี้ + เซสชันยัง active + ยังไม่หมดเวลาเช่า
router.post('/verify', asyncHandler(async (req, res) => {
  const secret = process.env.AGENT_SECRET;
  if (!secret || !safeEqual(req.get('x-agent-secret'), secret)) {
    return res.status(401).json({ valid: false, message: 'unauthorized' });
  }
  const computerCode = String(req.body.computerCode || '').trim();
  const key = normalizeKey(req.body.key);
  if (!computerCode || !key) return res.json({ valid: false, reason: 'invalid_format' });

  const [rows] = await pool.query(
    `SELECT r.end_time
     FROM session s
     JOIN rental r ON r.rental_id = s.rental_id
     JOIN computer c ON c.computer_id = r.computer_id
     WHERE s.access_key = ? AND c.computer_code = ?
       AND s.status = 'active' AND s.connection_enabled = TRUE
       AND r.status = 'active' AND r.end_time > CURRENT_TIMESTAMP`,
    [key, computerCode]
  );
  if (!rows.length) return res.json({ valid: false, reason: 'not_found_or_expired' });
  res.json({ valid: true, expiresAt: rows[0].end_time });
}));

module.exports = router;
