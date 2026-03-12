const express = require('express');
const router = express.Router();

const { createTeacher, listTeachers } = require('./teacherController');
const { requireAuth, requireAdmin } = require('../../middlewares/authMiddleware');

router.post('/', requireAuth, requireAdmin, createTeacher);
router.get('/', requireAuth, requireAdmin, listTeachers);

module.exports = router;