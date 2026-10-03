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

// โปรแกรมบนเครื่องที่ให้เช่า (agent) เรียกตรวจคีย์ที่ผู้เช่าใส่
// POST /api/access/verify  header: x-agent-secret  body: { computerCode, key }
router.post('/verify', asyncHandler(async (req, res) => {
  const secret = process.env.AGENT_SECRET;
  if (!secret || !safeEqual(req.get('x-agent-secret'), secret)) {
    return res.status(401).json({ valid: false, message: 'unauthorized' });
  }
  const computerCode = String(req.body.computerCode || '').trim();
  const key = String(req.body.key || '').trim().toUpperCase();
  if (!computerCode || !key) return res.status(400).json({ valid: false, message: 'missing fields' });

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
  if (!rows.length) return res.json({ valid: false });
  res.json({ valid: true, expiresAt: rows[0].end_time });
}));

module.exports = router;
