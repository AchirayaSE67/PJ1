const express = require('express');
const ticketController = require('../controllers/ticketController');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAuth, ticketController.listMine);
router.post('/', requireAuth, ticketController.create);
router.post('/:id/messages', requireAuth, ticketController.reply);

module.exports = router;
