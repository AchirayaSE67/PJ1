const express = require('express');
const adminController = require('../controllers/adminController');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth, requireAdmin);

router.post('/computers', adminController.createComputer);
router.put('/computers/:id', adminController.updateComputer);
router.delete('/computers/:id', adminController.deleteComputer);

router.get('/customers', adminController.customers);
router.get('/rentals', adminController.rentals);
router.get('/transactions', adminController.transactions);

router.get('/tickets', adminController.tickets);
router.put('/tickets/:id', adminController.updateTicket);

router.get('/reservations', adminController.reservations);
router.put('/reservations/:id', adminController.updateReservation);

module.exports = router;
