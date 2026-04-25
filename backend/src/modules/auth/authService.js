const { supabase, supabaseAdmin } = require('../../config/supabase');
const AppError = require('../../utils/AppError');
const jwt = require('jsonwebtoken');

async function loginWithEmail(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    throw new AppError('Invalid login credentials', 401, 'INVALID_CREDENTIALS');
  }

  return data;
}

async function getProfileByAuthUserId(authUserId) {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('auth_user_id', authUserId)
    .single();

  if (error || !data) {
    throw new AppError('Profile not found', 404, 'PROFILE_NOT_FOUND');
  }

  return data;
}

function generateSupabaseCompatibleToken(authUserId) {
  const payload = {
    sub: authUserId,
    role: 'authenticated',
    aud: 'authenticated'
  };

  const token = jwt.sign(payload, process.env.SUPABASE_JWT_SECRET, {
    expiresIn: '8h'
  });

  return token;
}

async function loginWithRfid(uid) {
  const cleanUid = String(uid).trim();

  if (!cleanUid) {
    throw new AppError('RFID UID is required', 400, 'RFID_UID_REQUIRED');
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

  if (profile.status !== 'active') {
    throw new AppError('Account is inactive', 403, 'ACCOUNT_INACTIVE');
  }

  if (profile.role !== 'teacher') {
    throw new AppError(
      'RFID login is only allowed for teacher accounts in this step',
      403,
      'INVALID_RFID_LOGIN_ROLE'
    );
  }

  const { data: teacher, error: teacherError } = await supabaseAdmin
    .from('teachers')
    .select('*')
    .eq('profile_id', profile.id)
    .single();

  if (teacherError || !teacher) {
    throw new AppError('Teacher record not found', 404, 'TEACHER_NOT_FOUND');
  }

  await supabaseAdmin
    .from('rfid_cards')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', card.id);

  await supabaseAdmin.from('activity_logs').insert([
    {
      actor_profile_id: profile.id,
      action_type: 'RFID_LOGIN',
      entity_type: 'profile',
      entity_id: profile.id,
      details: {
        uid: cleanUid,
        role: profile.role
      }
    }
  ]);

  const accessToken = generateSupabaseCompatibleToken(profile.auth_user_id);

  return {
    profile,
    teacher,
    rfid_card: {
      id: card.id,
      uid: card.uid,
      last_used_at: card.last_used_at
    },
    session: {
      access_token: accessToken,
      refresh_token: null
    }
  };
}

module.exports = {
  loginWithEmail,
  getProfileByAuthUserId,
  loginWithRfid
};