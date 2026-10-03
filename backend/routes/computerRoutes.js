const express = require('express');
const computerController = require('../controllers/computerController');

const router = express.Router();

router.get('/', computerController.list);
router.get('/quote', computerController.quote);
router.get('/:id', computerController.detail);

module.exports = router;
