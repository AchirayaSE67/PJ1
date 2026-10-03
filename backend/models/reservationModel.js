const pool = require('../config/db');

async function hasOverlap(conn, computerId, startTime, endTime, ignoreReservationId) {
  const sql = `
    SELECT reservation_id FROM reservation
    WHERE computer_id = ?
      AND status IN ('pending', 'confirmed')
      AND start_time < ?
      AND end_time > ?
      ${ignoreReservationId ? 'AND reservation_id <> ?' : ''}
  `;
  const params = ignoreReservationId
    ? [computerId, endTime, startTime, ignoreReservationId]
    : [computerId, endTime, startTime];
  const [rows] = await conn.query(sql, params);
  return rows.length > 0;
}

async function listAll() {
  const [rows] = await pool.query(`
    SELECT r.*, c.computer_code, cu.full_name, cu.email
    FROM reservation r
    JOIN computer c ON c.computer_id = r.computer_id
    JOIN customer cu ON cu.customer_id = r.customer_id
    ORDER BY r.start_time DESC
  `);
  return rows.map((row) => ({
    reservationId: row.reservation_id,
    customerId: row.customer_id,
    customerName: row.full_name,
    email: row.email,
    computerId: row.computer_id,
    computerCode: row.computer_code,
    startTime: row.start_time,
    endTime: row.end_time,
    hours: Number(row.hours),
    totalPrice: Number(row.total_price),
    status: row.status,
    createdAt: row.created_at
  }));
}

async function updateStatus(id, status) {
  await pool.query('UPDATE reservation SET status = ? WHERE reservation_id = ?', [status, id]);
}

module.exports = { hasOverlap, listAll, updateStatus };
