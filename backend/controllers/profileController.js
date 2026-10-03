const bcrypt = require('bcryptjs');
const customerModel = require('../models/customerModel');
const { asyncHandler } = require('../middleware/errorHandler');

const getProfile = asyncHandler(async (req, res) => {
  const customer = await customerModel.findById(req.user.customerId);
  res.json({ user: customerModel.mapCustomer(customer) });
});

const updateProfile = asyncHandler(async (req, res) => {
  const { fullName, phone } = req.body;
  if (!fullName) {
    return res.status(400).json({ message: 'กรุณากรอกชื่อ' });
  }
  const customer = await customerModel.updateProfile(req.user.customerId, { fullName, phone });
  res.json({ user: customerModel.mapCustomer(customer) });
});

const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const customer = await customerModel.findById(req.user.customerId);
  const ok = await bcrypt.compare(currentPassword || '', customer.password_hash);
  if (!ok) {
    return res.status(400).json({ message: 'รหัสผ่านปัจจุบันไม่ถูกต้อง' });
  }
  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ message: 'รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร' });
  }
  const hash = await bcrypt.hash(newPassword, 10);
  await customerModel.updatePassword(req.user.customerId, hash);
  res.json({ message: 'เปลี่ยนรหัสผ่านแล้ว' });
});

module.exports = { getProfile, updateProfile, changePassword };
