require('dotenv').config();

const mysql = require('mysql2/promise');
const { Client } = require('pg');

const TABLES = [
  { name: 'customer', pk: 'customer_id' },
  { name: 'wallet', pk: 'wallet_id' },
  { name: 'computer', pk: 'computer_id' },
  { name: 'reservation', pk: 'reservation_id' },
  { name: 'rental', pk: 'rental_id' },
  { name: 'session', pk: 'session_id' },
  { name: 'session_extension', pk: 'extension_id' },
  { name: 'wallet_transaction', pk: 'transaction_id' },
  { name: 'topup_payment', pk: 'topup_id' },
  { name: 'support_ticket', pk: 'ticket_id' },
  { name: 'support_ticket_message', pk: 'message_id' },
  { name: 'rating', pk: 'rating_id' }
];

// MySQL DATETIME has no timezone. Your project has been using Thailand local time,
// so this defaults to +07:00. Override with SOURCE_TIMEZONE_OFFSET when needed.
const SOURCE_TIMEZONE_OFFSET = process.env.SOURCE_TIMEZONE_OFFSET || '+07:00';
const CLEAR_DEST = String(process.env.MIGRATION_CLEAR_DEST || 'false').toLowerCase() === 'true';

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

function normalizeDatetime(value) {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString();

  const text = String(value).trim();
  if (!text) return null;

  // Already contains timezone information.
  if (/[zZ]|[+-]\d{2}:?\d{2}$/.test(text)) return text;

  // MySQL DATETIME: YYYY-MM-DD HH:mm:ss[.fraction]
  const normalized = text.replace(' ', 'T');
  return `${normalized}${SOURCE_TIMEZONE_OFFSET}`;
}

function normalizeValue(table, column, value) {
  if (value == null) return null;

  if (table === 'session' && column === 'connection_enabled') {
    return Number(value) === 1 || value === true;
  }

  const datetimeColumns = new Set([
    'created_at',
    'updated_at',
    'start_time',
    'end_time',
    'started_at',
    'ended_at',
    'slip_submitted_at',
    'reviewed_at',
    'expires_at',
    'paid_at'
  ]);

  if (datetimeColumns.has(column)) {
    return normalizeDatetime(value);
  }

  return value;
}

async function tableExists(mysqlConn, tableName) {
  const [rows] = await mysqlConn.query(
    `SELECT COUNT(*) AS count
     FROM information_schema.tables
     WHERE table_schema = DATABASE()
       AND table_name = ?`,
    [tableName]
  );
  return Number(rows[0].count) > 0;
}

async function getColumns(mysqlConn, tableName) {
  const [rows] = await mysqlConn.query(
    `SELECT COLUMN_NAME
     FROM information_schema.columns
     WHERE table_schema = DATABASE()
       AND table_name = ?
     ORDER BY ORDINAL_POSITION`,
    [tableName]
  );
  return rows.map((row) => row.COLUMN_NAME);
}

async function insertRows(pgClient, tableName, columns, rows) {
  if (!rows.length) return 0;

  const quotedColumns = columns.map((c) => `"${c}"`).join(', ');
  let inserted = 0;

  // Keep batches small so a very large table does not create one giant SQL statement.
  const batchSize = 250;

  for (let start = 0; start < rows.length; start += batchSize) {
    const batch = rows.slice(start, start + batchSize);
    const values = [];
    const tuples = batch.map((row, rowIndex) => {
      const placeholders = columns.map((column, columnIndex) => {
        values.push(normalizeValue(tableName, column, row[column]));
        return `$${rowIndex * columns.length + columnIndex + 1}`;
      });
      return `(${placeholders.join(', ')})`;
    }).join(', ');

    await pgClient.query(
      `INSERT INTO "${tableName}" (${quotedColumns}) VALUES ${tuples}`,
      values
    );

    inserted += batch.length;
  }

  return inserted;
}

async function syncSequence(pgClient, tableName, pk) {
  const sequenceQuery = `
    SELECT pg_get_serial_sequence($1, $2) AS sequence_name,
           MAX("${pk}") AS max_id
    FROM "${tableName}"
  `;

  const result = await pgClient.query(sequenceQuery, [tableName, pk]);
  const sequenceName = result.rows[0].sequence_name;
  const maxId = result.rows[0].max_id;

  if (!sequenceName) return;

  if (maxId == null) {
    await pgClient.query('SELECT setval($1, 1, false)', [sequenceName]);
  } else {
    await pgClient.query('SELECT setval($1, $2, true)', [sequenceName, Number(maxId)]);
  }
}

async function main() {
  const mysqlConn = await mysql.createConnection({
    host: process.env.LEGACY_DB_HOST || 'localhost',
    port: Number(process.env.LEGACY_DB_PORT || 3306),
    user: requireEnv('LEGACY_DB_USER'),
    password: process.env.LEGACY_DB_PASSWORD || '',
    database: process.env.LEGACY_DB_NAME || 'pc_rental',
    dateStrings: true
  });

  const pgClient = new Client({
    connectionString: requireEnv('DATABASE_URL'),
    ssl: String(process.env.DB_SSL || 'true').toLowerCase() === 'true'
      ? { rejectUnauthorized: false }
      : false
  });

  try {
    await pgClient.connect();
    await pgClient.query('SET TIME ZONE \'Asia/Bangkok\'');

    console.log('Source: MySQL', process.env.LEGACY_DB_NAME || 'pc_rental');
    console.log('Target: Supabase PostgreSQL');
    console.log(`Clear destination: ${CLEAR_DEST ? 'YES' : 'NO'}`);

    if (CLEAR_DEST) {
      // Reverse dependency order so foreign keys can be cleared safely.
      const reverse = [...TABLES].reverse().map((t) => `"${t.name}"`).join(', ');
      await pgClient.query(`TRUNCATE TABLE ${reverse} RESTART IDENTITY CASCADE`);
      console.log('Destination tables cleared.');
    }

    await pgClient.query('BEGIN');

    const summary = [];

    for (const table of TABLES) {
      const exists = await tableExists(mysqlConn, table.name);

      if (!exists) {
        console.log(`[SKIP] ${table.name} - source table does not exist`);
        summary.push({ table: table.name, source: 0, inserted: 0, status: 'skipped' });
        continue;
      }

      const columns = await getColumns(mysqlConn, table.name);
      const [rows] = await mysqlConn.query(`SELECT * FROM \`${table.name}\``);

      const inserted = await insertRows(pgClient, table.name, columns, rows);
      summary.push({ table: table.name, source: rows.length, inserted, status: 'ok' });
      console.log(`[OK] ${table.name}: ${rows.length} -> ${inserted}`);
    }

    for (const table of TABLES) {
      const exists = await tableExists(mysqlConn, table.name);
      if (!exists) continue;
      await syncSequence(pgClient, table.name, table.pk);
    }

    await pgClient.query('COMMIT');

    console.log('\nMigration complete.');
    console.table(summary);
  } catch (error) {
    try { await pgClient.query('ROLLBACK'); } catch (_) {}
    console.error('\nMigration failed. All destination inserts in this run were rolled back.');
    throw error;
  } finally {
    await mysqlConn.end();
    await pgClient.end();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
