const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const customerModel = require('../models/customerModel');
const { asyncHandler } = require('../middleware/errorHandler');

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

const register = asyncHandler(async (req, res) => {
  const { email, password, fullName, phone } = req.body;
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
    customer = await customerModel.create({ email, passwordHash, fullName, phone });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ message: 'อีเมลนี้ถูกใช้แล้ว' });
    }
    throw err;
  }
  const token = signToken(customer);
  res.status(201).json({
    token,
    user: customerModel.mapCustomer(customer)
  });
});

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const customer = await customerModel.findByEmail(email);
  if (!customer) {
    return res.status(400).json({ message: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' });
  }
  const ok = await bcrypt.compare(password, customer.password_hash);
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

module.exports = { register, login, me, logout };
