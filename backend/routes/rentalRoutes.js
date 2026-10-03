const express = require('express');
const rentalController = require('../controllers/rentalController');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.post('/book', requireAuth, rentalController.book);
router.get('/', requireAuth, rentalController.history);
router.get('/active', requireAuth, rentalController.active);
router.get('/:id', requireAuth, rentalController.detail);
router.post('/:id/extend-time', requireAuth, rentalController.extendTime);
router.post('/:id/save-time', requireAuth, rentalController.saveTime);
router.post('/:id/open', requireAuth, rentalController.openMachine);
router.post('/:id/end', requireAuth, rentalController.endUsage);
router.post('/:id/rate', requireAuth, rentalController.rate);

module.exports = router;
