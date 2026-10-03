-- รันใน Supabase SQL Editor 1 ครั้ง (สำหรับฐานข้อมูลที่สร้างไว้แล้ว)
ALTER TABLE session ADD COLUMN IF NOT EXISTS access_key VARCHAR(20) UNIQUE;
