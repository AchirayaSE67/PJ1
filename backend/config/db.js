const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;

if (!connectionString) {
  throw new Error(
    'ยังไม่ได้ตั้งค่า DATABASE_URL สำหรับ Supabase PostgreSQL ในไฟล์ .env'
  );
}

function convertPlaceholders(sql) {
  let index = 0;
  return String(sql).replace(/\?/g, () => `$${++index}`);
}

function decorateResult(result) {
  const firstRow = result.rows && result.rows[0];
  const firstColumn = firstRow ? Object.keys(firstRow)[0] : null;

  result.insertId =
    firstColumn && firstRow[firstColumn] != null
      ? Number(firstRow[firstColumn])
      : undefined;

  result.affectedRows = result.rowCount;
  return result;
}

function isSelectCommand(command, sql) {
  if (command === 'SELECT' || command === 'SHOW' || command === 'EXPLAIN') {
    return true;
  }

  // The project currently has no CTE reads, but keep this compatible if one is added later.
  return /^\s*WITH\b/i.test(sql);
}

function createQueryRunner(client) {
  return async function query(sql, params = []) {
    const text = convertPlaceholders(sql);
    const config = params.length ? { text, values: params } : { text };
    const result = decorateResult(await client.query(config));

    return isSelectCommand(result.command, text)
      ? [result.rows, result]
      : [result, result];
  };
}

const poolConfig = {
  connectionString,
  max: Number(process.env.DB_POOL_MAX || 10),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  options: '-c timezone=Asia/Bangkok'
};

if (process.env.DB_SSL === 'true') {
  poolConfig.ssl = { rejectUnauthorized: false };
} else if (process.env.DB_SSL === 'false') {
  poolConfig.ssl = false;
}

const pgPool = new Pool(poolConfig);

pgPool.on('error', (err) => {
  console.error('PostgreSQL pool error:', err.message);
});

const pool = {
  query: createQueryRunner(pgPool),

  async getConnection() {
    const client = await pgPool.connect();
    const query = createQueryRunner(client);

    return {
      query,
      beginTransaction: () => client.query('BEGIN'),
      commit: () => client.query('COMMIT'),
      rollback: () => client.query('ROLLBACK'),
      release: () => client.release()
    };
  },

  end: () => pgPool.end(),
  rawPool: pgPool
};

module.exports = pool;
