const express = require('express');
const router = express.Router();

const {
  createStudentHandler,
  getMyStudentsHandler
} = require('./studentController');

const {
  requireAuth,
  requireTeacher
} = require('../../middlewares/authMiddleware');

router.post('/', requireAuth, requireTeacher, createStudentHandler);
router.get('/my-students', requireAuth, requireTeacher, getMyStudentsHandler);

module.exports = router;