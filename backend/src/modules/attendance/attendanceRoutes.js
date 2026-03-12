const express = require('express');
const router = express.Router();

const {
  startSessionHandler,
  getMyActiveSessionsHandler,
  getDeviceActiveSessionHandler,
  scanAttendanceHandler,
  endSessionHandler,
  getSessionRecordsHandler
} = require('./attendanceController');

const {
  requireAuth,
  requireTeacher
} = require('../../middlewares/authMiddleware');

const deviceAuth = require('../../middlewares/deviceAuth');

router.post('/sessions/start', requireAuth, requireTeacher, startSessionHandler);
router.get(
  '/sessions/my-active',
  deviceAuth,
  requireAuth,
  requireTeacher,
  getMyActiveSessionsHandler
);

router.get('/device/active-session', deviceAuth, getDeviceActiveSessionHandler);

router.post('/sessions/:sessionId/scan', scanAttendanceHandler);
router.post('/sessions/:sessionId/end', requireAuth, requireTeacher, endSessionHandler);
router.get('/sessions/:sessionId/records', requireAuth, requireTeacher, getSessionRecordsHandler);


module.exports = router;