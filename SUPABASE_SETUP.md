# Supabase setup

1. สร้าง Supabase Project
2. ไปที่ **Connect** และคัดลอก connection string ของ **Session pooler (port 5432)**
3. สร้าง `.env` จาก `.env.example`
4. ใส่ connection string ลงใน `DATABASE_URL`
5. เปิด Supabase **SQL Editor** แล้วรัน `database/schema.sql`
6. ใน Terminal ของโปรเจกต์รัน `npm.cmd install`
7. รัน `npm.cmd run seed`
8. รัน `npm.cmd start`

หมายเหตุ: การเปลี่ยนครั้งนี้ย้ายฐานข้อมูลของแอปไปเป็น Supabase PostgreSQL แล้ว แต่ไม่ได้ย้ายข้อมูลที่อยู่ใน MySQL เครื่องเดิมโดยอัตโนมัติ เพราะต้องใช้ connection ของ Supabase ของผู้ใช้เองก่อน
