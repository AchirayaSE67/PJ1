const ticketModel = require('../models/ticketModel');
const { asyncHandler } = require('../middleware/errorHandler');

const create = asyncHandler(async (req, res) => {
  const { subject, description, issueType } = req.body;

  const rawComputerId = req.body.computerId;

  const computerId =
    rawComputerId === null ||
    rawComputerId === '' ||
    rawComputerId === undefined
      ? null
      : Number(rawComputerId);

  if (!subject?.trim() || !description?.trim() || !issueType) {
    return res.status(400).json({
      message: 'กรอกหัวข้อ รายละเอียด และประเภทปัญหา'
    });
  }

  if (
    computerId !== null &&
    (!Number.isInteger(computerId) || computerId < 1)
  ) {
    return res.status(400).json({
      message: 'หมายเลขเครื่องไม่ถูกต้อง'
    });
  }

  const ticket = await ticketModel.create({
    customerId: req.user.customerId,
    computerId,
    subject,
    description,
    issueType
  });

  res.status(201).json({ ticket });
});

const listMine = asyncHandler(async (req, res) => {
  const tickets = await ticketModel.listByCustomer(
    req.user.customerId
  );

  res.json({ tickets });
});

const reply = asyncHandler(async (req, res) => {
  const message = String(req.body.message || '').trim();

  if (!message) {
    return res.status(400).json({
      message: 'กรุณากรอกข้อความตอบกลับ'
    });
  }

  if (message.length > 2000) {
    return res.status(400).json({
      message: 'ข้อความตอบกลับยาวเกิน 2,000 ตัวอักษร'
    });
  }

  const ticket = await ticketModel.findById(req.params.id);

  if (
    !ticket ||
    ticket.customerId !== req.user.customerId
  ) {
    return res.status(404).json({
      message: 'ไม่พบ Ticket นี้'
    });
  }

  if (ticket.status === 'closed') {
    return res.status(400).json({
      message: 'Ticket นี้ปิดแล้ว ไม่สามารถตอบกลับได้'
    });
  }

  const messages = Array.isArray(ticket.messages)
    ? ticket.messages
    : [];

  const lastMessage = messages.length
    ? messages[messages.length - 1]
    : null;

  const adminHasReplied =
    lastMessage
      ? lastMessage.senderRole === 'admin'
      : Boolean(ticket.adminReply);

  if (!adminHasReplied) {
    return res.status(400).json({
      message: 'กรุณารอ Admin ตอบกลับก่อน จึงจะสามารถตอบกลับได้'
    });
  }

  await ticketModel.addMessage(
    req.params.id,
    req.user.customerId,
    'customer',
    message
  );

  if (ticket.status === 'resolved') {
    await ticketModel.updateStatus(
      req.params.id,
      'in_progress'
    );
  }

  res.json({
    ticket: await ticketModel.findById(req.params.id)
  });
});

module.exports = {
  create,
  listMine,
  reply
};