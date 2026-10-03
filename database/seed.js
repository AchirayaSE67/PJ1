require('dotenv').config();
const { Client } = require('pg');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

const connectionString = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;

if (!connectionString) {
  console.error('Seed ไม่สำเร็จ: ยังไม่ได้ตั้งค่า DATABASE_URL');
  process.exit(1);
}

const client = new Client({
  connectionString,
  options: '-c timezone=Asia/Bangkok',
  ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false }
});

async function run() {
  await client.connect();
  await client.query("SET TIME ZONE 'Asia/Bangkok'");
  await client.query('BEGIN');

  try {
    const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    await client.query(schema);

    const adminHash = await bcrypt.hash('Admin123!', 10);
    const customerHash = await bcrypt.hash('Customer123!', 10);

    const customerResult = await client.query(
      `INSERT INTO customer
        (email, password_hash, full_name, phone, role, time_balance_minutes)
       VALUES
        ($1, $2, $3, $4, 'admin', 0),
        ($5, $6, $7, $8, 'customer', 40)
       RETURNING customer_id, role`,
      [
        'admin@pcrental.com', adminHash, 'System Admin', '0800000000',
        'customer@pcrental.com', customerHash, 'สมชาย ทดสอบ', '0812345678'
      ]
    );

    const admin = customerResult.rows.find((row) => row.role === 'admin');
    const customer = customerResult.rows.find((row) => row.role === 'customer');

    await client.query(
      `INSERT INTO wallet (customer_id, balance)
       VALUES ($1, 0.00), ($2, 464.00)`,
      [admin.customer_id, customer.customer_id]
    );

    await client.query(`
      INSERT INTO computer
        (computer_code, cpu, ram, gpu, storage, price_per_hour, status, connection_address, connection_port, connection_method)
      VALUES
        ('PC-001', 'Ryzen 9 9800X3D', '32GB', 'RTX 5070 Ti', '512GB SSD', 25.00, 'available', '10.0.8.11', 3389, 'RDP'),
        ('PC-002', 'Intel i7-14700K', '32GB', 'RTX 4070', '1TB SSD', 20.00, 'available', '10.0.8.12', 3389, 'RDP'),
        ('PC-003', 'Ryzen 7 7800X3D', '16GB', 'RTX 4060', '512GB SSD', 15.00, 'available', '10.0.8.13', 3389, 'RDP'),
        ('PC-004', 'Intel i5-13400F', '16GB', 'RTX 3060', '512GB SSD', 12.00, 'in_use', '10.0.8.14', 3389, 'RDP'),
        ('PC-005', 'Ryzen 5 7600', '16GB', 'RTX 4060 Ti', '1TB SSD', 18.00, 'reserved', '10.0.8.15', 3389, 'RDP'),
        ('PC-006', 'Ryzen 9 7950X', '64GB', 'RTX 4090', '2TB SSD', 50.00, 'maintenance', '10.0.8.16', 3389, 'RDP')
    `);

    const computersResult = await client.query(
      `SELECT computer_id, computer_code
       FROM computer
       WHERE computer_code IN ('PC-004', 'PC-005')`
    );

    const pc004 = computersResult.rows.find((row) => row.computer_code === 'PC-004');
    const pc005 = computersResult.rows.find((row) => row.computer_code === 'PC-005');

    const now = new Date();
    const activeStart = new Date(now.getTime() - 20 * 60 * 1000);
    const activeEnd = new Date(now.getTime() + 2 * 60 * 60 * 1000 + 35 * 60 * 1000);
    const reservedStart = new Date(now.getTime() + 3 * 60 * 60 * 1000);
    const reservedEnd = new Date(reservedStart.getTime() + 2 * 60 * 60 * 1000);

    const res1 = await client.query(
      `INSERT INTO reservation
        (customer_id, computer_id, start_time, end_time, hours, total_price, status)
       VALUES ($1, $2, $3, $4, 3, 36.00, 'confirmed')
       RETURNING reservation_id`,
      [customer.customer_id, pc004.computer_id, activeStart, activeEnd]
    );

    const rental1 = await client.query(
      `INSERT INTO rental
        (reservation_id, customer_id, computer_id, start_time, end_time, hours, price, status)
       VALUES ($1, $2, $3, $4, $5, 3, 36.00, 'active')
       RETURNING rental_id`,
      [res1.rows[0].reservation_id, customer.customer_id, pc004.computer_id, activeStart, activeEnd]
    );

    await client.query(
      `INSERT INTO session
        (rental_id, started_at, status, connection_enabled)
       VALUES ($1, $2, 'active', TRUE)`,
      [rental1.rows[0].rental_id, activeStart]
    );

    const res2 = await client.query(
      `INSERT INTO reservation
        (customer_id, computer_id, start_time, end_time, hours, total_price, status)
       VALUES ($1, $2, $3, $4, 2, 36.00, 'confirmed')
       RETURNING reservation_id`,
      [customer.customer_id, pc005.computer_id, reservedStart, reservedEnd]
    );

    await client.query(
      `INSERT INTO rental
        (reservation_id, customer_id, computer_id, start_time, end_time, hours, price, status)
       VALUES ($1, $2, $3, $4, $5, 2, 36.00, 'reserved')`,
      [res2.rows[0].reservation_id, customer.customer_id, pc005.computer_id, reservedStart, reservedEnd]
    );

    const walletResult = await client.query(
      'SELECT wallet_id FROM wallet WHERE customer_id = $1',
      [customer.customer_id]
    );
    const walletId = walletResult.rows[0].wallet_id;

    await client.query(
      `INSERT INTO wallet_transaction
        (wallet_id, type, amount, description, method, status)
       VALUES ($1, 'topup', 500.00, 'เติมเงิน (Mock Payment)', 'mock', 'success')`,
      [walletId]
    );

    await client.query(
      `INSERT INTO wallet_transaction
        (wallet_id, type, amount, description, method, status, rental_id)
       VALUES ($1, 'rental', -36.00, 'ค่าเช่า PC-004', 'wallet', 'success', $2)`,
      [walletId, rental1.rows[0].rental_id]
    );

    await client.query(
      `INSERT INTO support_ticket
        (customer_id, computer_id, subject, description, issue_type, status)
       VALUES ($1, $2, 'เครื่องช้า', 'เกมกระตุกเป็นระยะ', 'performance', 'open')`,
      [customer.customer_id, pc004.computer_id]
    );

    await client.query('COMMIT');

    console.log('สร้างฐานข้อมูล Supabase และข้อมูลตัวอย่างเรียบร้อย');
    console.log('Admin: admin@pcrental.com / Admin123!');
    console.log('Customer: customer@pcrental.com / Customer123!');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    await client.end();
  }
}

run().catch((err) => {
  console.error('Seed ไม่สำเร็จ:', err.message);
  process.exit(1);
});
