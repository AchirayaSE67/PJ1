const computerModel = require('../models/computerModel');
const customerModel = require('../models/customerModel');
const rentalModel = require('../models/rentalModel');
const walletModel = require('../models/walletModel');
const ticketModel = require('../models/ticketModel');
const reservationModel = require('../models/reservationModel');
const topupModel = require('../models/topupModel');
const { asyncHandler } = require('../middleware/errorHandler');

const createComputer = asyncHandler(async (req, res) => {
  const computer = await computerModel.create(req.body);
  res.status(201).json({ computer });
});

const updateComputer = asyncHandler(async (req, res) => {
  const computer = await computerModel.update(req.params.id, req.body);
  res.json({ computer });
});

const deleteComputer = asyncHandler(async (req, res) => {
  try {
    await computerModel.remove(req.params.id);
    res.json({ message: 'ลบเครื่องแล้ว' });
  } catch (err) {
    if (err.code === '23503') {
      return res.status(400).json({ message: 'ลบไม่ได้ เพราะมีประวัติการเช่าหรือจองอยู่' });
    }
    throw err;
  }
});

const customers = asyncHandler(async (req, res) => {
  res.json({ customers: await customerModel.listAll() });
});

const rentals = asyncHandler(async (req, res) => {
  res.json({ rentals: await rentalModel.listAll() });
});

const transactions = asyncHandler(async (req, res) => {
  res.json({ transactions: await walletModel.listAllTransactions() });
});

const tickets = asyncHandler(async (req, res) => {
  res.json({ tickets: await ticketModel.listAll() });
});

const updateTicket = asyncHandler(async (req, res) => {
  const ticket = await ticketModel.updateByAdmin(
    req.params.id,
    req.body,
    req.user.customerId
  );
  res.json({ ticket });
});

const reservations = asyncHandler(async (req, res) => {
  res.json({ reservations: await reservationModel.listAll() });
});

const updateReservation = asyncHandler(async (req, res) => {
  await reservationModel.updateStatus(req.params.id, req.body.status);
  res.json({ message: 'อัปเดตการจองแล้ว' });
});

module.exports = {
  createComputer,
  updateComputer,
  deleteComputer,
  customers,
  rentals,
  transactions,
  tickets,
  updateTicket,
  reservations,
  updateReservation
};
