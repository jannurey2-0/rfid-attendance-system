const {
  createStudent,
  getMyStudents
} = require('./studentService');

const { sendSuccess } = require('../../utils/response');
const AppError = require('../../utils/AppError');

async function createStudentHandler(req, res, next) {
  try {
    const {
      first_name,
      last_name,
      middle_name,
      email,
      parent_phone_number,
      student_no,
      year_level,
      section
    } = req.body;

    if (!first_name || !last_name || !student_no) {
      throw new AppError(
        'first_name, last_name, and student_no are required',
        400,
        'MISSING_REQUIRED_FIELDS'
      );
    }

    const result = await createStudent({
      first_name,
      last_name,
      middle_name,
      email,
      parent_phone_number,
      student_no,
      year_level,
      section,
      created_by: req.user.profile.id
    });

    return sendSuccess(res, 'Student created successfully', result, 201);
  } catch (error) {
    next(error);
  }
}

async function getMyStudentsHandler(req, res, next) {
  try {
    const result = await getMyStudents();
    return sendSuccess(res, 'Students fetched successfully', result);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createStudentHandler,
  getMyStudentsHandler
};