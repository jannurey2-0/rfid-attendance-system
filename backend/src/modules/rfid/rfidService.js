const { supabaseAdmin } = require('../../config/supabase');
const AppError = require('../../utils/AppError');

async function assignCardToProfile({ uid, profile_id, assigned_by, entity_type = 'profile' }) {
  const cleanUid = String(uid).trim();

  if (!cleanUid) {
    throw new AppError('RFID UID is required', 400, 'RFID_UID_REQUIRED');
  }

  const { data: existingUid, error: uidCheckError } = await supabaseAdmin
    .from('rfid_cards')
    .select('*')
    .eq('uid', cleanUid)
    .maybeSingle();

  if (uidCheckError) {
    throw new AppError(
      'Failed to check RFID UID',
      500,
      'RFID_UID_CHECK_FAILED',
      uidCheckError.message
    );
  }

  if (existingUid) {
    throw new AppError(
      'RFID UID is already assigned to another user',
      409,
      'RFID_ALREADY_ASSIGNED'
    );
  }

  const { data: existingProfileCard, error: profileCardCheckError } = await supabaseAdmin
    .from('rfid_cards')
    .select('*')
    .eq('profile_id', profile_id)
    .maybeSingle();

  if (profileCardCheckError) {
    throw new AppError(
      'Failed to check existing RFID card for user',
      500,
      'PROFILE_CARD_CHECK_FAILED',
      profileCardCheckError.message
    );
  }

  if (existingProfileCard) {
    throw new AppError(
      'This user already has an assigned RFID card',
      409,
      'PROFILE_ALREADY_HAS_RFID'
    );
  }

  const { data, error } = await supabaseAdmin
    .from('rfid_cards')
    .insert([
      {
        uid: cleanUid,
        profile_id,
        assigned_by,
        is_active: true
      }
    ])
    .select()
    .single();

  if (error) {
    throw new AppError(
      'RFID assignment failed',
      500,
      'RFID_ASSIGNMENT_FAILED',
      error.message
    );
  }

  await supabaseAdmin.from('activity_logs').insert([
    {
      actor_profile_id: assigned_by,
      action_type: 'ASSIGN_RFID',
      entity_type,
      entity_id: data.id,
      details: {
        uid: cleanUid,
        profile_id
      }
    }
  ]);

  return data;
}

async function assignCardToTeacher({ uid, teacher_id, assigned_by }) {
  const { data: teacher, error: teacherError } = await supabaseAdmin
    .from('teachers')
    .select(`
      id,
      profile_id,
      profiles (
        id,
        first_name,
        last_name,
        email,
        role,
        status
      )
    `)
    .eq('id', teacher_id)
    .single();

  if (teacherError || !teacher) {
    throw new AppError('Teacher not found', 404, 'TEACHER_NOT_FOUND');
  }

  return assignCardToProfile({
    uid,
    profile_id: teacher.profile_id,
    assigned_by,
    entity_type: 'teacher_rfid'
  });
}

async function assignCardToStudent({ uid, student_id, assigned_by }) {
  const { data: student, error: studentError } = await supabaseAdmin
    .from('students')
    .select(`
      id,
      profile_id,
      student_no,
      profiles (
        id,
        first_name,
        last_name,
        email,
        role,
        status
      )
    `)
    .eq('id', student_id)
    .single();

  if (studentError || !student) {
    throw new AppError('Student not found', 404, 'STUDENT_NOT_FOUND');
  }

  return assignCardToProfile({
    uid,
    profile_id: student.profile_id,
    assigned_by,
    entity_type: 'student_rfid'
  });
}

async function getTeacherRfidList() {
  const { data, error } = await supabaseAdmin
    .from('teachers')
    .select(`
      id,
      profile_id,
      employee_no,
      department,
      created_at,
      profiles (
        id,
        first_name,
        last_name,
        middle_name,
        email,
        status
      )
    `)
    .order('created_at', { ascending: false });

  if (error) {
    throw new AppError(
      'Failed to fetch teacher RFID list',
      500,
      'FETCH_TEACHER_RFID_FAILED',
      error.message
    );
  }

  const profileIds = data.map((teacher) => teacher.profile_id);

  let cards = [];
  if (profileIds.length > 0) {
    const { data: cardData, error: cardError } = await supabaseAdmin
      .from('rfid_cards')
      .select('*')
      .in('profile_id', profileIds);

    if (cardError) {
      throw new AppError(
        'Failed to fetch teacher RFID cards',
        500,
        'FETCH_TEACHER_RFID_CARDS_FAILED',
        cardError.message
      );
    }

    cards = cardData || [];
  }

  return data.map((teacher) => {
    const card = cards.find(c => c.profile_id === teacher.profile_id);

    return {
      teacher_id: teacher.id,
      profile_id: teacher.profile_id,
      employee_no: teacher.employee_no,
      department: teacher.department,
      profile: teacher.profiles,
      rfid_card: card || null
    };
  });
}

async function getStudentRfidList() {
  const { data, error } = await supabaseAdmin
    .from('students')
    .select(`
      id,
      profile_id,
      student_no,
      year_level,
      section,
      created_at,
      profiles (
        id,
        first_name,
        last_name,
        middle_name,
        email,
        status
      )
    `)
    .order('created_at', { ascending: false });

  if (error) {
    throw new AppError(
      'Failed to fetch student RFID list',
      500,
      'FETCH_STUDENT_RFID_FAILED',
      error.message
    );
  }

  const profileIds = data.map((student) => student.profile_id);

  let cards = [];
  if (profileIds.length > 0) {
    const { data: cardData, error: cardError } = await supabaseAdmin
      .from('rfid_cards')
      .select('*')
      .in('profile_id', profileIds);

    if (cardError) {
      throw new AppError(
        'Failed to fetch student RFID cards',
        500,
        'FETCH_STUDENT_RFID_CARDS_FAILED',
        cardError.message
      );
    }

    cards = cardData || [];
  }

  return data.map((student) => {
    const card = cards.find(c => c.profile_id === student.profile_id);

    return {
      student_id: student.id,
      profile_id: student.profile_id,
      student_no: student.student_no,
      year_level: student.year_level,
      section: student.section,
      profile: student.profiles,
      rfid_card: card || null
    };
  });
}

module.exports = {
  assignCardToTeacher,
  assignCardToStudent,
  getTeacherRfidList,
  getStudentRfidList
};