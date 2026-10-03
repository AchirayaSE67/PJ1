const rentalService = require('../services/rentalService');
const rentalModel = require('../models/rentalModel');
const ratingModel = require('../models/ratingModel');
const { asyncHandler } = require('../middleware/errorHandler');

const book = asyncHandler(async (req, res) => {
  const { computerId, hours, startTime } = req.body;
  if (!computerId || !hours || !startTime) {
    return res.status(400).json({ message: 'กรุณาเลือกเครื่อง จำนวนชั่วโมง และเวลาเริ่มต้น' });
  }
  const rental = await rentalService.book({
    customerId: req.user.customerId,
    computerId,
    hours,
    startTime
  });
  res.status(201).json({ rental });
});

const history = asyncHandler(async (req, res) => {
  const rentals = await rentalModel.listByCustomer(req.user.customerId);
  res.json({ rentals });
});

const active = asyncHandler(async (req, res) => {
  const rentals = await rentalModel.findActiveByCustomer(req.user.customerId);
  res.json({ rentals });
});

const detail = asyncHandler(async (req, res) => {
  const rental = await rentalModel.findById(req.params.id);
  if (!rental || (rental.customerId !== req.user.customerId && req.user.role !== 'admin')) {
    return res.status(404).json({ message: 'ไม่พบรายการเช่า' });
  }
  res.json({ rental });
});

const extendTime = asyncHandler(async (req, res) => {
  const minutes = Number(req.body.minutes);
  if (!Number.isSafeInteger(minutes) || minutes < 30 || minutes % 30 !== 0) {
    return res.status(400).json({ message: 'เวลาที่เพิ่มต้องเป็นจำนวนเต็ม และเพิ่มครั้งละ 30 นาทีขึ้นไป' });
  }
  const result = await rentalService.extendTime(req.user.customerId, req.params.id, minutes);
  res.json({
    message: `ต่อเวลา ${minutes >= 60 ? `${minutes / 60} ชั่วโมง` : `${minutes} นาที`} สำเร็จ`,
    rental: result.rental,
    balance: result.balance,
    addedMinutes: minutes,
    cost: result.cost
  });
});

const saveTime = asyncHandler(async (req, res) => {
  const result = await rentalService.saveTime(req.user.customerId, req.params.id);
  res.json({
    message: `เก็บเวลา ${result.remainingMinutes} นาที เข้า Time Balance แล้ว`,
    remainingMinutes: result.remainingMinutes,
    rental: result.rental
  });
});


const endUsage = asyncHandler(async (req, res) => {
  const rental = await rentalService.endUsage(req.user.customerId, req.params.id);
  res.json({ message: 'ปิดการใช้งานเครื่องเรียบร้อยแล้ว', rental });
});

const openMachine = asyncHandler(async (req, res) => {
  const data = await rentalService.openMachine(req.user.customerId, req.params.id);
  res.json(data);
});

const rate = asyncHandler(async (req, res) => {
  const rental = await rentalModel.findById(req.params.id);
  if (!rental || rental.customerId !== req.user.customerId) {
    return res.status(404).json({ message: 'ไม่พบรายการเช่า' });
  }
  const score = Number(req.body.score);
  if (score < 1 || score > 5) {
    return res.status(400).json({ message: 'คะแนนต้องอยู่ระหว่าง 1 ถึง 5' });
  }
  await ratingModel.create({
    rentalId: rental.rentalId,
    customerId: req.user.customerId,
    computerId: rental.computerId,
    score,
    comment: req.body.comment
  });
  res.json({ message: 'บันทึกคะแนนแล้ว' });
});

module.exports = { book, history, active, detail, extendTime, saveTime, endUsage, openMachine, rate };
