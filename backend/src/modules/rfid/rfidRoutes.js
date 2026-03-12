const express = require('express');
const router = express.Router();

const {
  assignTeacherRfid,
  assignStudentRfid,
  listTeacherRfid,
  listStudentRfid
} = require('./rfidController');

const {
  requireAuth,
  requireAdmin,
  requireTeacher
} = require('../../middlewares/authMiddleware');

router.post('/teachers/assign', requireAuth, requireAdmin, assignTeacherRfid);
router.get('/teachers', requireAuth, requireAdmin, listTeacherRfid);

// Teacher assigns student RFID
router.post('/students/assign', requireAuth, requireTeacher, assignStudentRfid);
router.get('/students', requireAuth, requireTeacher, listStudentRfid);

module.exports = router;