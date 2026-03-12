const { supabaseAdmin } = require('../../config/supabase');
const AppError = require('../../utils/AppError');

async function createStudent({
  first_name,
  last_name,
  middle_name,
  email,
  student_no,
  year_level,
  section,
  created_by
}) {
  const { data: profileData, error: profileError } = await supabaseAdmin
    .from('profiles')
    .insert([
      {
        auth_user_id: null,
        role: 'student',
        first_name,
        last_name,
        middle_name: middle_name || null,
        email: email || null,
        status: 'active'
      }
    ])
    .select()
    .single();

  if (profileError) {
    if (profileError.code === '23505') {
      throw new AppError('Student email already exists', 409, 'EMAIL_ALREADY_EXISTS');
    }

    throw new AppError(
      'Profile creation failed',
      500,
      'PROFILE_CREATION_FAILED',
      profileError.message
    );
  }

  const { data: studentData, error: studentError } = await supabaseAdmin
    .from('students')
    .insert([
      {
        profile_id: profileData.id,
        student_no,
        year_level: year_level || null,
        section: section || null
      }
    ])
    .select()
    .single();

  if (studentError) {
    await supabaseAdmin.from('profiles').delete().eq('id', profileData.id);

    if (studentError.code === '23505') {
      throw new AppError('Student number already exists', 409, 'STUDENT_NO_ALREADY_EXISTS');
    }

    throw new AppError(
      'Student creation failed',
      500,
      'STUDENT_CREATION_FAILED',
      studentError.message
    );
  }

  await supabaseAdmin.from('activity_logs').insert([
    {
      actor_profile_id: created_by,
      action_type: 'CREATE_STUDENT',
      entity_type: 'student',
      entity_id: studentData.id,
      details: {
        student_no,
        email: email || null
      }
    }
  ]);

  return {
    profile: profileData,
    student: studentData
  };
}

async function getMyStudents() {
  const { data, error } = await supabaseAdmin
    .from('students')
    .select(`
      id,
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
        status,
        role
      )
    `)
    .order('created_at', { ascending: false });

  if (error) {
    throw new AppError(
      'Failed to fetch students',
      500,
      'FETCH_STUDENTS_FAILED',
      error.message
    );
  }

  return data;
}

module.exports = {
  createStudent,
  getMyStudents
};