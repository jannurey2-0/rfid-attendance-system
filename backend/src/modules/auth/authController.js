const {
  loginWithEmail,
  getProfileByAuthUserId,
  loginWithRfid
} = require('./authService');

const { sendSuccess } = require('../../utils/response');
const AppError = require('../../utils/AppError');

async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      throw new AppError('Email and password are required', 400, 'MISSING_CREDENTIALS');
    }

    const authData = await loginWithEmail(email, password);

    const user = authData.user;
    const session = authData.session;

    if (!user) {
      throw new AppError('Invalid login', 401, 'INVALID_LOGIN');
    }

    const profile = await getProfileByAuthUserId(user.id);

    if (profile.status !== 'active') {
      throw new AppError('Account is inactive', 403, 'ACCOUNT_INACTIVE');
    }

    return sendSuccess(res, 'Login successful', {
      user: {
        id: user.id,
        email: user.email
      },
      profile,
      session: {
        access_token: session.access_token,
        refresh_token: session.refresh_token
      }
    });
  } catch (error) {
    next(error);
  }
}

async function rfidLogin(req, res, next) {
  try {
    const { uid } = req.body;

    if (!uid) {
      throw new AppError('uid is required', 400, 'UID_REQUIRED');
    }

    const result = await loginWithRfid(uid);

    return sendSuccess(res, 'RFID login successful', result);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  login,
  rfidLogin
};