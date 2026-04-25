const { supabaseAdmin } = require('../../config/supabase');
const { sendSMS } = require('../../utils/smsService');
const AppError = require('../../utils/AppError');

async function getTeacherByProfileId(profileId) {
  const { data, error } = await supabaseAdmin
    .from('teachers')
    .select('*')
    .eq('profile_id', profileId)
    .single();

  if (error || !data) {
    throw new AppError('Teacher record not found', 404, 'TEACHER_NOT_FOUND');
  }

  return data;
}

async function startAttendanceSession({
  teacher_profile_id,
  subject_id,
  mode
}) {
  const teacher = await getTeacherByProfileId(teacher_profile_id);

  const { data: subject, error: subjectError } = await supabaseAdmin
    .from('subjects')
    .select('*')
    .eq('id', subject_id)
    .eq('teacher_id', teacher.id)
    .single();

  if (subjectError || !subject) {
    throw new AppError('Subject not found or not owned by teacher', 404, 'SUBJECT_NOT_FOUND');
  }

  const { data: existingSession, error: existingSessionError } = await supabaseAdmin
    .from('attendance_sessions')
    .select('*')
    .eq('subject_id', subject_id)
    .eq('teacher_id', teacher.id)
    .eq('status', 'active')
    .maybeSingle();

  if (existingSessionError) {
    throw new AppError(
      'Failed to check existing session',
      500,
      'SESSION_CHECK_FAILED',
      existingSessionError.message
    );
  }

  if (existingSession) {
    throw new AppError(
      'This subject already has an active attendance session',
      409,
      'ACTIVE_SESSION_EXISTS'
    );
  }

  const { data, error } = await supabaseAdmin
    .from('attendance_sessions')
    .insert([
      {
        subject_id,
        teacher_id: teacher.id,
        mode,
        status: 'active'
      }
    ])
    .select()
    .single();

  if (error) {
    throw new AppError(
      'Failed to start attendance session',
      500,
      'SESSION_START_FAILED',
      error.message
    );
  }

  await supabaseAdmin.from('activity_logs').insert([
    {
      actor_profile_id: teacher_profile_id,
      action_type: 'START_ATTENDANCE_SESSION',
      entity_type: 'attendance_session',
      entity_id: data.id,
      details: {
        subject_id,
        mode
      }
    }
  ]);

  return data;
}

async function getMyActiveSessions(teacher_profile_id) {
  const teacher = await getTeacherByProfileId(teacher_profile_id);

  const { data, error } = await supabaseAdmin
    .from('attendance_sessions')
    .select(`
      *,
      subjects (
        id,
        subject_code,
        subject_name,
        section,
        semester,
        school_year
      )
    `)
    .eq('teacher_id', teacher.id)
    .eq('status', 'active')
    .order('start_time', { ascending: false });

  if (error) {
    throw new AppError(
      'Failed to fetch active sessions',
      500,
      'FETCH_ACTIVE_SESSIONS_FAILED',
      error.message
    );
  }

  return data;
}

async function getMySessionHistory(teacher_profile_id) {
  const teacher = await getTeacherByProfileId(teacher_profile_id);

  const { data: sessions, error } = await supabaseAdmin
    .from('attendance_sessions')
    .select(`
      *,
      subjects (
        id,
        subject_code,
        subject_name,
        section,
        semester,
        school_year
      )
    `)
    .eq('teacher_id', teacher.id)
    .order('start_time', { ascending: false });

  if (error) {
    throw new AppError(
      'Failed to fetch session history',
      500,
      'FETCH_SESSION_HISTORY_FAILED',
      error.message
    );
  }

  // Get record counts for all sessions in one query
  const sessionIds = sessions.map(s => s.id);
  const recordCounts = {};

  if (sessionIds.length > 0) {
    const { data: records, error: recordsError } = await supabaseAdmin
      .from('attendance_records')
      .select('session_id')
      .in('session_id', sessionIds);

    if (!recordsError && records) {
      records.forEach(r => {
        recordCounts[r.session_id] = (recordCounts[r.session_id] || 0) + 1;
      });
    }
  }

  return sessions.map(session => ({
    ...session,
    record_count: recordCounts[session.id] || 0
  }));
}

async function scanAttendance({ session_id, uid }) {
  const cleanUid = String(uid).trim();

  if (!cleanUid) {
    throw new AppError('RFID UID is required', 400, 'RFID_UID_REQUIRED');
  }

  const { data: session, error: sessionError } = await supabaseAdmin
    .from('attendance_sessions')
    .select('*')
    .eq('id', session_id)
    .eq('status', 'active')
    .single();

  if (sessionError || !session) {
    throw new AppError('Active attendance session not found', 404, 'ACTIVE_SESSION_NOT_FOUND');
  }

  const { data: card, error: cardError } = await supabaseAdmin
    .from('rfid_cards')
    .select('*')
    .eq('uid', cleanUid)
    .eq('is_active', true)
    .single();

  if (cardError || !card) {
    throw new AppError('RFID card not registered or inactive', 404, 'RFID_NOT_REGISTERED');
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('id', card.profile_id)
    .single();

  if (profileError || !profile) {
    throw new AppError('Linked profile not found', 404, 'PROFILE_NOT_FOUND');
  }

  if (profile.role !== 'student') {
    throw new AppError(
      'Only student RFID cards are allowed for attendance scanning',
      403,
      'INVALID_CARD_ROLE'
    );
  }

  if (profile.status !== 'active') {
    throw new AppError('Student account is inactive', 403, 'STUDENT_INACTIVE');
  }

  const { data: student, error: studentError } = await supabaseAdmin
    .from('students')
    .select('*')
    .eq('profile_id', profile.id)
    .single();

  if (studentError || !student) {
    throw new AppError('Student record not found', 404, 'STUDENT_NOT_FOUND');
  }

  const { data: enrollment, error: enrollmentError } = await supabaseAdmin
    .from('subject_enrollments')
    .select('*')
    .eq('subject_id', session.subject_id)
    .eq('student_id', student.id)
    .eq('status', 'enrolled')
    .maybeSingle();

  if (enrollmentError) {
    throw new AppError(
      'Failed to verify enrollment',
      500,
      'ENROLLMENT_CHECK_FAILED',
      enrollmentError.message
    );
  }

  if (!enrollment) {
    throw new AppError('Student is not enrolled in this subject', 403, 'STUDENT_NOT_ENROLLED');
  }

  const { data: existingRecord, error: existingRecordError } = await supabaseAdmin
    .from('attendance_records')
    .select('*')
    .eq('session_id', session.id)
    .eq('student_id', student.id)
    .maybeSingle();

  if (existingRecordError) {
    throw new AppError(
      'Failed to check existing attendance record',
      500,
      'ATTENDANCE_CHECK_FAILED',
      existingRecordError.message
    );
  }

  if (existingRecord) {
    throw new AppError(
      'Student attendance already recorded for this session',
      409,
      'ALREADY_SCANNED'
    );
  }

  const { data: record, error: recordError } = await supabaseAdmin
    .from('attendance_records')
    .insert([
      {
        session_id: session.id,
        student_id: student.id,
        attendance_status: 'present',
        remarks: 'RFID_SCAN',
        recorded_by: profile.id
      }
    ])
    .select()
    .single();

  if (recordError) {
    throw new AppError(
      'Failed to save attendance',
      500,
      'ATTENDANCE_SAVE_FAILED',
      recordError.message
    );
  }

  // ---------- SEND SMS TO PARENT ----------
  try {

    const phone = student.parent_phone;

    if (phone) {

      const now = new Date().toLocaleString();

      const message = `Attendance Alert:
  ${profile.first_name} ${profile.last_name} has been marked PRESENT.

  Time: ${now}`;

      await sendSMS(phone, message);

      console.log("SMS sent to:", phone);

    } else {

      console.log("No phone number found for student:", student.id);

    }

  } catch (smsError) {

    console.error("SMS sending failed:", smsError.message);

  }

  await supabaseAdmin
    .from('rfid_cards')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', card.id);

  await supabaseAdmin.from('activity_logs').insert([
    {
      actor_profile_id: profile.id,
      action_type: 'ATTENDANCE_SCAN',
      entity_type: 'attendance_record',
      entity_id: record.id,
      details: {
        session_id: session.id,
        student_id: student.id,
        uid: cleanUid
      }
    }
  ]);

  return {
    record,
    student: {
      id: student.id,
      student_no: student.student_no,
      year_level: student.year_level,
      section: student.section
    },
    profile: {
      id: profile.id,
      first_name: profile.first_name,
      last_name: profile.last_name,
      middle_name: profile.middle_name
    }
  };
}

async function endAttendanceSession({
  teacher_profile_id,
  session_id
}) {
  const teacher = await getTeacherByProfileId(teacher_profile_id);

  const { data: session, error: sessionError } = await supabaseAdmin
    .from('attendance_sessions')
    .select('*')
    .eq('id', session_id)
    .eq('teacher_id', teacher.id)
    .eq('status', 'active')
    .single();

  if (sessionError || !session) {
    throw new AppError(
      'Active session not found or not owned by teacher',
      404,
      'SESSION_NOT_FOUND'
    );
  }

  const { data, error } = await supabaseAdmin
    .from('attendance_sessions')
    .update({
      status: 'closed',
      end_time: new Date().toISOString()
    })
    .eq('id', session_id)
    .select()
    .single();

  if (error) {
    throw new AppError(
      'Failed to end attendance session',
      500,
      'SESSION_END_FAILED',
      error.message
    );
  }

  await supabaseAdmin.from('activity_logs').insert([
    {
      actor_profile_id: teacher_profile_id,
      action_type: 'END_ATTENDANCE_SESSION',
      entity_type: 'attendance_session',
      entity_id: data.id,
      details: {
        subject_id: data.subject_id
      }
    }
  ]);

  return data;
}

async function getSessionRecords({
  teacher_profile_id,
  session_id
}) {
  const teacher = await getTeacherByProfileId(teacher_profile_id);

  const { data: session, error: sessionError } = await supabaseAdmin
    .from('attendance_sessions')
    .select(`
      *,
      subjects (
        id,
        subject_code,
        subject_name,
        section
      )
    `)
    .eq('id', session_id)
    .eq('teacher_id', teacher.id)
    .single();

  if (sessionError || !session) {
    throw new AppError('Session not found or not owned by teacher', 404, 'SESSION_NOT_FOUND');
  }

  const { data: records, error: recordsError } = await supabaseAdmin
    .from('attendance_records')
    .select(`
      id,
      scan_time,
      attendance_status,
      remarks,
      students (
        id,
        student_no,
        year_level,
        section,
        profiles (
          id,
          first_name,
          last_name,
          middle_name,
          email
        )
      )
    `)
    .eq('session_id', session_id)
    .order('scan_time', { ascending: true });

  if (recordsError) {
    throw new AppError(
      'Failed to fetch attendance records',
      500,
      'FETCH_RECORDS_FAILED',
      recordsError.message
    );
  }

  return {
    session,
    records
  };
}

async function getSessionRecordsForExport({
  teacher_profile_id,
  session_id
}) {
  const teacher = await getTeacherByProfileId(teacher_profile_id);

  const { data: session, error: sessionError } = await supabaseAdmin
    .from('attendance_sessions')
    .select(`
      *,
      subjects (
        id,
        subject_code,
        subject_name,
        section,
        semester,
        school_year
      ),
      teachers (
        id,
        profiles (
          id,
          first_name,
          last_name
        )
      )
    `)
    .eq('id', session_id)
    .eq('teacher_id', teacher.id)
    .single();

  if (sessionError || !session) {
    throw new AppError('Session not found or not owned by teacher', 404, 'SESSION_NOT_FOUND');
  }

  const { data: records, error: recordsError } = await supabaseAdmin
    .from('attendance_records')
    .select(`
      id,
      scan_time,
      attendance_status,
      remarks,
      students (
        id,
        student_no,
        year_level,
        section,
        profiles (
          id,
          first_name,
          last_name,
          middle_name
        )
      )
    `)
    .eq('session_id', session_id)
    .order('scan_time', { ascending: true });

  if (recordsError) {
    throw new AppError(
      'Failed to fetch attendance records',
      500,
      'FETCH_RECORDS_FAILED',
      recordsError.message
    );
  }

  return {
    session,
    records
  };
}

async function getDeviceActiveSession() {

  const { data: session, error } = await supabaseAdmin
    .from('attendance_sessions')
    .select(`
      id,
      teacher_id,
      subjects (
        subject_code,
        subject_name,
        section
      )
    `)
    .eq('status', 'active')
    .limit(1)
    .single();

  if (error || !session) {
    return null;
  }

  // get teacher info
  const { data: teacher } = await supabaseAdmin
    .from('teachers')
    .select('profile_id')
    .eq('id', session.teacher_id)
    .single();

  if (!teacher) {
    return null;
  }

  // get teacher RFID
  const { data: rfid } = await supabaseAdmin
    .from('rfid_cards')
    .select('uid')
    .eq('profile_id', teacher.profile_id)
    .eq('is_active', true)
    .single();

  return {
    id: session.id,
    subject: session.subjects,
    teacher_rfid_uid: rfid ? rfid.uid : null
  };

}

module.exports = {
  startAttendanceSession,
  getMyActiveSessions,
  getMySessionHistory,
  getDeviceActiveSession,
  scanAttendance,
  endAttendanceSession,
  getSessionRecords,
  getSessionRecordsForExport
};