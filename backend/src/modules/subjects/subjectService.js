const { supabaseAdmin } = require('../../config/supabase');
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

async function createSubject({
  teacher_profile_id,
  subject_code,
  subject_name,
  section,
  semester,
  school_year,
  schedule_info
}) {
  const teacher = await getTeacherByProfileId(teacher_profile_id);

  const { data, error } = await supabaseAdmin
    .from('subjects')
    .insert([
      {
        teacher_id: teacher.id,
        subject_code,
        subject_name,
        section: section || null,
        semester: semester || null,
        school_year: school_year || null,
        schedule_info: schedule_info || null,
        is_active: true
      }
    ])
    .select()
    .single();

  if (error) {
    throw new AppError(
      'Subject creation failed',
      500,
      'SUBJECT_CREATION_FAILED',
      error.message
    );
  }

  await supabaseAdmin.from('activity_logs').insert([
    {
      actor_profile_id: teacher_profile_id,
      action_type: 'CREATE_SUBJECT',
      entity_type: 'subject',
      entity_id: data.id,
      details: {
        subject_code,
        subject_name,
        section,
        semester,
        school_year
      }
    }
  ]);

  return data;
}

async function getMySubjects(teacher_profile_id) {
  const teacher = await getTeacherByProfileId(teacher_profile_id);

  const { data, error } = await supabaseAdmin
    .from('subjects')
    .select('*')
    .eq('teacher_id', teacher.id)
    .order('created_at', { ascending: false });

  if (error) {
    throw new AppError(
      'Failed to fetch subjects',
      500,
      'FETCH_SUBJECTS_FAILED',
      error.message
    );
  }

  return data;
}

async function enrollStudentToSubject({
  teacher_profile_id,
  subject_id,
  student_id
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

  const { data: student, error: studentError } = await supabaseAdmin
    .from('students')
    .select('*')
    .eq('id', student_id)
    .single();

  if (studentError || !student) {
    throw new AppError('Student not found', 404, 'STUDENT_NOT_FOUND');
  }

  const { data, error } = await supabaseAdmin
    .from('subject_enrollments')
    .insert([
      {
        subject_id,
        student_id,
        status: 'enrolled'
      }
    ])
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      throw new AppError(
        'Student is already enrolled in this subject',
        409,
        'STUDENT_ALREADY_ENROLLED'
      );
    }

    throw new AppError(
      'Enrollment failed',
      500,
      'ENROLLMENT_FAILED',
      error.message
    );
  }

  await supabaseAdmin.from('activity_logs').insert([
    {
      actor_profile_id: teacher_profile_id,
      action_type: 'ENROLL_STUDENT',
      entity_type: 'subject_enrollment',
      entity_id: data.id,
      details: {
        subject_id,
        student_id
      }
    }
  ]);

  return data;
}

async function getStudentsBySubject({
  teacher_profile_id,
  subject_id
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

  const { data, error } = await supabaseAdmin
    .from('subject_enrollments')
    .select(`
      id,
      enrolled_at,
      status,
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
          email,
          status
        )
      )
    `)
    .eq('subject_id', subject_id)
    .order('enrolled_at', { ascending: false });

  if (error) {
    throw new AppError(
      'Failed to fetch enrolled students',
      500,
      'FETCH_ENROLLED_STUDENTS_FAILED',
      error.message
    );
  }

  return data;
}

module.exports = {
  createSubject,
  getMySubjects,
  enrollStudentToSubject,
  getStudentsBySubject
};