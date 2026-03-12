const { supabaseAdmin } = require('../../config/supabase');
const AppError = require('../../utils/AppError');

async function createTeacherAccount({
  first_name,
  last_name,
  middle_name,
  email,
  password,
  employee_no,
  department,
  created_by
}) {
  const { data: authData, error: authError } =
    await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    });

  if (authError) {
    throw new AppError(
      'Auth user creation failed',
      500,
      'AUTH_USER_CREATION_FAILED',
      authError.message
    );
  }

  const authUser = authData.user;

  const { data: profileData, error: profileError } = await supabaseAdmin
    .from('profiles')
    .insert([
      {
        auth_user_id: authUser.id,
        role: 'teacher',
        first_name,
        last_name,
        middle_name: middle_name || null,
        email,
        status: 'active'
      }
    ])
    .select()
    .single();

  if (profileError) {
    await supabaseAdmin.auth.admin.deleteUser(authUser.id);

    if (profileError.code === '23505') {
      throw new AppError('Teacher email already exists', 409, 'EMAIL_ALREADY_EXISTS');
    }

    throw new AppError(
      'Profile creation failed',
      500,
      'PROFILE_CREATION_FAILED',
      profileError.message
    );
  }

  const { data: teacherData, error: teacherError } = await supabaseAdmin
    .from('teachers')
    .insert([
      {
        profile_id: profileData.id,
        employee_no,
        department: department || null
      }
    ])
    .select()
    .single();

  if (teacherError) {
    await supabaseAdmin.from('profiles').delete().eq('id', profileData.id);
    await supabaseAdmin.auth.admin.deleteUser(authUser.id);

    if (teacherError.code === '23505') {
      throw new AppError('Employee number already exists', 409, 'EMPLOYEE_NO_ALREADY_EXISTS');
    }

    throw new AppError(
      'Teacher record creation failed',
      500,
      'TEACHER_CREATION_FAILED',
      teacherError.message
    );
  }

  await supabaseAdmin.from('activity_logs').insert([
    {
      actor_profile_id: created_by,
      action_type: 'CREATE_TEACHER',
      entity_type: 'teacher',
      entity_id: teacherData.id,
      details: {
        email,
        employee_no
      }
    }
  ]);

  return {
    auth_user_id: authUser.id,
    profile: profileData,
    teacher: teacherData
  };
}

async function getAllTeachers() {
  const { data, error } = await supabaseAdmin
    .from('teachers')
    .select(`
      id,
      employee_no,
      department,
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
      'Failed to fetch teachers',
      500,
      'FETCH_TEACHERS_FAILED',
      error.message
    );
  }

  return data;
}

module.exports = {
  createTeacherAccount,
  getAllTeachers
};