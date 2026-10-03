const computerModel = require('../models/computerModel');
const { asyncHandler } = require('../middleware/errorHandler');
const rentalService = require('../services/rentalService');

const list = asyncHandler(async (req, res) => {
  const computers = await computerModel.listAll();
  res.json({ computers });
});

const detail = asyncHandler(async (req, res) => {
  const computer = await computerModel.findById(req.params.id);
  if (!computer) {
    return res.status(404).json({ message: 'ไม่พบเครื่องคอมพิวเตอร์' });
  }
  res.json({ computer });
});

const quote = asyncHandler(async (req, res) => {
  const computer = await computerModel.findById(req.query.computerId);
  if (!computer) {
    return res.status(404).json({ message: 'ไม่พบเครื่องคอมพิวเตอร์' });
  }
  const result = rentalService.calcQuote(computer.pricePerHour, req.query.hours, req.query.startTime);
  res.json({
    hours: result.hours,
    startTime: result.startTime,
    endTime: result.endTime,
    totalPrice: result.totalPrice,
    pricePerHour: computer.pricePerHour
  });
});

module.exports = { list, detail, quote };
