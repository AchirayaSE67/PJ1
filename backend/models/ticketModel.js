const pool = require('../config/db');

function mapTicket(row) {
  return {
    ticketId: row.ticket_id,
    customerId: row.customer_id,
    customerName: row.full_name,
    computerId: row.computer_id,
    computerCode: row.computer_code,
    subject: row.subject,
    description: row.description,
    issueType: row.issue_type,
    status: row.status,
    adminReply: row.admin_reply,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    messages: []
  };
}

function mapMessage(row) {
  return {
    messageId: row.message_id,
    ticketId: row.ticket_id,
    senderCustomerId: row.sender_customer_id,
    senderRole: row.sender_role,
    senderName: row.sender_name,
    message: row.message,
    createdAt: row.created_at
  };
}

const select = `
  SELECT t.*, c.computer_code, cu.full_name
  FROM support_ticket t
  LEFT JOIN computer c ON c.computer_id = t.computer_id
  JOIN customer cu ON cu.customer_id = t.customer_id
`;

async function getMessages(ticketId) {
  const [rows] = await pool.query(
    `SELECT m.*, cu.full_name AS sender_name
     FROM support_ticket_message m
     JOIN customer cu ON cu.customer_id = m.sender_customer_id
     WHERE m.ticket_id = ?
     ORDER BY m.created_at ASC, m.message_id ASC`,
    [ticketId]
  );

  return rows.map(mapMessage);
}

async function attachMessages(tickets) {
  if (!tickets.length) return tickets;

  const ids = tickets.map((ticket) => ticket.ticketId);
  const placeholders = ids.map(() => '?').join(',');

  const [rows] = await pool.query(
    `SELECT m.*, cu.full_name AS sender_name
     FROM support_ticket_message m
     JOIN customer cu ON cu.customer_id = m.sender_customer_id
     WHERE m.ticket_id IN (${placeholders})
     ORDER BY m.created_at ASC, m.message_id ASC`,
    ids
  );

  const byTicket = new Map();

  rows.forEach((row) => {
    if (!byTicket.has(row.ticket_id)) {
      byTicket.set(row.ticket_id, []);
    }

    byTicket.get(row.ticket_id).push(mapMessage(row));
  });

  tickets.forEach((ticket) => {
    ticket.messages = byTicket.get(ticket.ticketId) || [];
  });

  return tickets;
}

async function create(data) {
  const [result] = await pool.query(
    `INSERT INTO support_ticket
      (customer_id, computer_id, subject, description, issue_type)
     VALUES (?, ?, ?, ?, ?) RETURNING ticket_id`,
    [
      data.customerId,
      data.computerId || null,
      data.subject,
      data.description,
      data.issueType
    ]
  );

  return findById(result.insertId);
}

async function findById(id) {
  const [rows] = await pool.query(
    `${select} WHERE t.ticket_id = ?`,
    [id]
  );

  if (!rows[0]) return null;

  const ticket = mapTicket(rows[0]);
  ticket.messages = await getMessages(id);

  return ticket;
}

async function listByCustomer(customerId) {
  const [rows] = await pool.query(
    `${select}
     WHERE t.customer_id = ?
     ORDER BY t.created_at DESC`,
    [customerId]
  );

  return attachMessages(rows.map(mapTicket));
}

async function listAll() {
  const [rows] = await pool.query(
    `${select}
     ORDER BY t.created_at DESC`
  );

  return attachMessages(rows.map(mapTicket));
}

async function addMessage(
  ticketId,
  senderCustomerId,
  senderRole,
  message
) {
  await pool.query(
    `INSERT INTO support_ticket_message
      (ticket_id, sender_customer_id, sender_role, message)
     VALUES (?, ?, ?, ?)`,
    [
      ticketId,
      senderCustomerId,
      senderRole,
      message
    ]
  );

  return findById(ticketId);
}

async function updateStatus(id, status) {
  await pool.query(
    `UPDATE support_ticket
     SET status = ?
     WHERE ticket_id = ?`,
    [status, id]
  );

  return findById(id);
}

async function updateByAdmin(
  id,
  { status, adminReply },
  adminCustomerId
) {
  const ticket = await findById(id);

  if (!ticket) return null;

  await pool.query(
    `UPDATE support_ticket
     SET status = ?
     WHERE ticket_id = ?`,
    [status, id]
  );

  const reply = String(adminReply || '').trim();

  if (reply) {
    await addMessage(
      id,
      adminCustomerId,
      'admin',
      reply
    );

    await pool.query(
      `UPDATE support_ticket
       SET admin_reply = ?
       WHERE ticket_id = ?`,
      [reply, id]
    );
  }

  return findById(id);
}

module.exports = {
  create,
  findById,
  listByCustomer,
  listAll,
  addMessage,
  updateStatus,
  updateByAdmin
};