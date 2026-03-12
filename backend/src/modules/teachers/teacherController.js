const {
  createTeacherAccount,
  getAllTeachers
} = require('./teacherService');

const { sendSuccess } = require('../../utils/response');
const AppError = require('../../utils/AppError');

async function createTeacher(req, res, next) {
  try {
    const {
      first_name,
      last_name,
      middle_name,
      email,
      password,
      employee_no,
      department
    } = req.body;

    if (!first_name || !last_name || !email || !password || !employee_no) {
      throw new AppError(
        'first_name, last_name, email, password, and employee_no are required',
        400,
        'MISSING_REQUIRED_FIELDS'
      );
    }

    const result = await createTeacherAccount({
      first_name,
      last_name,
      middle_name,
      email,
      password,
      employee_no,
      department,
      created_by: req.user.profile.id
    });

    return sendSuccess(res, 'Teacher account created successfully', result, 201);
  } catch (error) {
    next(error);
  }
}

async function listTeachers(req, res, next) {
  try {
    const teachers = await getAllTeachers();
    return sendSuccess(res, 'Teachers fetched successfully', teachers);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createTeacher,
  listTeachers
};