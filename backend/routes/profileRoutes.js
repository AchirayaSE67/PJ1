const express = require('express');
const profileController = require('../controllers/profileController');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAuth, profileController.getProfile);
router.put('/', requireAuth, profileController.updateProfile);
router.put('/password', requireAuth, profileController.changePassword);

module.exports = router;
