const express = require('express');
const router = express.Router();

const { listActivityLogs } = require('./activityLogController');
const { requireAuth, requireAdmin } = require('../../middlewares/authMiddleware');

router.get('/', requireAuth, requireAdmin, listActivityLogs);

module.exports = router;
