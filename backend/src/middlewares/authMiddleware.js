const { supabaseAdmin } = require('../config/supabase');
const AppError = require('../utils/AppError');

async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError(
        'Missing or invalid authorization header',
        401,
        'INVALID_AUTH_HEADER'
      );
    }

    const token = authHeader.split(' ')[1];

    const {
      data: { user },
      error: authError
    } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      throw new AppError('Invalid or expired token', 401, 'INVALID_TOKEN');
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('auth_user_id', user.id)
      .single();

    if (profileError || !profile) {
      throw new AppError('Profile not found', 404, 'PROFILE_NOT_FOUND');
    }

    if (profile.status !== 'active') {
      throw new AppError('Account is inactive', 403, 'ACCOUNT_INACTIVE');
    }

    req.user = {
      authUser: user,
      profile
    };

    next();
  } catch (error) {
    next(error);
  }
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.profile.role !== 'admin') {
    return next(new AppError('Admin access required', 403, 'ADMIN_ACCESS_REQUIRED'));
  }

  next();
}

function requireTeacher(req, res, next) {
  if (!req.user || req.user.profile.role !== 'teacher') {
    return next(new AppError('Teacher access required', 403, 'TEACHER_ACCESS_REQUIRED'));
  }

  next();
}

module.exports = {
  requireAuth,
  requireAdmin,
  requireTeacher
};