# Online PC Rental System

เว็บแอปสำหรับเช่าคอมพิวเตอร์ออนไลน์ ลูกค้าสมัครสมาชิก เติมเงิน (Mock Payment) เลือกเครื่อง ชำระผ่าน Wallet แล้วรับข้อมูลเชื่อมต่อเครื่อง

เทคโนโลยี: HTML, CSS, JavaScript, Node.js, Express, Supabase PostgreSQL

## 1. ต้องมี

- Node.js 18 ขึ้นไป
- บัญชี Supabase และ Project 1 โปรเจกต์

## 2. ติดตั้งแพ็กเกจ

ที่โฟลเดอร์โปรเจกต์รัน:

```bash
npm install
```

โปรเจกต์นี้ใช้ `pg` สำหรับเชื่อมต่อ PostgreSQL ของ Supabase และไม่ใช้ `mysql2` แล้ว

## 3. สร้างฐานข้อมูลบน Supabase

เปิด Supabase Dashboard → Project → SQL Editor

เปิดไฟล์:

```text
database/schema.sql
```

คัดลอก SQL ทั้งหมดไปวางใน SQL Editor แล้วกด Run

ไฟล์นี้สร้างตารางทั้งหมด รวมถึง `support_ticket_message` สำหรับระบบตอบกลับ Ticket

## 4. ตั้งค่า `.env`

คัดลอกไฟล์ตัวอย่าง:

```bash
copy .env.example .env
```

จากนั้นเปิด `.env` และใส่ `DATABASE_URL` จาก Supabase โดยใช้ connection string ที่หน้า **Connect → Session pooler**

ตัวอย่างรูปแบบ:

```text
DATABASE_URL=postgresql://postgres.PROJECT_REF:YOUR_PASSWORD@YOUR_POOLER_HOST:5432/postgres
DB_SSL=true
```

อย่าใส่รหัสผ่านจริงลง Git

## 5. ใส่ข้อมูลตัวอย่าง

เมื่อสร้าง schema และตั้ง `.env` แล้ว ให้รัน:

```bash
npm run seed
```

คำสั่งนี้จะล้างตารางเดิมใน Supabase แล้วสร้างข้อมูลตัวอย่างใหม่

บัญชีทดสอบ:

- Admin: `admin@pcrental.com` / `Admin123!`
- Customer: `customer@pcrental.com` / `Customer123!`

## 6. Start Backend

```bash
npm start
```

หรือโหมดพัฒนา:

```bash
npm run dev
```

เซิร์ฟเวอร์จะเปิดที่:

```text
http://localhost:3000
```

ระบบมีตัวนับเวลาในเซิร์ฟเวอร์ทุก 5 วินาที เมื่อหมดเวลาเช่า Session จะถูกปิด เครื่องกลับเป็น Available และ Rental เป็น Completed

## 7. Flow หลัก

Customer: สมัคร → Login → เติมเงิน → เลือกเครื่อง → เช่า → ใช้งาน → ต่อเวลา → ประวัติ

Support Ticket: Customer สร้าง Ticket → Admin ตอบ → Customer ตอบ Ticket เดิม → Admin ตอบต่อ โดยลูกค้าจะต้องรอ Admin ตอบก่อนจึงส่งข้อความถัดไปได้

Admin: จัดการเครื่อง ลูกค้า การเช่า การจอง Wallet และ Support Ticket

## 8. โครงสร้างโปรเจกต์

```text
pc-rental-system/
├── frontend/          หน้าเว็บ HTML CSS JS
├── backend/           Express API
├── database/          schema.sql และ seed.js
├── .env.example
├── package.json
└── README.md
```

รหัสผ่านของผู้ใช้ถูกเก็บแบบ hash ด้วย bcrypt
