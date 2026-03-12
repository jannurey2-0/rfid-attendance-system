const express = require('express');
const router = express.Router();

const {
  createSubjectHandler,
  getMySubjectsHandler,
  enrollStudentHandler,
  getStudentsBySubjectHandler
} = require('./subjectController');

const {
  requireAuth,
  requireTeacher
} = require('../../middlewares/authMiddleware');

router.post('/', requireAuth, requireTeacher, createSubjectHandler);
router.get('/my-subjects', requireAuth, requireTeacher, getMySubjectsHandler);
router.post('/:subjectId/enroll', requireAuth, requireTeacher, enrollStudentHandler);
router.get('/:subjectId/students', requireAuth, requireTeacher, getStudentsBySubjectHandler);

module.exports = router;