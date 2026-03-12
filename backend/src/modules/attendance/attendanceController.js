const {
  startAttendanceSession,
  getMyActiveSessions,
  getDeviceActiveSession,
  scanAttendance,
  endAttendanceSession,
  getSessionRecords
} = require('./attendanceService');

const { sendSuccess } = require('../../utils/response');
const AppError = require('../../utils/AppError');

async function startSessionHandler(req, res, next) {
  try {
    const { subject_id, mode } = req.body;

    if (!subject_id || !mode) {
      throw new AppError('subject_id and mode are required', 400, 'MISSING_REQUIRED_FIELDS');
    }

    const allowedModes = ['time_in', 'time_out', 'class_attendance'];
    if (!allowedModes.includes(mode)) {
      throw new AppError('Invalid mode', 400, 'INVALID_MODE');
    }

    const result = await startAttendanceSession({
      teacher_profile_id: req.user.profile.id,
      subject_id,
      mode
    });

    return sendSuccess(res, 'Attendance session started successfully', result, 201);
  } catch (error) {
    next(error);
  }
}

async function getMyActiveSessionsHandler(req, res, next) {
  try {
    const result = await getMyActiveSessions(req.user.profile.id);
    return sendSuccess(res, 'Active attendance sessions fetched successfully', result);
  } catch (error) {
    next(error);
  }
}

async function scanAttendanceHandler(req, res, next) {
  try {
    const { sessionId } = req.params;
    const { uid } = req.body;

    if (!uid) {
      throw new AppError('uid is required', 400, 'UID_REQUIRED');
    }

    const result = await scanAttendance({
      session_id: sessionId,
      uid
    });

    return sendSuccess(res, 'Attendance recorded successfully', result, 201);
  } catch (error) {
    next(error);
  }
}

async function endSessionHandler(req, res, next) {
  try {
    const { sessionId } = req.params;

    const result = await endAttendanceSession({
      teacher_profile_id: req.user.profile.id,
      session_id: sessionId
    });

    return sendSuccess(res, 'Attendance session ended successfully', result);
  } catch (error) {
    next(error);
  }
}

async function getSessionRecordsHandler(req, res, next) {
  try {
    const { sessionId } = req.params;

    const result = await getSessionRecords({
      teacher_profile_id: req.user.profile.id,
      session_id: sessionId
    });

    return sendSuccess(res, 'Attendance session records fetched successfully', result);
  } catch (error) {
    next(error);
  }
}

async function getDeviceActiveSessionHandler(req, res) {

  try {

    const session = await getDeviceActiveSession();

    if (!session) {
      return res.json({
        success: true,
        message: "No active session",
        data: null
      });
    }

    return res.json({
      success: true,
      message: "Active session fetched successfully",
      data: session
    });

  } catch (err) {

    return res.status(500).json({
      success: false,
      message: "Failed to fetch session",
      error: err.message
    });

  }

}

module.exports = {
  startSessionHandler,
  getMyActiveSessionsHandler,
  getDeviceActiveSessionHandler,
  scanAttendanceHandler,
  endSessionHandler,
  getSessionRecordsHandler
};