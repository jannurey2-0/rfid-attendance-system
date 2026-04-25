const express = require('express');
const router = express.Router();

const deviceAuth = require('../../middlewares/deviceAuth');

const {
  submitLoginScanHandler,
  getLatestLoginScanHandler,
  consumeLatestLoginScanHandler,
  requestDeviceRefreshHandler,
  getDeviceRefreshStatusHandler,
  getDeviceStatusHandler,
  submitAdminRfidScanHandler,
  getAdminRfidScanHandler
} = require('./deviceScanController');

// ESP32 sends RFID UID here
router.post('/device/login-scan', deviceAuth, submitLoginScanHandler);

// Frontend checks latest scan here
router.get('/device/login-scan', getLatestLoginScanHandler);

// Frontend marks it used after login
router.post('/device/login-scan/consume', consumeLatestLoginScanHandler);

// Frontend triggers device refresh
router.post('/device/refresh', requestDeviceRefreshHandler);

// Device checks for refresh signal
router.get('/device/refresh-status', deviceAuth, getDeviceRefreshStatusHandler);

// Device checks for session end signal
router.post('/device/session-ended', deviceAuth, (req, res) => {
  const { triggerSessionEnd } = require('./deviceScanStore');
  triggerSessionEnd();
  return res.status(200).json({
    success: true,
    message: 'Session end signal sent to device'
  });
});

// Device checks combined status (refresh + session end)
router.get('/device/status', deviceAuth, getDeviceStatusHandler);

// ESP32 sends RFID scan for admin assignment
router.post('/device/admin-scan', deviceAuth, submitAdminRfidScanHandler);

// Admin frontend checks for RFID scan
router.get('/device/admin-scan', getAdminRfidScanHandler);

module.exports = router;
