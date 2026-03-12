const express = require('express');
const router = express.Router();
const { login, rfidLogin } = require('./authController');

router.post('/login', login);
router.post('/rfid-login', rfidLogin);

module.exports = router;