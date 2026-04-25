const express = require('express');
const cors = require('cors');
const testRoutes = require('./routes/testRoutes');
const authRoutes = require('./modules/auth/authRoutes');
const teacherRoutes = require('./modules/teachers/teacherRoutes');
const rfidRoutes = require('./modules/rfid/rfidRoutes');
const subjectRoutes = require('./modules/subjects/subjectRoutes');
const studentRoutes = require('./modules/students/studentRoutes');
const attendanceRoutes = require('./modules/attendance/attendanceRoutes');
const errorHandler = require('./middlewares/errorHandler');
const deviceScanRoutes = require('./modules/rfid/deviceScanRoutes');
const activityLogRoutes = require('./modules/activityLogs/activityLogRoutes');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'RFID Attendance System API is running'
  });
});

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Server is healthy'
  });
});

app.use('/api/test', testRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/teachers', teacherRoutes);
app.use('/api/rfid', rfidRoutes);
app.use('/api/subjects', subjectRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/activity-logs', activityLogRoutes);
app.use(errorHandler);
app.use('/api/rfid', deviceScanRoutes);

module.exports = app;