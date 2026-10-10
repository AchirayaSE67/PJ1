const { before, after, test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

const baseUrl = String(process.env.TEST_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const databaseUrl = process.env.TEST_DATABASE_URL;
const runId = crypto.randomBytes(5).toString('hex');

assert.equal(process.env.TEST_DB_ISOLATED, 'yes', 'Tests not run: set TEST_DB_ISOLATED=yes only for a disposable test database');
assert.ok(databaseUrl, 'Tests not run: set TEST_DATABASE_URL to a disposable local PostgreSQL database');
const databaseHost = new URL(databaseUrl).hostname;
assert.ok(['localhost', '127.0.0.1', '::1', '[::1]'].includes(databaseHost), 'Tests not run: TEST_DATABASE_URL must point to local PostgreSQL, never the Render/Supabase database');
const hostname = new URL(baseUrl).hostname;
assert.ok(['localhost', '127.0.0.1', '::1', '[::1]'].includes(hostname), 'Tests not run: TEST_BASE_URL must point to a local test server');

let db;
let token;
let customerId;
let walletId;
let rentalId;
const computerIds = [];

async function api(path, { method = 'GET', body, auth = true } = {}) {
  const response = await fetch(`${baseUrl}/api${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(auth && token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(10000)
  });
  const data = await response.json().catch(() => ({}));
  return { status: response.status, data };
}

async function snapshot() {
  const result = await db.query(
    `SELECT
       (SELECT COUNT(*)::int FROM reservation WHERE customer_id = $1) AS reservations,
       (SELECT COUNT(*)::int FROM rental WHERE customer_id = $1) AS rentals,
       (SELECT COUNT(*)::int FROM session s JOIN rental r ON r.rental_id = s.rental_id WHERE r.customer_id = $1) AS sessions,
       (SELECT COUNT(*)::int FROM wallet_transaction WHERE wallet_id = $2) AS transactions,
       (SELECT balance FROM wallet WHERE wallet_id = $2) AS balance`,
    [customerId, walletId]
  );
  return result.rows[0];
}

async function rejectWithoutChanges(body, expectedMessage) {
  const beforeState = await snapshot();
  const result = await api('/rentals/book', { method: 'POST', body });
  assert.equal(result.status, 400, result.data.message);
  assert.match(result.data.message || '', expectedMessage);
  assert.deepEqual(await snapshot(), beforeState, 'Rejected booking changed database records or wallet balance');
}

before(async () => {
  db = new Pool({
    connectionString: databaseUrl,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 10000
  });

  const password = crypto.randomBytes(24).toString('base64url');
  const passwordHash = await bcrypt.hash(password, 10);
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const customer = await client.query(
      `INSERT INTO customer (email, password_hash, full_name, email_verified, role)
       VALUES ($1, $2, 'Rental API Test', TRUE, 'customer') RETURNING customer_id`,
      [`rental-test-${runId}@example.invalid`, passwordHash]
    );
    customerId = customer.rows[0].customer_id;

    const wallet = await client.query(
      'INSERT INTO wallet (customer_id, balance) VALUES ($1, 100.00) RETURNING wallet_id',
      [customerId]
    );
    walletId = wallet.rows[0].wallet_id;

    for (const [suffix, status] of [['A', 'available'], ['B', 'available'], ['M', 'maintenance']]) {
      const computer = await client.query(
        `INSERT INTO computer
         (computer_code, cpu, ram, gpu, storage, price_per_hour, status)
         VALUES ($1, 'Test CPU', '16GB', 'Test GPU', '512GB SSD', 25.00, $2)
         RETURNING computer_id`,
        [`T-${runId}-${suffix}`, status]
      );
      computerIds.push(computer.rows[0].computer_id);
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  const email = `rental-test-${runId}@example.invalid`;
  const login = await api('/auth/login', {
    method: 'POST', body: { email, password }, auth: false
  });
  assert.equal(login.status, 200, login.data.message || 'Test customer login failed');
  assert.ok(login.data.token, 'Login response has no token');
  token = login.data.token;
  assert.equal(Number(login.data.user.customerId), customerId, 'Server and test runner use different databases');
});

test('TC-01 creates and reads a rental with the correct database effects', async () => {
  const beforeState = await snapshot();
  const result = await api('/rentals/book', {
    method: 'POST',
    body: { computerId: computerIds[0], hours: 1, startTime: new Date().toISOString() }
  });

  assert.equal(result.status, 201, result.data.message);
  rentalId = result.data.rental?.rentalId;
  assert.ok(rentalId, 'Created rental has no ID');
  assert.equal(Number(result.data.rental.customerId), customerId);
  assert.equal(Number(result.data.rental.computerId), computerIds[0]);
  assert.equal(result.data.rental.status, 'active');

  const detail = await api(`/rentals/${rentalId}`);
  assert.equal(detail.status, 200, detail.data.message);
  assert.equal(Number(detail.data.rental.rentalId), Number(rentalId));
  assert.equal(Number(detail.data.rental.customerId), customerId);

  const computerDetail = await api(`/computers/${computerIds[0]}`, { auth: false });
  assert.equal(computerDetail.status, 200);
  assert.equal(computerDetail.data.computer.status, 'in_use');
  assert.equal(Number(computerDetail.data.computer.activeRentalId), Number(rentalId));

  const stored = await db.query(
    `SELECT r.reservation_id, r.status AS rental_status, r.price,
            v.status AS reservation_status, s.status AS session_status,
            t.amount AS transaction_amount,
            t.method AS transaction_method
     FROM rental r
     JOIN reservation v ON v.reservation_id = r.reservation_id
     JOIN session s ON s.rental_id = r.rental_id
     JOIN wallet_transaction t ON t.rental_id = r.rental_id
     WHERE r.rental_id = $1 AND r.customer_id = $2`,
    [rentalId, customerId]
  );
  assert.equal(stored.rowCount, 1, 'Expected one linked reservation, session, and wallet transaction');
  assert.equal(stored.rows[0].rental_status, 'active');
  assert.equal(stored.rows[0].reservation_status, 'confirmed');
  assert.equal(stored.rows[0].session_status, 'active');
  assert.equal(stored.rows[0].transaction_method, 'wallet');
  assert.equal(Number(stored.rows[0].price), 25);
  assert.equal(Number(stored.rows[0].transaction_amount), -25);

  const afterState = await snapshot();
  assert.equal(afterState.reservations, beforeState.reservations + 1);
  assert.equal(afterState.rentals, beforeState.rentals + 1);
  assert.equal(afterState.sessions, beforeState.sessions + 1);
  assert.equal(afterState.transactions, beforeState.transactions + 1);
  assert.equal(Number(afterState.balance), Number(beforeState.balance) - 25);
});

test('TC-02 rejects an unaffordable rental and rolls back all writes', async () => {
  await rejectWithoutChanges(
    { computerId: computerIds[1], hours: 5, startTime: new Date().toISOString() },
    /ไม่เพียงพอ/
  );
});

test('TC-03 rejects a computer in maintenance without charging the wallet', async () => {
  await rejectWithoutChanges(
    { computerId: computerIds[2], hours: 1, startTime: new Date().toISOString() },
    /ปิดปรับปรุง/
  );
});

test('TC-04 rejects missing computerId without creating a rental', async () => {
  await rejectWithoutChanges(
    { hours: 1, startTime: new Date().toISOString() },
    /เลือกเครื่อง/
  );
});

after(async () => {
  if (!db) return;
  try {
    if (rentalId && token) {
      try { await api(`/rentals/${rentalId}/end`, { method: 'POST' }); } catch { /* Cleanup continues below. */ }
    }
    if (!customerId) return;

    const client = await db.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM wallet_transaction WHERE wallet_id = $1', [walletId]);
      await client.query(
        'DELETE FROM session_extension WHERE session_id IN (SELECT s.session_id FROM session s JOIN rental r ON r.rental_id = s.rental_id WHERE r.customer_id = $1)',
        [customerId]
      );
      await client.query('DELETE FROM session WHERE rental_id IN (SELECT rental_id FROM rental WHERE customer_id = $1)', [customerId]);
      await client.query('DELETE FROM rating WHERE customer_id = $1', [customerId]);
      await client.query('DELETE FROM rental WHERE customer_id = $1', [customerId]);
      await client.query('DELETE FROM reservation WHERE customer_id = $1', [customerId]);
      await client.query('DELETE FROM wallet WHERE customer_id = $1', [customerId]);
      for (const computerId of computerIds) {
        await client.query('DELETE FROM computer WHERE computer_id = $1', [computerId]);
      }
      await client.query('DELETE FROM customer WHERE customer_id = $1', [customerId]);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } finally {
    await db.end();
  }
});
