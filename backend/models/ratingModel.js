const pool = require('../config/db');

async function create({ rentalId, customerId, computerId, score, comment }) {
  const [result] = await pool.query(
    `INSERT INTO rating (rental_id, customer_id, computer_id, score, comment)
     VALUES (?, ?, ?, ?, ?) RETURNING rating_id`,
    [rentalId, customerId, computerId, score, comment || null]
  );
  return result.insertId;
}

module.exports = { create };
