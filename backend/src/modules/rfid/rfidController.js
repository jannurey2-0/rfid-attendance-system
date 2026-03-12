const {
  assignCardToTeacher,
  assignCardToStudent,
  getTeacherRfidList,
  getStudentRfidList
} = require('./rfidService');

const { sendSuccess } = require('../../utils/response');
const AppError = require('../../utils/AppError');

async function assignTeacherRfid(req, res, next) {
  try {
    const { teacher_id, uid } = req.body;

    if (!teacher_id || !uid) {
      throw new AppError(
        'teacher_id and uid are required',
        400,
        'MISSING_REQUIRED_FIELDS'
      );
    }

    const result = await assignCardToTeacher({
      teacher_id,
      uid,
      assigned_by: req.user.profile.id
    });

    return sendSuccess(res, 'Teacher RFID card assigned successfully', result, 201);
  } catch (error) {
    next(error);
  }
}

async function assignStudentRfid(req, res, next) {
  try {
    const { student_id, uid } = req.body;

    if (!student_id || !uid) {
      throw new AppError(
        'student_id and uid are required',
        400,
        'MISSING_REQUIRED_FIELDS'
      );
    }

    const result = await assignCardToStudent({
      student_id,
      uid,
      assigned_by: req.user.profile.id
    });

    return sendSuccess(res, 'Student RFID card assigned successfully', result, 201);
  } catch (error) {
    next(error);
  }
}

async function listTeacherRfid(req, res, next) {
  try {
    const result = await getTeacherRfidList();
    return sendSuccess(res, 'Teacher RFID list fetched successfully', result);
  } catch (error) {
    next(error);
  }
}

async function listStudentRfid(req, res, next) {
  try {
    const result = await getStudentRfidList();
    return sendSuccess(res, 'Student RFID list fetched successfully', result);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  assignTeacherRfid,
  assignStudentRfid,
  listTeacherRfid,
  listStudentRfid
};