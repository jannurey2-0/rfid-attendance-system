const {
  startAttendanceSession,
  getMyActiveSessions,
  getMySessionHistory,
  getDeviceActiveSession,
  scanAttendance,
  endAttendanceSession,
  getSessionRecords,
  getSessionRecordsForExport
} = require('./attendanceService');

const { sendSuccess } = require('../../utils/response');
const AppError = require('../../utils/AppError');
const { triggerSessionEnd } = require('../rfid/deviceScanStore');
const ExcelJS = require('exceljs');

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

async function getMySessionHistoryHandler(req, res, next) {
  try {
    const result = await getMySessionHistory(req.user.profile.id);
    return sendSuccess(res, 'Attendance session history fetched successfully', result);
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

    // Trigger device to refresh when session ends
    triggerSessionEnd();

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

async function exportAttendanceToExcel(req, res, next) {
  try {
    const { sessionId } = req.params;

    const data = await getSessionRecordsForExport({
      teacher_profile_id: req.user.profile.id,
      session_id: sessionId
    });

    const { session, records } = data;
    const subject = session.subjects || {};
    const teacher = session.teachers?.profiles || {};

    // Create workbook and worksheet
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Attendance Records');

    // Set column widths
    worksheet.columns = [
      { header: 'No.', key: 'number', width: 8 },
      { header: 'Student No.', key: 'student_no', width: 15 },
      { header: 'Last Name', key: 'last_name', width: 20 },
      { header: 'First Name', key: 'first_name', width: 20 },
      { header: 'Middle Name', key: 'middle_name', width: 20 },
      { header: 'Year Level', key: 'year_level', width: 12 },
      { header: 'Section', key: 'section', width: 12 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Scan Time', key: 'scan_time', width: 22 },
      { header: 'Remarks', key: 'remarks', width: 15 }
    ];

    // Style header row
    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' }
    };
    worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

    // Add session information at the top
    worksheet.insertRow(1, []);
    worksheet.insertRow(1, []);
    worksheet.insertRow(1, []);
    worksheet.insertRow(1, []);

    // Session info styles
    const titleRow = worksheet.getRow(1);
    titleRow.getCell(1).value = 'ATTENDANCE RECORDS';
    titleRow.getCell(1).font = { bold: true, size: 16 };
    worksheet.mergeCells('A1:J1');

    const infoRow2 = worksheet.getRow(2);
    infoRow2.getCell(1).value = `Subject: ${subject.subject_code || ''} - ${subject.subject_name || ''}`;
    infoRow2.getCell(1).font = { bold: true, size: 12 };
    worksheet.mergeCells('A2:J2');

    const infoRow3 = worksheet.getRow(3);
    infoRow3.getCell(1).value = `Teacher: ${teacher.first_name || ''} ${teacher.last_name || ''}`;
    worksheet.mergeCells('A3:J3');

    const infoRow4 = worksheet.getRow(4);
    infoRow4.getCell(1).value = `Section: ${subject.section || 'N/A'} | Semester: ${subject.semester || 'N/A'} | School Year: ${subject.school_year || 'N/A'}`;
    worksheet.mergeCells('A4:J4');

    const infoRow5 = worksheet.getRow(5);
    const sessionDate = new Date(session.start_time);
    infoRow5.getCell(1).value = `Date: ${sessionDate.toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} | Mode: ${session.mode.toUpperCase()}`;
    worksheet.mergeCells('A5:J5');

    const infoRow6 = worksheet.getRow(6);
    infoRow6.getCell(1).value = `Total Students Present: ${records.length}`;
    infoRow6.getCell(1).font = { bold: true };
    worksheet.mergeCells('A6:J6');

    // Add data rows starting from row 8 (after header row at 7)
    records.forEach((record, index) => {
      const student = record.students || {};
      const profile = student.profiles || {};

      worksheet.addRow({
        number: index + 1,
        student_no: student.student_no || '',
        last_name: profile.last_name || '',
        first_name: profile.first_name || '',
        middle_name: profile.middle_name || '',
        year_level: student.year_level || '',
        section: student.section || '',
        status: record.attendance_status?.toUpperCase() || '',
        scan_time: record.scan_time ? new Date(record.scan_time).toLocaleString('en-PH') : '',
        remarks: record.remarks || ''
      });
    });

    // Style data rows
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber > 7) { // Skip info and header rows
        row.alignment = { vertical: 'middle' };
        row.eachCell((cell) => {
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
          };
        });
      }
    });

    // Generate filename
    const dateStr = sessionDate.toISOString().split('T')[0];
    const subjectCode = subject.subject_code || 'Attendance';
    const filename = `${subjectCode}_${dateStr}.xlsx`;

    // Set response headers
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(filename)}"`
    );

    // Write to response
    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    next(error);
  }
}

module.exports = {
  startSessionHandler,
  getMyActiveSessionsHandler,
  getMySessionHistoryHandler,
  getDeviceActiveSessionHandler,
  scanAttendanceHandler,
  endSessionHandler,
  getSessionRecordsHandler,
  exportAttendanceToExcel
};