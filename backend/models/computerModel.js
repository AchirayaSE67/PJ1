const pool = require('../config/db');
const { mapComputer } = require('../config/mappers');

const remainingJoin = `
  SELECT c.*,
    r.rental_id AS active_rental_id,
    r.start_time AS active_start_time,
    r.end_time AS active_end_time,
    cu.full_name AS active_customer_name,
    (SELECT COUNT(*) FROM rental rr WHERE rr.computer_id = c.computer_id) AS rental_count,
    (SELECT COALESCE(AVG(rt.score), 0) FROM rating rt WHERE rt.computer_id = c.computer_id) AS rating_avg,
    GREATEST(
      EXTRACT(EPOCH FROM (r.end_time - CURRENT_TIMESTAMP))::integer,
      0
    ) AS remaining_seconds
  FROM computer c
  LEFT JOIN (
    SELECT computer_id, rental_id, customer_id, start_time, end_time
    FROM rental
    WHERE status = 'active'
      AND start_time <= CURRENT_TIMESTAMP
      AND end_time > CURRENT_TIMESTAMP
  ) r ON r.computer_id = c.computer_id
  LEFT JOIN customer cu ON cu.customer_id = r.customer_id
`;

async function listAll() {
  const [rows] = await pool.query(`${remainingJoin} ORDER BY c.computer_code`);
  return rows.map(mapComputer);
}

async function findById(id) {
  const [rows] = await pool.query(`${remainingJoin} WHERE c.computer_id = ?`, [id]);
  return mapComputer(rows[0]);
}

async function create(data) {
  const [result] = await pool.query(
    `INSERT INTO computer
      (computer_code, cpu, ram, gpu, storage, price_per_hour, status, connection_address, connection_port, connection_method)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING computer_id`,
    [
      data.computerCode,
      data.cpu,
      data.ram,
      data.gpu,
      data.storage,
      data.pricePerHour,
      data.status || 'available',
      data.connectionAddress || '10.0.8.10',
      data.connectionPort || 3389,
      data.connectionMethod || 'RDP'
    ]
  );
  return findById(result.insertId);
}

async function update(id, data) {
  await pool.query(
    `UPDATE computer SET
      computer_code = ?, cpu = ?, ram = ?, gpu = ?, storage = ?,
      price_per_hour = ?, status = ?, connection_address = ?,
      connection_port = ?, connection_method = ?
     WHERE computer_id = ?`,
    [
      data.computerCode,
      data.cpu,
      data.ram,
      data.gpu,
      data.storage,
      data.pricePerHour,
      data.status,
      data.connectionAddress,
      data.connectionPort,
      data.connectionMethod,
      id
    ]
  );
  return findById(id);
}

async function remove(id) {
  await pool.query('DELETE FROM computer WHERE computer_id = ?', [id]);
}

async function setStatus(conn, computerId, status) {
  await conn.query('UPDATE computer SET status = ? WHERE computer_id = ?', [status, computerId]);
}

module.exports = {
  listAll,
  findById,
  create,
  update,
  remove,
  setStatus
};
