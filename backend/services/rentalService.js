const crypto = require('crypto');
const pool = require('../config/db');
const reservationModel = require('../models/reservationModel');
const walletModel = require('../models/walletModel');
const computerModel = require('../models/computerModel');
const rentalModel = require('../models/rentalModel');
const customerModel = require('../models/customerModel');

// คีย์เข้าเครื่อง รูปแบบ XXXX-XXXX-XXXX สุ่มใหม่ทุกเซสชัน (ตัดตัวอักษรที่สับสน เช่น 0/O 1/I)
function genAccessKey() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(12);
  let out = '';
  for (let i = 0; i < 12; i++) {
    if (i && i % 4 === 0) out += '-';
    out += chars[bytes[i] % chars.length];
  }
  return out;
}

function parseDbDate(value) {
  if (value instanceof Date) return value;
  return new Date(String(value).replace(' ', 'T'));
}

function toDbDateTime(value) {
  const date = value instanceof Date ? value : parseDbDate(value);
  if (Number.isNaN(date.getTime())) {
    const error = new Error('รูปแบบวันเวลาไม่ถูกต้อง');
    error.status = 400;
    throw error;
  }
  return date;
}

function calcQuote(pricePerHour, hours, startTime) {
  const start = new Date(startTime);
  const hourCount = Number(hours);
  if (!Number.isSafeInteger(hourCount) || hourCount < 1) {
    const error = new Error('จำนวนชั่วโมงต้องเป็นจำนวนเต็มตั้งแต่ 1 ชั่วโมงขึ้นไป');
    error.status = 400;
    throw error;
  }
  const totalPrice = Number((pricePerHour * hourCount).toFixed(2));
  if (!Number.isFinite(totalPrice) || totalPrice > 99999999.99) {
    const error = new Error('จำนวนชั่วโมงสูงเกินกว่ายอดที่ระบบรองรับ');
    error.status = 400;
    throw error;
  }
  const end = new Date(start.getTime() + hourCount * 60 * 60 * 1000);
  return {
    hours: hourCount,
    startTime: start,
    endTime: end,
    totalPrice
  };
}

async function refreshComputerStatus(conn, computerId) {
  const [active] = await conn.query(
    `SELECT rental_id FROM rental
     WHERE computer_id = ? AND status = 'active' AND start_time <= CURRENT_TIMESTAMP AND end_time > CURRENT_TIMESTAMP`,
    [computerId]
  );
  if (active.length) {
    await computerModel.setStatus(conn, computerId, 'in_use');
    return;
  }
  const [reserved] = await conn.query(
    `SELECT rental_id FROM rental
     WHERE computer_id = ? AND status = 'reserved' AND start_time > CURRENT_TIMESTAMP`,
    [computerId]
  );
  if (reserved.length) {
    await computerModel.setStatus(conn, computerId, 'reserved');
    return;
  }
  const [computer] = await conn.query('SELECT status FROM computer WHERE computer_id = ?', [computerId]);
  if (computer[0] && computer[0].status !== 'maintenance') {
    await computerModel.setStatus(conn, computerId, 'available');
  }
}

async function book({ customerId, computerId, hours, startTime }) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [computers] = await conn.query(
      'SELECT * FROM computer WHERE computer_id = ? FOR UPDATE',
      [computerId]
    );
    const computer = computers[0];
    if (!computer) {
      const error = new Error('ไม่พบเครื่องคอมพิวเตอร์');
      error.status = 404;
      throw error;
    }
    if (computer.status === 'maintenance') {
      const error = new Error('เครื่องนี้ปิดปรับปรุง ไม่สามารถเช่าได้');
      error.status = 400;
      throw error;
    }

    // ไม่มีระบบจอง: เริ่มนับเวลา ณ ตอนที่ยืนยัน (ใช้เวลาของเซิร์ฟเวอร์ ไม่ใช้เวลาจากหน้าเว็บ)
    const quote = calcQuote(Number(computer.price_per_hour), hours, new Date());
    const startSql = toDbDateTime(quote.startTime);
    const endSql = toDbDateTime(quote.endTime);

    const overlapped = await reservationModel.hasOverlap(conn, computerId, startSql, endSql);
    if (overlapped) {
      const error = new Error('ช่วงเวลาที่เลือกถูกจองแล้ว');
      error.status = 400;
      throw error;
    }

    const [wallets] = await conn.query(
      'SELECT * FROM wallet WHERE customer_id = ? FOR UPDATE',
      [customerId]
    );
    const wallet = wallets[0];

    const [resResult] = await conn.query(
      `INSERT INTO reservation (customer_id, computer_id, start_time, end_time, hours, total_price, status)
       VALUES (?, ?, ?, ?, ?, ?, 'confirmed') RETURNING reservation_id`,
      [customerId, computerId, startSql, endSql, quote.hours, quote.totalPrice]
    );

    const startsNow = quote.startTime.getTime() <= Date.now() + 60 * 1000;
    const rentalStatus = startsNow ? 'active' : 'reserved';

    const [rentalResult] = await conn.query(
      `INSERT INTO rental (reservation_id, customer_id, computer_id, start_time, end_time, hours, price, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING rental_id`,
      [resResult.insertId, customerId, computerId, startSql, endSql, quote.hours, quote.totalPrice, rentalStatus]
    );

    if (startsNow) {
      await conn.query(
        `INSERT INTO session (rental_id, started_at, status, connection_enabled)
         VALUES (?, ?, 'active', TRUE)`,
        [rentalResult.insertId, startSql]
      );
    }

    await walletModel.deductForRental(
      conn,
      wallet.wallet_id,
      quote.totalPrice,
      `ค่าเช่า ${computer.computer_code}`,
      rentalResult.insertId
    );

    await refreshComputerStatus(conn, computerId);
    await conn.commit();
    return rentalModel.findById(rentalResult.insertId);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function extendTime(customerId, rentalId, minutes) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [rentals] = await conn.query(
      `SELECT r.*, c.computer_code, c.price_per_hour
       FROM rental r
       JOIN computer c ON c.computer_id = r.computer_id
       WHERE r.rental_id = ? AND r.customer_id = ?
       FOR UPDATE`,
      [rentalId, customerId]
    );
    const rental = rentals[0];
    if (!rental || rental.status !== 'active') {
      const error = new Error('รายการเช่านี้ไม่ได้กำลังใช้งานอยู่');
      error.status = 400;
      throw error;
    }

    const currentEnd = parseDbDate(rental.end_time);
    if (currentEnd.getTime() <= Date.now()) {
      const error = new Error('เซสชันหมดเวลาแล้ว ไม่สามารถต่อเวลาได้');
      error.status = 400;
      throw error;
    }

    const addedMinutes = Number(minutes);
    const cost = Number(((Number(rental.price_per_hour) * addedMinutes) / 60).toFixed(2));
    const newEnd = new Date(currentEnd.getTime() + addedMinutes * 60 * 1000);
    const newEndSql = toDbDateTime(newEnd);

    const overlapped = await reservationModel.hasOverlap(
      conn,
      rental.computer_id,
      toDbDateTime(currentEnd),
      newEndSql,
      rental.reservation_id
    );
    if (overlapped) {
      const error = new Error('ไม่สามารถต่อเวลาได้ เพราะมีการจองเครื่องนี้ต่อจากเวลาปัจจุบันแล้ว');
      error.status = 400;
      throw error;
    }

    const [wallets] = await conn.query(
      'SELECT * FROM wallet WHERE customer_id = ? FOR UPDATE',
      [customerId]
    );
    const wallet = wallets[0];
    if (!wallet) {
      const error = new Error('ไม่พบ Wallet ของผู้ใช้');
      error.status = 400;
      throw error;
    }
    const balance = Number(wallet.balance);
    if (balance < cost) {
      const error = new Error(`ยอดเงินไม่เพียงพอ ต้องใช้ ${cost.toFixed(2)} บาท แต่มี ${balance.toFixed(2)} บาท`);
      error.status = 400;
      throw error;
    }

    const [sessions] = await conn.query(
      `SELECT * FROM session WHERE rental_id = ? AND status = 'active' FOR UPDATE`,
      [rentalId]
    );
    const session = sessions[0];
    if (!session) {
      const error = new Error('ไม่พบเซสชันที่กำลังใช้งาน');
      error.status = 400;
      throw error;
    }

    await conn.query(
      'UPDATE wallet SET balance = balance - ? WHERE wallet_id = ?',
      [cost, wallet.wallet_id]
    );
    await conn.query(
      `INSERT INTO wallet_transaction (wallet_id, type, amount, description, method, status, rental_id)
       VALUES (?, 'rental', ?, ?, 'wallet', 'success', ?)`,
      [wallet.wallet_id, -cost, `ต่อเวลา ${rental.computer_code} +${addedMinutes} นาที`, rentalId]
    );

    await conn.query(
      `UPDATE rental
       SET end_time = ?, hours = hours + ?, price = price + ?
       WHERE rental_id = ?`,
      [newEndSql, addedMinutes / 60, cost, rentalId]
    );
    await conn.query(
      `UPDATE reservation
       SET end_time = ?, hours = hours + ?, total_price = total_price + ?
       WHERE reservation_id = ?`,
      [newEndSql, addedMinutes / 60, cost, rental.reservation_id]
    );
    await conn.query(
      `INSERT INTO session_extension (session_id, type, minutes, note)
       VALUES (?, 'extend', ?, ?)`,
      [session.session_id, addedMinutes, `ต่อเวลา ${rental.computer_code} เพิ่ม ${addedMinutes} นาที`]
    );

    await conn.commit();
    const updatedRental = await rentalModel.findById(rentalId);
    return {
      rental: updatedRental,
      balance: Number((balance - cost).toFixed(2)),
      cost
    };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function saveTime(customerId, rentalId) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rentals] = await conn.query(
      'SELECT * FROM rental WHERE rental_id = ? AND customer_id = ? FOR UPDATE',
      [rentalId, customerId]
    );
    const rental = rentals[0];
    if (!rental || rental.status !== 'active') {
      const error = new Error('ไม่พบเซสชันที่กำลังใช้งาน');
      error.status = 400;
      throw error;
    }

    const remainingMs = parseDbDate(rental.end_time).getTime() - Date.now();
    const remainingMinutes = Math.max(0, Math.ceil(remainingMs / 60000));
    const remainingSeconds = Math.max(0, Math.floor(remainingMs / 1000));

    const [sessions] = await conn.query(
      `SELECT * FROM session WHERE rental_id = ? AND status = 'active' FOR UPDATE`,
      [rentalId]
    );
    const session = sessions[0];
    if (session) {
      await conn.query(
        `UPDATE session SET status = 'saved', ended_at = CURRENT_TIMESTAMP, remaining_seconds = ?, connection_enabled = FALSE
         WHERE session_id = ?`,
        [remainingSeconds, session.session_id]
      );
      await conn.query(
        `INSERT INTO session_extension (session_id, type, minutes, note)
         VALUES (?, 'save_time', ?, 'เก็บเวลาที่เหลือกลับเข้า Time Balance')`,
        [session.session_id, remainingMinutes]
      );
    }

    await conn.query(
      `UPDATE rental SET status = 'saved', remaining_minutes = ?, end_time = CURRENT_TIMESTAMP WHERE rental_id = ?`,
      [remainingMinutes, rentalId]
    );
    await conn.query(
      `UPDATE reservation SET status = 'completed', end_time = CURRENT_TIMESTAMP WHERE reservation_id = ?`,
      [rental.reservation_id]
    );
    await customerModel.addTimeBalance(conn, customerId, remainingMinutes);
    await refreshComputerStatus(conn, rental.computer_id);
    await conn.commit();
    return {
      remainingMinutes,
      rental: await rentalModel.findById(rentalId)
    };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function endUsage(customerId, rentalId) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.query(
      `SELECT r.*, s.session_id
       FROM rental r
       LEFT JOIN session s ON s.rental_id = r.rental_id AND s.status = 'active'
       WHERE r.rental_id = ? AND r.customer_id = ?
       FOR UPDATE OF r`,
      [rentalId, customerId]
    );
    const rental = rows[0];
    if (!rental || rental.status !== 'active') {
      const error = new Error('รายการนี้ไม่ได้กำลังใช้งานอยู่');
      error.status = 400;
      throw error;
    }

    const session = rental.session_id;
    if (session) {
      await conn.query(
        `UPDATE session SET status='ended', ended_at=CURRENT_TIMESTAMP, remaining_seconds=0, connection_enabled=FALSE WHERE session_id=?`,
        [session]
      );
    }
    await conn.query(
      `UPDATE rental SET status='completed', remaining_minutes=0, end_time=CURRENT_TIMESTAMP WHERE rental_id=?`,
      [rentalId]
    );
    await conn.query(
      `UPDATE reservation SET status='completed', end_time=CURRENT_TIMESTAMP WHERE reservation_id=?`,
      [rental.reservation_id]
    );
    await refreshComputerStatus(conn, rental.computer_id);
    await conn.commit();
    return rentalModel.findById(rentalId);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

// ผู้เช่ากด "เปิดเครื่อง" -> คืนคีย์เข้าเครื่องของเซสชันที่กำลังใช้งาน (สร้างให้ถ้ายังไม่มี)
async function openMachine(customerId, rentalId) {
  const [rows] = await pool.query(
    `SELECT r.rental_id, r.end_time, c.computer_code, c.connection_method,
            s.session_id, s.access_key, s.connection_enabled
     FROM rental r
     JOIN computer c ON c.computer_id = r.computer_id
     LEFT JOIN session s ON s.rental_id = r.rental_id AND s.status = 'active'
     WHERE r.rental_id = ? AND r.customer_id = ? AND r.status = 'active' AND r.end_time > CURRENT_TIMESTAMP`,
    [rentalId, customerId]
  );
  const row = rows[0];
  if (!row || !row.session_id || !row.connection_enabled) {
    const error = new Error('รายการนี้ยังไม่เริ่มใช้งานหรือหมดเวลาแล้ว');
    error.status = 400;
    throw error;
  }
  let key = row.access_key;
  if (!key) {
    key = genAccessKey();
    await pool.query(
      'UPDATE session SET access_key = ? WHERE session_id = ? AND access_key IS NULL',
      [key, row.session_id]
    );
    const [again] = await pool.query('SELECT access_key FROM session WHERE session_id = ?', [row.session_id]);
    key = again[0].access_key;
  }
  return {
    accessKey: key,
    computerCode: row.computer_code,
    connectionMethod: row.connection_method,
    endTime: row.end_time
  };
}

async function expireDueRentals() {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [due] = await conn.query(
      `SELECT * FROM rental WHERE status = 'active' AND end_time <= CURRENT_TIMESTAMP`
    );
    for (const rental of due) {
      await conn.query(
        `UPDATE session SET status = 'ended', ended_at = CURRENT_TIMESTAMP, remaining_seconds = 0, connection_enabled = FALSE
         WHERE rental_id = ? AND status = 'active'`,
        [rental.rental_id]
      );
      await conn.query(
        `UPDATE rental SET status = 'completed', remaining_minutes = 0 WHERE rental_id = ?`,
        [rental.rental_id]
      );
      await conn.query(
        `UPDATE reservation SET status = 'completed' WHERE reservation_id = ?`,
        [rental.reservation_id]
      );
      await refreshComputerStatus(conn, rental.computer_id);
    }

    const [toStart] = await conn.query(
      `SELECT * FROM rental WHERE status = 'reserved' AND start_time <= CURRENT_TIMESTAMP AND end_time > CURRENT_TIMESTAMP`
    );
    for (const rental of toStart) {
      await conn.query(`UPDATE rental SET status = 'active' WHERE rental_id = ?`, [rental.rental_id]);
      const [existing] = await conn.query(
        `SELECT session_id FROM session WHERE rental_id = ? AND status = 'active'`,
        [rental.rental_id]
      );
      if (!existing.length) {
        await conn.query(
          `INSERT INTO session (rental_id, started_at, status, connection_enabled)
           VALUES (?, CURRENT_TIMESTAMP, 'active', TRUE)`,
          [rental.rental_id]
        );
      }
      await refreshComputerStatus(conn, rental.computer_id);
    }
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    console.error('session job error:', err.message);
  } finally {
    conn.release();
  }
}

function startSessionWatcher() {
  expireDueRentals();
  setInterval(expireDueRentals, 5000);
}

module.exports = {
  calcQuote,
  book,
  extendTime,
  saveTime,
  endUsage,
  openMachine,
  startSessionWatcher
};
