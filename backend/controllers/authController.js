const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const customerModel = require('../models/customerModel');
const emailTokenModel = require('../models/emailTokenModel');
const mailer = require('../services/mailer');
const { asyncHandler } = require('../middleware/errorHandler');

const VERIFY_MINUTES = 24 * 60;
const RESET_MINUTES = 30;

function signToken(customer) {
  return jwt.sign(
    {
      customerId: customer.customer_id,
      email: customer.email,
      role: customer.role
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES || '7d' }
  );
}

function baseUrl(req) {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/+$/, '');
  const proto = req.headers['x-forwarded-proto'] || req.protocol;
  return `${String(proto).split(',')[0]}://${req.get('host')}`;
}

// ส่งอีเมลยืนยัน (ไม่ throw — ถ้าส่งไม่ออกแค่ log เพื่อไม่ให้การสมัครล้มเหลว)
async function issueVerification(req, customer) {
  try {
    if (await emailTokenModel.recentlyIssued(customer.customer_id, 'verify')) return false;
    const raw = await emailTokenModel.create(customer.customer_id, 'verify', VERIFY_MINUTES);
    await mailer.sendVerifyEmail(customer.email, customer.full_name, `${baseUrl(req)}/pages/verify-email.html?token=${raw}`);
    return true;
  } catch (err) {
    console.error('ส่งอีเมลยืนยันไม่สำเร็จ:', err.message);
    return false;
  }
}

const register = asyncHandler(async (req, res) => {
  const email = String(req.body.email || '').trim();
  const { password, fullName } = req.body;
  if (!email || !password || !fullName) {
    return res.status(400).json({ message: 'กรอกอีเมล รหัสผ่าน และชื่อให้ครบ' });
  }
  if (String(password).length < 6) {
    return res.status(400).json({ message: 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร' });
  }
  const existing = await customerModel.findByEmail(email);
  if (existing) {
    return res.status(400).json({ message: 'อีเมลนี้ถูกใช้แล้ว' });
  }
  const passwordHash = await bcrypt.hash(password, 10);
  let customer;
  try {
    customer = await customerModel.create({ email, passwordHash, fullName });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ message: 'อีเมลนี้ถูกใช้แล้ว' });
    }
    throw err;
  }
  await issueVerification(req, customer);
  const token = signToken(customer);
  res.status(201).json({
    token,
    user: customerModel.mapCustomer(customer)
  });
});

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const customer = await customerModel.findByEmail(String(email || '').trim());
  if (!customer) {
    return res.status(400).json({ message: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' });
  }
  const ok = await bcrypt.compare(password || '', customer.password_hash);
  if (!ok) {
    return res.status(400).json({ message: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' });
  }
  const token = signToken(customer);
  res.json({
    token,
    user: customerModel.mapCustomer(customer)
  });
});

const me = asyncHandler(async (req, res) => {
  const customer = await customerModel.findById(req.user.customerId);
  res.json({ user: customerModel.mapCustomer(customer) });
});

const logout = asyncHandler(async (req, res) => {
  res.json({ message: 'ออกจากระบบแล้ว' });
});

// ---------- ลืมรหัสผ่าน ----------
const GENERIC_FORGOT = 'หากอีเมลนี้มีในระบบ เราได้ส่งลิงก์ตั้งรหัสผ่านใหม่ไปให้แล้ว (ลิงก์หมดอายุใน 30 นาที) กรุณาตรวจสอบกล่องจดหมายและจดหมายขยะ';

const forgotPassword = asyncHandler(async (req, res) => {
  const email = String(req.body.email || '').trim();
  if (!email) return res.status(400).json({ message: 'กรุณากรอกอีเมล' });

  // ตอบข้อความเดียวกันเสมอ และส่งอีเมลเบื้องหลัง เพื่อไม่ให้เดาได้ว่าอีเมลไหนสมัครไว้
  res.json({ message: GENERIC_FORGOT });

  try {
    const customer = await customerModel.findByEmail(email);
    if (!customer) return;
    if (await emailTokenModel.recentlyIssued(customer.customer_id, 'reset')) return;
    await emailTokenModel.invalidateAll(customer.customer_id, 'reset');
    const raw = await emailTokenModel.create(customer.customer_id, 'reset', RESET_MINUTES);
    await mailer.sendResetEmail(customer.email, customer.full_name, `${baseUrl(req)}/pages/reset-password.html?token=${raw}`);
  } catch (err) {
    console.error('ส่งอีเมลรีเซ็ตรหัสผ่านไม่สำเร็จ:', err.message);
  }
});

const resetPassword = asyncHandler(async (req, res) => {
  const { token, password } = req.body;
  if (!password || String(password).length < 6) {
    return res.status(400).json({ message: 'รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร' });
  }
  const customerId = await emailTokenModel.consume(token, 'reset');
  if (!customerId) {
    return res.status(400).json({ message: 'ลิงก์ไม่ถูกต้อง หมดอายุ หรือถูกใช้ไปแล้ว กรุณาขอลิงก์ใหม่' });
  }
  const hash = await bcrypt.hash(password, 10);
  await customerModel.updatePassword(customerId, hash);
  // ผู้ใช้เข้าถึงอีเมลนี้ได้จริง จึงนับเป็นการยืนยันอีเมลด้วย
  await customerModel.setEmailVerified(customerId);
  await emailTokenModel.invalidateAll(customerId, 'reset');
  res.json({ message: 'ตั้งรหัสผ่านใหม่เรียบร้อยแล้ว กรุณาเข้าสู่ระบบด้วยรหัสผ่านใหม่' });
});

// ---------- ยืนยันอีเมล ----------
const verifyEmail = asyncHandler(async (req, res) => {
  const customerId = await emailTokenModel.consume(req.body.token, 'verify');
  if (!customerId) {
    return res.status(400).json({ message: 'ลิงก์ไม่ถูกต้อง หมดอายุ หรือถูกใช้ไปแล้ว หากยังไม่ได้ยืนยันให้เข้าสู่ระบบแล้วกด "ส่งลิงก์ยืนยันอีกครั้ง"' });
  }
  await customerModel.setEmailVerified(customerId);
  res.json({ message: 'ยืนยันอีเมลเรียบร้อยแล้ว' });
});

const resendVerification = asyncHandler(async (req, res) => {
  const customer = await customerModel.findById(req.user.customerId);
  if (!customer) return res.status(404).json({ message: 'ไม่พบบัญชี' });
  if (customer.email_verified !== false) {
    return res.json({ message: 'อีเมลนี้ยืนยันแล้ว', alreadyVerified: true });
  }
  if (await emailTokenModel.recentlyIssued(customer.customer_id, 'verify')) {
    return res.status(429).json({ message: 'เพิ่งส่งลิงก์ไปแล้ว กรุณารอ 1 นาทีแล้วลองใหม่ และตรวจสอบจดหมายขยะ' });
  }
  await emailTokenModel.invalidateAll(customer.customer_id, 'verify');
  const sent = await issueVerification(req, customer);
  if (!sent) return res.status(502).json({ message: 'ส่งอีเมลไม่สำเร็จ กรุณาลองใหม่ภายหลัง' });
  res.json({ message: 'ส่งลิงก์ยืนยันอีเมลแล้ว' });
});

module.exports = { register, login, me, logout, forgotPassword, resetPassword, verifyEmail, resendVerification };
