const pool = require('../config/db');
const { mapRental } = require('../config/mappers');

const rentalSelect = `
  SELECT r.*, c.computer_code, c.connection_address, c.connection_port, c.connection_method,
         s.session_id, s.connection_enabled, s.access_key,
         GREATEST(EXTRACT(EPOCH FROM (r.end_time - CURRENT_TIMESTAMP))::integer, 0) AS remaining_seconds
  FROM rental r
  JOIN computer c ON c.computer_id = r.computer_id
  LEFT JOIN session s ON s.rental_id = r.rental_id AND s.status = 'active'
`;

async function findById(id) {
  const [rows] = await pool.query(`${rentalSelect} WHERE r.rental_id = ?`, [id]);
  return mapRental(rows[0]);
}

async function listByCustomer(customerId) {
  const [rows] = await pool.query(
    `${rentalSelect} WHERE r.customer_id = ? ORDER BY r.created_at DESC`,
    [customerId]
  );
  return rows.map(mapRental);
}

async function listAll() {
  const [rows] = await pool.query(`${rentalSelect} ORDER BY r.created_at DESC`);
  return rows.map(mapRental);
}

async function findActiveByCustomer(customerId) {
  const [rows] = await pool.query(
    `${rentalSelect}
     WHERE r.customer_id = ?
       AND r.status IN ('active', 'reserved')
     ORDER BY r.start_time`,
    [customerId]
  );
  return rows.map(mapRental);
}

module.exports = {
  findById,
  listByCustomer,
  listAll,
  findActiveByCustomer
};
