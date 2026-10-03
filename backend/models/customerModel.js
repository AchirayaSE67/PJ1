const pool = require('../config/db');
const { mapCustomer } = require('../config/mappers');

async function findByEmail(email) {
  const [rows] = await pool.query('SELECT * FROM customer WHERE email = ?', [email]);
  return rows[0] || null;
}

async function findById(id) {
  const [rows] = await pool.query('SELECT * FROM customer WHERE customer_id = ?', [id]);
  return rows[0] || null;
}

async function create({ email, passwordHash, fullName }) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [result] = await conn.query(
      `INSERT INTO customer (email, password_hash, full_name, role, email_verified)
       VALUES (?, ?, ?, 'customer', FALSE) RETURNING customer_id`,
      [email, passwordHash, fullName]
    );
    await conn.query(
      'INSERT INTO wallet (customer_id, balance) VALUES (?, 0.00)',
      [result.insertId]
    );
    await conn.commit();
    return findById(result.insertId);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function updateProfile(id, { fullName }) {
  await pool.query(
    'UPDATE customer SET full_name = ? WHERE customer_id = ?',
    [fullName, id]
  );
  return findById(id);
}

async function updatePassword(id, passwordHash) {
  await pool.query('UPDATE customer SET password_hash = ? WHERE customer_id = ?', [passwordHash, id]);
}

async function setEmailVerified(id) {
  await pool.query('UPDATE customer SET email_verified = TRUE WHERE customer_id = ?', [id]);
}

async function addTimeBalance(conn, customerId, minutes) {
  await conn.query(
    'UPDATE customer SET time_balance_minutes = time_balance_minutes + ? WHERE customer_id = ?',
    [minutes, customerId]
  );
}

async function listAll() {
  const [rows] = await pool.query(
    `SELECT c.*, w.balance
     FROM customer c
     LEFT JOIN wallet w ON w.customer_id = c.customer_id
     ORDER BY c.customer_id DESC`
  );
  return rows.map((row) => ({
    ...mapCustomer(row),
    walletBalance: Number(row.balance || 0)
  }));
}

module.exports = {
  findByEmail,
  findById,
  create,
  updateProfile,
  updatePassword,
  setEmailVerified,
  addTimeBalance,
  listAll,
  mapCustomer
};
