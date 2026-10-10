const { Pool } = require('pg');

const required = {
  computer: ['computer_id', 'computer_code', 'cpu', 'ram', 'gpu', 'storage', 'price_per_hour', 'status'],
  customer: ['customer_id', 'email', 'password_hash', 'full_name', 'email_verified', 'role'],
  rating: ['customer_id'],
  rental: ['rental_id', 'reservation_id', 'customer_id', 'computer_id', 'price', 'status'],
  reservation: ['reservation_id', 'customer_id', 'status'],
  session: ['session_id', 'rental_id', 'status'],
  session_extension: ['session_id'],
  wallet: ['wallet_id', 'customer_id', 'balance'],
  wallet_transaction: ['wallet_id', 'rental_id', 'amount', 'method']
};

async function main() {
  const pool = new Pool({
    connectionString: process.env.TEST_DATABASE_URL,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 10000
  });

  try {
    const result = await pool.query(
      `SELECT table_name, column_name
       FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = ANY($1)
       ORDER BY table_name, ordinal_position`,
      [Object.keys(required)]
    );
    const actual = new Map();
    for (const row of result.rows) {
      if (!actual.has(row.table_name)) actual.set(row.table_name, new Set());
      actual.get(row.table_name).add(row.column_name);
    }

    const missing = [];
    for (const [table, columns] of Object.entries(required)) {
      if (!actual.has(table)) {
        missing.push(`table public.${table}`);
        continue;
      }
      for (const column of columns) {
        if (!actual.get(table).has(column)) missing.push(`column public.${table}.${column}`);
      }
    }

    if (missing.length) throw new Error(`Test database schema is missing: ${missing.join(', ')}`);
    console.log('Database preflight passed: required rental tables and columns are present.');
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  const rawMessage = String(error.message || error);
  const connectionString = process.env.TEST_DATABASE_URL;
  const message = connectionString ? rawMessage.replaceAll(connectionString, '[redacted]') : rawMessage;
  console.error(`Database preflight failed: ${message}`);
  process.exitCode = 1;
});
