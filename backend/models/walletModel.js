const pool = require('../config/db');

async function findByCustomerId(customerId) {
  const [rows] = await pool.query('SELECT * FROM wallet WHERE customer_id = ?', [customerId]);
  return rows[0] || null;
}

async function listTransactions(walletId) {
  const [rows] = await pool.query(
    'SELECT * FROM wallet_transaction WHERE wallet_id = ? ORDER BY created_at DESC',
    [walletId]
  );
  return rows.map((row) => ({
    transactionId: row.transaction_id,
    type: row.type,
    amount: Number(row.amount),
    description: row.description,
    method: row.method,
    status: row.status,
    rentalId: row.rental_id,
    createdAt: row.created_at
  }));
}

async function listTopups(walletId) {
  const [rows] = await pool.query(
    `SELECT * FROM wallet_transaction
     WHERE wallet_id = ? AND type = 'topup'
     ORDER BY created_at DESC`,
    [walletId]
  );
  return rows.map((row) => ({
    transactionId: row.transaction_id,
    amount: Number(row.amount),
    method: row.method,
    status: row.status,
    createdAt: row.created_at
  }));
}

async function topUp(customerId, amount) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [wallets] = await conn.query(
      'SELECT * FROM wallet WHERE customer_id = ? FOR UPDATE',
      [customerId]
    );
    const wallet = wallets[0];
    await conn.query('UPDATE wallet SET balance = balance + ? WHERE wallet_id = ?', [amount, wallet.wallet_id]);
    await conn.query(
      `INSERT INTO wallet_transaction (wallet_id, type, amount, description, method, status)
       VALUES (?, 'topup', ?, 'เติมเงิน (Mock Payment)', 'mock', 'success')`,
      [wallet.wallet_id, amount]
    );
    await conn.commit();
    const [updated] = await conn.query('SELECT * FROM wallet WHERE wallet_id = ?', [wallet.wallet_id]);
    return updated[0];
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function deductForRental(conn, walletId, amount, description, rentalId) {
  const [wallets] = await conn.query('SELECT * FROM wallet WHERE wallet_id = ? FOR UPDATE', [walletId]);
  const wallet = wallets[0];
  const balance = Number(wallet.balance);
  if (balance < amount) {
    const error = new Error('ยอดเงินใน Wallet ไม่เพียงพอ');
    error.status = 400;
    throw error;
  }
  await conn.query('UPDATE wallet SET balance = balance - ? WHERE wallet_id = ?', [amount, walletId]);
  await conn.query(
    `INSERT INTO wallet_transaction (wallet_id, type, amount, description, method, status, rental_id)
     VALUES (?, 'rental', ?, ?, 'wallet', 'success', ?)`,
    [walletId, -amount, description, rentalId]
  );
}

async function listAllTransactions() {
  const [rows] = await pool.query(`
    SELECT t.*, c.full_name, c.email
    FROM wallet_transaction t
    JOIN wallet w ON w.wallet_id = t.wallet_id
    JOIN customer c ON c.customer_id = w.customer_id
    ORDER BY t.created_at DESC
  `);
  return rows.map((row) => ({
    transactionId: row.transaction_id,
    type: row.type,
    amount: Number(row.amount),
    description: row.description,
    method: row.method,
    status: row.status,
    customerName: row.full_name,
    email: row.email,
    createdAt: row.created_at
  }));
}

module.exports = {
  findByCustomerId,
  listTransactions,
  listTopups,
  topUp,
  deductForRental,
  listAllTransactions
};
