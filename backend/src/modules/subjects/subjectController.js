const {
  createSubject,
  getMySubjects,
  enrollStudentToSubject,
  getStudentsBySubject
} = require('./subjectService');

const { sendSuccess } = require('../../utils/response');
const AppError = require('../../utils/AppError');

async function createSubjectHandler(req, res, next) {
  try {
    const {
      subject_code,
      subject_name,
      section,
      semester,
      school_year,
      schedule_info
    } = req.body;

    if (!subject_code || !subject_name) {
      throw new AppError(
        'subject_code and subject_name are required',
        400,
        'MISSING_REQUIRED_FIELDS'
      );
    }

    const result = await createSubject({
      teacher_profile_id: req.user.profile.id,
      subject_code,
      subject_name,
      section,
      semester,
      school_year,
      schedule_info
    });

    return sendSuccess(res, 'Subject created successfully', result, 201);
  } catch (error) {
    next(error);
  }
}

async function getMySubjectsHandler(req, res, next) {
  try {
    const result = await getMySubjects(req.user.profile.id);
    return sendSuccess(res, 'Subjects fetched successfully', result);
  } catch (error) {
    next(error);
  }
}

async function enrollStudentHandler(req, res, next) {
  try {
    const { subjectId } = req.params;
    const { student_id } = req.body;

    if (!student_id) {
      throw new AppError('student_id is required', 400, 'STUDENT_ID_REQUIRED');
    }

    const result = await enrollStudentToSubject({
      teacher_profile_id: req.user.profile.id,
      subject_id: subjectId,
      student_id
    });

    return sendSuccess(res, 'Student enrolled successfully', result, 201);
  } catch (error) {
    next(error);
  }
}

async function getStudentsBySubjectHandler(req, res, next) {
  try {
    const { subjectId } = req.params;

    const result = await getStudentsBySubject({
      teacher_profile_id: req.user.profile.id,
      subject_id: subjectId
    });

    return sendSuccess(res, 'Enrolled students fetched successfully', result);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createSubjectHandler,
  getMySubjectsHandler,
  enrollStudentHandler,
  getStudentsBySubjectHandler
};